// Pre-game room settings (docs/CONTRACT.md sections 3b + 3c). Everything from a client is
// untrusted: the host may only choose the winning target, the round limit, the start cash,
// the dice mode and whether a declined property goes to auction.
// Pure functions - shared by POST /api/rooms and the GameRoom Durable Object.

import * as engine from '../shared/index.js';

export const MAX_PLAYERS_MIN = 2;
export const MAX_PLAYERS_MAX = 6;

// Ranges come from the engine's SETTING_LIMITS so the server can never accept a value the engine
// would clamp. Fallbacks match the contract.
const LIMITS = engine.SETTING_LIMITS || {};
export const GOAL_MIN = LIMITS.goal?.min ?? 10_000;
export const GOAL_MAX = LIMITS.goal?.max ?? 1_000_000;
export const START_CASH_MIN = LIMITS.startCash?.min ?? 5_000;
export const START_CASH_MAX = LIMITS.startCash?.max ?? 100_000;
/** The only round limits accepted: 30, 50 or `null` (= unlimited). */
export const ROUND_LIMITS = [30, 50, null];
/** The only dice modes accepted. */
export const DICE_MODES = ['lucky', 'fair'];

/** What a room starts with when the host picks nothing: the engine's own defaults. */
const D = engine.DEFAULT_SETTINGS || {};
export const ROOM_DEFAULTS = Object.freeze({
  goal: D.goal ?? 70_000,
  startCash: D.startCash ?? 15_000,
  maxRounds: D.maxRounds === undefined ? 50 : D.maxRounds,
  dice: D.dice ?? 'lucky',
  auctionOnDecline: D.auctionOnDecline ?? true,
});

const SETTING_KEYS = Object.keys(ROOM_DEFAULTS);

/** Room seats: integer 2..6, else null. */
export function parseMaxPlayers(v) {
  return Number.isInteger(v) && v >= MAX_PLAYERS_MIN && v <= MAX_PLAYERS_MAX ? v : null;
}

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/**
 * Validate a (partial) settings object from a client.
 *
 * Returns `{ settings, maxPlayers?, errors }`:
 *  - `settings` only contains keys that were present AND valid (`goal`, `startCash`,
 *    `maxRounds`, `dice`, `auctionOnDecline`). `maxRounds: null` (unlimited) is a valid
 *    value, so test with `in`.
 *  - unknown keys (e.g. `debug`, `seed`, or echoed engine defaults) are ignored;
 *  - `maxPlayers` (2..6) is accepted as a convenience for the room seats;
 *  - `errors` holds one clear message per bad value. A missing key / `undefined` means
 *    "leave it alone / use the default".
 */
export function sanitizeSettings(input) {
  const settings = {};
  const errors = [];
  let maxPlayers;
  if (input === undefined || input === null) return { settings, errors };
  if (typeof input !== 'object' || Array.isArray(input)) return { settings, errors: ['Settings must be an object.'] };
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined;

  if (has('goal')) {
    const v = input.goal;
    if (!isInt(v) || v < GOAL_MIN || v > GOAL_MAX) {
      errors.push(`Winning target must be a whole number between ${GOAL_MIN} and ${GOAL_MAX}.`);
    } else settings.goal = v;
  }
  if (has('startCash')) {
    const v = input.startCash;
    if (!isInt(v) || v < START_CASH_MIN || v > START_CASH_MAX) {
      errors.push(`Start cash must be a whole number between ${START_CASH_MIN} and ${START_CASH_MAX}.`);
    } else settings.startCash = v;
  }
  if (has('maxRounds')) {
    const v = input.maxRounds;
    if (v === null || v === 30 || v === 50) settings.maxRounds = v;
    else errors.push('Round limit must be 30, 50 or unlimited (null).');
  }
  if (has('dice')) {
    const v = input.dice;
    if (typeof v === 'string' && DICE_MODES.includes(v)) settings.dice = v;
    else errors.push("Dice must be 'lucky' or 'fair'.");
  }
  if (has('auctionOnDecline')) {
    const v = input.auctionOnDecline;
    if (typeof v === 'boolean') settings.auctionOnDecline = v;
    else errors.push('Auction on decline must be true or false.');
  }
  if (has('maxPlayers')) {
    const mp = parseMaxPlayers(input.maxPlayers);
    if (mp == null) errors.push(`Players must be between ${MAX_PLAYERS_MIN} and ${MAX_PLAYERS_MAX}.`);
    else maxPlayers = mp;
  }
  return { settings, maxPlayers, errors };
}

/** Full, normalised settings: defaults filled in under any valid overrides. */
export function normalizeSettings(partial) {
  const out = { ...ROOM_DEFAULTS };
  if (partial && typeof partial === 'object') {
    // Re-validate defensively: only known keys with valid values can ever get through.
    const { settings } = sanitizeSettings(partial);
    for (const k of SETTING_KEYS) if (k in settings) out[k] = settings[k];
  }
  return out;
}

/** One-line summary, e.g. "Target 70000 / 50 rounds / Start 15000" (for logs). */
export function describeSettings(s) {
  const n = normalizeSettings(s);
  return `Target ${n.goal} / ${n.maxRounds === null ? 'unlimited rounds' : `${n.maxRounds} rounds`} / Start ${n.startCash} / ${n.dice} dice`;
}
