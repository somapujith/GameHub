// Server adapter for Hyderabad Tycoon (docs/MARKETPLACE.md section 5). Everything the generic
// GameRoom / persistence code needs to know about this game lives here: it wraps the rules engine
// (shared/index.js) and the Tycoon-only helpers worker/{mask,settings,validate}.js.
import * as engine from '../../shared/index.js';
import { MAX_LEVEL, BOARD_SIZE } from '../../shared/board.js';
import { formatINR } from '../../shared/format.js';
import { maskStateFor } from '../mask.js';
import { sanitizeSettings, normalizeSettings, ROOM_DEFAULTS, MAX_PLAYERS_MIN, MAX_PLAYERS_MAX } from '../settings.js';
import { sanitizeAction, EMOTES } from '../validate.js';

export const ID = 'hyderabad-tycoon';
export const TRADE_MS = 30_000; // an unanswered trade offer is auto-rejected after this
const SNATCH_FALLBACK_MS = 3000; // used only if a state somehow lacks `pending.ms`
export const SNATCH_GRACE_MS = 400; // the server closes the window this long after the UI countdown ends (network latency)
const TRADE_VOID_MS = 900; // an offer to a player who is out of the game is cancelled right away
const MAX_ANIM_MS = 6000;
const AUTO_MOVE_MS = 900; // pause before an idle / disconnected player's move is played for them
const BID_MOVE_MS = 400; // sealed bids are quick
const START_ANIM_MS = 1500; // the client plays a short "game start" intro

// ------------------------------------------------------------------ pure helpers (also used by tests)

/** Rough client-side animation time of an action's events (the next move waits for it). */
export function estimateAnimMs(events) {
  let ms = 0;
  for (const ev of events || []) {
    switch (ev.type) {
      case 'dice':
        ms += 900;
        break;
      case 'move':
        ms += 170 * (ev.path ? ev.path.length : 0);
        break;
      case 'card':
        ms += 1500;
        break;
      case 'auction_end':
      case 'city_event':
        ms += 1500;
        break;
      case 'trap_sprung':
        ms += 900;
        break;
      case 'win':
        ms += 2500;
        break;
      default:
        break;
    }
  }
  return Math.min(ms, MAX_ANIM_MS);
}

/**
 * Ids of the (non-bankrupt) players the game is currently waiting for.
 * - pending trade: the player who must answer it (`trade.to`);
 * - debt phase: the debtor (even when it is not their turn);
 * - auction: everyone who has not bid yet;
 * - snatch window: the eligible players who have not pressed yet (nobody is auto-played in it);
 * - otherwise the turn player.
 */
export function pendingActors(state) {
  if (!state || state.phase === 'over') return [];
  if (state.phase === 'snatch' && state.pending && state.pending.type === 'snatch') {
    const claims = state.pending.claims || [];
    return state.players.filter((p) => !p.bankrupt && state.pending.eligible.includes(p.id) && !claims.includes(p.id)).map((p) => p.id);
  }
  if (state.trade) {
    const to = state.players.find((p) => p.id === state.trade.to);
    return to && !to.bankrupt ? [to.id] : [];
  }
  if (state.phase === 'debt' && state.debt) {
    const debtor = state.players.find((p) => p.id === state.debt.player);
    return debtor && !debtor.bankrupt ? [debtor.id] : [];
  }
  if (state.phase === 'auction' && state.pending && state.pending.type === 'auction') {
    return state.players.filter((p) => !p.bankrupt && !(p.id in state.pending.bids)).map((p) => p.id);
  }
  const tp = state.players[state.turn];
  return tp && !tp.bankrupt ? [tp.id] : [];
}

/** The move an automated player (an idle or disconnected player, played on their behalf) should make right now. */
export function autoMove(state, playerId, rnd = Math.random) {
  let action = engine.chooseBotAction(state, playerId, rnd);
  // Safety net for a phase the brain declines to act in: a debtor tries to pay (the engine
  // rejects it if they cannot, and repeated rejections end in RESIGN).
  if (!action && state.phase === 'debt' && state.debt && state.debt.player === playerId) {
    action = { type: 'PAY_DEBT', playerId };
  }
  return action;
}

