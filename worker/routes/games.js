import { Hono } from 'hono';
import { listGames } from '../games/index.js';
import { countOpenTables } from '../roomsdb.js';
import { limit } from '../ratelimit.js';

const games = new Hono();

/** `listGames()` + how many public tables are open for each game. */
export function withOpenTables(list, counts) {
  return list.map((g) => ({ ...g, openTables: counts[g.id] || 0 }));
}

// GET /api/games -> { games:[{ id, name, minPlayers, maxPlayers, openTables }] } (public)
games.get('/', limit('games', 60, 60), async (c) => {
  const counts = await countOpenTables(c.env);
  c.header('Cache-Control', 'public, max-age=5');
  return c.json({ games: withOpenTables(listGames(), counts) });
});

export default games;
