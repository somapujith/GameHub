// Room codes and friend codes. Pure helpers (no Worker APIs besides Web Crypto).
// Alphabet is the unambiguous one from the contract: no 0/O, 1/I.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const FRIEND_CODE_PREFIX = 'HYD-';
export const FRIEND_CODE_LENGTH = 4;

const ROOM_RE = new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
const FRIEND_RE = new RegExp(`^${FRIEND_CODE_PREFIX}[${CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`);

/** Uniformly random string over CODE_ALPHABET (32 symbols, so `byte & 31` has no modulo bias). */
export function randomCode(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[bytes[i] & 31];
  return out;
}

export const newRoomCode = () => randomCode(ROOM_CODE_LENGTH);
export const newFriendCode = () => FRIEND_CODE_PREFIX + randomCode(FRIEND_CODE_LENGTH);

/** Uppercase + validate a user-supplied room code. Returns the code or null. */
export function normalizeRoomCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  return ROOM_RE.test(code) ? code : null;
}

/** Accepts `HYD-7K2Q`, `hyd7k2q` or `7K2Q`. Returns the canonical `HYD-XXXX` or null. */
export function normalizeFriendCode(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('HYD') && !s.startsWith(FRIEND_CODE_PREFIX)) s = FRIEND_CODE_PREFIX + s.slice(3);
  if (!s.startsWith(FRIEND_CODE_PREFIX)) s = FRIEND_CODE_PREFIX + s;
  return FRIEND_RE.test(s) ? s : null;
}
