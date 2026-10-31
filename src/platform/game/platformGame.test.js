import { afterEach, describe, expect, it } from 'vitest';
import { alpha, hexToRgb, readableOn, themeVars } from './color.js';
import { defaultSettings, roomRequest } from './useHostRoom.js';
import { playersLabel } from './GameHero.jsx';
import { defaultSeats, seatOptions } from './seats.js';
import { isNotified, setNotified } from './notify.js';

describe('colour helpers', () => {
  it('parses hex and picks readable text', () => {
    expect(hexToRgb('#ffc857')).toEqual([255, 200, 87]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('nope')).toBeNull();
    expect(readableOn('#ffc857')).toBe('#0b1021');
    expect(readableOn('#1b1340')).toBe('#ffffff');
    expect(alpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
  it('builds theme variables with fallbacks', () => {
    const v = themeVars({ accent: '#ffc857', accent2: '#ff8a3d', bg: '#1b1340' });
    expect(v['--g-accent']).toBe('#ffc857');
    expect(v['--g-on']).toBe('#0b1021');
    expect(themeVars(undefined)['--g-accent']).toMatch(/^#/);
  });
});

describe('hosting defaults', () => {
  it('collects defaults from the manifest settings schema', () => {
    const game = { settings: [{ key: 'goal', default: 70000 }, { key: 'rounds', default: 50 }, { key: 'x' }, null] };
    expect(defaultSettings(game)).toEqual({ goal: 70000, rounds: 50 });
    expect(defaultSettings({})).toEqual({});
    expect(defaultSettings(null)).toEqual({});
  });

  it('builds the create-table request: private, default settings, the chosen seats', () => {
    const game = { id: 'g', players: { min: 2, max: 6 }, settings: [{ key: 'goal', default: 70000 }] };
    expect(roomRequest(game, { maxPlayers: 3 })).toEqual({ gameId: 'g', visibility: 'private', settings: { goal: 70000 }, maxPlayers: 3 });
    expect(roomRequest(game, 'private')).toEqual({ gameId: 'g', visibility: 'private', settings: { goal: 70000 } }); // older call form
    expect(roomRequest(game)).toEqual({ gameId: 'g', visibility: 'private', settings: { goal: 70000 } });
    expect(roomRequest(game, 'public').visibility).toBe('public');
  });

  it('leaves out seat counts the game does not allow', () => {
    const game = { id: 'g', players: { min: 2, max: 6 } };
    for (const maxPlayers of [1, 7, 2.5, '4', NaN, null]) expect(roomRequest(game, { maxPlayers })).not.toHaveProperty('maxPlayers');
    expect(roomRequest(game, { maxPlayers: 6 }).maxPlayers).toBe(6);
  });
});

describe('seat choices', () => {
  it('lists min..max and preselects 4', () => {
    expect(seatOptions({ min: 2, max: 6 })).toEqual([2, 3, 4, 5, 6]);
    expect(defaultSeats(seatOptions({ min: 2, max: 6 }))).toBe(4);
  });
  it('falls back to the nearest allowed count and survives junk', () => {
    expect(defaultSeats(seatOptions({ min: 2, max: 3 }))).toBe(3);
    expect(defaultSeats(seatOptions({ min: 5, max: 8 }))).toBe(5);
    expect(seatOptions({ min: 3, max: 3 })).toEqual([3]);
    expect(seatOptions(undefined)).toEqual([2]);
    expect(seatOptions({ min: 4, max: 2 })).toEqual([4]);
  });
});

describe('labels', () => {
  it('formats player counts', () => {
    expect(playersLabel({ min: 2, max: 6 })).toBe('2–6 players');
    expect(playersLabel({ min: 4, max: 4 })).toBe('4 players');
    expect(playersLabel(undefined)).toBe('');
  });
});

describe('notify me flag', () => {
  afterEach(() => setNotified('zz-test', false));
  it('works without browser storage (falls back to memory)', () => {
    expect(isNotified('zz-test')).toBe(false);
    setNotified('zz-test', true);
    expect(isNotified('zz-test')).toBe(true);
    setNotified('zz-test', false);
    expect(isNotified('zz-test')).toBe(false);
  });
});
