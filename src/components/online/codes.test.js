import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  normalizeRoomCode,
  isRoomCode,
  normalizeFriendCode,
  isFriendCode,
  safeNext,
  spacedCode,
  inviteText,
  inviteMessage,
  joinLink,
  whatsappUrl,
  friendLinkUrl,
  friendInviteMessage,
  friendShareText,
  parseFriendLink,
  playerCountOf,
} from './codes.js';

describe('normalizeRoomCode', () => {
  it('uppercases and strips spaces, dashes and ambiguous characters', () => {
    expect(normalizeRoomCode('abc 234')).toBe('ABC234');
    expect(normalizeRoomCode('ab-c2-34')).toBe('ABC234');
    expect(normalizeRoomCode('0O1Iabc')).toBe('ABC'); // 0 O 1 I are not in the alphabet
  });
  it('caps at 6 characters', () => {
    expect(normalizeRoomCode('ABCDEFGHJK')).toBe('ABCDEF');
  });
  it('extracts the code from a pasted link', () => {
    expect(normalizeRoomCode('https://hyderabad-tycoon.dev/join/abc234')).toBe('ABC234');
    expect(normalizeRoomCode('http://localhost:5173/join/xyz789?utm=1#top')).toBe('XYZ789');
    expect(normalizeRoomCode('/join/ABC234/')).toBe('ABC234');
  });
  it('handles junk', () => {
    expect(normalizeRoomCode(null)).toBe('');
    expect(normalizeRoomCode(undefined)).toBe('');
    expect(normalizeRoomCode(12345)).toBe('2345');
    expect(normalizeRoomCode('   ')).toBe('');
  });
});

describe('isRoomCode', () => {
  it('accepts exactly 6 alphabet characters', () => {
    expect(isRoomCode('ABC234')).toBe(true);
    expect(isRoomCode('ABC23')).toBe(false);
    expect(isRoomCode('ABC2345')).toBe(false);
    expect(isRoomCode('abc234')).toBe(false);
    expect(isRoomCode('ABCO34')).toBe(false);
    expect(isRoomCode(null)).toBe(false);
  });
  it('alphabet has 32 unambiguous characters', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(/[01OI]/.test(CODE_ALPHABET)).toBe(false);
  });
});

describe('friend codes', () => {
  it('normalises while typing', () => {
    expect(normalizeFriendCode('7k2q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('hyd7k2q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('hyd-7k2q')).toBe('HYD-7K2Q');
    expect(normalizeFriendCode('HYD 7K')).toBe('HYD-7K');
    expect(normalizeFriendCode('  ')).toBe('');
    expect(normalizeFriendCode('HYD')).toBe('');
    expect(normalizeFriendCode('7K2QZZ')).toBe('HYD-7K2Q');
  });
  it('validates the final shape', () => {
    expect(isFriendCode('HYD-7K2Q')).toBe(true);
    expect(isFriendCode('HYD-7K2')).toBe(false);
    expect(isFriendCode('HYD-7K2O')).toBe(false);
    expect(isFriendCode('hyd-7k2q')).toBe(false);
    expect(isFriendCode('')).toBe(false);
  });
});

describe('safeNext', () => {
  it('allows same-site paths only', () => {
    expect(safeNext('/join/ABC234')).toBe('/join/ABC234');
    expect(safeNext('/friends?room=ABC234')).toBe('/friends?room=ABC234');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('/\\evil.com')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('/login?next=/x')).toBe('/');
    expect(safeNext('nope', '/home')).toBe('/home');
  });
});

describe('sharing', () => {
  it('formats the code', () => {
    expect(spacedCode('ABC234')).toBe('ABC 234');
    expect(spacedCode('AB')).toBe('AB');
  });
  it('builds the room link from paths.join (origin + /join/CODE)', () => {
    expect(joinLink('ABC234', 'https://h.dev')).toBe('https://h.dev/join/ABC234');
    expect(joinLink('ABC234', '')).toBe('/join/ABC234');
  });
  it('builds the invite message (names the game) and the wa.me link', () => {
    const t = inviteText('ABC234', 'Hyderabad Tycoon', 'https://h.dev');
    expect(t).toContain('Hyderabad Tycoon');
    expect(t).toContain('GameHub');
    expect(t).toContain('ABC234');
    expect(t).toContain('https://h.dev/join/ABC234');
    const m = inviteMessage('ABC234', 'Ludo Lanes', 'https://h.dev');
    expect(m).toEqual({ title: 'Ludo Lanes', text: expect.stringContaining('Ludo Lanes'), url: 'https://h.dev/join/ABC234' });
    expect(m.text).not.toContain('https://');
    const u = whatsappUrl('ABC234', 'Hyderabad Tycoon', 'https://h.dev');
    expect(u.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(u.slice('https://wa.me/?text='.length))).toBe(t);
  });
  it('falls back to the brand name when the game is unknown', () => {
    expect(inviteText('ABC234', undefined, 'https://h.dev')).toContain('Come play GameHub with me');
  });
});

