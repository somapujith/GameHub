import { describe, expect, it } from 'vitest';
import { progressOf } from './stores.js';

describe('progressOf (level / XP / coins)', () => {
  const local = { xp: 0, coins: 500 };
  it('uses the server numbers for a signed-in player, guests included', () => {
    const p = progressOf({ xp: 300, coins: 1250, level: 3 }, local);
    expect(p).toMatchObject({ xp: 300, coins: 1250, level: 3 });
    expect(p.info).toMatchObject({ level: 3, into: 0 });
    expect(progressOf({ xp: 0, coins: 0, isGuest: true }, { xp: 900, coins: 9 })).toMatchObject({ xp: 0, coins: 0, level: 1 });
  });
  it('falls back to the on-device profile while signed out or when the server omits a number', () => {
    expect(progressOf(null, { xp: 100, coins: 700 })).toMatchObject({ xp: 100, coins: 700, level: 2 });
    expect(progressOf({ name: 'x' }, { xp: 100, coins: 700 })).toMatchObject({ xp: 100, coins: 700 });
  });
  it('survives a missing profile', () => {
    expect(progressOf(null, undefined)).toMatchObject({ xp: 0, coins: 0, level: 1 });
  });
});
