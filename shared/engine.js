// Hyderabad Tycoon rules engine (rules v2). Pure + deterministic: runs in the browser AND the Cloudflare Worker.
//
//   createGame({ players, settings?, seed? })  -> state
//   applyAction(state, action)                 -> { state, events, error? }   (never mutates `state`)
//
// See docs/CONTRACT.md sections 3, 3b and 3c for the state shape, actions and events.

import {
  BOARD_SIZE, START_TILE, JAIL_TILE, MAX_LEVEL, TRANSPORT_RENT, UTILITY_MULT, SELL_RATIO,
  START_CASH, PASS_START, BAIL_FINE, PARKING_TILE, TOKEN_CAP, LAPS_PER_TOKEN, GO_TO_JAIL_TILE, TRAPS_EACH,
  GROUPS, GROUP_TILES, TILES, LEVEL_NAMES, isBuyable, rentFor, upgradeCost, setMultiplier,
  mortgageValue, unmortgageCost, taxDue,
} from './board.js';
import { KISMET } from './cards.js';
import { shuffle, seedToUint32, randInt } from './rng.js';
import { CITY_EVENTS, EVENT_EVERY } from './events.js';
import { formatINR } from './format.js';
import { rollDice, DICE_RULES } from './dice.js';

// ---------------------------------------------------------------------------------------------
// Constants and settings
// ---------------------------------------------------------------------------------------------

export const DEFAULT_SETTINGS = {
  startCash: START_CASH,
  goal: 70000,
  passStart: PASS_START,
  jailTurns: 1,
  bailFine: BAIL_FINE,
  // Tax comes from the tile itself (board.js `taxDue`: GHMC = lower of 2,000 / 10% of worth, ORR = 1,000).
  maxRounds: 50, // 30 | 50 | null (null = unlimited; JSON cannot carry Infinity)
  dice: 'lucky', // 'lucky' | 'fair'  (see shared/dice.js). There is always exactly ONE die.
  auctionOnDecline: true, // declining an unowned tile opens a sealed auction for it
  snatches: 1, // Snatch tokens each player starts with (0 = the snatch rule is off)
  snatchMs: 3000, // how long the snatch window stays open after a purchase (docs/GAME_RULES.md section 9)
};

export const SETTING_LIMITS = {
  goal: { min: 10000, max: 1000000 },
  startCash: { min: 5000, max: 100000 },
  snatches: { min: 0, max: 3 },
  snatchMs: { min: 1000, max: 10000 },
};

const toInt = (v) => {
  if (typeof v === 'string' && v.trim() === '') return NaN;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : NaN;
};

/**
 * Turns whatever the UI / server hands us into a valid engine config.
 *   undefined -> default, null maxRounds -> unlimited, garbage -> default, out-of-range -> clamped.
 * Unknown keys are dropped; `debug: true` is kept (tests only).
 */
export function normalizeSettings(input) {
  const src = input && typeof input === 'object' ? input : {};
  const cfg = { ...DEFAULT_SETTINGS };
  const ranged = (key, lo, hi) => {
    const n = toInt(src[key]);
    cfg[key] = Number.isNaN(n) ? DEFAULT_SETTINGS[key] : Math.min(hi, Math.max(lo, n));
  };
  ranged('goal', SETTING_LIMITS.goal.min, SETTING_LIMITS.goal.max);
  ranged('startCash', SETTING_LIMITS.startCash.min, SETTING_LIMITS.startCash.max);
  ranged('passStart', 0, 1000000);
  ranged('bailFine', 0, 1000000);
  ranged('jailTurns', 1, 10);
  ranged('snatches', SETTING_LIMITS.snatches.min, SETTING_LIMITS.snatches.max);
  ranged('snatchMs', SETTING_LIMITS.snatchMs.min, SETTING_LIMITS.snatchMs.max);

  const mr = src.maxRounds;
  if (mr === null || mr === Infinity) cfg.maxRounds = null;
  else {
    const n = toInt(mr);
    cfg.maxRounds = Number.isNaN(n) || n < 1 ? DEFAULT_SETTINGS.maxRounds : n;
  }
  cfg.dice = src.dice === 'fair' || src.dice === 'lucky' ? src.dice : DEFAULT_SETTINGS.dice;
  cfg.auctionOnDecline = typeof src.auctionOnDecline === 'boolean' ? src.auctionOnDecline : DEFAULT_SETTINGS.auctionOnDecline;
  if (src.debug === true) cfg.debug = true;
  return cfg;
}

export const PLAYER_COLORS = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b794f6', '#ff9f43'];

/** Bot personality defaults (stored on `player.bot`). */
export const DEFAULT_BOT = { reserve: 1000, greed: 1 };

const MAX_CARD_DEPTH = 2;
const JAIL_CARD_INDEX = KISMET.findIndex((c) => c.effect.type === 'jailCard');

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const byId = (s, id) => s.players.find((p) => p.id === id);
const activePlayers = (s) => s.players.filter((p) => !p.bankrupt);
const turnPlayer = (s) => s.players[s.turn];
const diceTotal = (s) => s.dice?.[0] || 0; // the single die
const isMort = (s, t) => !!(s.mortgaged && s.mortgaged[t]);
const refundPerLevel = (tile) => Math.round(upgradeCost(tile) * SELL_RATIO);

function newStats() {
  return { rentPaid: 0, rentEarned: 0, taxPaid: 0, propertiesBought: 0, upgrades: 0, jailed: 0, biggestRent: 0 };
}

function countOwned(s, ownerId, type) {
  let n = 0;
  for (let i = 0; i < BOARD_SIZE; i++) if (s.owners[i] === ownerId && TILES[i].type === type) n++;
  return n;
}

function ownedInGroup(s, ownerId, groupId) {
  let n = 0;
  for (const t of GROUP_TILES[groupId]) if (s.owners[t] === ownerId) n++;
  return n;
}

const ownsWholeGroup = (s, ownerId, groupId) => ownedInGroup(s, ownerId, groupId) === GROUP_TILES[groupId].length;
const groupHasBuildings = (s, groupId) => GROUP_TILES[groupId].some((t) => (s.levels[t] || 0) > 0);

/** Why `p` (the turn player) cannot set a trap at all right now, or null. */
function trapAvailability(state, p) {
  if (state.phase !== 'roll') return 'You can only set a trap before you roll';
  if (!((p.traps || 0) > 0)) return 'You have no trap left';
  return null;
}

/** Why `p` cannot set a trap on `tile` right now, or null. */
function trapProblem(state, p, tile) {
  const why = trapAvailability(state, p);
  if (why) return why;
  if (!Number.isInteger(tile) || tile < 0 || tile >= BOARD_SIZE || tile === GO_TO_JAIL_TILE) return 'You cannot trap that square';
  if ((state.traps || []).some((t) => t.owner === p.id && t.tile === tile)) return 'You cannot trap that square';
  return null;
}

/** True when another active player holds a Snatch token (so a window would open for `playerId`'s purchase). */
function snatchersExist(state, playerId) {
  return state.players.some((q) => q.id !== playerId && !q.bankrupt && (q.snatches || 0) > 0);
}

