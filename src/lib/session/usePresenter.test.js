import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '@shared/index.js';
import { createPresenterCore } from './usePresenter.js';

afterEach(() => vi.useRealTimers());

describe('dice landing before pawn movement', () => {
  it.each([
    { name: 'normal play', speed: 1 },
    { name: 'fast play', speed: 0.5 },
    { name: 'fast background bot', speed: 0.5, background: true },
    { name: 'queue catch-up', speed: 0.5, queued: 10 },
    { name: 'reduced motion', speed: 1, reduced: true },
  ])('$name', async ({ speed, background = false, queued = 1, reduced = false }) => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'bot', isBot: true }], seed: 1 });
    const actor = background ? 'bot' : 'me';
    const actorIndex = background ? 1 : 0;
    const final = structuredClone(initial);
    final.players[actorIndex].pos = 1;
    final.dice = [1];
    const core = createPresenterCore({
      meId: 'me', initialState: initial, speed,
      deps: {
        loadSettings: () => ({ reducedMotion: reduced }),
        sfx: { play() {} }, voice: { stop() {} },
        pickLine: () => null, lineForTile: () => null, describeEvent: () => null,
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

describe('Kismet clip: the players who get paid hear it', () => {
  const play = async (cardEvent) => {
    vi.useFakeTimers();
    const initial = createGame({ players: [{ id: 'me' }, { id: 'bot', isBot: true }], seed: 1 });
    const spoken = [];
    const core = createPresenterCore({
      meId: 'me', initialState: initial,
      deps: {
        loadSettings: () => ({}),
        sfx: { play() {} },
        voice: { stop() {}, speak: (line, opts) => { spoken.push({ id: line.id, priority: opts?.priority }); return Promise.resolve(); } },
        pickLine: () => null, lineForTile: () => null, describeEvent: () => null,
      },
    });
    core.enqueue([cardEvent], initial);
    await vi.runAllTimersAsync();
    core.dispose();
    return spoken;
  };
  const card = (player, cardId) => ({ type: 'card', player, cardId, kind: 'bad', title: 'Paytm Karo!', text: 't', te: 't' });

  it('plays the Paytm clip with high priority when somebody else draws the card', async () => {
    expect(await play(card('bot', 'paytm_100'))).toEqual([{ id: 'sfx_paytm_100', priority: 'high' }]);
  });

  it('does not play it for the player who has to pay', async () => {
    expect((await play(card('me', 'paytm_100'))).map((s) => s.id)).not.toContain('sfx_paytm_100');
  });

  it('does not play it for other cards', async () => {
    expect(await play(card('bot', 'biryani_promise'))).toEqual([]);
  });
});
