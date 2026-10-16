import { describe, it, expect } from 'vitest';
import { parseGameParam, buildLeaderboardQuery, rowToLeaderboardRow, LEADERBOARD_LIMIT, OVERALL } from './leaderboard.js';
import { getAdapter } from './games/index.js';

describe('?game= parameter', () => {
  it('no parameter (old clients) means overall', () => {
    for (const raw of [undefined, null, '', 'overall']) expect(parseGameParam(raw, getAdapter)).toBe(OVERALL);
  });
  it('a registered game id is accepted, anything else is unknown', () => {
    expect(parseGameParam('hyderabad-tycoon', getAdapter)).toBe('hyderabad-tycoon');
    for (const bad of ['ludo', 'Overall', 'OVERALL', '__proto__', 'x'.repeat(100), 5, {}, ['overall']]) {
      expect(parseGameParam(bad, getAdapter), String(bad)).toBeNull();
    }
  });
});

describe('leaderboard queries', () => {
  it('overall ranks by xp, never lists guests, and sums per-game stats', () => {
    const q = buildLeaderboardQuery(OVERALL);
    expect(q.params).toEqual([]);
    expect(q.text).toMatch(/ORDER BY u\.xp DESC/);
    expect(q.text).toMatch(/u\.is_guest = false/);
    expect(q.text).toMatch(/FROM user_game_stats GROUP BY user_id/);
    expect(q.text).toMatch(new RegExp(`LIMIT ${LEADERBOARD_LIMIT}$`));
    expect(q.text).toMatch(/AS rank/);
  });

  it('a game ranks by wins, then rating, from user_game_stats; the game id is a bound parameter', () => {
    const q = buildLeaderboardQuery('hyderabad-tycoon');
    expect(q.params).toEqual(['hyderabad-tycoon']);
    expect(q.text).toMatch(/FROM user_game_stats s/);
    expect(q.text).toMatch(/s\.game_id = \$1/);
    expect(q.text).toMatch(/ORDER BY s\.wins DESC, s\.rating DESC/);
    expect(q.text).toMatch(/u\.is_guest = false/);
    expect(q.text).toMatch(/s\.games > 0/);
    expect(q.text).not.toMatch(/hyderabad-tycoon/);
    expect(LEADERBOARD_LIMIT).toBe(50);
  });

  it('rows keep the old shape (bestWorth) and add bestScore / rating; level comes from xp', () => {
    const row = rowToLeaderboardRow({ rank: 1, name: 'Teja', avatar: 2, xp: 100, wins: 4, games: 9, best_score: 123456, rating: 1048 });
    expect(row).toEqual({
      rank: 1,
      name: 'Teja',
      avatar: 2,
      level: 2,
      wins: 4,
      games: 9,
      bestScore: 123456,
      rating: 1048,
      bestWorth: 123456,
    });
  });
});
