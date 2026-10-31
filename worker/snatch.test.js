// The server side of the Snatch window (docs/GAME_RULES.md section 9): the action allow-list, the
// room-owned close timer, "nobody is auto-played in the window", and sealed presses. Real engine.
import { describe, it, expect } from 'vitest';
import adapter, { pendingActors, SNATCH_GRACE_MS } from './games/hyderabad-tycoon.js';
import { sanitizeAction } from './validate.js';
import { maskStateFor, hasSealedBids } from './mask.js';

const P = (n) => ({ id: `p${n}`, name: `Player ${n}`, avatar: n });

/** A 3-player game where the turn player just bought Dilsukhnagar (600) and the Snatch window is open. */
function snatchWindow(extra = {}) {
  let s = adapter.createGame({ players: [P(0), P(1), P(2)], settings: { goal: 70000, ...extra }, seed: 11 });
  s = { ...s, cfg: { ...s.cfg, debug: true } };
  const me = s.players[s.turn].id;
  let r = adapter.applyAction(s, { type: 'ROLL', playerId: me, dice: [1] }); // 0 + 1 = Dilsukhnagar
  expect(r.error).toBeUndefined();
  expect(r.state.phase).toBe('buy');
  r = adapter.applyAction(r.state, { type: 'BUY', playerId: me });
  expect(r.error).toBeUndefined();
  return { state: r.state, events: r.events, buyer: me };
}

describe('snatch: action allow-list', () => {
  it('lets a client send SNATCH but never SNATCH_CLOSE', () => {
    expect(sanitizeAction({ type: 'SNATCH' }, 'p1')).toEqual({ type: 'SNATCH', playerId: 'p1' });
    expect(sanitizeAction({ type: 'SNATCH', playerId: 'someone-else' }, 'p1')).toEqual({ type: 'SNATCH', playerId: 'p1' });
    expect(sanitizeAction({ type: 'SNATCH_CLOSE' }, 'p1')).toBeNull();
    expect(adapter.sanitizeAction({ type: 'SNATCH_CLOSE' }, 'p1')).toBeNull();
  });
});

describe('snatch: timer and auto-play', () => {
  it('opens a window after a purchase when somebody holds a token', () => {
    const { state, events, buyer } = snatchWindow();
    expect(state.phase).toBe('snatch');
    expect(state.pending).toMatchObject({ type: 'snatch', buyer, tile: 1, price: 600, ms: 3000 });
    expect(state.pending.eligible.sort()).toEqual(['p0', 'p1', 'p2'].filter((id) => id !== buyer));
    expect(events.find((e) => e.type === 'snatch_open')).toMatchObject({ tile: 1, buyer, ms: 3000 });
  });

  it('exposes exactly one close deadline, keyed by turn and tile, owned by no player action', () => {
    const { state, buyer } = snatchWindow();
    const list = adapter.deadlines(state);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ afterMs: 3000 + SNATCH_GRACE_MS, playerId: buyer, action: { type: 'SNATCH_CLOSE' } });
    expect(list[0].key).toMatch(/^snatch:\d+:1$/);
    expect(list[0].action.playerId).toBeUndefined();
    // the timer follows the configured window
    expect(adapter.deadlines(snatchWindow({ snatchMs: 5000 }).state)[0].afterMs).toBe(5000 + SNATCH_GRACE_MS);
  });

  it('SNATCH_CLOSE from the timer resolves the window; applying it twice is rejected', () => {
    const { state, buyer } = snatchWindow();
    const closed = adapter.applyAction(state, adapter.deadlines(state)[0].action);
    expect(closed.error).toBeUndefined();
    expect(closed.state.phase).toBe('manage');
    expect(closed.state.owners[1]).toBe(buyer); // nobody pressed: the buyer keeps it
    expect(closed.events.find((e) => e.type === 'snatch_end')).toMatchObject({ outcome: 'none' });
    expect(adapter.deadlines(closed.state)).toEqual([]);
    expect(adapter.applyAction(closed.state, { type: 'SNATCH_CLOSE' }).error).toBeTruthy();
  });

  it('never auto-plays anybody during the window', () => {
    const { state, buyer } = snatchWindow();
    for (const p of state.players) expect(adapter.idleAction(state, p.id)).toBeNull();
    expect(adapter.turnPlayerId(state)).toBe(buyer);
  });

  it('waits for the eligible players who have not pressed yet', () => {
    const { state, buyer } = snatchWindow();
    const others = state.players.map((p) => p.id).filter((id) => id !== buyer);
    expect(pendingActors(state).sort()).toEqual(others.sort());
    expect(adapter.pendingPlayerIds(state).sort()).toEqual(others.sort());
    const pressed = adapter.applyAction(state, { type: 'SNATCH', playerId: others[0] });
    expect(pressed.error).toBeUndefined();
    expect(pendingActors(pressed.state)).toEqual([others[1]]);
  });

  it('adds no client animation time for the window (it runs in real time)', () => {
    const { events } = snatchWindow();
    expect(adapter.animationMs(events)).toBeLessThan(500);
  });

  it('does not open for a player who spends no token: snatches 0 turns the feature off', () => {
    const { state } = snatchWindow({ snatches: 0 });
    expect(state.phase).toBe('manage');
    expect(adapter.deadlines(state)).toEqual([]);
  });
});