/** Rent the tile asks right now from a visitor (owner's perspective). 0 for a mortgaged tile. */
function rentOf(s, tileId, ownerId, total) {
  const tile = TILES[tileId];
  if (isMort(s, tileId)) return 0;
  const event = s.event || null; // city event of the current round (docs/GAME_RULES.md section 11); old saves have none
  if (tile.type === 'property') {
    const level = s.levels[tileId] || 0;
    let rent;
    if (level > 0) rent = rentFor(tile, level);
    else {
      const size = GROUP_TILES[tile.group].length;
      rent = Math.round(rentFor(tile, 0) * setMultiplier(ownedInGroup(s, ownerId, tile.group), size));
    }
    if (event && event.group === tile.group && event.mult) rent = Math.round(rent * event.mult);
    return rent;
  }
  if (tile.type === 'transport') {
    if (event && event.id === 'metro_strike') return 0;
    const n = Math.min(countOwned(s, ownerId, 'transport'), TRANSPORT_RENT.length - 1);
    return TRANSPORT_RENT[n];
  }
  if (tile.type === 'utility') {
    const n = Math.min(countOwned(s, ownerId, 'utility'), UTILITY_MULT.length - 1);
    return total * UTILITY_MULT[n];
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------------------------

/** cash + sum(price + level * upgradeCost); a mortgaged tile counts price - mortgageValue. */
export function netWorth(state, playerId) {
  const p = byId(state, playerId);
  if (!p) return 0;
  let w = p.cash;
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (state.owners[i] !== playerId) continue;
    const t = TILES[i];
    w += (isMort(state, i) ? t.price - mortgageValue(t) : t.price) + (state.levels[i] || 0) * upgradeCost(t);
  }
  return w;
}

/** Cash the player could raise by selling every building and mortgaging every unmortgaged tile. */
export function liquidationValue(state, playerId) {
  let v = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (state.owners[i] !== playerId) continue;
    v += (state.levels[i] || 0) * refundPerLevel(TILES[i]);
    if (!isMort(state, i)) v += mortgageValue(TILES[i]);
  }
  return v;
}

/** [{ id, cash, worth, rank }] sorted by worth desc (rank is 1-based). */
export function standings(state) {
  const rows = state.players.map((p, seat) => ({ id: p.id, cash: p.cash, worth: netWorth(state, p.id), bankrupt: p.bankrupt, seat }));
  rows.sort((a, b) => (b.worth - a.worth) || (Number(a.bankrupt) - Number(b.bankrupt)) || (a.seat - b.seat));
  return rows.map((r, i) => ({ id: r.id, cash: r.cash, worth: r.worth, rank: i + 1 }));
}

/** Rent a visitor would owe right now on `tileId` (0 if unowned / mortgaged / not buyable). */
export function previewRent(state, tileId, diceSum = 7) {
  const tile = TILES[tileId];
  const owner = state.owners[tileId];
  if (!tile || !isBuyable(tile) || !owner) return 0;
  return rentOf(state, tileId, owner, diceSum);
}

/** { ok, reason?, cost } with human-readable reasons (good for tooltips). */
export function canUpgrade(state, playerId, tileId) {
  const tile = TILES[tileId];
  if (!tile || tile.type !== 'property') return { ok: false, reason: 'Only colour-group properties can be built on', cost: 0 };
  const cost = upgradeCost(tile);
  const no = (reason) => ({ ok: false, reason, cost });
  const p = byId(state, playerId);
  if (!p || p.bankrupt) return no('You are out of the game');
  if (state.phase === 'over') return no('The game is over');
  if (state.owners[tileId] !== playerId) return no('You do not own this property');
  if (!ownsWholeGroup(state, playerId, tile.group)) return no(`Own all of ${GROUPS[tile.group].name} to build here`);
  const level = state.levels[tileId] || 0;
  if (level >= MAX_LEVEL) return no(`Already fully built (${LEVEL_NAMES[MAX_LEVEL]})`);
  if (GROUP_TILES[tile.group].some((t) => isMort(state, t))) return no('Unmortgage every tile in this colour first');
  const minLevel = Math.min(...GROUP_TILES[tile.group].map((t) => state.levels[t] || 0));
  if (level > minLevel) return no('Build evenly: upgrade the lower tiles in this set first');
  if (turnPlayer(state).id !== playerId) return no('Wait for your turn');
  if (state.trade) return no('Answer the trade offer first');
  if (state.phase !== 'roll' && state.phase !== 'manage') return no('Finish the current step first');
  if (p.cash < cost) return no(`Need ${formatINR(cost - p.cash)} more`);
  return { ok: true, cost };
}

// ---- raise-cash checks (mortgage / unmortgage / sell a building) ----

/** Who may mortgage / sell right now: the debtor during a debt, otherwise the turn player in roll/manage. */
function raiseCashGate(s, playerId) {
  if (s.trade) return 'Answer the trade offer first';
  if (s.phase === 'debt') return s.debt && s.debt.player === playerId ? null : 'Wait until the debt is settled';
  if (turnPlayer(s).id !== playerId) return 'Not your turn';
  if (s.phase !== 'roll' && s.phase !== 'manage') return 'Finish the current step first';
  return null;
}

function mortgageCheck(s, playerId, tileId) {
  const tile = TILES[tileId];
  if (!tile || !isBuyable(tile)) return { ok: false, reason: 'That tile cannot be mortgaged', value: 0 };
  const value = mortgageValue(tile);
  const no = (reason) => ({ ok: false, reason, value });
  if (s.owners[tileId] !== playerId) return no('You do not own this tile');
  if (isMort(s, tileId)) return no('Already mortgaged');
  if (tile.type === 'property' && groupHasBuildings(s, tile.group)) return no('Sell the buildings in this colour first');
  const gate = raiseCashGate(s, playerId);
  if (gate) return no(gate);
  return { ok: true, value };
}

function unmortgageCheck(s, playerId, tileId) {
  const tile = TILES[tileId];
  if (!tile || !isBuyable(tile)) return { ok: false, reason: 'That tile cannot be mortgaged', cost: 0 };
  const cost = unmortgageCost(tile);
  const no = (reason) => ({ ok: false, reason, cost });
  const p = byId(s, playerId);
  if (s.owners[tileId] !== playerId) return no('You do not own this tile');
  if (!isMort(s, tileId)) return no('This tile is not mortgaged');
  if (s.phase === 'debt') return no('Settle the debt first');
  const gate = raiseCashGate(s, playerId);
  if (gate) return no(gate);
  if (p.cash < cost) return no(`Need ${formatINR(cost - p.cash)} more`);
  return { ok: true, cost };
}

function sellCheck(s, playerId, tileId) {
  const tile = TILES[tileId];
  if (!tile || tile.type !== 'property') return { ok: false, reason: 'Only properties have buildings', refund: 0 };
  const refund = refundPerLevel(tile);
  const no = (reason) => ({ ok: false, reason, refund });
  if (s.owners[tileId] !== playerId) return no('You do not own this tile');
  const level = s.levels[tileId] || 0;
  if (level <= 0) return no('Nothing built here');
  const maxLevel = Math.max(...GROUP_TILES[tile.group].map((t) => s.levels[t] || 0));
  if (level < maxLevel) return no('Sell evenly: sell from the tallest tile in this set first');
  const gate = raiseCashGate(s, playerId);
  if (gate) return no(gate);
  return { ok: true, refund };
}

function setsFor(s, playerId) {
  const out = [];
  for (const g of Object.keys(GROUPS)) {
    const size = GROUP_TILES[g].length;
    const owned = ownedInGroup(s, playerId, g);
    if (owned > 0) out.push({ group: g, owned, size, multiplier: setMultiplier(owned, size) });
  }
  return out;
}

