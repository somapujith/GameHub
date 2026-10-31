// The presenter: replays engine events with timing (dice roll, pawn steps, cash changes, card
// reveal, auction result...) on top of a `display` copy of the game state, fires sound effects,
// builds the centre-stage bubble and the log, then snaps `display` to the authoritative state.
// Used by the online session.
//
//   usePresenter({ meId, initialState, speed = 1 }) ->
//     { display, busy, rolling, bubble, stageTile, log, enqueue(events, newState), reset(state), isBusy() }
//
// `speed` multiplies every delay (relaxed 1.4, normal 1, fast 0.5). Playback also trims itself for
// background activity (nothing the local player needs to see).
//
// The snatch window (docs/GAME_RULES.md 9) is REAL TIME: `snatch_open` only announces it and never waits, and
// the UI reads the window from `session.view`, not from this presenter's delayed `display`.
//
// The playback logic lives in `createPresenterCore` (plain JS, no React) so it can be tested with fake
// timers. The hook only subscribes React to the core's snapshots.

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BOARD_SIZE, JAIL_TILE, MAX_LEVEL } from '@shared/board.js';
import { sfx } from '../sfx.js';
import { CARD_CLIPS, playCardClip } from '../cardClips.js';
import { describeEvent } from '../messages.js';
import { loadSettings } from '../storage.js';

const LOG_CAP = 200;

const LONG_TRIP = 12; // a pawn move longer than this many squares hops faster so the whole trip stays short

/** Base delays in ms (scaled down when reduced motion is on or the queue is backed up). */
const T = {
  dice: 900,
  afterDice: 620,
  step: 260, // one tile: lift, carry, set down (the pawn animation in board.css spans this time)
  teleportPre: 220,
  teleport: 300,
  land: 380,
  rentOut: 520,
  rentIn: 240,
  cash: 380,
  own: 520,
  quiet: 120,
  level: 600,
  jail: 850,
  jailStay: 1000,
  card: 2200,
  auctionStart: 900,
  auctionEnd: 1500,
  snatchEnd: 1100,
  bankrupt: 1300,
  round: 1000,
  finalRound: 1700,
  win: 3200,
  setComplete: 1100,
  mortgage: 650,
  trade: 800,
  debt: 1000,
  cityEvent: 1200,
  trap: 800,
};

/**
 * Pacing trims for "background" playback: other players acting while the local player has nothing to decide.
 * A multiplier on the base delay above (events missing here keep full length).
 */
const QUICK = {
  dice: 0.75,
  afterDice: 0.4,
  step: 0.7,
  teleportPre: 0.6,
  teleport: 0.6,
  land: 0.5,
  rentOut: 0.75,
  rentIn: 0.6,
  cash: 0.6,
  own: 0.5,
  level: 0.5,
  jail: 0.7,
  jailStay: 0.7,
  card: 0.42,
  snatchEnd: 0.6,
  round: 0.7,
  finalRound: 0.7,
  mortgage: 0.7,
  quiet: 0.6,
};

/** Events the human should always get to see at full pacing, whoever caused them. */
const NEEDS_ATTENTION = new Set([
  'win', 'bankrupt', 'debt', 'set_complete',
  'auction_start', 'auction_end', 'snatch_open', 'snatch_end',
  'trade_offer', 'trade_done', 'trade_rejected', 'city_event', 'trap_sprung',
]);

let uid = 0;
const nextId = () => {
  uid += 1;
  return uid;
};

const devWarn = (...args) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) console.warn('[presenter]', ...args);
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------------------------
// State -> display
// ---------------------------------------------------------------------------------------------

const EMPTY_OWNERS = Object.freeze(Array(BOARD_SIZE).fill(null));
const EMPTY_LEVELS = Object.freeze(Array(BOARD_SIZE).fill(0));
const EMPTY_MORTGAGED = Object.freeze(Array(BOARD_SIZE).fill(false));

/**
 * The animated view of an engine state. `cfg` mirrors `state.cfg` (maxRounds is number|null);
 * `mortgaged`, `debt` and `trade` mirror the state; `assist` is the last dice roll's assist (or null).
 */
