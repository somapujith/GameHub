import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '@shared/index.js';
import { createPresenterCore } from './usePresenter.js';

afterEach(() => vi.useRealTimers());

describe('dice landing before pawn movement', () => {
  it.each([
    { name: 'normal play', speed: 1 },
    { name: 'fast play', speed: 0.5 },
    { name: 'fast background play', speed: 0.5, background: true },
    { name: 'queue catch-up', speed: 0.5, queued: 10 },
    { name: 'reduced motion', speed: 1, reduced: true },
  ])('$name', async ({ speed, background = false, queued = 1, reduced = false }) => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    const actor = background ? 'other' : 'me';
    const actorIndex = background ? 1 : 0;
    const final = structuredClone(initial);
    final.players[actorIndex].pos = 1;
    final.dice = [1];
    const core = createPresenterCore({
      meId: 'me', initialState: initial, speed,
      deps: {
        loadSettings: () => ({ reducedMotion: reduced }),
        sfx: { play() {} }, describeEvent: () => null,
      },
    });
    let previousRolling = false;
    let landedAt;
    let movedAt;
    let settleMs;
    core.subscribe(() => {
      const snapshot = core.getSnapshot();
      if (previousRolling && !snapshot.rolling && landedAt === undefined) {
        landedAt = Date.now();
        settleMs = snapshot.display.diceSettleMs;
      }
      previousRolling = snapshot.rolling;
      if (snapshot.display.players[actorIndex].pos === 1 && movedAt === undefined) movedAt = Date.now();
    });
    core.enqueue([
      { type: 'dice', player: actor, values: [1] },
      { type: 'move', player: actor, path: [1], to: 1 },
    ], final);
    for (let i = 1; i < queued; i++) core.enqueue([], final);
    await vi.runAllTimersAsync();
    expect(landedAt).toBeDefined();
    expect(movedAt).toBeDefined();
    expect(movedAt - landedAt).toBeGreaterThanOrEqual(settleMs - 1);
    expect(settleMs).toBeGreaterThanOrEqual(0);
    expect(settleMs).toBeLessThanOrEqual(560);
    if (reduced) expect(settleMs).toBe(0);
    expect(core.getSnapshot().busy).toBe(false);
    expect(core.getSnapshot().display.dice).toEqual([1]);
    core.dispose();
  });
});

describe('Card clip: the players who get paid hear it', () => {
  const play = async (cardEvent) => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    const played = [];
    const core = createPresenterCore({
      meId: 'me', initialState: initial,
      deps: {
        loadSettings: () => ({}),
        sfx: { play() {} },
        playCardClip: (cardId) => { played.push(cardId); return true; },
        describeEvent: () => null,
      },
    });
    core.enqueue([cardEvent], initial);
    await vi.runAllTimersAsync();
    core.dispose();
    return played;
  };
  const card = (player, cardId) => ({ type: 'card', player, cardId, kind: 'bad', title: 'Paytm Karo!', text: 't' });

  it('plays the Paytm clip when somebody else draws the card', async () => {
    expect(await play(card('other', 'paytm_100'))).toEqual(['paytm_100']);
  });

  it('does not play it for the player who has to pay', async () => {
    expect(await play(card('me', 'paytm_100'))).toEqual([]);
  });

  it('does not play it for other cards', async () => {
    expect(await play(card('other', 'biryani_promise'))).toEqual([]);
  });
});

describe('long trips across the 40-square board', () => {
  it('keeps a 39-square card move short and ends on the right square', async () => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    const final = structuredClone(initial);
    final.players[0].pos = 39;
    const path = Array.from({ length: 39 }, (_, i) => i + 1);
    const core = createPresenterCore({
      meId: 'me', initialState: initial,
      deps: { loadSettings: () => ({}), sfx: { play() {} }, describeEvent: () => null },
    });
    const seen = [];
    core.subscribe(() => seen.push(core.getSnapshot().display.players[0].pos));
    const t0 = Date.now();
    core.enqueue([{ type: 'move', player: 'me', from: 0, to: 39, path }], final);
    await vi.runAllTimersAsync();
    expect(core.getSnapshot().display.players[0].pos).toBe(39);
    expect(seen).toContain(20);
    expect(Date.now() - t0).toBeLessThan(5000);
    core.dispose();
  });
});