describe('friend links', () => {
  it('builds /f/CODE on the origin and a share message that carries it', () => {
    expect(friendLinkUrl('HYD-7K2Q', 'https://h.dev')).toBe('https://h.dev/f/HYD-7K2Q');
    const m = friendInviteMessage('HYD-7K2Q', 'https://h.dev');
    expect(m.url).toBe('https://h.dev/f/HYD-7K2Q');
    expect(m.text).toContain('HYD-7K2Q');
    expect(friendShareText('HYD-7K2Q', 'https://h.dev')).toBe(`${m.text}\n${m.url}`);
  });
  it('parses codes out of anything pasted', () => {
    expect(parseFriendLink('HYD-7K2Q')).toBe('HYD-7K2Q');
    expect(parseFriendLink(' hyd 7k2q ')).toBe('HYD-7K2Q');
    expect(parseFriendLink('7k2q')).toBe('HYD-7K2Q');
    expect(parseFriendLink('https://gamehub.dev/f/HYD-7K2Q')).toBe('HYD-7K2Q');
    expect(parseFriendLink('https://gamehub.dev/f/hyd7k2q?utm=1#x')).toBe('HYD-7K2Q');
    expect(parseFriendLink('/f/HYD-7K2Q')).toBe('HYD-7K2Q');
    expect(parseFriendLink('http://localhost:5173/f/HYD%2D7K2Q')).toBe('HYD-7K2Q');
    expect(parseFriendLink('https://gamehub.dev/friends?add=HYD-7K2Q')).toBe('HYD-7K2Q'); // old share links keep working
  });
  it('rejects anything that is not a complete friend code', () => {
    for (const bad of ['', '   ', null, undefined, 'HYD-7K2', 'HYD-7K2O', 'hello', 'https://gamehub.dev/join/ABC234', 'https://gamehub.dev/f/', '/f/HYD-', 'https://x.dev/?add=']) {
      expect(parseFriendLink(bad), String(bad)).toBe('');
    }
  });
  it('a pasted friend link round-trips through friendLinkUrl', () => {
    expect(parseFriendLink(friendLinkUrl('HYD-9ABC', 'https://h.dev'))).toBe('HYD-9ABC');
  });
});

describe('playerCountOf', () => {
  it('reads a count or a list', () => {
    expect(playerCountOf({ players: 3 })).toBe(3);
    expect(playerCountOf({ players: [{}, {}] })).toBe(2);
    expect(playerCountOf({})).toBe(0);
    expect(playerCountOf(null)).toBe(0);
    expect(playerCountOf({ players: -1 })).toBe(0);
  });
});

import { roomProblem } from './codes.js';

describe('roomProblem', () => {
  const room = (over = {}) => ({ code: 'ABC234', exists: true, status: 'lobby', players: [{ id: 'a' }], maxPlayers: 4, hostName: 'Ravi', ...over });
  it('is fine for an open lobby', () => {
    expect(roomProblem(room(), 'me')).toBeNull();
  });
  it('explains each failure', () => {
    expect(roomProblem(room({ exists: false }), 'me')).toMatch(/No room/);
    expect(roomProblem(null, 'me')).toMatch(/No room/);
    expect(roomProblem(room({ status: 'playing' }), 'me')).toMatch(/already started/);
    expect(roomProblem(room({ status: 'finished' }), 'me')).toMatch(/ended/);
    expect(roomProblem(room({ players: [{ id: 'a' }, { id: 'b' }], maxPlayers: 2 }), 'me')).toMatch(/full/);
  });
  it('lets existing members back in, and copes with a numeric player count', () => {
    expect(roomProblem(room({ status: 'playing', players: [{ id: 'me' }] }), 'me')).toBeNull();
    expect(roomProblem(room({ players: [{ id: 'me' }, { id: 'b' }], maxPlayers: 2 }), 'me')).toBeNull();
    expect(roomProblem(room({ players: 4, maxPlayers: 4 }), 'me')).toMatch(/full/);
    expect(roomProblem(room({ players: 2, maxPlayers: 4 }), 'me')).toBeNull();
  });
});
