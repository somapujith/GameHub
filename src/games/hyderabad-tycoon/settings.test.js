// The lobby schema in the manifest must never drift from what the server accepts
// (worker/settings.js is the source of truth) or from the engine defaults (shared/engine.js).
import { describe, expect, it } from 'vitest';
import * as server from '../../../worker/settings.js';
import { DEFAULT_SETTINGS, SETTING_LIMITS } from '@shared/index.js';
import {
  CASH_PRESETS,
  GOAL_PRESETS,
  SETTINGS_SCHEMA,
  clampGoal,
  minGoalFor,
  settingsSummary,
} from './settings.js';

const field = (key) => SETTINGS_SCHEMA.find((f) => f.key === key);

describe('settings schema vs worker/settings.js', () => {
  it('describes exactly the keys the server accepts', () => {
    expect(SETTINGS_SCHEMA.map((f) => f.key).sort()).toEqual(Object.keys(server.ROOM_DEFAULTS).sort());
  });

  it('uses the server defaults, which are the engine defaults', () => {
    for (const f of SETTINGS_SCHEMA) {
      expect(f.default, f.key).toEqual(server.ROOM_DEFAULTS[f.key]);
    }
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

describe('settingsSummary (manifest.summarize)', () => {
  it('formats the defaults', () => {
    expect(settingsSummary({ goal: 70000, maxRounds: 50, startCash: 15000, dice: 'lucky' })).toBe(
      'Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice',
    );
  });

  it('falls back to the engine defaults for missing keys', () => {
    expect(settingsSummary()).toBe('Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice');
    expect(settingsSummary({})).toBe('Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice');
  });

  it('handles unlimited rounds, fair dice and Indian digit grouping', () => {
    expect(settingsSummary({ goal: 100000, maxRounds: null, startCash: 25000, dice: 'fair' })).toBe(
      'Target ₹1,00,000 · Unlimited rounds · Start ₹25,000 · Fair dice',
    );
  });
});

describe('goal helpers', () => {
  it('clamps to the legal range', () => {
    expect(clampGoal(5)).toBe(server.GOAL_MIN);
    expect(clampGoal(5_000_000)).toBe(server.GOAL_MAX);
    expect(clampGoal('nope')).toBe(70000);
  });

  it('leaves room to win from the start cash', () => {
    expect(minGoalFor(15000)).toBe(20000);
    expect(minGoalFor(5000)).toBe(10000);
  });
});
