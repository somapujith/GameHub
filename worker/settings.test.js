import { describe, it, expect } from 'vitest';
import { sanitizeSettings, normalizeSettings, ROOM_DEFAULTS, parseMaxPlayers } from './settings.js';

describe('sanitizeSettings (strict, untrusted input)', () => {
  it('missing / empty means "nothing chosen"', () => {
    expect(sanitizeSettings(undefined)).toEqual({ settings: {}, errors: [] });
    expect(sanitizeSettings(null)).toEqual({ settings: {}, errors: [] });
    expect(sanitizeSettings({}).settings).toEqual({});
    expect(sanitizeSettings({ goal: undefined }).errors).toEqual([]);
  });

  it('accepts valid values', () => {
    const r = sanitizeSettings({ goal: 100000, startCash: 25000, maxRounds: 30, dice: 'fair', auctionOnDecline: false });
    expect(r.errors).toEqual([]);
    expect(r.settings).toEqual({ goal: 100000, startCash: 25000, maxRounds: 30, dice: 'fair', auctionOnDecline: false });
  });

  it('goal: integer 10,000 - 1,000,000', () => {
    for (const ok of [10000, 30000, 70000, 1000000]) expect(sanitizeSettings({ goal: ok }).errors).toEqual([]);
    for (const bad of [9999, 1000001, 0, -5, 70000.5, '70000', NaN, Infinity, null, true, [], {}]) {
      const r = sanitizeSettings({ goal: bad });
      expect(r.errors).toHaveLength(1);
      expect('goal' in r.settings).toBe(false);
    }
  });

  it('startCash: integer 5,000 - 100,000', () => {
    for (const ok of [5000, 10000, 15000, 100000]) expect(sanitizeSettings({ startCash: ok }).errors).toEqual([]);
    for (const bad of [4999, 100001, 0, -1, 15000.2, '15000', NaN, Infinity, null]) {
      const r = sanitizeSettings({ startCash: bad });
      expect(r.errors).toHaveLength(1);
      expect('startCash' in r.settings).toBe(false);
    }
  });

  it('maxRounds: ONLY 30, 50 or null (unlimited)', () => {
    expect(sanitizeSettings({ maxRounds: 30 }).settings).toEqual({ maxRounds: 30 });
    expect(sanitizeSettings({ maxRounds: 50 }).settings).toEqual({ maxRounds: 50 });
    const unlimited = sanitizeSettings({ maxRounds: null });
    expect(unlimited.errors).toEqual([]);
    expect('maxRounds' in unlimited.settings).toBe(true);
    expect(unlimited.settings.maxRounds).toBeNull();
    for (const bad of [0, 1, 29, 31, 49, 51, 120, 100, -1, Infinity, -Infinity, NaN, '30', '50', 'unlimited', true, false, [], {}, 30.5]) {
      const r = sanitizeSettings({ maxRounds: bad });
      expect(r.errors, String(bad)).toHaveLength(1);
      expect('maxRounds' in r.settings).toBe(false);
    }
  });

  it("dice: only 'lucky' or 'fair'", () => {
    expect(sanitizeSettings({ dice: 'lucky' }).settings).toEqual({ dice: 'lucky' });
    expect(sanitizeSettings({ dice: 'fair' }).settings).toEqual({ dice: 'fair' });
    for (const bad of ['Lucky', 'FAIR', 'loaded', '', 1, true, null, [], {}]) {
      const r = sanitizeSettings({ dice: bad });
      expect(r.errors, String(bad)).toHaveLength(1);
      expect('dice' in r.settings).toBe(false);
    }
  });

  it('auctionOnDecline: strictly boolean', () => {
    expect(sanitizeSettings({ auctionOnDecline: true }).settings).toEqual({ auctionOnDecline: true });
    expect(sanitizeSettings({ auctionOnDecline: false }).settings).toEqual({ auctionOnDecline: false });
    for (const bad of ['true', 'false', 0, 1, null, [], {}]) {
      const r = sanitizeSettings({ auctionOnDecline: bad });
      expect(r.errors, String(bad)).toHaveLength(1);
      expect('auctionOnDecline' in r.settings).toBe(false);
    }
  });

  it('reports every bad value and keeps the good ones', () => {
    const r = sanitizeSettings({ goal: 5, startCash: 20000, maxRounds: 7 });
    expect(r.errors).toHaveLength(2);
    expect(r.settings).toEqual({ startCash: 20000 });
  });

  it('ignores unknown keys (never forwards debug/seed/etc.)', () => {
    const r = sanitizeSettings({ goal: 50000, debug: true, seed: 1, passStart: 99999, __proto__: { x: 1 } });
    expect(r.settings).toEqual({ goal: 50000 });
    expect(r.errors).toEqual([]);
  });

  it('rejects non-object input', () => {
    for (const bad of ['x', 5, true, []]) expect(sanitizeSettings(bad).errors).toHaveLength(1);
  });

  it('maxPlayers convenience: 2..6 only', () => {
    expect(sanitizeSettings({ maxPlayers: 6 }).maxPlayers).toBe(6);
    expect(sanitizeSettings({ maxPlayers: 2 }).maxPlayers).toBe(2);
    for (const bad of [1, 7, 0, 3.5, '4', null]) expect(sanitizeSettings({ maxPlayers: bad }).errors).toHaveLength(1);
    expect(parseMaxPlayers(4)).toBe(4);
    expect(parseMaxPlayers(9)).toBeNull();
  });
});

describe('normalizeSettings', () => {
  it('fills the defaults: 70,000 / 15,000 / 50 rounds / lucky dice / auction on decline', () => {
    const defaults = { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true };
    expect(ROOM_DEFAULTS).toEqual(defaults);
    expect(normalizeSettings(undefined)).toEqual(defaults);
    expect(normalizeSettings({})).toEqual(defaults);
  });

  it('keeps valid overrides, including unlimited (null)', () => {
    expect(normalizeSettings({ goal: 30000, maxRounds: null, dice: 'fair' })).toEqual({
      goal: 30000,
      startCash: 15000,
      maxRounds: null,
      dice: 'fair',
      auctionOnDecline: true,
    });
  });

  it('drops invalid values back to the defaults', () => {
    expect(
      normalizeSettings({ goal: 1, startCash: 'lots', maxRounds: Infinity, dice: 'x', auctionOnDecline: 'no', debug: true }),
    ).toEqual({ goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true });
  });

  it('returns a fresh object (the frozen defaults are never leaked or mutated)', () => {
    const a = normalizeSettings();
    a.goal = 1;
    expect(normalizeSettings().goal).toBe(70000);
  });
});
