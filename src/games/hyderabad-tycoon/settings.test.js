// The lobby schema in the manifest must never drift from what the server accepts
// (worker/settings.js is the source of truth) or from the engine defaults (shared/engine.js).
import { describe, expect, it } from 'vitest';
import * as server from '../../../worker/settings.js';
import { DEFAULT_SETTINGS, SETTING_LIMITS } from '@shared/index.js';
import {
  CASH_PRESETS,
  GOAL_PRESETS,
  LOBBY_SETTINGS,
  SETTINGS_SCHEMA,
  SNATCHES_DEFAULT,
  SNATCHES_MAX,
  SNATCH_MS_DEFAULT,
  SNATCH_MS_MAX,
  SNATCH_MS_MIN,
  TABLE_RULES,
  clampGoal,
  settingsSummary,
} from './settings.js';

// Snatch settings are engine settings with defaults, not host settings: the lobby schema must never list them.
const ENGINE_ONLY = ['snatches', 'snatchMs'];

const field = (key) => SETTINGS_SCHEMA.find((f) => f.key === key);

describe('settings schema vs worker/settings.js', () => {
  it('describes exactly the host settings the server accepts', () => {
    const hostKeys = Object.keys(server.ROOM_DEFAULTS).filter((k) => !ENGINE_ONLY.includes(k));
    expect(SETTINGS_SCHEMA.map((f) => f.key).sort()).toEqual(hostKeys.sort());
  });

  it('uses the server defaults, which are the engine defaults', () => {
    for (const f of SETTINGS_SCHEMA) {
      expect(f.default, f.key).toEqual(server.ROOM_DEFAULTS[f.key]);
    }
    expect(ENGINE_ONLY.filter((k) => SETTINGS_SCHEMA.some((f) => f.key === k))).toEqual([]);
    expect(server.ROOM_DEFAULTS.goal).toBe(DEFAULT_SETTINGS.goal);
    expect(server.ROOM_DEFAULTS.startCash).toBe(DEFAULT_SETTINGS.startCash);
    expect(server.ROOM_DEFAULTS.maxRounds).toBe(DEFAULT_SETTINGS.maxRounds);
    expect(server.ROOM_DEFAULTS.dice).toBe(DEFAULT_SETTINGS.dice);
    expect(server.ROOM_DEFAULTS.auctionOnDecline).toBe(DEFAULT_SETTINGS.auctionOnDecline);
  });

  it('goal and start cash limits equal the server (and engine) limits', () => {
    expect(field('goal').min).toBe(server.GOAL_MIN);
    expect(field('goal').max).toBe(server.GOAL_MAX);
    expect(field('goal').min).toBe(SETTING_LIMITS.goal.min);
    expect(field('goal').max).toBe(SETTING_LIMITS.goal.max);
    expect(field('startCash').min).toBe(server.START_CASH_MIN);
    expect(field('startCash').max).toBe(server.START_CASH_MAX);
  });

  it('round and dice options equal the server lists', () => {
    expect(field('maxRounds').options.map((o) => o.value)).toEqual(server.ROUND_LIMITS);
    expect(field('dice').options.map((o) => o.value)).toEqual(server.DICE_MODES);
  });

  it('the headline defaults are 70,000 / 50 rounds / 15,000 / lucky / auction on', () => {
    expect(field('goal').default).toBe(70000);
    expect(field('maxRounds').default).toBe(50);
    expect(field('startCash').default).toBe(15000);
    expect(field('dice').default).toBe('lucky');
    expect(field('auctionOnDecline').default).toBe(true);
  });

  it('every preset the UI offers passes the server validation', () => {
    expect(GOAL_PRESETS).toEqual([30000, 50000, 70000, 100000]);
    expect(CASH_PRESETS).toEqual([10000, 15000, 20000, 25000]);
    for (const f of SETTINGS_SCHEMA) {
      for (const o of f.options || []) {
        const res = server.sanitizeSettings({ [f.key]: o.value });
        expect(res.errors, `${f.key}=${o.value}`).toEqual([]);
        expect(res.settings[f.key]).toEqual(o.value);
      }
      const res = server.sanitizeSettings({ [f.key]: f.default });
      expect(res.errors, `${f.key} default`).toEqual([]);
    }
    expect(server.sanitizeSettings({ goal: field('goal').min }).errors).toEqual([]);
    expect(server.sanitizeSettings({ goal: field('goal').max }).errors).toEqual([]);
  });

  it('field shapes follow the contract (type, options, range, step)', () => {
    for (const f of SETTINGS_SCHEMA) {
      expect(['segmented', 'stepper', 'toggle']).toContain(f.type);
      expect(typeof f.label).toBe('string');
      expect('default' in f).toBe(true);
      if (f.type === 'segmented') expect(f.options.length).toBeGreaterThan(1);
      if (f.type === 'stepper') expect(f.step).toBeGreaterThan(0);
    }
    expect(field('goal').format).toBe('inr');
  });
});

