import { describe, expect, it, vi } from 'vitest';

const live = {
  id: 'a-game',
  name: 'A Game',
  status: 'live',
  modes: { friends: true },
  loaders: { onlineGame: () => Promise.resolve({ default: function APage() {} }) },
};
const bots = { id: 'bots-only', name: 'Bots', status: 'live', modes: { friends: false }, loaders: { onlineGame: () => Promise.resolve({}) } };
const soon = { id: 'soon', name: 'Soon', status: 'coming_soon' };
const noOnline = { id: 'offline-only', name: 'Offline', status: 'live', loaders: {} };

vi.mock('@/games/registry.js', () => {
  const all = [live, bots, soon, noOnline];
  return {
    getGame: (id) => all.find((g) => g.id === id) || null,
    liveGames: () => all.filter((g) => g.status === 'live'),
  };
});

const { defaultGame, gameName, gameOf, inviteGames, loadOnlineGame, loadedOnlineGame, pickComponent, warmOnlineGame } = await import('./games.js');

describe('registry access', () => {
  it('finds games and never throws on junk ids', () => {
    expect(gameOf('a-game')).toBe(live);
    expect(gameOf('nope')).toBeNull();
    expect(gameOf(undefined)).toBeNull();
    expect(gameOf('')).toBeNull();
  });
  it('names a game, falling back to the id', () => {
    expect(gameName('a-game')).toBe('A Game');
    expect(gameName('mystery')).toBe('mystery');
    expect(gameName(undefined)).toBe('this game');
  });
  it('invite choices are live, friends-capable games with an online page', () => {
    expect(inviteGames().map((g) => g.id)).toEqual(['a-game']);
  });
  it('falls back to the first invite game when the default game is missing', () => {
    expect(defaultGame()).toBe(live);
  });
});

describe('pickComponent', () => {
  it('takes the default export, a bare function or the first exported function', () => {
    const A = () => null;
    const B = () => null;
    expect(pickComponent({ default: A })).toBe(A);
    expect(pickComponent(B)).toBe(B);
    expect(pickComponent({ Page: B, other: 1 })).toBe(B);
    expect(pickComponent({})).toBeNull();
    expect(pickComponent(null)).toBeNull();
  });
});

describe('loadOnlineGame', () => {
  it('loads once, caches, and exposes the loaded component synchronously', async () => {
    const spy = vi.fn(() => Promise.resolve({ default: function Page() {} }));
    const g = { id: 'cache-me', loaders: { onlineGame: spy } };
    expect(loadedOnlineGame('cache-me')).toBeNull();
    const [a, b] = await Promise.all([loadOnlineGame(g), loadOnlineGame(g)]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loadedOnlineGame('cache-me')).toBe(a);
    await loadOnlineGame(g);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('rejects for a game without an online page, and a failed chunk can be retried', async () => {
    await expect(loadOnlineGame({ id: 'x', loaders: {} })).rejects.toThrow(/no online mode/);
    await expect(loadOnlineGame(null)).rejects.toThrow();
    let calls = 0;
    const flaky = {
      id: 'flaky',
      loaders: {
        onlineGame: () => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('chunk failed')) : Promise.resolve({ default: () => null });
        },
      },
    };
    await expect(loadOnlineGame(flaky)).rejects.toThrow('chunk failed');
    await expect(loadOnlineGame(flaky)).resolves.toBeTypeOf('function');
    expect(calls).toBe(2);
  });
  it('rejects when the module has no component, and a throwing loader is a rejection, not a crash', async () => {
    await expect(loadOnlineGame({ id: 'empty', loaders: { onlineGame: () => Promise.resolve({}) } })).rejects.toThrow(/component/);
    await expect(
      loadOnlineGame({
        id: 'throws',
        loaders: {
          onlineGame() {
            throw new Error('sync boom');
          },
        },
      }),
    ).rejects.toThrow('sync boom');
  });
  it('warmOnlineGame never throws or rejects', async () => {
    expect(() => warmOnlineGame(null)).not.toThrow();
    expect(() => warmOnlineGame({ id: 'warm-bad', loaders: {} })).not.toThrow();
    warmOnlineGame({ id: 'warm-ok', loaders: { onlineGame: () => Promise.resolve({ default: () => null }) } });
    await Promise.resolve();
  });
});
