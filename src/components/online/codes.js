// Pure helpers for room codes and friend codes (no React, unit-tested).
// Alphabet: no 0/O/1/I so codes survive being read out loud or typed from a screenshot.

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const FRIEND_PREFIX = 'HYD';
export const FRIEND_CODE_BODY = 4;

const ALLOWED = new Set(CODE_ALPHABET);

/** Pull a code out of whatever was pasted: "abc 234", "https://x.dev/join/abc234?x=1", "ABC-234" … */
function stripUrl(raw) {
  let s = String(raw ?? '').trim();
  if (/^https?:\/\//i.test(s) || s.includes('/')) {
    s = s.split(/[?#]/)[0].replace(/\/+$/, '');
    s = s.slice(s.lastIndexOf('/') + 1);
  }
  return s;
}

/** Normalise user input to at most 6 valid room-code characters (uppercase, junk removed). */
export function normalizeRoomCode(raw) {
  let out = '';
  for (const ch of stripUrl(raw).toUpperCase()) {
    if (ALLOWED.has(ch)) out += ch;
    if (out.length >= ROOM_CODE_LENGTH) break;
  }
  return out;
}

export function isRoomCode(code) {
  return typeof code === 'string' && code.length === ROOM_CODE_LENGTH && [...code].every((c) => ALLOWED.has(c));
}

/**
 * Normalise a friend code while typing. Accepts "7k2q", "hyd7k2q", "HYD-7K2Q", "hyd 7k2q".
 * Returns '' for empty input, otherwise "HYD-" + up to 4 valid characters (so "HYD-7K" mid-typing).
 */
export function normalizeFriendCode(raw) {
  let s = String(raw ?? '').toUpperCase();
  s = s.replace(/[^A-Z0-9]/g, '');
  if (s.startsWith(FRIEND_PREFIX)) s = s.slice(FRIEND_PREFIX.length);
  let body = '';
  for (const ch of s) {
    if (ALLOWED.has(ch)) body += ch;
    if (body.length >= FRIEND_CODE_BODY) break;
  }
  if (!body) return '';
  return `${FRIEND_PREFIX}-${body}`;
}

export function isFriendCode(code) {
  return typeof code === 'string' && new RegExp(`^${FRIEND_PREFIX}-[${CODE_ALPHABET}]{${FRIEND_CODE_BODY}}$`).test(code);
}

/** Only allow same-site relative redirects (`?next=`): no `//evil.com`, no `https:`, no backslashes. */
export function safeNext(next, fallback = '/') {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/^\/(login)(\/|\?|$)/.test(next)) return fallback;
  return next;
}

/** Room-code characters laid out for display: "ABC 234". */
export function spacedCode(code) {
  const c = String(code ?? '');
  return c.length === ROOM_CODE_LENGTH ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

export function lobbyLink(code, origin = globalThis.location?.origin ?? '') {
  return `${origin}/join/${code}`;
}

/** WhatsApp invite text (Telugu first, English second) + wa.me link. */
export function inviteText(code, origin) {
  return (
    `హైదరాబాద్ టైకూన్ ఆడదాం రండి! 🎲\n` +
    `Come play Hyderabad Tycoon with me! Room code: ${code}\n` +
    lobbyLink(code, origin)
  );
}

export function whatsappUrl(code, origin) {
  return `https://wa.me/?text=${encodeURIComponent(inviteText(code, origin))}`;
}

export function friendShareText(friendCode, origin = globalThis.location?.origin ?? '') {
  return `Add me on Hyderabad Tycoon! Friend code: ${friendCode}\n${origin}/friends?add=${friendCode}`;
}

/**
 * Can the current user enter this room? `info` is GET /api/rooms/:code.
 * Returns a human message when not, or null when fine. Players already in the room may always come back
 * (reconnect to a running game, rejoin a full lobby).
 */
export function roomProblem(info, myId) {
  if (!info || info.exists === false) return 'No room with that code. Check it and try again.';
  if (info.isMember === true) return null;
  const players = Array.isArray(info.players) ? info.players : null;
  if (players && myId != null && players.some((p) => p && p.id != null && String(p.id) === String(myId))) return null;
  if (info.status === 'finished') return 'That game has already ended.';
  if (info.status === 'playing') return 'That game has already started.';
  const count = players ? players.length : Number(info.players);
  if (Number.isFinite(count) && Number.isFinite(info.maxPlayers) && info.maxPlayers > 0 && count >= info.maxPlayers) return 'That room is full.';
  return null;
}