/** True when a stored game state was made on the current board (a 28-tile state has a shorter `owners`). */
export const isCurrentBoard = (state) => Array.isArray(state?.owners) && state.owners.length === BOARD_SIZE;

const hotelsBuilt = (p, meta) => {
  const n = Number(meta?.hotels?.[p.id] ?? p.stats?.hotelsBuilt ?? p.stats?.hotels ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 100) : 0;
};

// ------------------------------------------------------------------ the adapter

const adapter = {
  id: ID,
  name: 'Hyderabad Tycoon',
  minPlayers: MAX_PLAYERS_MIN,
  maxPlayers: MAX_PLAYERS_MAX,
  defaultMaxPlayers: 4,
  defaultSettings: ROOM_DEFAULTS,
  /** Soundboard keys accepted in `{t:'chat', emote}`. */
  emotes: EMOTES,
  /** Client animation time after the game starts (the first move waits for it). */
  startAnimMs: START_ANIM_MS,

  /** Strict check of untrusted host settings; unknown keys are dropped, defaults filled in. */
  validateSettings(raw) {
    const { settings, errors } = sanitizeSettings(raw);
    if (errors.length) return { ok: false, error: errors[0] };
    return { ok: true, settings: normalizeSettings(settings) };
  },

  /** Settings as the lobby shows them: exactly what createGame runs with (state.cfg). */
  lobbySettings(settings) {
    const chosen = normalizeSettings(settings);
    return typeof engine.normalizeSettings === 'function'
      ? engine.normalizeSettings(chosen)
      : { ...engine.DEFAULT_SETTINGS, ...chosen };
  },

  /** One line for open-table cards, e.g. "Target ₹70,000 · 50 rounds". */
  summarize(settings) {
    const s = normalizeSettings(settings);
    return `Target ${formatINR(s.goal)} · ${s.maxRounds === null ? 'unlimited rounds' : `${s.maxRounds} rounds`}`;
  },

  createGame({ players, settings, seed }) {
    return engine.createGame({
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      settings: normalizeSettings(settings), // goal, startCash, maxRounds (null = unlimited), dice, auctionOnDecline
      seed,
    });
  },

  /** Clean an action received from a client (allow-list; `playerId` is forced). */
  sanitizeAction,

  applyAction: (state, action) => engine.applyAction(state, action),

  /** The player the idle timer waits for (the debtor during the debt phase). */
  turnPlayerId(state) {
    if (state && state.phase === 'snatch' && state.pending && state.pending.type === 'snatch') return state.pending.buyer ?? null;
    return pendingActors(state)[0] ?? null;
  },

  /**
   * Optional extension: EVERY player the game waits for right now (auction bidders; for a pending
   * trade the recipient and the offerer). GameRoom falls back to [turnPlayerId] without it.
   */
  pendingPlayerIds(state) {
    const ids = pendingActors(state);
    if (state && state.trade && state.phase !== 'over') {
      const from = state.players.find((p) => p.id === state.trade.from);
      if (from && !from.bankrupt && !ids.includes(from.id)) ids.push(from.id);
    }
    return ids;
  },

  /** Timers besides the turn timer: an unanswered trade offer is auto-rejected after 30 s. */
  deadlines(state) {
    // The Snatch window: the room itself closes it (SNATCH_CLOSE has no player and clients cannot send it).
    // The key carries the tile and turn count, so two windows in a row are two timers.
    if (state && state.phase === 'snatch' && state.pending && state.pending.type === 'snatch') {
      const pend = state.pending;
      return [{
        key: `snatch:${state.turnCount ?? 0}:${pend.tile}`,
        afterMs: (Number.isFinite(pend.ms) ? pend.ms : SNATCH_FALLBACK_MS) + SNATCH_GRACE_MS,
        playerId: pend.buyer,
        action: { type: 'SNATCH_CLOSE' },
      }];
    }
    const t = state && state.phase !== 'over' ? state.trade : null;
    if (!t) return [];
    const to = state.players.find((p) => p.id === t.to);
    if (!to || to.bankrupt) {
      // The recipient is out of the game: the offerer takes the offer back.
      return [{ key: `trade:${t.id}:void`, afterMs: TRADE_VOID_MS, playerId: t.from, action: { type: 'TRADE_CANCEL', playerId: t.from } }];
    }
    return [{ key: `trade:${t.id}`, afterMs: TRADE_MS, playerId: to.id, action: { type: 'TRADE_REJECT', playerId: to.id } }];
  },

  /** Auto-play for an AFK / disconnected player. Ignoring a trade offer means rejecting it. */
  idleAction(state, playerId) {
    if (state && state.phase === 'snatch') return null; // auto-play never snatches and never acts during the window
    const t = state && state.trade;
    if (t) {
      if (t.to === playerId) return { type: 'TRADE_REJECT', playerId };
      if (t.from === playerId) return { type: 'TRADE_CANCEL', playerId };
      return null;
    }
    return autoMove(state, playerId);
  },

  /** What leaving a running game does to the leaver. */
  resignAction(state, playerId) {
    const p = state && state.players.find((x) => x.id === playerId);
    return p && !p.bankrupt ? { type: 'RESIGN', playerId } : null;
  },

  isOver: (state) => !!state && state.phase === 'over',

  animationMs: estimateAnimMs,

  /** Pause before an automated move (bids are quicker). */
  moveDelayMs: (action) => (action && action.type === 'BID' ? BID_MOVE_MS : AUTO_MOVE_MS),

  /** Rooms stored by the previous version kept hotels / the trade clock in their own fields. */
  upgradeRecord(r) {
    if (r.hotels && !(r.meta && r.meta.hotels)) r.meta = { ...r.meta, hotels: r.hotels };
    if (r.tradeId != null && !(r.deadlines && Object.keys(r.deadlines).length)) {
      r.deadlines = { ...r.deadlines, [`trade:${r.tradeId}`]: r.tradeAt || Date.now() };
    }
    delete r.hotels;
    delete r.tradeId;
    delete r.tradeAt;
    // Room record v3 = the 40-square board. A game stored on the old 28-tile board cannot be resumed
    // (its owners / levels / positions mean different tiles): drop it and call the room off, unrecorded.
    if (r.state && !isCurrentBoard(r.state)) {
      r.state = null;
      if (r.status !== 'lobby') {
        r.status = 'finished';
        r.abandoned = true;
        r.endedAt ||= Date.now();
      }
    }
  },

  /** Fold the events of an applied action into the per-match `meta` (hotels built per player). */
  track(meta, events, state) {
    let hotels = null;
    for (const ev of events || []) {
      if (ev.type === 'level' && ev.reason === 'upgrade' && ev.level >= MAX_LEVEL) {
        const owner = state.owners[ev.tile];
        if (owner) {
          hotels ||= { ...(meta && meta.hotels) };
          hotels[owner] = (hotels[owner] || 0) + 1;
        }
      }
    }
    return hotels ? { ...meta, hotels } : meta;
  },

  /** Final standings. `score` is net worth; `legacy` feeds the old users.* columns / matches columns. */
  result(state, meta) {
    const table = engine.standings(state);
    const byId = new Map(state.players.map((p) => [p.id, p]));
    const rawMax = state.cfg && state.cfg.maxRounds;
    const maxRounds = Number.isFinite(rawMax) ? rawMax : null; // null = unlimited
    const rounds = maxRounds ? Math.min(state.round, maxRounds) : state.round;
    return {
      winnerId: state.winner || null,
      reason: state.winReason || null,
      rounds,
      standings: table.map((row) => {
        const p = byId.get(row.id) || {};
        return {
          id: row.id,
          rank: row.rank,
          score: Math.round(row.worth),
          stats: { rentEarned: Math.round(p.stats?.rentEarned || 0), hotelsBuilt: hotelsBuilt(p, meta) },
        };
      }),
      legacy: {
        goal: Number.isFinite(state.cfg?.goal) ? state.cfg.goal : null,
        maxRounds,
        diceMode: state.cfg?.dice === 'fair' ? 'fair' : 'lucky',
      },
    };
  },

  /** Sealed auctions: other players' bid amounts are hidden (the keys stay, so "has bid" is visible). */
  redact: (state, viewerId) => maskStateFor(state, viewerId),
};

export default adapter;