export function displayFromState(state) {
  if (!state || !Array.isArray(state.players)) {
    return {
      players: [], owners: [...EMPTY_OWNERS], levels: [...EMPTY_LEVELS], mortgaged: [...EMPTY_MORTGAGED], turn: 0, round: 1, dice: [0],
      phase: 'roll', goal: 0, cfg: {}, winner: null, lastCash: null, assist: null, assistPlayer: null, debt: null, trade: null, event: null,
    };
  }
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      cash: p.cash,
      pos: p.pos,
      jailTurns: p.jailTurns || 0,
      bankrupt: !!p.bankrupt,
      snatches: p.snatches ?? 0, // Snatch tokens left (public)
      traps: p.traps ?? 0, // traps still in hand (public; where they are placed is secret)
      laps: p.laps ?? 0, // times passed START (public; every 3rd earns a token)
    })),
    owners: Array.isArray(state.owners) ? state.owners.slice() : [...EMPTY_OWNERS],
    levels: Array.isArray(state.levels) ? state.levels.slice() : [...EMPTY_LEVELS],
    mortgaged: Array.isArray(state.mortgaged) ? state.mortgaged.map(Boolean) : [...EMPTY_MORTGAGED],
    turn: state.turn || 0,
    round: state.round || 1,
    dice: Array.isArray(state.dice) ? [...state.dice] : [0],
    phase: state.phase || 'roll',
    goal: state.cfg && state.cfg.goal !== undefined ? state.cfg.goal : 0,
    cfg: state.cfg ? { ...state.cfg } : {},
    winner: state.winner ?? null,
    lastCash: null,
    assist: null,
    assistPlayer: null,
    debt: state.debt ? { ...state.debt } : null,
    trade: state.trade ? { ...state.trade } : null,
    event: state.event ? { ...state.event } : null, // the city event of this round (public)
  };
}

/** Centre-stage tile for a freshly loaded state: where the player to move is standing. */
function stageFor(state) {
  const p = state && Array.isArray(state.players) ? state.players[state.turn] : null;
  return p && Number.isInteger(p.pos) ? p.pos : 0;
}

function makeSnapshot(state) {
  return { display: displayFromState(state), busy: false, rolling: false, bubble: null, stageTile: stageFor(state), log: [] };
}

const setAt = (arr, i, v) => {
  const next = arr.slice();
  next[i] = v;
  return next;
};

// ---------------------------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------------------------

/** `speed` is a delay multiplier: 1 = normal, 1.4 = relaxed, 0.5 = fast. */
const clampSpeed = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(3, Math.max(0.1, n)) : 1;
};

