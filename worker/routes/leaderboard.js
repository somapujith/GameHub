import { Hono } from 'hono';
import { query } from '../db.js';
import { requireMember } from '../auth.js';
import { levelFromXp } from '../xp.js';

const leaderboard = new Hono();

let cache = { at: 0, rows: null };
const TTL_MS = 15_000;

// GET /api/leaderboard -> { rows:[{rank,name,avatar,level,wins,games,bestWorth}] } (members only)
leaderboard.get('/', requireMember, async (c) => {
  const now = Date.now();
  if (!cache.rows || now - cache.at > TTL_MS) {
    const rows = await query(
      c.env,
      `SELECT (ROW_NUMBER() OVER (ORDER BY wins DESC, best_worth DESC, games ASC, created_at ASC))::int AS rank,
              name, avatar, xp, wins, games, best_worth
         FROM users
        WHERE is_guest = false AND games > 0
        ORDER BY rank
        LIMIT 50`,
    );
    cache = {
      at: now,
      rows: rows.map((r) => ({
        rank: r.rank,
        name: r.name,
        avatar: r.avatar,
        level: levelFromXp(r.xp),
        wins: r.wins,
        games: r.games,
        bestWorth: r.best_worth,
      })),
    };
  }
  return c.json({ rows: cache.rows });
});

export default leaderboard;
