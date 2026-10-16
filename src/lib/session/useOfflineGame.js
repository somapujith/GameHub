// Offline (vs bots) game session. Runs the engine locally, drives the bots, auto-saves after every
// action and exposes the `session` interface that GameView consumes (see docs/CONTRACT.md section 6).
//
//   useOfflineGame({ config: { players, settings, seed }, resume?: { state }, chapterId? }) -> session

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createGame, applyAction, getOptions, nextBotMove, standings } from '@shared/index.js';
import { usePresenter } from './usePresenter.js';
import { saveGame, clearGame } from '../storage.js';
import { pickLine } from '../voiceLines.js';
import { voice } from '../voice.js';

/** Every action key blanked (used while the presenter is busy and when the game is over). */
const NO_OPTIONS = Object.freeze({
  roll: false,
  bail: false,
  buy: false,
  skipBuy: false,
  endTurn: false,
  upgrade: Object.freeze([]),
  bid: null,
  resign: false,
  mortgage: Object.freeze([]),
  unmortgage: Object.freeze([]),
  sellBuilding: Object.freeze([]),
  debt: null,
  payDebt: false,
  useJailCard: false,
  trade: Object.freeze({ canOffer: false }),
  tradeOffer: null,
  tradeSent: null,
  sets: Object.freeze([]),
});
const NO_CHAT = Object.freeze([]);
const EMOTES = ['emote_mass', 'emote_cheer', 'emote_shock', 'emote_laugh', 'emote_thanks', 'emote_hurry', 'emote_taunt'];
/** `config.speed` -> multiplier on every presenter delay and on the bots' think time. */
export const SPEED_MUL = { relaxed: 1.4, normal: 1, fast: 0.5 };

/**
 * How long a bot "thinks" before acting, at normal speed (ms). The opening roll of a turn gets the
 * longest pause; the follow-ups of the same turn (buy / skip / build / end turn) are quick because
 * the human has nothing to decide while a bot plays. Answers the human is waiting on keep their pace.
 */
function thinkDelay(type, humanOut) {
  if (humanOut) return 250; // only bots left: speed the match along
  switch (type) {
    case 'ROLL':
      return 450 + Math.random() * 250;
    case 'UPGRADE':
      return 200; // bots often build several levels in a row
    case 'TRADE_OFFER':
      return 700 + Math.random() * 400; // the human has to read and decide
    case 'TRADE_ACCEPT':
    case 'TRADE_REJECT':
      return 600;
    case 'BID':
      return 350;
    case 'MORTGAGE':
    case 'UNMORTGAGE':
    case 'SELL_BUILDING':
    case 'PAY_DEBT':
      return 450;
    default:
      return 250; // BUY, SKIP_BUY, END_TURN, PAY_BAIL, ...
  }
}

const BOT_REPLY_P = 0.3;
const BOT_REPLY_DELAY = 1500;
const START_VOICE_DELAY = 800;
const CHAT_MIN_GAP = 350;

const devWarn = (...args) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) console.warn('[offline]', ...args);
  } catch {
    /* ignore */
  }
};

const randSeed = () => ((Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff)) >>> 0) || 1;

/** Build the first state (new game or resumed) plus the config we keep for saves and restarts. */
function boot(config, resume) {
  const saved = resume && resume.state;
  const resumed = !!(saved && Array.isArray(saved.players) && saved.phase !== 'over');
  const players =
    (config && config.players) ||
    (saved && Array.isArray(saved.players) ? saved.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, bot: p.bot || undefined })) : []);
  const cfg = {
    players,
    settings: (config && config.settings) || (saved && saved.cfg) || undefined,
    seed: config && config.seed !== undefined && config.seed !== null ? config.seed : randSeed(),
    speed: config && Object.prototype.hasOwnProperty.call(SPEED_MUL, config.speed) ? config.speed : 'normal', // kept in saves and restarts
  };
  const state = resumed ? saved : createGame(cfg);
  const human = players.find((p) => !p.isBot) || players[0];
  return { state, cfg, me: human ? human.id : 'me', resumed };
}

