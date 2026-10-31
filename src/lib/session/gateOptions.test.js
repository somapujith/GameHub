import { describe, expect, it } from 'vitest';
import { gateOptions } from './gateOptions.js';

const real = { roll: true, buy: false, endTurn: true, upgrade: [{ tile: 1 }], bid: null, snatch: { tile: 6, ms: 3000 }, snatched: undefined };

describe('gateOptions', () => {
  it('passes the real options through when idle and connected', () => {
    expect(gateOptions(real, { phase: 'roll' })).toBe(real);
  });

  it('blanks every action while the presenter animates or a request is in flight', () => {
    for (const flags of [{ busy: true }, { awaiting: true }]) {
      const out = gateOptions(real, { phase: 'roll' }, flags);
      expect(out.roll).toBe(false);
      expect(out.endTurn).toBe(false);
      expect(out.upgrade).toEqual([]);
      expect(out.snatch).toBeNull();
    }
  });

  it('keeps the snatch button alive while animations play: the window is real time', () => {
    const view = { phase: 'snatch' };
    const out = gateOptions(real, view, { busy: true, awaiting: true });
    expect(out.snatch).toEqual({ tile: 6, ms: 3000 });
    expect(out.roll).toBe(false);
    expect(out.endTurn).toBe(false);
    expect(gateOptions({ ...real, snatch: null, snatched: true }, view, { busy: true }).snatched).toBe(true);
  });

  it('blanks everything when the connection is not open, snatch included', () => {
    const out = gateOptions(real, { phase: 'snatch' }, { connection: 'connecting' });
    expect(out.snatch).toBeNull();
    expect(out.roll).toBe(false);
    expect(gateOptions(null, null).roll).toBe(false);
  });
});
