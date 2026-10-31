// Server side of Shield, city events and traps (docs/GAME_RULES.md sections 10, 11 and 13).
import { describe, it, expect } from 'vitest';
import adapter, { estimateAnimMs } from './games/hyderabad-tycoon.js';
import { sanitizeAction } from './validate.js';
import { maskStateFor, hasSealedBids } from './mask.js';

const P = (n) => ({ id: `p${n}`, name: `Player ${n}`, avatar: n });

describe('Buy + Shield over the wire', () => {
  it('keeps shield:true through sanitizeAction and forces the player id', () => {
    expect(sanitizeAction({ type: 'BUY', shield: true }, 'p1')).toEqual({ type: 'BUY', shield: true, playerId: 'p1' });
    expect(adapter.sanitizeAction({ type: 'BUY', shield: true, playerId: 'p9' }, 'p1')).toEqual({ type: 'BUY', shield: true, playerId: 'p1' });
  });

  it('drops anything that is not exactly shield:true', () => {
    for (const shield of [false, 1, 'true', null, undefined, {}]) {
      expect(sanitizeAction({ type: 'BUY', shield }, 'p1')).toEqual({ type: 'BUY', playerId: 'p1' });
    }
    expect(sanitizeAction({ type: 'BUY', extra: 1 }, 'p1')).toEqual({ type: 'BUY', playerId: 'p1' });
  });

  it('a shielded buy goes through the adapter end to end: no snatch window, one token spent', () => {
    let s = adapter.createGame({ players: [P(0), P(1), P(2)], settings: {}, seed: 5 });
    s = { ...s, cfg: { ...s.cfg, debug: true } };
    const me = s.players[s.turn].id;
    let r = adapter.applyAction(s, { type: 'ROLL', playerId: me, dice: [1] });
    expect(r.state.phase).toBe('buy');
    r = adapter.applyAction(r.state, sanitizeAction({ type: 'BUY', shield: true }, me));
    expect(r.error).toBeUndefined();
    expect(r.state.phase).toBe('manage');
    expect(r.events.map((e) => e.type)).toContain('shield');
    expect(r.state.players.find((p) => p.id === me).snatches).toBe(0);
  });
});

describe('animation time for the new events', () => {
  it('a city event takes 1.5 s, a sprung trap 0.9 s; shield and token_earned add nothing', () => {
    expect(estimateAnimMs([{ type: 'city_event' }])).toBe(1500);
    expect(estimateAnimMs([{ type: 'trap_sprung' }])).toBe(900);
    expect(estimateAnimMs([{ type: 'shield' }, { type: 'token_earned' }, { type: 'snatch_token' }, { type: 'trap_placed' }])).toBe(0);
  });
});

describe('traps over the wire (13)', () => {
  it('PLACE_TRAP carries only an on-board integer tile and a forced player id', () => {
    expect(sanitizeAction({ type: 'PLACE_TRAP', tile: 12 }, 'p1')).toEqual({ type: 'PLACE_TRAP', tile: 12, playerId: 'p1' });
    expect(sanitizeAction({ type: 'PLACE_TRAP', tile: 12, playerId: 'x', extra: 1 }, 'p1')).toEqual({ type: 'PLACE_TRAP', tile: 12, playerId: 'p1' });
    for (const tile of [-1, 40, 1.5, '3', null, undefined]) expect(sanitizeAction({ type: 'PLACE_TRAP', tile }, 'p1')).toBeNull();
    expect(adapter.sanitizeAction({ type: 'PLACE_TRAP', tile: 3 }, 'p2')).toEqual({ type: 'PLACE_TRAP', tile: 3, playerId: 'p2' });
  });

  const state = (traps) => ({
    phase: 'roll', round: 2, pending: null, traps,
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  });
  const traps = [{ tile: 7, owner: 'a' }, { tile: 12, owner: 'b' }];

  it('a viewer only sees their own traps; spectators none; the state is not mutated', () => {
    const s = state(traps);
    const copy = structuredClone(s);
    expect(maskStateFor(s, 'a').traps).toEqual([{ tile: 7, owner: 'a' }]);
    expect(maskStateFor(s, 'b').traps).toEqual([{ tile: 12, owner: 'b' }]);
    expect(maskStateFor(s, 'c').traps).toEqual([]);
    expect(maskStateFor(s, undefined).traps).toEqual([]);
    expect(maskStateFor(s, 'a')).not.toBe(s);
    expect(s).toEqual(copy);
    expect(adapter.redact(s, 'c').traps).toEqual([]);
  });

  it('is the same object when there are no traps (absent or empty) and nothing else is sealed', () => {
    const none = state([]);
    expect(maskStateFor(none, 'a')).toBe(none);
    const old = { phase: 'roll', pending: null, players: [] };
    expect(maskStateFor(old, 'a')).toBe(old);
    expect(hasSealedBids(none)).toBe(false);
    expect(hasSealedBids(old)).toBe(false);
    expect(hasSealedBids(state(traps))).toBe(true);
  });

  it('traps and a sealed auction are masked together', () => {
    const s = { ...state(traps), phase: 'auction', pending: { type: 'auction', tile: 5, minBid: 50, bids: { a: 300, b: 120, c: 0 } } };
    const m = maskStateFor(s, 'a');
    expect(m.pending.bids).toEqual({ a: 300, b: 0, c: 0 });
    expect(m.traps).toEqual([{ tile: 7, owner: 'a' }]);
  });

  it('the engine state from the adapter hides a rival trap but keeps the viewer own', () => {
    let s = adapter.createGame({ players: [P(0), P(1), P(2)], settings: {}, seed: 3 });
    const me = s.players[s.turn].id;
    const r = adapter.applyAction(s, { type: 'PLACE_TRAP', tile: 14, playerId: me });
    expect(r.error).toBeUndefined();
    s = r.state;
    expect(adapter.redact(s, me).traps).toEqual([{ tile: 14, owner: me }]);
    const other = s.players.find((p) => p.id !== me).id;
    expect(adapter.redact(s, other).traps).toEqual([]);
    expect(JSON.stringify(r.events)).not.toContain('14');
  });
});
