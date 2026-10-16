// Input validation / sanitising. Pure functions, no Worker APIs: easy to unit-test.
import { BOARD_SIZE } from '../shared/board.js';

export const NAME_MAX = 24;
export const AVATAR_MAX = 11;
export const CHAT_MAX = 200;

// C0/C1 controls, zero-width + bidi override/isolate characters, BOM, line/paragraph separators.
// eslint-disable-next-line no-control-regex
const INVISIBLE = new RegExp('[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]', 'g');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/**
 * Clean a display name: strips control/invisible characters, collapses whitespace, trims,
 * truncates to NAME_MAX code points. Returns '' when nothing usable is left.
 */
export function sanitizeName(input, max = NAME_MAX) {
  if (typeof input !== 'string') return '';
  const s = input.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...s];
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

/**
 * Strict name validation for user-submitted names. Returns `{ ok:true, value }` or
 * `{ ok:false, error }`. Names longer than NAME_MAX are rejected (not silently cut).
 */
export function validateName(input) {
  if (typeof input !== 'string') return { ok: false, error: 'Name must be text.' };
  const cleaned = input.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { ok: false, error: 'Name cannot be empty.' };
  if ([...cleaned].length > NAME_MAX) return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` };
  return { ok: true, value: cleaned };
}

/** Avatar preset id: integer 0..11. Returns the number or null. */
export function parseAvatar(v) {
  if (typeof v === 'string' && /^\d{1,2}$/.test(v)) v = Number(v);
  return Number.isInteger(v) && v >= 0 && v <= AVATAR_MAX ? v : null;
}

// Room/engine settings live in ./settings.js (strict, shared by the routes and GameRoom).
export { sanitizeSettings, parseMaxPlayers, MAX_PLAYERS_MIN, MAX_PLAYERS_MAX } from './settings.js';

export const EMOTES = ['emote_mass', 'emote_cheer', 'emote_shock', 'emote_laugh', 'emote_thanks', 'emote_hurry', 'emote_taunt'];

/** Chat text: strip control chars, collapse whitespace, cap length. */
export function sanitizeChat(input) {
  if (typeof input !== 'string') return '';
  const s = input.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...s];
  return chars.length > CHAT_MAX ? chars.slice(0, CHAT_MAX).join('') : s;
}

/** Emote key if it is one of the known soundboard keys, else ''. */
export const sanitizeEmote = (v) => (typeof v === 'string' && EMOTES.includes(v) ? v : '');

// Actions that carry no parameters besides the (server-forced) player id.
const SIMPLE_ACTIONS = new Set([
  'ROLL',
  'PAY_BAIL',
  'BUY',
  'SKIP_BUY',
  'END_TURN',
  'RESIGN',
  'PAY_DEBT',
  'USE_JAIL_CARD',
  'TRADE_ACCEPT',
  'TRADE_REJECT',
  'TRADE_CANCEL',
]);
// Actions that carry a single tile id.
const TILE_ACTIONS = new Set(['UPGRADE', 'MORTGAGE', 'UNMORTGAGE', 'SELL_BUILDING']);
const MAX_MONEY = 100_000_000;

const isTile = (t) => Number.isInteger(t) && t >= 0 && t < BOARD_SIZE;

/** One side of a trade: { cash:int>=0, tiles:int[] (unique, on-board) }, or null if malformed. */
function sanitizeTradeSide(side) {
  if (!side || typeof side !== 'object' || Array.isArray(side)) return null;
  const cash = side.cash === undefined ? 0 : side.cash;
  if (!Number.isInteger(cash) || cash < 0 || cash > MAX_MONEY) return null;
  const tiles = side.tiles === undefined ? [] : side.tiles;
  if (!Array.isArray(tiles) || tiles.length > BOARD_SIZE || !tiles.every(isTile)) return null;
  if (new Set(tiles).size !== tiles.length) return null;
  return { cash, tiles: [...tiles] };
}

/**
 * Action types a client may send (docs/CONTRACT.md sections 3 and 3c), and how to build the
 * clean engine action: `playerId` is forced, unknown fields are dropped, numbers are checked.
 * Whether the action is *legal right now* is the engine's job (applyAction validates).
 * Keep this list in sync with the contract when the engine gains actions.
 */
export function sanitizeAction(input, playerId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const type = input.type;
  if (typeof type !== 'string') return null;
  if (SIMPLE_ACTIONS.has(type)) return { type, playerId };
  if (TILE_ACTIONS.has(type)) return isTile(input.tile) ? { type, tile: input.tile, playerId } : null;
  switch (type) {
    case 'BID': {
      const amount = input.amount;
      if (!Number.isInteger(amount) || amount < 0 || amount > MAX_MONEY) return null;
      return { type, amount, playerId };
    }
    case 'TRADE_OFFER': {
      const to = input.to;
      if (typeof to !== 'string' || !to || to.length > 64 || to === playerId) return null;
      const give = sanitizeTradeSide(input.give);
      const get = sanitizeTradeSide(input.get);
      if (!give || !get) return null;
      if (!give.cash && !give.tiles.length && !get.cash && !get.tiles.length) return null; // empty deal
      return { type, to, give, get, playerId };
    }
    default:
      return null;
  }
}
