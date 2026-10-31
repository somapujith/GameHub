// One die, always (docs/GAME_RULES.md sections 1 and 4): `state.dice` is `[d]`, a six rolls again, a six leaves jail,
// three sixes in a row are NOT special, and the old two-dice setting no longer exists.
import { describe, it, expect } from 'vitest';
import {
  applyAction, createGame, diceOdds, diceWeights, landingOdds, nextFloat, rollDice, normalizeSettings, JAIL_TILE,
} from './index.js';

const game = (settings = {}) => createGame({
  players: [{ id: 'me', name: 'Miya' }, { id: 'rival', name: 'Chai Uncle' }],
  settings: { debug: true, dice: 'fair', auctionOnDecline: false, snatches: 0, ...settings },
  seed: 42,
});
const roll = (state, value) => applyAction(state, { type: 'ROLL', playerId: 'me', dice: [value] });

describe('single-die play', () => {
  it('new games use one die and moving one space is a real outcome', () => {
    const s = game();
    expect(s.cfg).not.toHaveProperty('diceCount');
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

  it('the old diceCount setting is gone: it is dropped, and play stays single-die', () => {
    for (const diceCount of [1, 2]) {
      expect(normalizeSettings({ diceCount })).not.toHaveProperty('diceCount');
      const s = game({ diceCount });
      expect(s.cfg).not.toHaveProperty('diceCount');
      expect(diceWeights(s, 'me').weights).toHaveLength(6);
      expect(roll(s, 2).state.dice).toEqual([2]);
    }
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
    expect(odds.six).toBeCloseTo(1 / 6);
    const landing = landingOdds(s, 'me');
    expect(landing.slice(1, 7)).toEqual(new Array(6).fill(1 / 6));
    expect(landing.slice(7).every((p) => p === 0)).toBe(true);
    const r = roll(s, 6);
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].pos).toBe(6);
    expect(r.state.extraRoll).toBe(true);
    expect(r.state.players[0].sixes).toBe(1);
    expect(r.state.phase).toBe('buy'); // Koti is for sale; the extra roll waits for the decision
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
    expect(freed.state.extraRoll).toBe(false); // freeing yourself with a six gives no extra roll
    expect(freed.events).toContainEqual({ type: 'jail', player: 'me', jailed: false, reason: 'six' });
  });

  it('three sixes in a row are not special: the third six moves and rolls again, matching the displayed odds', () => {
    const s = game();
    s.players[0].sixes = 2;
    const odds = landingOdds(s, 'me');
    expect(odds[JAIL_TILE]).toBe(0); // the displayed odds do not send a third six to jail
    expect(odds[6]).toBeCloseTo(1 / 6);
    const r = roll(s, 6);
    expect(r.error).toBeUndefined();
    expect(r.state.players[0].pos).toBe(6);
    expect(r.state.players[0].jailTurns).toBe(0);
    expect(r.state.players[0].sixes).toBe(3);
    expect(r.state.extraRoll).toBe(true);
    expect(r.events.some((e) => e.type === 'jail')).toBe(false);
  });

  it('lucky weights remain normalised and favour a six after a dry spell', () => {
    const s = game({ dice: 'lucky' });
    s.players[0].rollsSinceSix = 6;
    const { weights, active } = diceWeights(s, 'me');
    expect(weights).toHaveLength(6);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(weights[5]).toBeGreaterThan(weights[0]);
    expect(active).toContain('pity');
  });

  it('validates the debug die: exactly one integer 1..6', () => {
    expect(applyAction(game(), { type: 'ROLL', playerId: 'me', dice: [2, 3] }).error).toBe('Invalid dice');
    expect(applyAction(game(), { type: 'ROLL', playerId: 'me', dice: [2, 2] }).error).toBe('Invalid dice');
    expect(applyAction(game(), { type: 'ROLL', playerId: 'me', dice: [] }).error).toBe('Invalid dice');
    for (const value of [0, 7, 1.5, -1, NaN, '3']) expect(roll(game(), value).error).toBe('Invalid dice');
    for (const value of [1, 2, 3, 4, 5, 6]) expect(roll(game(), value).error).toBeUndefined();
  });

  it('an undeclared ROLL draws the die from the seeded rng (one element every time)', () => {
    let s = createGame({ players: [{ id: 'me' }, { id: 'rival' }], seed: 5, settings: { snatches: 0, auctionOnDecline: false } });
    for (let i = 0; i < 30 && s.phase !== 'over'; i++) {
      const who = s.players[s.turn].id;
      const res = applyAction(s, { type: 'ROLL', playerId: who });
      expect(res.error).toBeUndefined();
      expect(res.state.dice).toHaveLength(1);
      expect(res.events.find((e) => e.type === 'dice').values).toHaveLength(1);
      s = res.state;
      if (s.phase === 'buy') s = applyAction(s, { type: 'SKIP_BUY', playerId: who }).state;
      if (s.phase === 'manage' && !s.extraRoll) s = applyAction(s, { type: 'END_TURN', playerId: who }).state;
      if (s.phase === 'debt') break;
    }
  });
});