describe('snatch constants vs worker/settings.js and the engine', () => {
  it('mirror the server names and values', () => {
    expect(SNATCHES_DEFAULT).toBe(server.SNATCHES_DEFAULT);
    expect(SNATCHES_MAX).toBe(server.SNATCHES_MAX);
    expect(SNATCH_MS_DEFAULT).toBe(server.SNATCH_MS_DEFAULT);
    expect(SNATCH_MS_MIN).toBe(server.SNATCH_MS_MIN);
    expect(SNATCH_MS_MAX).toBe(server.SNATCH_MS_MAX);
  });
  it('the defaults are 1 token and a 3 s window, the engine defaults', () => {
    expect([SNATCHES_DEFAULT, SNATCH_MS_DEFAULT]).toEqual([1, 3000]);
    expect(DEFAULT_SETTINGS.snatches).toBe(SNATCHES_DEFAULT);
    expect(DEFAULT_SETTINGS.snatchMs).toBe(SNATCH_MS_DEFAULT);
    expect(SNATCH_MS_MIN).toBeLessThanOrEqual(SNATCH_MS_DEFAULT);
    expect(SNATCH_MS_DEFAULT).toBeLessThanOrEqual(SNATCH_MS_MAX);
    expect(SNATCHES_DEFAULT).toBeLessThanOrEqual(SNATCHES_MAX);
  });
});

describe('lobby settings', () => {
  it('tells the table rules in one line', () => {
    expect(TABLE_RULES).toBe('Single die - 1 Snatch each - sealed bidding on a tie');
  });
  it('shows only the end-cash limit, a real schema key labelled for players', () => {
    expect(LOBBY_SETTINGS).toEqual(['goal']);
    for (const k of LOBBY_SETTINGS) expect(field(k)).toBeTruthy();
    expect(field('goal').label).toBe('End cash limit');
  });
});

describe('settingsSummary (manifest.summarize)', () => {
  it('names the end-cash limit only', () => {
    expect(settingsSummary({ goal: 70000, maxRounds: 50, startCash: 15000, dice: 'lucky' })).toBe('First to reach ₹70,000 wins');
  });

  it('falls back to the default goal for missing keys', () => {
    expect(settingsSummary()).toBe('First to reach ₹70,000 wins');
    expect(settingsSummary({})).toBe('First to reach ₹70,000 wins');
  });

  it('uses Indian digit grouping', () => {
    expect(settingsSummary({ goal: 100000 })).toBe('First to reach ₹1,00,000 wins');
  });
});

describe('goal helpers', () => {
  it('clamps to the legal range', () => {
    expect(clampGoal(5)).toBe(server.GOAL_MIN);
    expect(clampGoal(5_000_000)).toBe(server.GOAL_MAX);
    expect(clampGoal('nope')).toBe(70000);
  });
});