describe('snatch: sealed presses', () => {
  it('shows a viewer only their own press and keeps everything else untouched', () => {
    const { state, buyer } = snatchWindow();
    const [a, b] = state.players.map((p) => p.id).filter((id) => id !== buyer);
    const pressed = adapter.applyAction(state, { type: 'SNATCH', playerId: a }).state;
    expect(pressed.phase).toBe('snatch'); // b has not pressed, so the window is still open
    expect(pressed.pending.claims).toEqual([a]); // authoritative state keeps it
    expect(adapter.redact(pressed, a).pending.claims).toEqual([a]);
    expect(adapter.redact(pressed, b).pending.claims).toEqual([]);
    expect(adapter.redact(pressed, buyer).pending.claims).toEqual([]);
    expect(adapter.redact(pressed, undefined).pending.claims).toEqual([]);
    expect(pressed.pending.claims).toEqual([a]); // never mutated
    expect(hasSealedBids(pressed)).toBe(true);
  });

  it('never ships the random-number state or the card deck, and changes nothing else', () => {
    const { state } = snatchWindow({ snatches: 0 });
    expect(state.rng).toBeTruthy();
    expect(state.deck.length).toBeGreaterThan(0);
    for (const viewer of ['p0', 'p1', undefined]) {
      const view = maskStateFor(state, viewer);
      expect(view.rng).toBe(0);
      expect(view.deck).toEqual([]);
      expect({ ...view, rng: state.rng, deck: state.deck }).toEqual(state);
    }
    expect(state.rng).toBeTruthy(); // the authoritative state is never touched
    expect(maskStateFor(state, 'p0')).toBe(maskStateFor(state, 'p1')); // one cached copy per state object
  });

  it('a press sends no event, so nobody learns about it before the close', () => {
    const { state, buyer } = snatchWindow();
    const a = state.players.map((p) => p.id).find((id) => id !== buyer);
    const res = adapter.applyAction(state, { type: 'SNATCH', playerId: a });
    expect(res.events.filter((e) => /snatch/.test(e.type))).toEqual([]);
  });

  it('reveals the claimants only in the close event', () => {
    const { state, buyer } = snatchWindow();
    const [a, b] = state.players.map((p) => p.id).filter((id) => id !== buyer);
    let s = adapter.applyAction(state, { type: 'SNATCH', playerId: a }).state;
    s = adapter.applyAction(s, { type: 'SNATCH', playerId: b }).state; // everyone pressed: resolves at once
    expect(s.phase).toBe('auction');
    expect(s.pending).toMatchObject({ snatch: true, buyer });
    expect([...s.pending.claimants].sort()).toEqual([a, b].sort());
  });
});

describe('snatch: window clock for reloads', () => {
  it('snatchInfo passes the server clock through', async () => {
    const { snatchInfo } = await import('../src/components/game/snatch.js');
    const { state } = snatchWindow();
    const me = state.pending.eligible[0];
    const view = { ...state, pending: { ...state.pending, remainingMs: 1200 } };
    expect(snatchInfo({ view, me, options: {} })).toMatchObject({ ms: 3000, remainingMs: 1200 });
    expect(snatchInfo({ view: state, me, options: {} }).remainingMs).toBeNull();
  });
});