/** What `playerId` may do right now. Everything false/null/[] when it is not their moment. */
export function getOptions(state, playerId) {
  const none = {
    roll: false, bail: false, buy: false, skipBuy: false, endTurn: false, upgrade: [], bid: null, resign: false,
    mortgage: [], unmortgage: [], sellBuilding: [], debt: null, payDebt: false, useJailCard: false,
    trade: { canOffer: false }, tradeOffer: null, tradeSent: null, sets: [], snatch: null,
  };
  const p = byId(state, playerId);
  if (!p || p.bankrupt || state.phase === 'over') return none;
  const out = { ...none, resign: true, sets: setsFor(state, playerId) };

  if (state.trade) {
    const t = state.trade;
    if (t.to === playerId) out.tradeOffer = { id: t.id, from: t.from, give: t.give, get: t.get };
    if (t.from === playerId) out.tradeSent = { id: t.id, to: t.to, give: t.give, get: t.get };
    return out;
  }

  const raiseCash = () => {
    for (let t = 0; t < BOARD_SIZE; t++) {
      if (state.owners[t] !== playerId) continue;
      const m = mortgageCheck(state, playerId, t);
      if (m.ok) out.mortgage.push({ tile: t, value: m.value });
      const s = sellCheck(state, playerId, t);
      if (s.ok) out.sellBuilding.push({ tile: t, refund: s.refund });
    }
  };

  if (state.phase === 'debt') {
    if (state.debt && state.debt.player === playerId) {
      out.debt = { amount: state.debt.amount, creditor: state.debt.creditor, shortfall: Math.max(0, state.debt.amount - p.cash) };
      out.payDebt = p.cash >= state.debt.amount;
      raiseCash();
    }
    return out;
  }

  if (state.phase === 'auction') {
    const pend = state.pending;
    if (pend && pend.type === 'auction' && !(playerId in pend.bids)) {
      out.bid = { tile: pend.tile, min: pend.minBid, max: p.cash };
    }
    return out;
  }

  if (state.phase === 'snatch') {
    const pend = state.pending;
    if (pend && pend.type === 'snatch' && pend.eligible.includes(playerId)) {
      if (pend.claims.includes(playerId)) out.snatched = true;
      else out.snatch = { tile: pend.tile, ms: pend.ms };
    }
    return out;
  }

  if (turnPlayer(state).id !== playerId) return out;
  if (state.phase === 'roll') {
    out.roll = true;
    out.bail = p.jailTurns > 0 && p.cash >= state.cfg.bailFine;
    out.useJailCard = p.jailTurns > 0 && (p.jailCards || 0) > 0;
    if (!trapAvailability(state, p)) out.trap = true;
  } else if (state.phase === 'buy') {
    out.skipBuy = true;
    out.buy = !!state.pending && p.cash >= state.pending.price;
    if (out.buy && (p.snatches || 0) > 0 && snatchersExist(state, playerId)) out.shield = true;
  } else if (state.phase === 'manage') {
    if (state.extraRoll) out.roll = true;
    else out.endTurn = true;
  }
  if (state.phase === 'roll' || state.phase === 'manage') {
    for (let t = 0; t < BOARD_SIZE; t++) {
      if (state.owners[t] !== playerId) continue;
      if (TILES[t].type === 'property') {
        const c = canUpgrade(state, playerId, t);
        if (c.ok) out.upgrade.push({ tile: t, cost: c.cost, level: state.levels[t] });
      }
      const u = unmortgageCheck(state, playerId, t);
      if (u.ok) out.unmortgage.push({ tile: t, cost: u.cost });
    }
    raiseCash();
    out.trade = { canOffer: !state.pending && activePlayers(state).length >= 2 };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------------------------

export function createGame({ players, settings = {}, seed } = {}) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 6) {
    throw new RangeError('createGame needs 2 to 6 players');
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error('Player ids must be unique');

  const cfg = normalizeSettings(settings);

  const state = {
    cfg,
    rng: seedToUint32(seed),
    round: 1,
    traps: [], // secret traps on the board: [{ tile, owner }] (docs/GAME_RULES.md section 13)
    event: null, // the city event of this round, or null (docs/GAME_RULES.md section 11)
    turn: 0,
    phase: 'roll',
    extraRoll: false,
    dice: [0], // the one die; zero means no roll has happened yet
    owners: Array(BOARD_SIZE).fill(null),
    levels: Array(BOARD_SIZE).fill(0),
    mortgaged: Array(BOARD_SIZE).fill(false),
    pending: null,
    trade: null,
    debt: null,
    tradeSeq: 0,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name ?? `Player ${i + 1}`,
      avatar: p.avatar ?? i,
      isBot: !!p.isBot,
      color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
      cash: cfg.startCash,
      pos: START_TILE,
      jailTurns: 0,
      jailCards: 0,
      sixes: 0, // sixes rolled so far in the current turn
      rollsSinceSix: 0,
      snatches: cfg.snatches, // Snatch tokens left (public)
      traps: TRAPS_EACH, // traps still in hand (public); where the placed ones are is secret
      laps: 0, // times START was passed; every LAPS_PER_TOKEN-th earns a token (public)
      rentStreak: 0,
      rentThisTurn: 0,
      lastOfferTurn: null,
      bankrupt: false,
      bot: p.isBot || p.bot ? { ...DEFAULT_BOT, ...(p.bot || {}) } : null,
      stats: newStats(),
    })),
    deck: [],
    deckPos: 0,
    winner: null,
    winReason: null,
    turnCount: 0,
  };
  state.deck = shuffle(state, KISMET.map((_, i) => i));
  return state;
}

// ---------------------------------------------------------------------------------------------
// Ownership + sets
// ---------------------------------------------------------------------------------------------

/** Emit `set_complete` for every colour the player now holds in full among `tiles`. */
function emitSets(s, ev, playerId, tiles) {
  const seen = new Set();
  for (const t of tiles) {
    const tile = TILES[t];
    if (tile.type !== 'property' || seen.has(tile.group)) continue;
    seen.add(tile.group);
    if (ownsWholeGroup(s, playerId, tile.group)) ev.push({ type: 'set_complete', player: playerId, group: tile.group });
  }
}

function returnJailCards(s, p) {
  for (let i = 0; i < (p.jailCards || 0); i++) s.deck.push(JAIL_CARD_INDEX);
  p.jailCards = 0;
}

// ---------------------------------------------------------------------------------------------
// Money: payments, debt, bankruptcy
// ---------------------------------------------------------------------------------------------

function gain(s, ev, p, amount, reason, other) {
  if (amount <= 0) return;
  p.cash += amount;
  const e = { type: 'cash', player: p.id, delta: amount, reason };
  if (other) e.other = other;
  ev.push(e);
}

/** Move `amount` from p to the creditor (or the bank). The caller guarantees p can afford it. */
function transfer(s, ev, p, creditor, amount, reason) {
  if (amount <= 0) return;
  p.cash -= amount;
  const e = { type: 'cash', player: p.id, delta: -amount, reason };
  if (creditor) e.other = creditor.id;
  ev.push(e);
  if (creditor) {
    creditor.cash += amount;
    ev.push({ type: 'cash', player: creditor.id, delta: amount, reason, other: p.id });
  }
  if (reason === 'rent') {
    p.stats.rentPaid += amount;
    p.rentThisTurn = (p.rentThisTurn || 0) + amount;
    if (creditor) {
      creditor.stats.rentEarned += amount;
      creditor.stats.biggestRent = Math.max(creditor.stats.biggestRent, amount);
    }
  } else if (reason === 'tax') {
    p.stats.taxPaid += amount;
  }
}

function cancelTradeOf(s, ev, playerId, reason) {
  const t = s.trade;
  if (t && (t.from === playerId || t.to === playerId)) {
    ev.push({ type: 'trade_rejected', id: t.id, from: t.from, to: t.to, reason });
    s.trade = null;
  }
}