/** A harmless action for a stuck bot (used only if the bot's own choice was rejected). */
function fallbackBotAction(view) {
  // A pending trade can only be answered by its recipient (or cancelled by the sender).
  if (view.trade) {
    const to = view.players.find((p) => p.id === view.trade.to);
    return to && to.isBot && !to.bankrupt ? { type: 'TRADE_REJECT', playerId: to.id } : null; // a human recipient answers themselves
  }
  if (view.phase === 'debt' && view.debt) {
    const debtor = view.players.find((p) => p.id === view.debt.player);
    return debtor && debtor.isBot && !debtor.bankrupt ? { type: 'RESIGN', playerId: debtor.id } : null;
  }
  if (view.phase === 'auction' && view.pending) {
    const bot = view.players.find((p) => p.isBot && !p.bankrupt && !(p.id in view.pending.bids));
    return bot ? { type: 'BID', amount: 0, playerId: bot.id } : null;
  }
  const tp = view.players[view.turn];
  if (!tp || !tp.isBot || tp.bankrupt) return null;
  const type = { roll: 'ROLL', buy: 'SKIP_BUY', manage: view.extraRoll ? 'ROLL' : 'END_TURN' }[view.phase];
  return type ? { type, playerId: tp.id } : null;
}

function buildResult(view, me) {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const rows = standings(view).map((r) => {
    const p = byId.get(r.id) || {};
    return { id: r.id, name: p.name, avatar: p.avatar, color: p.color, isBot: !!p.isBot, bankrupt: !!p.bankrupt, cash: r.cash, worth: r.worth, rank: r.rank };
  });
  const mine = rows.find((r) => r.id === me);
  const mp = byId.get(me);
  const maxRounds = view.cfg && view.cfg.maxRounds !== undefined ? view.cfg.maxRounds : null;
  const rounds = view.winReason === 'rounds' && maxRounds ? Math.min(view.round, maxRounds) : view.round;
  return {
    winner: view.winner,
    reason: view.winReason,
    rounds,
    maxRounds,
    standings: rows,
    me: {
      won: view.winner === me,
      rank: mine ? mine.rank : rows.length,
      worth: mine ? mine.worth : 0,
      rentEarned: mp && mp.stats ? mp.stats.rentEarned : 0,
      propertiesBought: mp && mp.stats ? mp.stats.propertiesBought : 0,
      hotelsBuilt: (mp && mp.stats && mp.stats.hotelsBuilt) || 0,
    },
  };
}