describe('snatch events', () => {
  const setup = (me = 'me') => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    initial.players.forEach((p) => { p.snatches = 1; });
    const played = [];
    const core = createPresenterCore({
      meId: me, initialState: initial,
      deps: { loadSettings: () => ({}), sfx: { play: (n) => played.push(n) } },
    });
    return { core, initial, played };
  };
  const open = { type: 'snatch_open', tile: 6, buyer: 'other', price: 1000, eligible: ['me'], ms: 3000 };

  it('announces the window without holding back the queue', async () => {
    const { core, initial, played } = setup();
    const t0 = Date.now();
    core.enqueue([open], initial);
    await vi.runAllTimersAsync();
    expect(Date.now() - t0).toBe(0); // no delay at all: the window is real time
    const snap = core.getSnapshot();
    expect(snap.busy).toBe(false);
    expect(snap.log.map((l) => l.text)).toEqual(['Player 2 bought Koti for ₹1,000. Snatch window open (3s)!']);
    expect(snap.bubble).toMatchObject({ text: 'Snatch it!', tile: 6, type: 'snatch_open' });
    expect(snap.stageTile).toBe(6);
    expect(played).toEqual(['lucky']);
    core.dispose();
  });

  it('logs a buy that opens a window only once', async () => {
    const { core, initial } = setup();
    core.enqueue([
      { type: 'cash', player: 'other', delta: -1000, reason: 'buy' },
      { type: 'own', tile: 6, owner: 'other', reason: 'buy' },
      open,
    ], initial);
    await vi.runAllTimersAsync();
    const texts = core.getSnapshot().log.map((l) => l.text);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Snatch window open');
    core.dispose();
  });

  it('still logs a plain buy when no window follows', async () => {
    const { core, initial } = setup();
    core.enqueue([{ type: 'own', tile: 6, owner: 'other', reason: 'buy' }], initial);
    await vi.runAllTimersAsync();
    expect(core.getSnapshot().log.map((l) => l.text)).toEqual(['Player 2 bought Koti for ₹1,000']);
    core.dispose();
  });

  it('moves the tile to the snatcher and spends the token', async () => {
    const { core, initial, played } = setup();
    const final = structuredClone(initial);
    final.owners[6] = 'me';
    final.players[0].snatches = 0;
    core.enqueue([
      { type: 'snatch_end', tile: 6, buyer: 'other', outcome: 'snatched', winner: 'me', claimants: ['me'] },
      { type: 'own', tile: 6, owner: 'me', reason: 'snatch' },
      { type: 'snatch_token', player: 'me', snatches: 0 },
    ], final);
    await vi.runAllTimersAsync();
    const snap = core.getSnapshot();
    expect(snap.log.map((l) => l.text)).toEqual(['You SNATCHED Koti from Player 2 for free! (Player 2 still paid ₹1,000)']);
    expect(snap.display.owners[6]).toBe('me');
    expect(snap.display.players.find((p) => p.id === 'me').snatches).toBe(0);
    expect(snap.display.players.find((p) => p.id === 'other').snatches).toBe(1);
    expect(played).toEqual(['cheer']);
    core.dispose();
  });

  it('keeps the owner when nobody snatched and announces snatch bidding', async () => {
    const { core, initial } = setup();
    core.enqueue([{ type: 'snatch_end', tile: 6, buyer: 'other', outcome: 'none' }], initial);
    core.enqueue([
      { type: 'snatch_end', tile: 8, buyer: 'other', outcome: 'bidding', claimants: ['me', 'other'] },
      { type: 'auction_start', tile: 8, minBid: 500, reason: 'snatch', eligible: ['me', 'other'] },
    ], initial);
    await vi.runAllTimersAsync();
    const texts = core.getSnapshot().log.map((l) => l.text);
    expect(texts).toEqual(['Nobody snatched. Koti stays with Player 2.', 'You and Player 2 both snatched! Sealed bidding for Abids.']);
    core.dispose();
  });

  it('gives the displayed players a public snatch token count', () => {
    const { core } = setup();
    expect(core.getSnapshot().display.players.map((p) => p.snatches)).toEqual([1, 1]);
    core.dispose();
  });
});