/** Bankruptcy: buildings are sold to the bank, all cash + every property goes to the creditor (or the bank). */
function bankruptPlayer(s, ev, p, creditorId, reason) {
  const creditor = creditorId ? byId(s, creditorId) : null;
  const heir = creditor && !creditor.bankrupt ? creditor : null;
  for (let t = 0; t < BOARD_SIZE; t++) {
    if (s.owners[t] !== p.id || !(s.levels[t] > 0)) continue;
    const refund = s.levels[t] * refundPerLevel(TILES[t]);
    s.levels[t] = 0;
    ev.push({ type: 'level', tile: t, level: 0, reason: 'bankrupt' });
    gain(s, ev, p, refund, 'liquidate');
  }
  if (heir && p.cash > 0) transfer(s, ev, p, heir, p.cash, reason || 'rent');
  const given = [];
  for (let t = 0; t < BOARD_SIZE; t++) {
    if (s.owners[t] !== p.id) continue;
    if (heir) {
      s.owners[t] = heir.id; // mortgaged tiles stay mortgaged
      given.push(t);
    } else {
      s.owners[t] = null;
      s.mortgaged[t] = false;
    }
    ev.push({ type: 'own', tile: t, owner: heir ? heir.id : null, reason: 'bankrupt' });
  }
  if (heir) emitSets(s, ev, heir.id, given);
  returnJailCards(s, p);
  if (s.traps) s.traps = s.traps.filter((t) => t.owner !== p.id);
  p.bankrupt = true;
  p.cash = 0;
  p.jailTurns = 0;
  p.sixes = 0;
  cancelTradeOf(s, ev, p.id, 'bankrupt');
  ev.push({ type: 'bankrupt', player: p.id });
}

/**
 * Settle one payment. Returns true when it is done (paid, skipped or the payer went bankrupt) and
 * false when the game paused in the `debt` phase (the remaining payments in `rest` are kept on the debt).
 */
function settlePayment(s, ev, pay, rest) {
  const p = byId(s, pay.from);
  if (!p || p.bankrupt) return true;
  let creditor = pay.to ? byId(s, pay.to) : null;
  if (creditor && creditor.bankrupt) creditor = null;
  const amount = Math.max(0, Math.round(pay.amount));
  if (amount === 0) return true;
  if (p.cash >= amount) {
    transfer(s, ev, p, creditor, amount, pay.reason);
    return true;
  }
  if (p.cash + liquidationValue(s, p.id) >= amount) {
    s.debt = {
      player: p.id,
      amount,
      creditor: creditor ? creditor.id : null,
      reason: pay.reason,
      returnPhase: s.phase === 'debt' ? 'manage' : s.phase,
      rest: rest.slice(),
    };
    s.phase = 'debt';
    ev.push({ type: 'debt', player: p.id, amount, creditor: s.debt.creditor });
    return false;
  }
  bankruptPlayer(s, ev, p, creditor ? creditor.id : null, pay.reason);
  return true;
}

