// Leaderboard queries (pure builders + row mapping). `overall` ranks by xp (platform-wide);
// a game id ranks by wins, then rating, from user_game_stats. Guests are never listed.
import { levelFromXp } from './xp.js';

export const OVERALL = 'overall';
export const LEADERBOARD_LIMIT = 50;

/**
 * The `?game=` parameter: missing / empty / 'overall' -> 'overall'; a registered game id -> the id;
 * anything else -> null (the route answers 400 `unknown game`).
 */
export function parseGameParam(raw, lookup) {
  if (raw === undefined || raw === null || raw === '' || raw === OVERALL) return OVERALL;
  return typeof raw === 'string' && lookup(raw) ? raw : null;
}

/** SQL + params for a leaderboard. `game` is 'overall' or a (validated) game id. */
export function buildLeaderboardQuery(game) {
  if (game === OVERALL) {
    return {
      text: `SELECT (ROW_NUMBER() OVER (ORDER BY u.xp DESC, coalesce(s.wins, 0) DESC, coalesce(s.games, 0) ASC, u.created_at ASC))::int AS rank,
              u.name, u.avatar, u.xp,
              coalesce(s.wins, 0)::int AS wins, coalesce(s.games, 0)::int AS games,
              coalesce(s.best_score, 0)::int AS best_score, coalesce(s.rating, 1000)::int AS rating
         FROM users u
         LEFT JOIN (SELECT user_id, sum(wins) AS wins, sum(games) AS games, max(best_score) AS best_score, max(rating) AS rating
                      FROM user_game_stats GROUP BY user_id) s ON s.user_id = u.id
        WHERE u.is_guest = false AND (u.xp > 0 OR u.games > 0 OR s.games > 0)
        ORDER BY rank
        LIMIT ${LEADERBOARD_LIMIT}`,
      params: [],
    };
  }
  return {
    text: `SELECT (ROW_NUMBER() OVER (ORDER BY s.wins DESC, s.rating DESC, s.games ASC, u.created_at ASC))::int AS rank,
              u.name, u.avatar, u.xp, s.wins, s.games, s.best_score, s.rating
         FROM user_game_stats s
         JOIN users u ON u.id = s.user_id
        WHERE s.game_id = $1 AND s.games > 0 AND u.is_guest = false
        ORDER BY rank
        LIMIT ${LEADERBOARD_LIMIT}`,
    params: [game],
  };
}

/** Database row -> API row. `bestWorth` repeats `bestScore` for clients written before games existed. */
export function rowToLeaderboardRow(r) {
  return {
    rank: r.rank,
    name: r.name,
    avatar: r.avatar,
    level: levelFromXp(r.xp),
    wins: r.wins,
    games: r.games,
    bestScore: r.best_score,
    rating: r.rating,
    bestWorth: r.best_score,
  };
}
