import { describe, it, expect } from 'vitest';
import {
  clampField,
  defaultSettings,
  fieldOptions,
  formatValue,
  resolveSettings,
  schemaFields,
  seatBounds,
  seatsMessage,
  settingsChips,
  settingsKey,
  settingsMessage,
  stepValue,
  summarizeSettings,
  visibilityMessage,
} from './settings.js';

// A schema shaped like a real game's (segmented with null, stepper with quick picks, toggle) but owned by the test.
const SCHEMA = [
  {
    key: 'goal',
    label: 'Winning target',
    type: 'stepper',
    format: 'inr',
    min: 10000,
    max: 1000000,
    step: 5000,
    options: [
      { value: 30000, label: '₹30k' },
      { value: 70000, label: '₹70k' },
    ],
    default: 70000,
  },
  {
    key: 'maxRounds',
    label: 'Rounds',
    type: 'segmented',
    options: [
      { value: 30, label: '30' },
      { value: 50, label: '50' },
      { value: null, label: 'Unlimited' },
    ],
    default: 50,
  },
  { key: 'dice', label: 'Dice', type: 'segmented', options: [{ value: 'lucky', label: 'Lucky' }, { value: 'fair', label: 'Fair' }], default: 'lucky' },
  { key: 'auction', label: 'Auction skipped properties', type: 'toggle', default: true },
  { key: 'seats', label: 'Seats', type: 'stepper', format: 'number', min: 1, max: 9, default: 4 },
];
const DEFAULTS = { goal: 70000, maxRounds: 50, dice: 'lucky', auction: true, seats: 4 };

describe('schemaFields / defaults', () => {
  it('keeps usable fields and skips junk without throwing', () => {
    expect(schemaFields(undefined)).toEqual([]);
    expect(schemaFields(null)).toEqual([]);
    expect(schemaFields([null, {}, { key: 'x', type: 'weird' }, { type: 'toggle' }, { key: 'ok', type: 'toggle', default: false }]).map((f) => f.key)).toEqual(['ok']);
    expect(schemaFields(SCHEMA)).toHaveLength(5);
  });
  it('collects defaults', () => {
    expect(defaultSettings(SCHEMA)).toEqual(DEFAULTS);
    expect(defaultSettings(undefined)).toEqual({});
  });
  it('exposes options only when they are well formed', () => {
    expect(fieldOptions(SCHEMA[1])).toHaveLength(3);
    expect(fieldOptions({ options: [null, { label: 'no value' }, { value: 0, label: 'zero' }] })).toEqual([{ value: 0, label: 'zero' }]);
    expect(fieldOptions({})).toEqual([]);
  });
});

describe('resolveSettings', () => {
  it('fills missing values with defaults', () => {
    expect(resolveSettings(SCHEMA, undefined)).toEqual(DEFAULTS);
    expect(resolveSettings(SCHEMA, {})).toEqual(DEFAULTS);
    expect(resolveSettings(SCHEMA, 'junk')).toEqual(DEFAULTS);
  });
  it('keeps null (a real choice) and drops keys the schema does not know', () => {
    const r = resolveSettings(SCHEMA, { goal: 30000, maxRounds: null, dice: 'fair', auction: false, seats: 6, passStart: 1500 });
    expect(r).toEqual({ goal: 30000, maxRounds: null, dice: 'fair', auction: false, seats: 6 });
    expect(r).not.toHaveProperty('passStart');
  });
  it('clamps steppers and ignores wrongly typed toggles', () => {
    expect(resolveSettings(SCHEMA, { goal: 5 }).goal).toBe(10000);
    expect(resolveSettings(SCHEMA, { goal: 9e9 }).goal).toBe(1000000);
    expect(resolveSettings(SCHEMA, { goal: 'abc' }).goal).toBe(70000);
    expect(resolveSettings(SCHEMA, { auction: 'no' }).auction).toBe(true);
  });
  it('does not rewrite a segmented value the client has no option for', () => {
    expect(resolveSettings(SCHEMA, { maxRounds: 40 }).maxRounds).toBe(40);
  });
  it('clampField falls back to the default for non-numbers', () => {
    expect(clampField(SCHEMA[0], NaN)).toBe(70000);
    expect(clampField(SCHEMA[0], 12345)).toBe(12345);
  });
});

