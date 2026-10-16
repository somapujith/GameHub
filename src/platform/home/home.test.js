import { describe, expect, it } from 'vitest';
import { BADGES, buildBadgeContext, evaluateBadges } from './badges.js';
import { fmtStat, resolveGameStats, statDefs, statValue } from './gameStats.js';
import { playersLabel } from './gameTheme.js';

const profile = (stats = {}, extra = {}) => ({ dailyStreak: 0, stats: { games: 0, wins: 0, bestWorth: 0, rentEarned: 0, hotelsBuilt: 0, ...stats }, ...extra });

describe('resolveGameStats', () => {
  it('prefers the server per-game stats', () => {
    const user = { gameStats: { 'hyderabad-tycoon': { games: 3, wins: 2, bestScore: 5000, rating: 1010 } } };
    expect(resolveGameStats({ user, profile: profile({ games: 99 }), gameId: 'hyderabad-tycoon' })).toMatchObject({ games: 3, wins: 2, bestScore: 5000, source: 'server' });
  });

  it('falls back to the offline record for the default game only', () => {
    const p = profile({ games: 4, wins: 1, bestWorth: 70000 });
    expect(resolveGameStats({ user: null, profile: p, gameId: 'hyderabad-tycoon' })).toMatchObject({ games: 4, wins: 1, bestScore: 70000, source: 'local' });
    expect(resolveGameStats({ user: null, profile: p, gameId: 'some-other-game' })).toBeNull();
  });

  it('returns null when there is nothing to show', () => {
    expect(resolveGameStats({ user: null, profile: profile(), gameId: 'hyderabad-tycoon' })).toBeNull();
  });
});

describe('stat helpers', () => {
  it('reads bestScore from the legacy bestWorth', () => {
    expect(statValue({ bestWorth: 12 }, 'bestScore')).toBe(12);
    expect(statValue({ wins: 0 }, 'wins')).toBe(0);
    expect(statValue({}, 'wins')).toBeNull();
  });

  it('formats numbers with Indian grouping and em dash for missing', () => {
    expect(fmtStat(125000)).toBe('1,25,000');
    expect(fmtStat(null)).toBe('—');
    expect(fmtStat(70000, { format: 'inr' })).toBe('₹70k');
  });

  it('uses the manifest stats or a default trio', () => {
    expect(statDefs({ stats: [{ key: 'wins', label: 'Wins' }] })).toEqual([{ key: 'wins', label: 'Wins' }]);
    expect(statDefs(null).length).toBe(3);
  });

  it('labels player counts', () => {
    expect(playersLabel({ min: 2, max: 6 })).toBe('2–6 players');
    expect(playersLabel({ min: 4, max: 4 })).toBe('4 players');
    expect(playersLabel({ min: 1, max: 1 })).toBe('Solo');
    expect(playersLabel(null)).toBe('');
  });
});

describe('badges', () => {
  const earnedIds = (ctx) => evaluateBadges(ctx).filter((b) => b.earned).map((b) => b.id);

  it('has unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });

  it('earns nothing for a brand-new player', () => {
    const ctx = buildBadgeContext({ perGame: [], profile: profile(), level: 1, friends: 0 });
    expect(earnedIds(ctx)).toEqual([]);
  });

  it('derives First Win, 10 Wins and Hotel Tycoon from stats', () => {
    const per = [{ games: 12, wins: 10 }];
    const ctx = buildBadgeContext({ perGame: per, profile: profile({ hotelsBuilt: 5 }), level: 2, friends: 0 });
    const ids = earnedIds(ctx);
    expect(ids).toEqual(expect.arrayContaining(['rookie', 'first-win', 'ten-wins', 'hotel-tycoon']));
    expect(ids).not.toContain('social-butterfly');
  });

  it('hides Social Butterfly until the friends list is known, then needs 3 friends', () => {
    const base = { perGame: [], profile: profile(), level: 1 };
    expect(evaluateBadges(buildBadgeContext({ ...base, friends: null })).some((b) => b.id === 'social-butterfly')).toBe(false);
    expect(earnedIds(buildBadgeContext({ ...base, friends: 3 }))).toContain('social-butterfly');
    expect(earnedIds(buildBadgeContext({ ...base, friends: 2 }))).not.toContain('social-butterfly');
  });

  it('reports progress for locked badges', () => {
    const ctx = buildBadgeContext({ perGame: [{ games: 5, wins: 5 }], profile: profile(), level: 1, friends: 0 });
    const ten = evaluateBadges(ctx).find((b) => b.id === 'ten-wins');
    expect(ten).toMatchObject({ earned: false, value: 5, target: 10, pct: 50 });
  });
});