describe('tokens and city events', () => {
  const setup = () => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    const played = [];
    const core = createPresenterCore({
      meId: 'me', initialState: initial,
      deps: { loadSettings: () => ({}), sfx: { play: (n) => played.push(n) } },
    });
    return { core, initial, played };
  };
  const cityEvent = { type: 'city_event', id: 'ipl', title: 'IPL Final!', text: 'Green rents are doubled.', kind: 'rent', group: 'green', mult: 2, round: 5 };

  it('carries laps, snatches and the event into the display', () => {
    const { core, initial } = setup();
    const withEvent = structuredClone(initial);
    withEvent.players[0].laps = 2;
    withEvent.event = { ...cityEvent };
    core.reset(withEvent);
    const d = core.getSnapshot().display;
    expect(d.players[0].laps).toBe(2);
    expect(d.event).toMatchObject({ id: 'ipl', round: 5 });
    core.dispose();
  });

  it('shield and token_earned log without delaying the queue', async () => {
    const { core, initial } = setup();
    const t0 = Date.now();
    core.enqueue([
      { type: 'shield', player: 'me', tile: 6 },
      { type: 'token_earned', player: 'me', reason: 'lap', snatches: 2 },
    ], initial);
    await vi.runAllTimersAsync();
    expect(Date.now() - t0).toBe(0);
    expect(core.getSnapshot().log.map((l) => l.text)).toEqual(['You shielded Koti: no snatching!', 'You earned a Snatch token (lap bonus)']);
    core.dispose();
  });

  it('a city event pauses the queue about 1.2 s and shows in the display', async () => {
    const { core, initial } = setup();
    const t0 = Date.now();
    core.enqueue([cityEvent], initial);
    await vi.advanceTimersByTimeAsync(1000);
    expect(core.getSnapshot().busy).toBe(true);
    expect(core.getSnapshot().display.event).toMatchObject({ id: 'ipl' });
    await vi.runAllTimersAsync();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1100);
    expect(core.getSnapshot().log[0].text).toBe('IPL Final! Green rents are doubled.');
    core.dispose();
  });
});

describe('traps', () => {
  const setup = () => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'other' }], seed: 1 });
    initial.players.forEach((p) => { p.traps = 1; });
    const played = [];
    const core = createPresenterCore({
      meId: 'me', initialState: initial,
      deps: { loadSettings: () => ({}), sfx: { play: (n) => played.push(n) } },
    });
    return { core, initial, played };
  };

  it('carries the public trap count in the display', () => {
    const { core } = setup();
    expect(core.getSnapshot().display.players.map((p) => p.traps)).toEqual([1, 1]);
    core.dispose();
  });

  it('trap_placed does not delay and uses the hand count', async () => {
    const { core, initial } = setup();
    const t0 = Date.now();
    core.enqueue([{ type: 'trap_placed', player: 'other' }], initial);
    await vi.runAllTimersAsync();
    expect(Date.now() - t0).toBe(0);
    expect(core.getSnapshot().log.map((l) => l.text)).toEqual(['Player 2 set a trap somewhere...']);
    core.dispose();
  });

  it('trap_sprung waits about 0.8 s with a bubble and a sound', async () => {
    const { core, initial, played } = setup();
    const t0 = Date.now();
    core.enqueue([{ type: 'trap_sprung', tile: 6, owner: 'other', victim: 'me' }], initial);
    await vi.runAllTimersAsync();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(700);
    expect(core.getSnapshot().bubble.text).toBe('Trapped!');
    expect(played).toEqual(['jail']);
    core.dispose();
  });
});
