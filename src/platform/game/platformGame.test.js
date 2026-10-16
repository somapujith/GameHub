import { afterEach, describe, expect, it } from 'vitest';
import { alpha, hexToRgb, readableOn, themeVars } from './color.js';
import { defaultSettings } from './useHostRoom.js';
import { lazyFor } from './PluginRoute.jsx';
import { ago } from './TableCard.jsx';
import { playersLabel } from './GameHero.jsx';
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
});

describe('plugin lazy cache', () => {
  it('reuses the lazy component per key and rebuilds when the loader changes', () => {
    const l1 = () => Promise.resolve({ default: () => null });
    const a = lazyFor('g:offlineSetup', l1);
    expect(lazyFor('g:offlineSetup', l1)).toBe(a);
    expect(lazyFor('g:offlineGame', l1)).not.toBe(a);
    expect(lazyFor('g:offlineSetup', () => Promise.resolve({ default: () => null }))).not.toBe(a);
  });
});

describe('labels', () => {
  it('formats player counts', () => {
    expect(playersLabel({ min: 2, max: 6 })).toBe('2–6 players');
    expect(playersLabel({ min: 4, max: 4 })).toBe('4 players');
    expect(playersLabel(undefined)).toBe('');
  });
  it('formats how long ago a table opened', () => {
    const now = Date.parse('2026-10-16T12:00:00Z');
    expect(ago('2026-10-16T11:59:50Z', now)).toBe('just now');
    expect(ago('2026-10-16T11:56:00Z', now)).toBe('4 min ago');
    expect(ago('2026-10-16T09:00:00Z', now)).toBe('3 h ago');
    expect(ago('garbage', now)).toBe('');
    expect(ago(null, now)).toBe('');
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
