import { describe, it, expect } from 'vitest';
import { applyAction, createGame, diceOdds, diceWeights, landingOdds, nextFloat, rollDice, JAIL_TILE } from './index.js';

const game = (settings = {}) => createGame({
  players: [{ id: 'me', name: 'Miya' }, { id: 'rival', name: 'Chai Uncle' }],
  settings: { debug: true, dice: 'fair', auctionOnDecline: false, ...settings },
  seed: 42,
});
const roll = (state, value) => applyAction(state, { type: 'ROLL', playerId: 'me', dice: [value] });

describe('single-die play', () => {
  it('new games use one die and moving one space is a real outcome', () => {
    const s = game();
    expect(s.cfg.diceCount).toBe(1);
    expect(s.dice).toEqual([0]);
    const r = roll(s, 1);
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].pos).toBe(1);
    expect(r.state.dice).toEqual([1]);
    expect(r.events.find((e) => e.type === 'dice').values).toEqual([1]);
    expect(r.events.find((e) => e.type === 'move').path).toEqual([1]);
    expect(r.state.extraRoll).toBe(false);
    expect(s.players[0].pos).toBe(0);
  });

  it('samples six possible results using exactly one deterministic random draw', () => {
    const s = game();
    const reference = structuredClone(s);
    nextFloat(reference);
    expect(rollDice(s, 'me').values).toHaveLength(1);
    expect(s.rng).toBe(reference.rng);
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const result = rollDice(s, 'me');
      expect(result.values).toHaveLength(1);
      expect(result.values[0]).toBeGreaterThanOrEqual(1);
      expect(result.values[0]).toBeLessThanOrEqual(6);
      seen.add(result.values[0]);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('fair movement odds match a single die and a six earns another roll', () => {
    const s = game();
    const odds = diceOdds(s, 'me');
    expect(Object.keys(odds.totals)).toEqual(['1', '2', '3', '4', '5', '6']);
    for (const p of Object.values(odds.totals)) expect(p).toBeCloseTo(1 / 6);
    expect(odds.bonus).toBeCloseTo(1 / 6);
    expect(odds.doubles).toBe(0);
    const landing = landingOdds(s, 'me');
    expect(landing.slice(1, 7)).toEqual(new Array(6).fill(1 / 6));
    expect(landing.slice(7).every((p) => p === 0)).toBe(true);
    const r = roll(s, 6);
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].pos).toBe(6);
    expect(r.state.extraRoll).toBe(true);
    expect(r.state.players[0].doubles).toBe(1);
  });

  it('a six frees a jailed player and other faces keep them in place', () => {
    const s = game({ jailTurns: 2 });
    Object.assign(s.players[0], { pos: JAIL_TILE, jailTurns: 2 });
    const odds = landingOdds(s, 'me');
    expect(odds[JAIL_TILE]).toBeCloseTo(5 / 6);
    expect(odds[JAIL_TILE + 6]).toBeCloseTo(1 / 6);
    const stay = roll(s, 3);
    expect(stay.error).toBeUndefined();
    expect(stay.state.players[0].pos).toBe(JAIL_TILE);
    expect(stay.state.players[0].jailTurns).toBe(1);
    const freed = roll(s, 6);
    expect(freed.error).toBeUndefined();
    expect(freed.state.players[0].pos).toBe(JAIL_TILE + 6);
    expect(freed.state.players[0].jailTurns).toBe(0);
    expect(freed.state.extraRoll).toBe(false);
    expect(freed.events).toContainEqual({ type: 'jail', player: 'me', jailed: false, reason: 'six' });
  });

  it('the third consecutive six sends you to jail, matching the displayed odds', () => {
    const s = game();
    s.players[0].doubles = 2;
    const odds = landingOdds(s, 'me');
    expect(odds[JAIL_TILE]).toBeCloseTo(1 / 6);
    expect(odds[6]).toBe(0);
    const r = roll(s, 6);
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].pos).toBe(JAIL_TILE);
    expect(r.state.players[0].jailTurns).toBe(1);
    expect(r.events.some((e) => e.reason === 'three_sixes')).toBe(true);
  });

  it('lucky weights remain normalised and favour a bonus after a dry spell', () => {
    const s = game({ dice: 'lucky' });
    s.players[0].rollsSinceDouble = 6;
    const { weights, active } = diceWeights(s, 'me');
    expect(weights).toHaveLength(6);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(weights[5]).toBeGreaterThan(weights[0]);
    expect(active).toContain('pity');
  });

  it('validates debug die count and retains explicit or saved two-die play', () => {
    expect(applyAction(game(), { type: 'ROLL', playerId: 'me', dice: [2, 3] }).error).toBe('Invalid dice');
    for (const value of [0, 7, 1.5]) expect(roll(game(), value).error).toBe('Invalid dice');
    for (const legacy of [false, true]) {
      const s = game({ diceCount: 2 });
      if (legacy) delete s.cfg.diceCount;
      const r = applyAction(s, { type: 'ROLL', playerId: 'me', dice: [2, 2] });
      expect(r.error).toBeUndefined();
      expect(r.state.dice).toEqual([2, 2]);
      expect(r.state.players[0].pos).toBe(4);
      expect(r.state.extraRoll).toBe(true);
      expect(diceWeights(s, 'me').weights).toHaveLength(36);
    }
  });
});
