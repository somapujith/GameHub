import { describe, it, expect } from 'vitest';
import {
  GOAL_MIN,
  GOAL_MAX,
  normalizeRounds,
  normalizeDice,
  clampGoal,
  stepGoal,
  resolveSettings,
  settingsMessage,
  settingsSummary,
  settingsChips,
  roundsLabel,
} from './settings.js';

describe('normalizeRounds', () => {
  it('accepts only 30, 50 and null; everything else is the default 50', () => {
    expect(normalizeRounds(30)).toBe(30);
    expect(normalizeRounds(50)).toBe(50);
    expect(normalizeRounds(null)).toBeNull();
    expect(normalizeRounds(undefined)).toBe(50);
    expect(normalizeRounds(120)).toBe(50);
    expect(normalizeRounds(Infinity)).toBe(50);
    expect(normalizeRounds('30')).toBe(50);
  });
});

describe('dice', () => {
  it('only "fair" is fair', () => {
    expect(normalizeDice('fair')).toBe('fair');
    expect(normalizeDice('lucky')).toBe('lucky');
    expect(normalizeDice(undefined)).toBe('lucky');
    expect(normalizeDice('weighted')).toBe('lucky');
  });
});

describe('goal stepper', () => {
  it('moves in 5,000 steps within 10,000..1,000,000', () => {
    expect(stepGoal(70000, 1)).toBe(75000);
    expect(stepGoal(70000, -1)).toBe(65000);
    expect(stepGoal(GOAL_MIN, -1)).toBe(GOAL_MIN);
    expect(stepGoal(GOAL_MAX, 1)).toBe(GOAL_MAX);
    expect(stepGoal(12000, 1)).toBe(15000); // snaps to the grid
    expect(stepGoal(12000, -1)).toBe(10000);
    expect(stepGoal(100000, -1)).toBe(95000);
  });
  it('clamps junk', () => {
    expect(clampGoal(5)).toBe(GOAL_MIN);
    expect(clampGoal(9e9)).toBe(GOAL_MAX);
    expect(clampGoal('abc')).toBe(70000);
    expect(clampGoal(NaN)).toBe(70000);
  });
});

describe('resolveSettings / settingsMessage', () => {
  it('fills defaults', () => {
    const d = { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true };
    expect(resolveSettings(undefined)).toEqual(d);
    expect(resolveSettings({})).toEqual(d);
    expect(resolveSettings({ goal: 30000, startCash: 10000, maxRounds: null, dice: 'fair', auctionOnDecline: false })).toEqual({
      goal: 30000,
      startCash: 10000,
      maxRounds: null,
      dice: 'fair',
      auctionOnDecline: false,
    });
  });
  it('always sends the full set with explicit values', () => {
    const msg = settingsMessage({ goal: 50000, startCash: 20000, maxRounds: 30, passStart: 1500 }, { maxRounds: null });
    expect(msg).toEqual({ t: 'settings', settings: { goal: 50000, startCash: 20000, maxRounds: null, dice: 'lucky', auctionOnDecline: true } });
    // JSON-safe: null survives, no Infinity
    expect(JSON.parse(JSON.stringify(msg)).settings.maxRounds).toBeNull();
    expect(settingsMessage(undefined, { goal: 100000 }).settings).toEqual({
      goal: 100000,
      startCash: 15000,
      maxRounds: 50,
      dice: 'lucky',
      auctionOnDecline: true,
    });
    expect(settingsMessage({}, { dice: 'fair' }).settings.dice).toBe('fair');
    expect(settingsMessage({ auctionOnDecline: true }, { auctionOnDecline: false }).settings.auctionOnDecline).toBe(false);
  });
});

describe('summary', () => {
  it('formats the one-line summary and chips with rupee grouping', () => {
    expect(settingsSummary({ goal: 70000, startCash: 15000, maxRounds: 50 })).toBe('Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice');
    expect(settingsSummary({ goal: 100000, startCash: 10000, maxRounds: null, dice: 'fair' })).toBe(
      'Target ₹1,00,000 · Unlimited rounds · Start ₹10,000 · Fair dice',
    );
    expect(settingsSummary(undefined)).toBe('Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice');
    expect(settingsChips({ goal: 100000, startCash: 25000, maxRounds: 30, dice: 'fair', auctionOnDecline: false })).toEqual([
      'Target ₹1L',
      '30 rounds',
      'Start ₹25k',
      '⚖️ Fair dice',
      'No auction on skip',
    ]);
    expect(roundsLabel(null)).toBe('Unlimited rounds');
  });
});