export function createPresenterCore({ meId, initialState, speed: speedOpt = 1, deps } = {}) {
  const D = { sfx, playCardClip, describeEvent, loadSettings, ...(deps || {}) };

  let me = meId;
  let S = makeSnapshot(initialState);
  const listeners = new Set();

  let epoch = 0; // bumped by reset()/dispose(): in-flight playback notices and stops
  let pending = 0; // enqueue() calls not finished yet (the playing one included)
  let chain = Promise.resolve();
  let disposed = false;
  let reducedNow = false;
  let speedMul = clampSpeed(speedOpt);
  let quickNow = false; // the item being played is background activity (see QUICK)
  let itemEvents = []; // the events of the item being played (lets a buy see that a snatch window follows it)
  const timers = new Set();

  // ---- store plumbing ----
  function commit(patch) {
    S = { ...S, ...patch };
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        /* ignore */
      }
    });
  }
  const patchDisplay = (fn) => commit({ display: fn(S.display) });
  const patchPlayer = (id, fn) =>
    patchDisplay((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }));
  const setPos = (id, pos) => patchPlayer(id, () => ({ pos }));

  // ---- timing ----
  function sleep(ms) {
    return new Promise((resolve) => {
      if (!(ms > 0)) {
        resolve();
        return;
      }
      const t = { resolve, id: null };
      t.id = setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });
  }
  function flushTimers() {
    for (const t of timers) {
      clearTimeout(t.id);
      t.resolve();
    }
    timers.clear();
  }
  function reducedMotion() {
    try {
      if (D.loadSettings().reducedMotion) return true;
    } catch {
      /* ignore */
    }
    try {
      return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }
  const waiting = () => Math.max(0, pending - 1);
  /** True when more than 3 enqueues are queued behind the one playing: hurry up and stay quiet. */
  const backedUp = () => waiting() > 3;
  /** Overall delay multiplier: user speed setting, then catch-up and reduced-motion limits. */
  function speed() {
    const w = waiting();
    let f = speedMul;
    if (w > 8) f = Math.min(f, 0.05);
    else if (w > 3) f = Math.min(f, 0.3);
    if (reducedNow) f = Math.min(f, 0.35);
    return f;
  }
  /** Base delay for `name`, trimmed when the item being played is background activity. */
  const dl = (name) => T[name] * (quickNow ? QUICK[name] ?? 1 : 1);
  /** An item is "quick" when it does not involve the local player and nothing in it needs their eyes. */
  function computeQuick(events) {
    for (const ev of events) {
      if (!ev) continue;
      if (NEEDS_ATTENTION.has(ev.type)) return false;
      if (ev.player === me || ev.other === me || ev.owner === me || ev.winner === me || ev.from === me || ev.to === me || ev.buyer === me) return false;
    }
    return true;
  }

  // ---- sound ----
  const fx = (name) => {
    if (disposed || backedUp()) return;
    try {
      D.sfx.play(name);
    } catch {
      /* ignore */
    }
  };

  // ---- bubble and log ----
  const playerOf = (ev) => {
    if (ev.player !== undefined && ev.player !== null) return ev.player;
    if (ev.owner !== undefined && ev.owner !== null) return ev.owner;
    if (ev.winner !== undefined && ev.winner !== null) return ev.winner;
    if (ev.from !== undefined && ev.from !== null) return ev.from; // trades
    if (ev.buyer !== undefined && ev.buyer !== null) return ev.buyer; // snatch
    if (ev.tile !== undefined) return S.display.owners[ev.tile] ?? undefined;
    return undefined;
  };

  /** Describe an event, append it to the log and show it in the bubble. Returns the description. */
  function announce(ev, { log = true, bubble = true } = {}) {
    const dsp = S.display;
    const d = D.describeEvent(ev, {
      players: dsp.players,
      me,
      owners: dsp.owners,
      round: dsp.round,
      maxRounds: dsp.cfg ? dsp.cfg.maxRounds ?? null : null,
      jailTurns: dsp.cfg ? dsp.cfg.jailTurns : undefined,
      tile: S.stageTile, // the square being played (a tax payment follows its 'land' event)
    });
    if (!d) return null;
    const patch = {};
    if (log) {
      const entry = { id: nextId(), text: d.text, tone: d.tone, icon: d.icon, player: playerOf(ev), tile: d.tile !== undefined ? d.tile : ev.tile };
      const added = [entry];
      if (d.extra && d.extra.text) {
        added.push({ id: nextId(), text: d.extra.text, tone: d.extra.tone || 'info', icon: d.extra.icon, player: entry.player, tile: entry.tile });
      }
      const all = [...S.log, ...added];
      patch.log = all.length > LOG_CAP ? all.slice(all.length - LOG_CAP) : all;
    }
    if (bubble) {
      patch.bubble = {
        id: nextId(),
        text: d.bubble || d.text,
        tone: d.tone,
        tile: d.tile !== undefined ? d.tile : ev.tile,
        icon: d.icon,
        type: ev.type,
        ...(ev.type === 'card' ? { card: { title: ev.title, text: ev.text, kind: ev.kind, deck: ev.deck } } : null),
      };
    }
    commit(patch);
    return d;
  }

  // ---- event playback ----
  /** Plays one event. Resolves to false when playback was cancelled (reset/unmount). */
  async function playEvent(ev, wait) {
    const dsp = S.display;
    const byMe = ev.player === me;

    switch (ev.type) {
      case 'dice': {
        commit({ rolling: true });
        fx('dice');
        if (!(await wait(dl('dice')))) return false;
        const values = ev.values || [1];
        const assist = ev.assist || null;
        // Keep the landing transition inside the presenter pause, including fast/catch-up play.
        const diceSettleMs = reducedNow ? 0 : Math.max(0, Math.min(560, dl('afterDice') * speed() - 32));
        patchDisplay((d) => ({ ...d, dice: [...values], diceSettleMs, assist, assistPlayer: assist ? ev.player : null }));
        commit({ rolling: false });
        announce(ev);
        if (assist && byMe) {
          fx('lucky');
        }
        return wait(dl('afterDice'));
      }

      case 'move': {
        const path = Array.isArray(ev.path) ? ev.path : [];
        if (ev.teleport || path.length === 0) {
          fx(ev.teleport ? 'card' : 'step');
          if (!(await wait(dl('teleportPre')))) return false;
          // `stepMs` tells the board how long the pawn's lift-and-set-down motion should take.
          patchDisplay((d) => ({
            ...d,
            stepMs: Math.round(dl('teleport') * speed()),
            players: d.players.map((p) => (p.id === ev.player ? { ...p, pos: ev.to } : p)),
          }));
          if (ev.teleport) announce(ev);
          return wait(dl('teleport'));
        }
        // The 40-square ring allows long trips (a card can send you across the board): hop faster on those.
        const stepScale = Math.max(0.3, Math.min(1, LONG_TRIP / path.length));
        for (const tile of path) {
          patchDisplay((d) => ({
            ...d,
            stepMs: Math.round(dl('step') * stepScale * speed()),
            players: d.players.map((p) => (p.id === ev.player ? { ...p, pos: tile } : p)),
          }));
          fx('step');
          if (!(await wait(dl('step') * stepScale))) return false;
        }
        const p = S.display.players.find((x) => x.id === ev.player);
        if (p && p.pos !== ev.to && Number.isInteger(ev.to)) setPos(ev.player, ev.to);
        return true;
      }

      case 'land': {
        commit({ stageTile: ev.tile });
        announce(ev);
        return wait(dl('land'));
      }

      case 'cash': {
        const delta = Number(ev.delta) || 0;
        patchDisplay((d) => ({
          ...d,
          players: d.players.map((p) => (p.id === ev.player ? { ...p, cash: p.cash + delta } : p)),
          lastCash: { id: nextId(), player: ev.player, delta, reason: ev.reason },
        }));
        const d = announce(ev);
        let sound = null;
        switch (ev.reason) {
          case 'salary':
          case 'liquidate':
          case 'event':
            sound = 'coin';
            break;
          case 'rent':
          case 'card':
            sound = delta >= 0 ? 'coin' : 'pay';
            break;
          case 'tax':
          case 'bail':
            sound = 'pay';
            break;
          default:
            break; // buy / upgrade / auction: own, level and auction_end make the sound
        }
        if (sound) fx(sound);

        if (ev.reason === 'rent') return wait(delta < 0 ? dl('rentOut') : dl('rentIn'));
        return wait(d ? dl('cash') : dl('quiet'));
      }

      case 'own': {
        // A buy that opens a snatch window is logged once, by the snatch_open line that follows it.
        const windowFollows = ev.reason === 'buy' && itemEvents.some((e) => e && e.type === 'snatch_open' && e.tile === ev.tile);
        if (!windowFollows) announce(ev); // before the change, so liquidations can name the previous owner
        patchDisplay((d) => ({
          ...d,
          owners: setAt(d.owners, ev.tile, ev.owner ?? null),
          // a tile that goes back to the bank comes back unmortgaged (a creditor inherits the flag)
          mortgaged: ev.owner === null || ev.owner === undefined ? setAt(d.mortgaged, ev.tile, false) : d.mortgaged,
        }));
        if (ev.reason === 'buy' || ev.reason === 'auction') {
          fx('buy');
          return wait(dl('own'));
        }
        if (ev.reason === 'snatch') return wait(dl('own')); // snatch_end made the sound
        if (ev.reason === 'liquidate') fx('coin');
        return wait(ev.reason === 'liquidate' ? dl('cash') : dl('quiet'));
      }

      case 'level': {
        announce(ev);
        patchDisplay((d) => ({ ...d, levels: setAt(d.levels, ev.tile, ev.level) }));
        if (ev.reason === 'upgrade') {
          commit({ stageTile: ev.tile });
          const hotel = ev.level >= MAX_LEVEL;
          fx(hotel ? 'hotel' : 'upgrade');
          return wait(hotel ? dl('level') * 1.5 : dl('level'));
        }
        if (ev.reason === 'sell') {
          fx('coin');
          return wait(dl('cash'));
        }
        return wait(dl('quiet'));
      }

      case 'set_complete': {
        announce(ev);
        fx(byMe ? 'cheer' : 'click');
        return wait(dl('setComplete'));
      }

      case 'mortgage': {
        patchDisplay((d) => ({ ...d, mortgaged: setAt(d.mortgaged, ev.tile, true) }));
        announce(ev);
        fx('mortgage');
        return wait(dl('mortgage'));
      }

      case 'unmortgage': {
        patchDisplay((d) => ({ ...d, mortgaged: setAt(d.mortgaged, ev.tile, false) }));
        announce(ev);
        fx('pay');
        return wait(dl('mortgage') * 0.8);
      }

      case 'trade_offer': {
        patchDisplay((d) => ({ ...d, trade: { id: ev.id, from: ev.from, to: ev.to, give: ev.give, get: ev.get } }));
        announce(ev);
        fx(ev.to === me ? 'card' : 'click');
        return wait(dl('trade'));
      }

      case 'trade_done': {
        patchDisplay((d) => ({ ...d, trade: null }));
        announce(ev);
        fx('trade');
        return wait(dl('trade'));
      }

      case 'trade_rejected': {
        patchDisplay((d) => ({ ...d, trade: null }));
        announce(ev);
        fx(ev.from === me || ev.to === me ? 'error' : 'click');
        return wait(dl('trade'));
      }

      case 'debt': {
        patchDisplay((d) => ({ ...d, debt: { player: ev.player, amount: ev.amount, creditor: ev.creditor ?? null } }));
        announce(ev);
        fx('error');
        return wait(dl('debt'));
      }

      case 'jail': {
        const jt = dsp.cfg && Number(dsp.cfg.jailTurns) > 0 ? Number(dsp.cfg.jailTurns) : 1;
        patchPlayer(ev.player, () => ({ jailTurns: ev.jailed ? jt : 0 }));
        if (ev.jailed) {
          commit({ stageTile: JAIL_TILE });
          fx('jail');
        }
        announce(ev);
        return wait(dl('jail'));
      }

      case 'jail_stay': {
        patchPlayer(ev.player, () => ({ jailTurns: Math.max(0, Number(ev.left) || 0) }));
        commit({ stageTile: JAIL_TILE });
        announce(ev);
        fx('click');
        return wait(dl('jailStay'));
      }

      case 'card': {
        fx('card');
        announce(ev);
        // A recorded clip for this card: the players who get paid hear it, the one who drew it does not.
        if (CARD_CLIPS[ev.cardId] && !byMe && !disposed && !backedUp()) {
          try {
            D.playCardClip(ev.cardId);
          } catch {
            /* ignore */
          }
        }
        return wait(dl('card'));
      }

      case 'snatch_open': {
        commit({ stageTile: ev.tile });
        announce(ev);
        fx(Array.isArray(ev.eligible) && ev.eligible.includes(me) ? 'lucky' : 'click');
        return true; // no delay: the window runs in real time from the moment the state arrived
      }

      case 'snatch_end': {
        commit({ stageTile: ev.tile });
        announce(ev);
        if (ev.outcome === 'snatched') fx(ev.winner === me ? 'cheer' : ev.buyer === me ? 'error' : 'click');
        else if (ev.outcome === 'bidding') fx('click');
        return wait(ev.outcome === 'none' ? dl('cash') : dl('snatchEnd'));
      }

      case 'shield': {
        // No delay: a shield only skips the snatch window, nothing to wait for.
        announce(ev);
        fx('click');
        return true;
      }

      case 'trap_placed': {
        // No delay, and no tile: placing is secret. The count in hand drops for everybody.
        patchPlayer(ev.player, (p) => ({ traps: Math.max(0, (p.traps || 0) - 1) }));
        announce(ev);
        fx(ev.player === me ? 'click' : 'error');
        return true;
      }

      case 'trap_sprung': {
        commit({ stageTile: ev.tile });
        announce(ev);
        fx(ev.victim === me ? 'jail' : ev.owner === me ? 'cheer' : 'error');
        return wait(dl('trap'));
      }

      case 'token_earned': {
        patchPlayer(ev.player, () => ({ snatches: Math.max(0, Number(ev.snatches) || 0) }));
        announce(ev);
        if (ev.player === me) fx('lucky');
        return true;
      }

      case 'city_event': {
        patchDisplay((d) => ({
          ...d,
          event: { id: ev.id, title: ev.title, text: ev.text, kind: ev.kind, group: ev.group, mult: ev.mult, amount: ev.amount, round: ev.round },
        }));
        announce(ev);
        fx(ev.kind === 'bad' ? 'error' : 'card');
        return wait(dl('cityEvent'));
      }

      case 'snatch_token': {
        patchPlayer(ev.player, () => ({ snatches: Math.max(0, Number(ev.snatches) || 0) }));
        return wait(dl('quiet'));
      }

      case 'auction_start': {
        commit({ stageTile: ev.tile });
        announce(ev);
        fx('click');
        return wait(dl('auctionStart'));
      }

      case 'auction_end': {
        announce(ev);
        const hasWinner = ev.winner !== null && ev.winner !== undefined;
        fx(hasWinner ? 'buy' : 'click');
        return wait(dl('auctionEnd'));
      }

      case 'bankrupt': {
        patchPlayer(ev.player, () => ({ bankrupt: true, cash: 0, jailTurns: 0 }));
        announce(ev);
        fx(byMe ? 'lose' : 'error');
        return wait(dl('bankrupt'));
      }

      case 'turn': {
        const idx = dsp.players.findIndex((p) => p.id === ev.player);
        const d = announce(ev); // null unless the round changes (quiet per-turn)
        patchDisplay((x) => ({
          ...x,
          turn: idx >= 0 ? idx : x.turn,
          round: ev.round ?? x.round,
          // a city event lasts one round: drop it when a later round begins
          event: x.event && ev.round !== undefined && x.event.round !== ev.round ? null : x.event,
        }));
        if (!d) return wait(dl('quiet'));
        const max = dsp.cfg ? Number(dsp.cfg.maxRounds) : NaN;
        const final = Number.isFinite(max) && max > 0 && ev.round === max;
        fx(final ? 'card' : 'click');
        return wait(final ? dl('finalRound') : dl('round'));
      }

      case 'win': {
        patchDisplay((x) => ({ ...x, phase: 'over', winner: ev.player ?? null }));
        announce(ev);
        const mine = ev.player === me;
        try {
          D.sfx.play(mine ? 'win' : 'lose'); // celebrate even while catching up
          if (mine) setTimeout(() => !disposed && D.sfx.play('cheer'), 450);
        } catch {
          /* ignore */
        }
        return wait(dl('win'));
      }

      default:
        return true;
    }
  }

  async function playItem(events, myEpoch) {
    reducedNow = reducedMotion();
    quickNow = computeQuick(events);
    itemEvents = events;
    const alive = () => epoch === myEpoch && !disposed;
    const wait = async (ms) => {
      await sleep(ms * speed());
      return alive();
    };
    for (const ev of events) {
      if (!alive()) return false;
      if (!ev || typeof ev.type !== 'string') continue;
      try {
        if (!(await playEvent(ev, wait))) return false;
      } catch (err) {
        devWarn('event failed', ev, err);
      }
    }
    return alive();
  }

  function snapTo(state) {
    if (!state || !Array.isArray(state.players)) {
      commit({ rolling: false });
      return;
    }
    // `assist` belongs to the last roll, which the state itself does not carry: keep it.
    commit({ display: { ...displayFromState(state), assist: S.display.assist, assistPlayer: S.display.assistPlayer }, rolling: false });
  }

  // ---- public API ----
  function enqueue(events, newState) {
    if (disposed) return;
    const list = Array.isArray(events) ? events : [];
    if (list.length === 0 && pending === 0) {
      snapTo(newState); // nothing to play and nothing ahead of us: apply instantly, no busy flicker
      return;
    }
    const myEpoch = epoch;
    pending += 1;
    if (!S.busy) commit({ busy: true });
    chain = chain.then(async () => {
      if (myEpoch !== epoch || disposed) return;
      try {
        await playItem(list, myEpoch);
      } catch (err) {
        devWarn('playback failed', err);
      }
      if (myEpoch !== epoch || disposed) return;
      pending = Math.max(0, pending - 1);
      snapTo(newState);
      if (pending === 0) commit({ busy: false, rolling: false });
    });
  }

  function reset(state) {
    epoch += 1;
    flushTimers();
    chain = Promise.resolve();
    pending = 0;
    S = { ...makeSnapshot(state) };
    listeners.forEach((l) => l());
  }

  function dispose() {
    disposed = true;
    epoch += 1;
    flushTimers();
    chain = Promise.resolve();
    pending = 0;
  }

  function mount() {
    disposed = false;
  }

  return {
    enqueue,
    reset,
    dispose,
    mount,
    setMe(id) {
      me = id;
    },
    /** Change the delay multiplier (applies from the next wait). */
    setSpeed(v) {
      speedMul = clampSpeed(v);
    },
    isBusy: () => pending > 0,
    getSnapshot: () => S,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------------

export function usePresenter({ meId, initialState, speed = 1 } = {}) {
  const ref = useRef(null);
  if (ref.current === null) ref.current = createPresenterCore({ meId, initialState, speed });
  const core = ref.current;
  core.setMe(meId);
  core.setSpeed(speed);

  useEffect(() => {
    core.mount(); // StrictMode runs effects twice in dev: mount -> dispose -> mount
    return () => core.dispose();
  }, [core]);

  const snap = useSyncExternalStore(core.subscribe, core.getSnapshot, core.getSnapshot);
  return useMemo(() => ({ ...snap, enqueue: core.enqueue, reset: core.reset, isBusy: core.isBusy }), [snap, core]);
}

export default usePresenter;