export function useOfflineGame({ config, resume, chapterId } = {}) {
  const [boot0] = useState(() => boot(config, resume));
  const me = boot0.me;

  const cfgRef = useRef(boot0.cfg);
  const chapterRef = useRef(chapterId);
  chapterRef.current = chapterId;

  const [view, setView] = useState(boot0.state);
  const viewRef = useRef(boot0.state); // always the latest authoritative state (guards stale closures)
  const [result, setResult] = useState(null);

  const speedMul = SPEED_MUL[boot0.cfg.speed] ?? 1;
  const presenter = usePresenter({ meId: me, initialState: boot0.state, speed: speedMul });
  const { enqueue, reset: resetPresenter, isBusy } = presenter;
  const busy = presenter.busy;

  const offerGuardRef = useRef({ key: null }); // last turn in which a bot proposed a trade
  const timersRef = useRef({ start: null, chat: new Set() });
  const lastChatRef = useRef(0);

  // ---- saving ----
  const persist = useCallback((state) => {
    try {
      if (state.phase === 'over') clearGame();
      else saveGame(state, { config: cfgRef.current, chapterId: chapterRef.current, me, round: state.round });
    } catch {
      /* storage problems must not stop the game */
    }
  }, [me]);

  // ---- applying actions ----
  const apply = useCallback((playerId, action) => {
    const cur = viewRef.current;
    if (!cur || cur.phase === 'over') return false;
    let res;
    try {
      res = applyAction(cur, { ...action, playerId });
    } catch (err) {
      devWarn('applyAction threw', action, err);
      return false;
    }
    if (!res || res.error) {
      devWarn('invalid action', action, res && res.error);
      return false;
    }
    viewRef.current = res.state;
    enqueue(res.events, res.state); // sets busy synchronously, before the new view renders
    setView(res.state);
    persist(res.state);
    return true;
  }, [enqueue, persist]);

  const dispatch = useCallback((action) => {
    if (!action || typeof action !== 'object' || isBusy()) return false;
    return apply(me, action);
  }, [apply, isBusy, me]);

  // ---- bots ----
  useEffect(() => {
    if (busy || view.phase === 'over') return undefined;
    let action = null;
    try {
      action = nextBotMove(view);
    } catch (err) {
      devWarn('nextBotMove threw', err);
    }
    if (!action) return undefined; // a human must act (bid, answer a trade offer, settle a debt, ...)

    // A bot proposes at most one trade per turn, so a human who keeps declining never causes a loop.
    const offerKey = `${view.turnCount}:${action.playerId}`;
    if (action.type === 'TRADE_OFFER' && offerGuardRef.current.key === offerKey) {
      action = fallbackBotAction(view);
      if (!action) return undefined;
    }

    const human = view.players.find((p) => p.id === me);
    const humanOut = !human || human.bankrupt; // only bots left: speed the match along
    const delay = thinkDelay(action.type, humanOut) * speedMul;

    const scheduledFor = view;
    const chosen = action;
    const timer = setTimeout(() => {
      if (viewRef.current !== scheduledFor || isBusy()) return; // something changed meanwhile
      const pid = chosen.playerId !== undefined ? chosen.playerId : scheduledFor.players[scheduledFor.turn].id;
      if (apply(pid, chosen)) {
        if (chosen.type === 'TRADE_OFFER') offerGuardRef.current = { key: offerKey };
        return;
      }
      const fb = fallbackBotAction(scheduledFor);
      if (fb && fb.playerId !== undefined) apply(fb.playerId, fb);
    }, delay);
    return () => clearTimeout(timer);
  }, [view, busy, me, apply, isBusy, speedMul]);

  // ---- result (after the win presentation has finished) ----
  useEffect(() => {
    if (result || view.phase !== 'over' || busy) return;
    setResult(buildResult(view, me));
  }, [view, busy, result, me]);

  // ---- voice: game start, soundboard ----
  const scheduleStartVoice = useCallback(() => {
    clearTimeout(timersRef.current.start);
    timersRef.current.start = setTimeout(() => {
      try {
        const line = pickLine('game_start');
        if (line) voice.speak(line, { priority: 'normal' });
      } catch {
        /* ignore */
      }
    }, START_VOICE_DELAY);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    if (!boot0.resumed) scheduleStartVoice();
    return () => {
      clearTimeout(timers.start);
      timers.chat.forEach((t) => clearTimeout(t));
      timers.chat.clear();
      try {
        voice.stop();
      } catch {
        /* ignore */
      }
    };
  }, [boot0.resumed, scheduleStartVoice]);

  const sendChat = useCallback((text, emote) => {
    if (typeof emote !== 'string' || !emote.startsWith('emote_')) return; // offline: only the soundboard
    const now = Date.now();
    if (now - lastChatRef.current < CHAT_MIN_GAP) return;
    lastChatRef.current = now;
    let mine = null;
    try {
      mine = pickLine(emote);
      if (mine) voice.speak(mine, { priority: 'high' });
    } catch {
      /* ignore */
    }
    const cur = viewRef.current;
    const botsLeft = cur.players.some((p) => p.isBot && !p.bankrupt);
    if (botsLeft && Math.random() < BOT_REPLY_P) {
      const others = EMOTES.filter((e) => e !== emote);
      const reply = others[Math.floor(Math.random() * others.length)];
      const t = setTimeout(() => {
        timersRef.current.chat.delete(t);
        try {
          const line = pickLine(reply, { avoid: mine ? [mine.id] : [] });
          if (line) voice.whenIdle().then(() => voice.speak(line, { priority: 'normal' }));
        } catch {
          /* ignore */
        }
      }, BOT_REPLY_DELAY);
      timersRef.current.chat.add(t);
    }
  }, []);

  // ---- restart / quit ----
  const restart = useCallback(() => {
    const cfg = { ...cfgRef.current, seed: randSeed() };
    cfgRef.current = cfg;
    const state = createGame(cfg);
    timersRef.current.chat.forEach((t) => clearTimeout(t));
    timersRef.current.chat.clear();
    viewRef.current = state;
    offerGuardRef.current = { key: null };
    resetPresenter(state);
    setView(state);
    setResult(null);
    clearGame();
    scheduleStartVoice();
  }, [resetPresenter, scheduleStartVoice]);

  const quit = useCallback(() => {
    clearGame();
    try {
      voice.stop();
    } catch {
      /* ignore */
    }
  }, []);

  // ---- what the UI may do right now ----
  const options = useMemo(() => {
    if (busy || view.phase === 'over') return NO_OPTIONS;
    try {
      return getOptions(view, me) || NO_OPTIONS;
    } catch {
      return NO_OPTIONS;
    }
  }, [view, busy, me]);

  return useMemo(() => ({
    mode: 'offline',
    me,
    view,
    display: presenter.display,
    busy,
    rolling: presenter.rolling,
    bubble: presenter.bubble,
    stageTile: presenter.stageTile,
    log: presenter.log,
    options,
    dispatch,
    chat: NO_CHAT,
    sendChat,
    result,
    connection: 'local',
    restart,
    quit,
    chapterId,
  }), [me, view, presenter.display, busy, presenter.rolling, presenter.bubble, presenter.stageTile, presenter.log, options, dispatch, sendChat, result, restart, quit, chapterId]);
}

export default useOfflineGame;
