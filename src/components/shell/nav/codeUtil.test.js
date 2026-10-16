import { describe, expect, it } from 'vitest';
import { isCode, normalizeCode } from './codeUtil.js';
import { isActive, NAV_ITEMS } from './navItems.js';

describe('code sheet input', () => {
  it('uppercases, drops junk and caps at six characters', () => {
    expect(normalizeCode('ab c-234x')).toBe('ABC234');
    expect(normalizeCode('  k7m2qx  ')).toBe('K7M2QX');
    expect(normalizeCode('')).toBe('');
    expect(normalizeCode(null)).toBe('');
  });
  it('skips look-alike characters the server never issues', () => {
    expect(normalizeCode('0O1I')).toBe('');
  });
  it('extracts the code from a pasted invite link', () => {
    expect(normalizeCode('https://gamehub.dev/join/abc234?x=1')).toBe('ABC234');
    expect(normalizeCode('/join/K7M2QX/')).toBe('K7M2QX');
  });
  it('validates complete codes only', () => {
    expect(isCode('ABC234')).toBe(true);
    expect(isCode('ABC23')).toBe(false);
    expect(isCode('ABC230')).toBe(false);
  });
});

describe('hub navigation', () => {
  const by = (id) => NAV_ITEMS.find((i) => i.id === id);
  it('has the four hub destinations in order', () => {
    expect(NAV_ITEMS.map((i) => i.to)).toEqual(['/', '/friends', '/leaderboard', '/profile']);
  });
  it('lights up the right tab for nested routes', () => {
    expect(isActive(by('games'), '/')).toBe(true);
    expect(isActive(by('games'), '/games/hyderabad-tycoon/tables')).toBe(true);
    expect(isActive(by('games'), '/lobby/ABC234')).toBe(true);
    expect(isActive(by('games'), '/friends')).toBe(false);
    expect(isActive(by('friends'), '/f/HYD-7K2Q')).toBe(true);
    expect(isActive(by('rank'), '/leaderboard')).toBe(true);
    expect(isActive(by('profile'), '/login')).toBe(true);
    expect(isActive(by('profile'), '/profile')).toBe(true);
    expect(isActive(by('games'), '/zzz')).toBe(false);
  });
});
