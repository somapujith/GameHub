import { describe, it, expect, beforeEach, vi } from 'vitest';

function stubLocalStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
  return m;
}

let S;
beforeEach(async () => {
  vi.resetModules();
  stubLocalStorage();
  S = await import('./storage.js');
});

describe('settings', () => {
  it('has contract defaults and merges patches', () => {
    const s = S.loadSettings();
    expect(s).toMatchObject({ sfx: true, voice: true, tts: true, volume: 0.8, subtitles: 'te', reducedMotion: false });
    expect(Object.keys(s.actors)).toHaveLength(12);
    expect(Object.values(s.actors).every(Boolean)).toBe(true);
    S.saveSettings({ volume: 5, subtitles: 'xx', actors: { ntr: false } });
    const n = S.loadSettings();
    expect(n.volume).toBe(1);
    expect(n.subtitles).toBe('te');
    expect(n.actors.ntr).toBe(false);
    expect(n.actors.prabhas).toBe(true);
  });

  it('notifies subscribers and keeps a stable snapshot between changes', () => {
    const cb = vi.fn();
    const off = S.subscribeSettings(cb);
    const a = S.loadSettings();
    expect(S.loadSettings()).toBe(a);
    S.saveSettings({ sfx: false });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(S.loadSettings()).not.toBe(a);
    off();
    S.saveSettings({ sfx: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('survives a throwing localStorage (in-memory fallback)', async () => {
    vi.resetModules();
    globalThis.localStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    const B = await import('./storage.js');
    B.saveSettings({ volume: 0.3 });
    expect(B.loadSettings().volume).toBe(0.3);
    B.saveGame({ players: [], owners: [], phase: 'roll' }, { a: 1 });
    expect(B.loadGame().meta).toEqual({ a: 1 });
    B.clearGame();
    expect(B.loadGame()).toBeNull();
  });
});

describe('levels and profile', () => {
  it('levelInfo walks the curve', () => {
    expect(S.levelInfo(0)).toEqual({ level: 1, into: 0, need: 100, pct: 0 });
    expect(S.levelInfo(100)).toMatchObject({ level: 2, into: 0, need: 200 });
    expect(S.levelInfo(250)).toMatchObject({ level: 2, into: 150, pct: 75 });
    expect(S.levelInfo(300).level).toBe(3);
    expect(S.levelInfo(-5).level).toBe(1);
  });

  it('addMatchResult awards xp/coins and updates stats', () => {
    const r = S.addMatchResult({ won: true, rank: 1, worth: 71000, rentEarned: 5000, propertiesBought: 6, players: [{}, {}, {}, {}] });
    // 40 + 120 + 3*15 + min(5000/50, 80) = 285
    expect(r.xpGained).toBe(285);
    expect(r.coinsGained).toBe(25 + 100 + 30 + 50);
    expect(r.level).toBe(S.levelInfo(285).level);
    expect(r.leveledUp).toBe(true);
    const p = S.loadProfile();
    expect(p.stats).toEqual({ games: 1, wins: 1, rentEarned: 5000, bestWorth: 71000, propertiesBought: 6, hotelsBuilt: 0 });
    expect(p.coins).toBe(500 + r.coinsGained);
    const lose = S.addMatchResult({ won: false, rank: 4, worth: 1000, rentEarned: 0, propertiesBought: 0, players: 4, rounds: 30 });
    expect(lose.xpGained).toBe(40);
    expect(S.loadProfile().stats.bestWorth).toBe(71000);
  });

  it('loads older profiles that lack newer stats, and counts hotels', async () => {
    vi.resetModules();
    const m = stubLocalStorage();
    m.set('hyd.profile.v1', JSON.stringify({ name: 'Old', xp: 120, coins: 10, stats: { games: 3, wins: 1, rentEarned: 100, bestWorth: 5000, propertiesBought: 4 } }));
    const O = await import('./storage.js');
    const p = O.loadProfile();
    expect(p).toMatchObject({ name: 'Old', xp: 120, level: 2, coins: 10 });
    expect(p.stats).toEqual({ games: 3, wins: 1, rentEarned: 100, bestWorth: 5000, propertiesBought: 4, hotelsBuilt: 0 });
    O.addMatchResult({ won: false, rank: 2, players: 2, hotelsBuilt: 2 });
    expect(O.loadProfile().stats.hotelsBuilt).toBe(2);
  });

  it('useProfile-style updates merge stats', () => {
    S.saveProfile({ name: 'Nithin', stats: { games: 2 } });
    const p = S.loadProfile();
    expect(p.name).toBe('Nithin');
    expect(p.stats.games).toBe(2);
    expect(p.stats.wins).toBe(0);
  });
});

describe('daily reward', () => {
  it('claims once a day and keeps or resets the streak', () => {
    const d1 = new Date(2026, 5, 10, 9);
    const first = S.claimDaily(d1);
    expect(first).toEqual({ ok: true, coins: 150, streak: 1 });
    expect(S.claimDaily(new Date(2026, 5, 10, 22))).toEqual({ ok: false });
    expect(S.claimDaily(new Date(2026, 5, 11, 8))).toEqual({ ok: true, coins: 200, streak: 2 });
    expect(S.claimDaily(new Date(2026, 5, 13, 8))).toEqual({ ok: true, coins: 150, streak: 1 }); // skipped a day
    expect(S.loadProfile().coins).toBe(500 + 150 + 200 + 150);
  });

  it('caps the reward growth', () => {
    expect(S.dailyReward(1)).toBe(150);
    expect(S.dailyReward(6)).toBe(400);
    expect(S.dailyReward(30)).toBe(400);
  });
});

describe('campaign and saved game', () => {
  it('completes chapters once and unlocks the next', () => {
    expect(S.loadCampaign()).toEqual({ unlocked: 1, completed: [] });
    expect(S.completeChapter('c1').firstTime).toBe(true);
    expect(S.completeChapter('c1').firstTime).toBe(false);
    expect(S.loadCampaign()).toEqual({ unlocked: 2, completed: ['c1'] });
  });

  it('round-trips and clears a saved game, ignoring finished games', () => {
    expect(S.loadGame()).toBeNull();
    const state = { players: [{ id: 'me' }], owners: [], phase: 'roll', round: 2 };
    S.saveGame(state, { chapterId: 'c1' });
    expect(S.loadGame()).toMatchObject({ state, meta: { chapterId: 'c1' } });
    S.saveGame({ ...state, phase: 'over' }, {});
    expect(S.loadGame()).toBeNull();
    S.saveGame(state, {});
    S.clearGame();
    expect(S.loadGame()).toBeNull();
  });
});
