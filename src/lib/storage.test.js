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
  it('has sound and motion defaults and merges patches', () => {
    expect(S.loadSettings()).toEqual({ sfx: true, volume: 0.8, reducedMotion: false });
    S.saveSettings({ volume: 5, reducedMotion: true });
    expect(S.loadSettings()).toEqual({ sfx: true, volume: 1, reducedMotion: true });
    S.saveSettings({ sfx: false, voice: true, subtitles: 'te', actors: { ntr: false } }); // unknown keys are dropped
    expect(S.loadSettings()).toEqual({ sfx: false, volume: 1, reducedMotion: true });
  });

  it('loads settings saved by older builds (with voice, subtitle and actor keys) and ignores those keys', async () => {
    vi.resetModules();
    const m = stubLocalStorage();
    m.set('hyd.settings.v1', JSON.stringify({ sfx: false, voice: true, tts: false, volume: 0.3, subtitles: 'tn', reducedMotion: true, actors: { ntr: false } }));
    const O = await import('./storage.js');
    expect(O.loadSettings()).toEqual({ sfx: false, volume: 0.3, reducedMotion: true });
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
    B.saveProfile({ name: 'Nithin' });
    expect(B.loadProfile().name).toBe('Nithin');
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

  it('loads older profiles that lack newer stats (and ignores the retired story flag)', async () => {
    vi.resetModules();
    const m = stubLocalStorage();
    m.set('hyd.profile.v1', JSON.stringify({ name: 'Old', xp: 120, coins: 10, seenStory: true, stats: { games: 3, wins: 1, rentEarned: 100, bestWorth: 5000, propertiesBought: 4 } }));
    const O = await import('./storage.js');
    const p = O.loadProfile();
    expect(p).toMatchObject({ name: 'Old', xp: 120, level: 2, coins: 10 });
    expect(p.stats).toEqual({ games: 3, wins: 1, rentEarned: 100, bestWorth: 5000, propertiesBought: 4, hotelsBuilt: 0 });
    expect(p).not.toHaveProperty('seenStory');
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

describe('retired features', () => {
  it('no longer exports the offline-game, campaign, match-result or voice helpers', () => {
    for (const name of ['saveGame', 'loadGame', 'clearGame', 'hasSavedGame', 'subscribeGame', 'loadCampaign', 'completeChapter', 'useCampaign', 'addMatchResult', 'isActorEnabled', 'ACTOR_IDS']) {
      expect(S, name).not.toHaveProperty(name);
    }
  });

  it('removes the keys an older build left behind for the offline game and the campaign', async () => {
    vi.resetModules();
    const m = stubLocalStorage();
    m.set('hyd.game.v1', '{"state":{"players":[],"owners":[]}}');
    m.set('hyd.campaign.v1', '{"completed":["c1"]}');
    m.set('hyd.profile.v1', '{"name":"Keep"}');
    const O = await import('./storage.js');
    expect(m.has('hyd.game.v1')).toBe(false);
    expect(m.has('hyd.campaign.v1')).toBe(false);
    expect(O.loadProfile().name).toBe('Keep');
  });
});