function runPayments(s, ev, list) {
  while (list.length) {
    const pay = list.shift();
    if (!settlePayment(s, ev, pay, list)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Movement, jail, landing, cards, auctions
// ---------------------------------------------------------------------------------------------

/** +1 Snatch token (docs/GAME_RULES.md 10.2). Off when snatches is 0; silent at TOKEN_CAP. */
function earnToken(s, ev, p, reason) {
  if (!s.cfg.snatches || (p.snatches || 0) >= TOKEN_CAP) return;
  p.snatches = (p.snatches || 0) + 1;
  ev.push({ type: 'token_earned', player: p.id, reason, snatches: p.snatches });
}

function moveForward(s, ev, p, steps, collect = true) {
  const from = p.pos;
  const path = [];
  for (let i = 1; i <= steps; i++) path.push((from + i) % BOARD_SIZE);
  if (path.length === 0) return;
  const passedStart = collect && path.includes(START_TILE);
  p.pos = path[path.length - 1];
  ev.push({ type: 'move', player: p.id, from, to: p.pos, path, passedStart });
  if (passedStart) {
    gain(s, ev, p, s.cfg.passStart, 'salary');
    p.laps = (p.laps || 0) + 1;
    if (p.laps % LAPS_PER_TOKEN === 0) earnToken(s, ev, p, 'lap');
  }
}

function moveBackward(s, ev, p, steps) {
  const from = p.pos;
  const path = [];
  for (let i = 1; i <= steps; i++) path.push((from - i + BOARD_SIZE * 4) % BOARD_SIZE);
  if (path.length === 0) return;
  p.pos = path[path.length - 1];
  ev.push({ type: 'move', player: p.id, from, to: p.pos, path, passedStart: false });
}

function sendToJail(s, ev, p, reason) {
  const from = p.pos;
  p.pos = JAIL_TILE;
  p.jailTurns = Math.max(1, s.cfg.jailTurns | 0);
  p.sixes = 0;
  p.stats.jailed += 1;
  s.pending = null;
  s.extraRoll = false;
  ev.push({ type: 'move', player: p.id, from, to: JAIL_TILE, path: [JAIL_TILE], passedStart: false, teleport: true });
  ev.push({ type: 'jail', player: p.id, jailed: true, reason });
}

/**
 * Traps on the tile this player just stopped on (docs/GAME_RULES.md 13.2): every one of them is spent, and the victim is
 * thrown in jail once (like Go to Jail). Returns true when that happened: the tile's own effect is then skipped.
 */
function springTraps(s, ev, p, tileId) {
  if (!s.traps || !s.traps.length) return false;
  const hit = s.traps.filter((t) => t.tile === tileId && t.owner !== p.id);
  if (!hit.length) return false;
  s.traps = s.traps.filter((t) => !hit.includes(t));
  for (const t of hit) ev.push({ type: 'trap_sprung', tile: tileId, owner: t.owner, victim: p.id });
  sendToJail(s, ev, p, 'trap');
  return true;
}

function land(s, ev, p, depth = 0) {
  const tileId = p.pos;
  const tile = TILES[tileId];
  ev.push({ type: 'land', player: p.id, tile: tileId });
  if (springTraps(s, ev, p, tileId)) return; // thrown in jail: the tile's own effect never happens
  switch (tile.type) {
    case 'property':
    case 'transport':
    case 'utility': {
      const ownerId = s.owners[tileId];
      if (ownerId === null || ownerId === undefined) {
        if (p.cash >= tile.price) {
          s.pending = { type: 'buy', tile: tileId, price: tile.price };
          s.phase = 'buy';
        }
      } else if (ownerId !== p.id) {
        const owner = byId(s, ownerId);
        if (owner && !owner.bankrupt) {
          runPayments(s, ev, [{ from: p.id, to: ownerId, amount: rentOf(s, tileId, ownerId, diceTotal(s)), reason: 'rent' }]);
        }
      }
      break;
    }
    case 'tax':
      if (s.event && s.event.id === 'tax_holiday') break; // GHMC / ORR cost nothing this round
      // A percentage tax (GHMC) is measured on the same net worth the goal check uses.
      runPayments(s, ev, [{ from: p.id, to: null, amount: taxDue(tile, netWorth(s, p.id)), reason: 'tax' }]);
      break;
    case 'kismet': // both card squares (Farman + Khazana) draw from the one shared deck
      if (depth < MAX_CARD_DEPTH) drawCard(s, ev, p, depth, tile.deck);
      break;
    case 'gotojail':
      sendToJail(s, ev, p, 'gotojail'); // straight to Chanchalguda, no salary
      break;
    default:
      if (tileId === PARKING_TILE) earnToken(s, ev, p, 'chai'); // Irani Chai break: a Snatch token
      break; // start, jail (just visiting)
  }
}

function drawCard(s, ev, p, depth, deck) {
  if (s.deckPos >= s.deck.length) {
    const held = s.players.some((q) => (q.jailCards || 0) > 0);
    const all = KISMET.map((_, i) => i).filter((i) => !(held && i === JAIL_CARD_INDEX));
    s.deck = shuffle(s, all);
    s.deckPos = 0;
  }
  const card = KISMET[s.deck[s.deckPos]];
  s.deckPos += 1;
  ev.push({ type: 'card', player: p.id, cardId: card.id, kind: card.kind, deck, title: card.title, text: card.text });
  const fx = card.effect;
  switch (fx.type) {
    case 'cash':
      if (fx.amount >= 0) gain(s, ev, p, fx.amount, 'card');
      else runPayments(s, ev, [{ from: p.id, to: null, amount: -fx.amount, reason: 'card' }]);
      break;
    case 'moveTo': {
      const steps = (fx.tile - p.pos + BOARD_SIZE) % BOARD_SIZE;
      if (steps === 0) break;
      moveForward(s, ev, p, steps, !!fx.collect);
      land(s, ev, p, depth + 1);
      break;
    }
    case 'moveBy':
      if (fx.n >= 0) moveForward(s, ev, p, fx.n, true);
      else moveBackward(s, ev, p, -fx.n);
      land(s, ev, p, depth + 1);
      break;
    case 'jail':
      sendToJail(s, ev, p, 'card');
      break;
    case 'jailCard':
      p.jailCards = (p.jailCards || 0) + 1;
      break;
    case 'collectFromAll':
      runPayments(s, ev, activePlayers(s).filter((q) => q.id !== p.id).map((q) => ({ from: q.id, to: p.id, amount: fx.amount, reason: 'card' })));
      break;
    case 'payAll':
      runPayments(s, ev, activePlayers(s).filter((q) => q.id !== p.id).map((q) => ({ from: p.id, to: q.id, amount: fx.amount, reason: 'card' })));
      break;
    default:
      break;
  }
}

/** Opening bid of an auction for a declined (or snatched-over) tile: a tenth of its price. */
const declinedMinBid = (tile) => Math.max(10, Math.round((TILES[tile].price * 0.1) / 10) * 10);

/** Open a sealed auction for `tile`. Players who cannot afford `minBid` are auto-passed. */
function openAuction(s, ev, tile, minBid) {
  s.pending = { type: 'auction', tile, minBid, bids: {} };
  s.phase = 'auction';
  ev.push({ type: 'auction_start', tile, minBid });
  for (const q of activePlayers(s)) if (q.cash < minBid) s.pending.bids[q.id] = 0;
  maybeResolveAuction(s, ev);
}

function maybeResolveAuction(s, ev) {
  const pend = s.pending;
  if (s.phase !== 'auction' || !pend) return;
  if (!activePlayers(s).every((p) => p.id in pend.bids)) return;

  // Highest bid wins; ties go to the earliest seat starting from the current turn player.
  const n = s.players.length;
  let winner = null;
  let best = 0;
  for (let k = 0; k < n; k++) {
    const p = s.players[(s.turn + k) % n];
    if (p.bankrupt) continue;
    const bid = pend.bids[p.id] || 0;
    if (bid >= pend.minBid && bid <= p.cash && bid > best) {
      best = bid;
      winner = p;
    }
  }
  const bids = {};
  for (const p of s.players) bids[p.id] = pend.bids[p.id] || 0;
  const end = { type: 'auction_end', tile: pend.tile, winner: winner ? winner.id : null, amount: winner ? best : 0, bids };
  if (pend.snatch) {
    end.reason = 'snatch';
    end.buyer = pend.buyer;
  }
  ev.push(end);
  if (winner) {
    winner.cash -= best;
    ev.push({ type: 'cash', player: winner.id, delta: -best, reason: 'auction' });
    s.owners[pend.tile] = winner.id;
    ev.push({ type: 'own', tile: pend.tile, owner: winner.id, reason: 'auction' });
    winner.stats.propertiesBought += 1;
    if (pend.snatch) spendToken(s, ev, winner); // only whoever ends up with the tile pays the token
    emitSets(s, ev, winner.id, [pend.tile]);
  } else if (pend.snatch) {
    keepWithBuyer(s, ev, pend.tile, pend.buyer);
  }
  s.pending = null;
  s.phase = pend.returnPhase || 'manage';
}

// ---------------------------------------------------------------------------------------------
// Snatch (docs/GAME_RULES.md section 9): after a landing BUY the other players get a short window to
// hit Snatch. One presser takes the tile for free (the buyer is NOT refunded); several press into a
// sealed bidding among the pressers only. Pressing is sealed: it never emits an event.
// ---------------------------------------------------------------------------------------------

function spendToken(s, ev, p) {
  p.snatches = Math.max(0, (p.snatches || 0) - 1);
  ev.push({ type: 'snatch_token', player: p.id, snatches: p.snatches });
}

/** The set celebration the buyer was denied while the tile was contested. */
function keepWithBuyer(s, ev, tile, buyerId) {
  const buyer = byId(s, buyerId);
  if (buyer && !buyer.bankrupt && s.owners[tile] === buyerId) emitSets(s, ev, buyerId, [tile]);
}

/** Players who can still act in the open window: eligible, not bankrupt. */
const snatchVoters = (s) => s.pending.eligible.filter((id) => !byId(s, id)?.bankrupt);

function openSnatch(s, ev, buyer, tile, price) {
  const eligible = activePlayers(s).filter((q) => q.id !== buyer.id && (q.snatches || 0) > 0).map((q) => q.id);
  if (!eligible.length) return false;
  s.pending = { type: 'snatch', tile, buyer: buyer.id, price, eligible, claims: [], ms: s.cfg.snatchMs, returnPhase: 'manage' };
  s.phase = 'snatch';
  ev.push({ type: 'snatch_open', tile, buyer: buyer.id, price, eligible: [...eligible], ms: s.cfg.snatchMs });
  return true;
}

/** Close the window: nothing, a free transfer to the single presser, or sealed bidding among 2+ pressers. */
function resolveSnatch(s, ev) {
  const pend = s.pending;
  const { tile, buyer, price } = pend;
  // A buyer who resigned mid-window already handed the tile to the bank / an heir: only a tile that is
  // still the buyer's (or the bank's) can be snatched.
  const holder = s.owners[tile];
  const contestable = holder === buyer || holder === null || holder === undefined;
  const claimants = contestable ? pend.claims.filter((id) => !byId(s, id)?.bankrupt) : [];
  s.pending = null;
  s.phase = pend.returnPhase || 'manage';
  if (claimants.length === 0) {
    ev.push({ type: 'snatch_end', tile, buyer, outcome: 'none' });
    keepWithBuyer(s, ev, tile, buyer);
    return;
  }
  if (claimants.length === 1) {
    const taker = byId(s, claimants[0]);
    s.owners[tile] = taker.id;
    taker.stats.propertiesBought += 1;
    ev.push({ type: 'snatch_end', tile, buyer, outcome: 'snatched', winner: taker.id, claimants: [taker.id] });
    ev.push({ type: 'own', tile, owner: taker.id, reason: 'snatch' });
    spendToken(s, ev, taker);
    emitSets(s, ev, taker.id, [tile]);
    return;
  }
  const minBid = declinedMinBid(tile);
  ev.push({ type: 'snatch_end', tile, buyer, outcome: 'bidding', claimants: [...claimants] });
  s.pending = { type: 'auction', tile, minBid, bids: {}, snatch: true, buyer, claimants: [...claimants], returnPhase: pend.returnPhase || 'manage' };
  s.phase = 'auction';
  ev.push({ type: 'auction_start', tile, minBid, reason: 'snatch', eligible: [...claimants] });
  for (const q of activePlayers(s)) {
    if (!claimants.includes(q.id) || q.cash < minBid) s.pending.bids[q.id] = 0; // non-claimants (and the broke) auto-pass
  }
  maybeResolveAuction(s, ev);
}

/** Resolve at once when every player who could still press has pressed. */
function maybeCloseSnatch(s, ev) {
  if (s.phase !== 'snatch' || !s.pending) return;
  if (snatchVoters(s).every((id) => s.pending.claims.includes(id))) resolveSnatch(s, ev);
}

// ---------------------------------------------------------------------------------------------
// Turn flow and win check
// ---------------------------------------------------------------------------------------------

/** A new round begins: last round's city event ends, and every EVENT_EVERY-th round draws a new one (seeded rng). */
function startRound(s, ev) {
  s.event = null;
  if (s.cfg.maxRounds != null && s.round > s.cfg.maxRounds) return; // the round limit just ended the game: no event
  if (s.round % EVENT_EVERY !== 0) return;
  const def = CITY_EVENTS[randInt(s, CITY_EVENTS.length)];
  const event = { id: def.id, title: def.title, text: def.text, kind: def.kind, round: s.round };
  if (def.group) {
    const all = Object.keys(GROUPS);
    const owned = all.filter((g) => GROUP_TILES[g].some((t) => s.owners[t] !== null && s.owners[t] !== undefined));
    const pool = owned.length ? owned : all;
    event.group = pool[randInt(s, pool.length)];
    event.mult = def.mult;
  }
  if (def.amount) event.amount = def.amount;
  s.event = event;
  ev.push({ type: 'city_event', ...event });
  if (def.id === 'bonalu') for (const q of activePlayers(s)) gain(s, ev, q, def.amount, 'event');
}

function endTurn(s, ev) {
  const n = s.players.length;
  const cur = s.turn;
  const me = s.players[cur];
  me.sixes = 0;
  me.rentStreak = (me.rentThisTurn || 0) >= DICE_RULES.mercy.minRent ? (me.rentStreak || 0) + 1 : 0;
  me.rentThisTurn = 0;
  s.extraRoll = false;
  s.pending = null;
  let next = cur;
  for (let k = 1; k <= n; k++) {
    next = (cur + k) % n;
    if (!s.players[next].bankrupt) break;
  }
  if (next <= cur) {
    s.round += 1;
    startRound(s, ev);
  }
  s.turn = next;
  s.phase = 'roll';
  s.turnCount += 1;
  ev.push({ type: 'turn', player: s.players[next].id, round: s.round });
}

function checkWin(s, ev) {
  if (s.phase === 'over') return;
  const active = activePlayers(s);
  let winner = null;
  let reason = null;
  if (active.length <= 1) {
    winner = active[0] || null;
    reason = 'last_standing';
  } else {
    let bestWorth = -Infinity;
    for (const p of active) {
      const w = netWorth(s, p.id);
      if (w >= s.cfg.goal && w > bestWorth) {
        bestWorth = w;
        winner = p;
      }
    }
    if (winner) reason = 'net_worth';
    else if (s.cfg.maxRounds != null && s.round > s.cfg.maxRounds) {
      // Richest wins; ties go to the most cash, then the earliest seat.
      let bestCash = -Infinity;
      for (const p of active) {
        const w = netWorth(s, p.id);
        if (w > bestWorth || (w === bestWorth && p.cash > bestCash)) {
          bestWorth = w;
          bestCash = p.cash;
          winner = p;
        }
      }
      reason = 'rounds';
    }
  }
  if (!reason) return;
  s.phase = 'over';
  s.pending = null;
  s.trade = null;
  s.debt = null;
  s.extraRoll = false;
  s.winner = winner ? winner.id : null;
  s.winReason = reason;
  ev.push({ type: 'win', player: s.winner, reason, worth: winner ? netWorth(s, winner.id) : 0 });
}

/** Runs after every action: auto-ends the turn of a bankrupt player, then checks for a winner. */
function settle(s, ev) {
  if (s.phase !== 'over' && activePlayers(s).length >= 2) {
    const tp = turnPlayer(s);
    if (tp.bankrupt && s.phase !== 'auction' && s.phase !== 'debt' && s.phase !== 'snatch') endTurn(s, ev);
  }
  checkWin(s, ev);
}

// ---------------------------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------------------------

function normSide(side) {
  const src = side && typeof side === 'object' ? side : {};
  const cash = src.cash === undefined || src.cash === null ? 0 : src.cash;
  const tiles = src.tiles === undefined || src.tiles === null ? [] : src.tiles;
  if (!Number.isInteger(cash) || cash < 0) return null;
  if (!Array.isArray(tiles) || !tiles.every((t) => Number.isInteger(t) && t >= 0 && t < BOARD_SIZE)) return null;
  if (new Set(tiles).size !== tiles.length) return null;
  return { cash, tiles: [...tiles] };
}

/** null when the trade is valid, else the reason. `give` leaves `from`, `get` leaves `to`. */
function tradeProblem(s, from, to, give, get) {
  if (!from || !to || from.bankrupt || to.bankrupt || from.id === to.id) return 'Pick another active player to trade with';
  if (!give || !get) return 'Invalid offer';
  if (give.cash + get.cash + give.tiles.length + get.tiles.length === 0) return 'The offer is empty';
  if (give.cash > from.cash) return 'You do not have that much cash';
  if (get.cash > to.cash) return `${to.name} does not have that much cash`;
  const check = (tiles, owner) => {
    for (const t of tiles) {
      const tile = TILES[t];
      if (!isBuyable(tile)) return 'Only properties, transport and utilities can be traded';
      if (s.owners[t] !== owner.id) return owner === from ? `You do not own ${tile.name}` : `${owner.name} does not own ${tile.name}`;
      if (tile.type === 'property' && groupHasBuildings(s, tile.group)) return `Sell the buildings in ${GROUPS[tile.group].name} before trading ${tile.name}`;
    }
    return null;
  };
  return check(give.tiles, from) || check(get.tiles, to);
}

function doTradeDone(s, ev) {
  const t = s.trade;
  const from = byId(s, t.from);
  const to = byId(s, t.to);
  s.trade = null;
  ev.push({ type: 'trade_done', id: t.id, from: t.from, to: t.to, give: t.give, get: t.get });
  const pay = (a, b, amount) => {
    if (amount <= 0) return;
    a.cash -= amount;
    b.cash += amount;
    ev.push({ type: 'cash', player: a.id, delta: -amount, reason: 'trade', other: b.id });
    ev.push({ type: 'cash', player: b.id, delta: amount, reason: 'trade', other: a.id });
  };
  pay(from, to, t.give.cash);
  pay(to, from, t.get.cash);
  for (const tile of t.give.tiles) {
    s.owners[tile] = to.id;
    ev.push({ type: 'own', tile, owner: to.id, reason: 'trade' });
  }
  for (const tile of t.get.tiles) {
    s.owners[tile] = from.id;
    ev.push({ type: 'own', tile, owner: from.id, reason: 'trade' });
  }
  emitSets(s, ev, to.id, t.give.tiles);
  emitSets(s, ev, from.id, t.get.tiles);
}

// ---------------------------------------------------------------------------------------------
// Action handlers (operate on the cloned state)
// ---------------------------------------------------------------------------------------------

function doRoll(s, ev, action) {
  const p = turnPlayer(s);
  let rolled;
  if (s.cfg.debug === true && Array.isArray(action.dice)) rolled = { values: [...action.dice], assist: null, active: [] };
  else rolled = rollDice(s, p.id, { previewRent });
  const dice = rolled.values; // one element
  s.dice = [...dice];
  ev.push({ type: 'dice', player: p.id, values: [...dice], assist: rolled.assist ?? null });
  const total = dice[0];
  const isSix = total === 6;
  p.rollsSinceSix = isSix ? 0 : (p.rollsSinceSix || 0) + 1;
  if ((rolled.active || []).includes('mercy')) p.rentStreak = 0; // mercy lasts one roll

  const stepAndLand = () => {
    s.phase = 'manage';
    moveForward(s, ev, p, total, true);
    land(s, ev, p, 0);
    if (p.bankrupt || p.jailTurns > 0) endTurn(s, ev); // sent to jail by a card, or out of the game
  };

  if (p.jailTurns > 0) {
    if (isSix) {
      p.jailTurns = 0;
      p.sixes = 0;
      s.extraRoll = false;
      ev.push({ type: 'jail', player: p.id, jailed: false, reason: 'six' });
      stepAndLand();
    } else {
      p.jailTurns -= 1;
      ev.push({ type: 'jail_stay', player: p.id, left: p.jailTurns });
      if (p.jailTurns === 0) ev.push({ type: 'jail', player: p.id, jailed: false, reason: 'served' });
      endTurn(s, ev);
    }
    return;
  }

  if (isSix) {
    p.sixes += 1; // a six rolls again; three sixes in a row are not special
    s.extraRoll = true;
  } else {
    p.sixes = 0;
    s.extraRoll = false;
  }
  stepAndLand();
}

function doBuy(s, ev, shield = false) {
  const p = turnPlayer(s);
  const { tile, price } = s.pending;
  p.cash -= price;
  ev.push({ type: 'cash', player: p.id, delta: -price, reason: 'buy' });
  s.owners[tile] = p.id;
  ev.push({ type: 'own', tile, owner: p.id, reason: 'buy' });
  p.stats.propertiesBought += 1;
  s.pending = null;
  s.phase = 'manage';
  if (shield) {
    // Shield (docs/GAME_RULES.md 10.1): one token buys a purchase nobody can snatch, so no window opens.
    ev.push({ type: 'shield', player: p.id, tile });
    spendToken(s, ev, p);
    emitSets(s, ev, p.id, [tile]);
    return;
  }
  // The set celebration waits for the snatch window, when there is one: the tile may still change hands.
  if (!openSnatch(s, ev, p, tile, price)) emitSets(s, ev, p.id, [tile]);
}

function doSkipBuy(s, ev) {
  const { tile } = s.pending;
  s.pending = null;
  s.phase = 'manage';
  if (s.cfg.auctionOnDecline !== false) openAuction(s, ev, tile, declinedMinBid(tile));
}

function doSnatch(s, p) {
  s.pending.claims.push(p.id); // sealed: no event
}

function doUpgrade(s, ev, tile) {
  const p = turnPlayer(s);
  const cost = upgradeCost(TILES[tile]);
  p.cash -= cost;
  s.levels[tile] += 1;
  p.stats.upgrades += 1;
  ev.push({ type: 'cash', player: p.id, delta: -cost, reason: 'upgrade' });
  ev.push({ type: 'level', tile, level: s.levels[tile], reason: 'upgrade' });
}

function doResign(s, ev, p) {
  const debt = s.debt && s.debt.player === p.id ? s.debt : null;
  bankruptPlayer(s, ev, p, debt ? debt.creditor : null, debt ? debt.reason : 'rent');
  if (debt) {
    s.debt = null;
    s.phase = debt.returnPhase || 'manage';
    runPayments(s, ev, debt.rest || []);
  }
  if (s.phase === 'auction' && s.pending) {
    s.pending.bids[p.id] = 0;
    maybeResolveAuction(s, ev);
  }
  if (s.phase === 'snatch' && s.pending) {
    // A resigning presser drops out; the window itself keeps running (a resigning buyer's tile went back to the bank / heir).
    s.pending.claims = s.pending.claims.filter((id) => id !== p.id);
    maybeCloseSnatch(s, ev);
  }
}

function doPayDebt(s, ev) {
  const d = s.debt;
  const p = byId(s, d.player);
  const creditor = d.creditor ? byId(s, d.creditor) : null;
  s.debt = null;
  s.phase = d.returnPhase || 'manage';
  transfer(s, ev, p, creditor && !creditor.bankrupt ? creditor : null, d.amount, d.reason);
  runPayments(s, ev, d.rest || []);
}

// ---------------------------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------------------------

const TRADE_ANSWERS = ['TRADE_ACCEPT', 'TRADE_REJECT', 'TRADE_CANCEL'];
const DEBT_ACTIONS = ['MORTGAGE', 'SELL_BUILDING', 'PAY_DEBT'];

function validate(prev, action) {
  if (!action || typeof action.type !== 'string') return 'Invalid action';
  if (prev.phase === 'over') return 'The game is over';
  // Server-only: the room fires it when the snatch timer ends. It carries no player (the buyer may have resigned).
  if (action.type === 'SNATCH_CLOSE') return prev.phase === 'snatch' && prev.pending?.type === 'snatch' ? null : 'There is nothing to snatch';
  const p = byId(prev, action.playerId);
  if (!p) return 'Unknown player';
  if (p.bankrupt) return 'You are out of the game';
  const isTurn = turnPlayer(prev).id === p.id;
  const type = action.type;

  if (prev.trade && !TRADE_ANSWERS.includes(type) && type !== 'RESIGN') return 'A trade offer is waiting for an answer';
  if (prev.phase === 'debt' && !DEBT_ACTIONS.includes(type) && type !== 'RESIGN') return 'Raise cash and settle the debt first';
  if (prev.phase === 'snatch' && type !== 'SNATCH' && type !== 'RESIGN') return 'Wait for the snatch window';

  switch (type) {
    case 'ROLL': {
      if (!isTurn) return 'Not your turn';
      if (prev.phase === 'buy') return 'Decide about the property first';
      if (prev.phase === 'auction') return 'An auction is in progress';
      if (prev.phase === 'manage' && !prev.extraRoll) return 'You already rolled. End your turn';
      if (prev.cfg.debug === true && action.dice !== undefined) {
        const d = action.dice;
        if (!Array.isArray(d) || d.length !== 1 || !d.every((x) => Number.isInteger(x) && x >= 1 && x <= 6)) return 'Invalid dice';
      }
      return null;
    }
    case 'PAY_BAIL':
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'roll') return 'You can only pay bail before rolling';
      if (p.jailTurns <= 0) return 'You are not in jail';
      if (p.cash < prev.cfg.bailFine) return `Bail costs ${formatINR(prev.cfg.bailFine)}`;
      return null;
    case 'USE_JAIL_CARD':
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'roll') return 'You can only use the card before rolling';
      if (p.jailTurns <= 0) return 'You are not in jail';
      if (!((p.jailCards || 0) > 0)) return 'You have no Get Out of Jail Free card';
      return null;
    case 'BUY':
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'buy' || !prev.pending) return 'Nothing to buy right now';
      if (p.cash < prev.pending.price) return 'Not enough cash';
      if (action.shield === true) {
        if (!((p.snatches || 0) > 0)) return 'You have no Snatch token to shield with';
        if (!snatchersExist(prev, p.id)) return 'Nobody could snatch it, no need to shield';
      }
      return null;
    case 'PLACE_TRAP':
      if (!isTurn) return 'Not your turn';
      return trapProblem(prev, p, action.tile);
    case 'SKIP_BUY':
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'buy' || !prev.pending) return 'Nothing to skip right now';
      return null;
    case 'UPGRADE': {
      if (!isTurn) return 'Not your turn';
      const c = canUpgrade(prev, p.id, action.tile);
      return c.ok ? null : c.reason;
    }
    case 'MORTGAGE': {
      const c = mortgageCheck(prev, p.id, action.tile);
      return c.ok ? null : c.reason;
    }
    case 'UNMORTGAGE': {
      const c = unmortgageCheck(prev, p.id, action.tile);
      return c.ok ? null : c.reason;
    }
    case 'SELL_BUILDING': {
      const c = sellCheck(prev, p.id, action.tile);
      return c.ok ? null : c.reason;
    }
    case 'PAY_DEBT':
      if (prev.phase !== 'debt' || !prev.debt) return 'You do not owe anything right now';
      if (prev.debt.player !== p.id) return 'This is not your debt';
      if (p.cash < prev.debt.amount) return `Raise ${formatINR(prev.debt.amount - p.cash)} more first`;
      return null;
    case 'END_TURN':
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'manage') return 'You cannot end your turn yet';
      if (prev.extraRoll) return 'You rolled a six. Roll again';
      return null;
    case 'BID': {
      if (prev.phase !== 'auction' || !prev.pending) return 'There is no auction right now';
      if (p.id in prev.pending.bids) return 'You already placed your bid';
      const a = action.amount;
      if (!Number.isInteger(a) || a < 0) return 'Invalid bid';
      if (a === 0) return null;
      if (a < prev.pending.minBid) return `The minimum bid is ${formatINR(prev.pending.minBid)}`;
      if (a > p.cash) return 'You cannot bid more than your cash';
      return null;
    }
    case 'TRADE_OFFER': {
      if (!isTurn) return 'Not your turn';
      if (prev.phase !== 'roll' && prev.phase !== 'manage') return 'Finish the current step before trading';
      if (prev.pending) return 'Finish the current step before trading';
      const to = byId(prev, action.to);
      const give = normSide(action.give);
      const get = normSide(action.get);
      if (!give || !get) return 'Invalid offer';
      return tradeProblem(prev, p, to, give, get);
    }
    case 'TRADE_ACCEPT':
    case 'TRADE_REJECT':
      if (!prev.trade) return 'There is no trade offer';
      if (prev.trade.to !== p.id) return 'This offer is not for you';
      return null;
    case 'TRADE_CANCEL':
      if (!prev.trade) return 'There is no trade offer';
      if (prev.trade.from !== p.id) return 'Only the player who made the offer can cancel it';
      return null;
    case 'SNATCH': {
      const pend = prev.pending;
      if (prev.phase !== 'snatch' || !pend || pend.type !== 'snatch') return 'There is nothing to snatch';
      if (!pend.eligible.includes(p.id)) return 'You cannot snatch this one';
      if (pend.claims.includes(p.id)) return 'You already pressed Snatch';
      return null;
    }
    case 'RESIGN':
      return null;
    default:
      return `Unknown action ${type}`;
  }
}

