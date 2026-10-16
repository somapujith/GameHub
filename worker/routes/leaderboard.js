import { Hono } from 'hono';
import { query, HttpError } from '../db.js';
import { getAdapter } from '../games/index.js';
import { limit } from '../ratelimit.js';
import { parseGameParam, buildLeaderboardQuery, rowToLeaderboardRow } from '../leaderboard.js';

const leaderboard = new Hono();

const caches = new Map(); // game -> { at, rows }
const TTL_MS = 15_000;

// GET /api/leaderboard?game=<id>|overall
//   -> { rows:[{ rank, name, avatar, level, wins, games, bestScore, rating, bestWorth }] }
// No parameter = overall (ranked by xp). Per game: wins, then rating. Top 50, cached 15 s.
// Public (no sign-in): guests can look at the Rank tab; guests themselves are never listed.
leaderboard.get('/', limit('leaderboard', 60, 60), async (c) => {
  const game = parseGameParam(c.req.query('game'), getAdapter);
  if (game === null) throw new HttpError(400, 'unknown game');
  const now = Date.now();
  let hit = caches.get(game);
  if (!hit || now - hit.at > TTL_MS) {
    const q = buildLeaderboardQuery(game);
    const rows = await query(c.env, q.text, q.params);
    hit = { at: now, rows: rows.map(rowToLeaderboardRow) };
    if (caches.size > 20) caches.clear();
    caches.set(game, hit);
  }
  return c.json({ rows: hit.rows });
});

export default leaderboard;