describe('settingsMessage', () => {
  it('always sends the full set with explicit values', () => {
    const msg = settingsMessage(SCHEMA, { goal: 50000, maxRounds: 30, seats: 6, extra: 1 }, { maxRounds: null });
    expect(msg).toEqual({ t: 'settings', settings: { goal: 50000, maxRounds: null, dice: 'lucky', auction: true, seats: 6 } });
    // JSON-safe: null survives
    expect(JSON.parse(JSON.stringify(msg)).settings.maxRounds).toBeNull();
    expect(settingsMessage(SCHEMA, undefined, { dice: 'fair' }).settings).toEqual({ ...DEFAULTS, dice: 'fair' });
    expect(settingsMessage(SCHEMA, { auction: true }, { auction: false }).settings.auction).toBe(false);
  });
  it('an empty schema sends an empty settings object', () => {
    expect(settingsMessage(undefined, { a: 1 }, { b: 2 })).toEqual({ t: 'settings', settings: {} });
  });
  it('settingsKey changes exactly when a resolved value changes', () => {
    const a = settingsKey(SCHEMA, { goal: 50000 });
    expect(settingsKey(SCHEMA, { goal: 50000, unrelated: 'x' })).toBe(a);
    expect(settingsKey(SCHEMA, { goal: 55000 })).not.toBe(a);
  });
});

describe('stepValue', () => {
  const goal = SCHEMA[0];
  it('moves one step on the grid that starts at min, within the limits', () => {
    expect(stepValue(goal, 70000, 1)).toBe(75000);
    expect(stepValue(goal, 70000, -1)).toBe(65000);
    expect(stepValue(goal, 10000, -1)).toBe(10000);
    expect(stepValue(goal, 1000000, 1)).toBe(1000000);
    expect(stepValue(goal, 12000, 1)).toBe(15000); // snaps to the grid
    expect(stepValue(goal, 12000, -1)).toBe(10000);
    expect(stepValue(goal, 100000, -1)).toBe(95000);
  });
  it('defaults to a step of 1 and works without limits', () => {
    expect(stepValue({ type: 'stepper', default: 3 }, 3, 1)).toBe(4);
    expect(stepValue({ type: 'stepper', default: 3 }, 3, -1)).toBe(2);
    expect(stepValue(SCHEMA[4], 9, 1)).toBe(9);
    expect(stepValue(SCHEMA[4], 1, -1)).toBe(1);
  });
});

describe('formatValue / chips / summary', () => {
  it('uses the option label, then the field format', () => {
    expect(formatValue(SCHEMA[1], null)).toBe('Unlimited');
    expect(formatValue(SCHEMA[1], 30)).toBe('30');
    expect(formatValue(SCHEMA[0], 70000)).toBe('₹70k'); // option label wins
    expect(formatValue(SCHEMA[0], 75000)).toBe('₹75,000');
    expect(formatValue(SCHEMA[0], 100000)).toBe('₹1,00,000');
    expect(formatValue(SCHEMA[0], 150000, { compact: true })).toBe('₹1.5L');
    expect(formatValue(SCHEMA[4], 12345)).toBe('12,345');
    expect(formatValue(SCHEMA[3], true)).toBe('On');
    expect(formatValue({ type: 'segmented' }, 'abc')).toBe('abc');
    expect(formatValue({ type: 'segmented' }, null)).toBe('None');
  });
  it('builds read-only chips from the schema', () => {
    expect(settingsChips(SCHEMA, { goal: 75000, maxRounds: null, auction: false })).toEqual([
      'Winning target ₹75k',
      'Rounds Unlimited',
      'Dice Lucky',
      'Auction skipped properties: Off',
      'Seats 4',
    ]);
    expect(settingsChips(SCHEMA, {})[3]).toBe('Auction skipped properties');
    expect(settingsChips(undefined, {})).toEqual([]);
  });
  it("uses the game's own summarize(), and survives it being absent or broken", () => {
    expect(summarizeSettings({ settings: SCHEMA, summarize: (s) => `Target ${s.goal}` }, { goal: 5 })).toBe('Target 5');
    expect(summarizeSettings({ settings: SCHEMA }, { maxRounds: 30 })).toContain('Rounds 30');
    expect(
      summarizeSettings(
        {
          settings: SCHEMA,
          summarize() {
            throw new Error('boom');
          },
        },
        {},
      ),
    ).toContain('Dice Lucky');
    expect(summarizeSettings(null, undefined)).toBe('');
  });
});

describe('seats and room messages', () => {
  it('keeps seats inside the game range and above the people already in', () => {
    const game = { players: { min: 2, max: 6 } };
    expect(seatBounds(game, 0)).toEqual({ min: 2, max: 6 });
    expect(seatBounds(game, 4)).toEqual({ min: 4, max: 6 });
    expect(seatBounds(game, 9)).toEqual({ min: 6, max: 6 });
    expect(seatBounds({ players: { min: 2, max: 20 } }, 3)).toEqual({ min: 3, max: 20 });
    expect(seatBounds(null, 1)).toEqual({ min: 2, max: 6 });
  });
  it('builds the small socket messages', () => {
    expect(seatsMessage(5)).toEqual({ t: 'settings', settings: { maxPlayers: 5 } });
    expect(visibilityMessage('public')).toEqual({ t: 'visibility', visibility: 'public' });
    expect(visibilityMessage('anything else')).toEqual({ t: 'visibility', visibility: 'private' });
  });
});