export function applyAction(prev, action) {
  const error = validate(prev, action);
  if (error) return { state: prev, events: [], error };

  const s = structuredClone(prev);
  if (!s.mortgaged) s.mortgaged = Array(BOARD_SIZE).fill(false); // saves from before rules v2
  if (!s.traps) s.traps = []; // saves from before traps
  const ev = [];
  const p = byId(s, action.playerId); // undefined for the server-only SNATCH_CLOSE

  switch (action.type) {
    case 'ROLL':
      doRoll(s, ev, action);
      break;
    case 'PAY_BAIL':
      p.cash -= s.cfg.bailFine;
      p.jailTurns = 0;
      ev.push({ type: 'cash', player: p.id, delta: -s.cfg.bailFine, reason: 'bail' });
      ev.push({ type: 'jail', player: p.id, jailed: false, reason: 'bail' });
      break;
    case 'USE_JAIL_CARD':
      p.jailCards -= 1;
      p.jailTurns = 0;
      s.deck.push(JAIL_CARD_INDEX);
      ev.push({ type: 'jail', player: p.id, jailed: false, reason: 'card_used' });
      break;
    case 'BUY':
      doBuy(s, ev, action.shield === true);
      break;
    case 'PLACE_TRAP':
      p.traps -= 1;
      s.traps.push({ tile: action.tile, owner: p.id });
      ev.push({ type: 'trap_placed', player: p.id }); // never names the tile
      break;
    case 'SKIP_BUY':
      doSkipBuy(s, ev);
      break;
    case 'UPGRADE':
      doUpgrade(s, ev, action.tile);
      break;
    case 'MORTGAGE': {
      const value = mortgageValue(TILES[action.tile]);
      s.mortgaged[action.tile] = true;
      p.cash += value;
      ev.push({ type: 'mortgage', player: p.id, tile: action.tile, value });
      ev.push({ type: 'cash', player: p.id, delta: value, reason: 'mortgage' });
      break;
    }
    case 'UNMORTGAGE': {
      const cost = unmortgageCost(TILES[action.tile]);
      s.mortgaged[action.tile] = false;
      p.cash -= cost;
      ev.push({ type: 'unmortgage', player: p.id, tile: action.tile, cost });
      ev.push({ type: 'cash', player: p.id, delta: -cost, reason: 'unmortgage' });
      break;
    }
    case 'SELL_BUILDING': {
      const refund = refundPerLevel(TILES[action.tile]);
      s.levels[action.tile] -= 1;
      p.cash += refund;
      ev.push({ type: 'level', tile: action.tile, level: s.levels[action.tile], reason: 'sell' });
      ev.push({ type: 'cash', player: p.id, delta: refund, reason: 'sell' });
      break;
    }
    case 'PAY_DEBT':
      doPayDebt(s, ev);
      break;
    case 'END_TURN':
      endTurn(s, ev);
      break;
    case 'BID':
      s.pending.bids[p.id] = action.amount;
      maybeResolveAuction(s, ev);
      break;
    case 'TRADE_OFFER': {
      s.tradeSeq = (s.tradeSeq || 0) + 1;
      s.trade = { id: s.tradeSeq, from: p.id, to: action.to, give: normSide(action.give), get: normSide(action.get) };
      p.lastOfferTurn = s.turnCount;
      ev.push({ type: 'trade_offer', id: s.trade.id, from: s.trade.from, to: s.trade.to, give: s.trade.give, get: s.trade.get });
      break;
    }
    case 'TRADE_ACCEPT': {
      const t = s.trade;
      const problem = tradeProblem(s, byId(s, t.from), byId(s, t.to), t.give, t.get);
      if (problem) {
        ev.push({ type: 'trade_rejected', id: t.id, from: t.from, to: t.to, reason: 'invalid' });
        s.trade = null;
      } else {
        doTradeDone(s, ev);
      }
      break;
    }
    case 'TRADE_REJECT':
    case 'TRADE_CANCEL': {
      const t = s.trade;
      ev.push({ type: 'trade_rejected', id: t.id, from: t.from, to: t.to, reason: action.type === 'TRADE_CANCEL' ? 'cancelled' : 'rejected' });
      s.trade = null;
      break;
    }
    case 'SNATCH':
      doSnatch(s, p);
      maybeCloseSnatch(s, ev);
      break;
    case 'SNATCH_CLOSE':
      resolveSnatch(s, ev);
      break;
    case 'RESIGN':
      doResign(s, ev, p);
      break;
    default:
      break;
  }

  settle(s, ev);
  return { state: s, events: ev };
}

/** The context dice.js needs (`rollDice`, `diceOdds`, `landingOdds`): pass it as the third argument. */
export const diceCtx = { previewRent };
