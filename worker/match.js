// Match persistence: builds the record for a finished game and writes it to Neon exactly once.
// Game-agnostic: everything game-specific comes from the adapter's `result(state, meta)`.
import { query, transaction } from './db.js';
import { matchRewards, levelFromXp } from './xp.js';
import { ratingDeltas } from './rating.js';

const INT_MAX = 2147483647;

/**
 * Turn a finished room into plain rows. Pure: no I/O.
 * `room` needs { matchId, code, startedAt, endedAt, state, meta?, players:[{id,name,isBot}] };
 * `adapter` is the game's adapter (see worker/games/index.js).
 */
export function buildMatchRecord(room, adapter) {
  const res = adapter.result(room.state, room.meta || {});
  const seats = new Map(room.players.map((p) => [p.id, p]));
  const n = res.standings.length;
  const legacy = res.legacy || null;
  const isBotRow = (row) => !seats.get(row.id) || !!seats.get(row.id).isBot;

  const players = res.standings.map((row) => {
    const seat = seats.get(row.id);
    const isBot = isBotRow(row);
    return {
      user_id: isBot ? null : row.id,
      name: (seat && seat.name) || 'Player',
      is_bot: isBot,
      rank: row.rank,
      final_worth: Math.round(row.score),
      rent_earned: Math.round(row.stats?.rentEarned || 0),
      hotels_built: Math.round(row.stats?.hotelsBuilt || 0),
    };
  });

  const users = res.standings
    .filter((row) => !isBotRow(row))
    .map((row) => {
      const won = res.winnerId === row.id;
      const { xp, coins } = matchRewards({ won, rank: row.rank, playerCount: n });
      const score = Math.min(Math.max(Math.round(row.score), 0), INT_MAX);
      const rent = Math.round(row.stats?.rentEarned || 0);
      return {
        user_id: row.id,
        won: won ? 1 : 0,
        xp,
        coins,
        score, // user_game_stats.best_score
        // Legacy users.* columns: only Hyderabad Tycoon keeps feeding them (previous app version).
        lg: legacy ? 1 : 0,
        lw: legacy && won ? 1 : 0,
        lworth: legacy ? score : 0,
        lrent: legacy ? rent : 0,
      };
    });

  const winner = res.winnerId ? seats.get(res.winnerId) : null;
  return {
    id: room.matchId,
    gameId: adapter.id,
    roomCode: room.code,
    startedAt: new Date(room.startedAt).toISOString(),
    endedAt: new Date(room.endedAt || Date.now()).toISOString(),
    rounds: Number.isFinite(res.rounds) ? res.rounds : 0,
    winnerId: winner && !winner.isBot ? winner.id : null,
    winReason: res.reason || null,
    goal: legacy ? legacy.goal ?? null : null,
    maxRounds: legacy ? legacy.maxRounds ?? null : null,
    diceMode: legacy ? legacy.diceMode ?? null : null,
    playerCount: n,
    players,
    users,
    // every seat, for the rating maths (humans are rated against the average of the others)
    seats: res.standings.map((row) => ({ id: row.id, rank: row.rank, isBot: isBotRow(row) })),
  };
}

// One statement = one atomic transaction. `ins` only returns a row the first time a match id
// is seen (ON CONFLICT DO NOTHING), and every other part reads from `ins`, so replaying the same
// match never double-counts anything:
//   mp  match_players rows
//   up  users: xp/coins always; the legacy games/wins/best_worth/rent_earned columns only when
//       lg = 1 (Hyderabad Tycoon, so the previous app version keeps working)
//   gs  user_game_stats: games, wins, best_score, rating (the row is created at 1000 + delta;
//       |delta| <= 24 so `EXCLUDED.rating - 1000` is exactly the delta; floor 100)
export const PERSIST_SQL = `
WITH ins AS (
  INSERT INTO matches (id, room_code, started_at, ended_at, rounds, winner_id, win_reason, goal, max_rounds, player_count, dice_mode, game_id)
  VALUES ($1::uuid, $2, $3::timestamptz, $4::timestamptz, $5::int,
          (SELECT id FROM users WHERE id = $6::uuid), $7, $8::int, $9::int, $10::int, $13, $14::text)
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), mp AS (
  INSERT INTO match_players (match_id, user_id, name, is_bot, rank, final_worth, rent_earned, hotels_built)
  SELECT ins.id, (SELECT u.id FROM users u WHERE u.id = p.user_id), p.name, p.is_bot, p.rank, p.final_worth, p.rent_earned, p.hotels_built
    FROM ins
   CROSS JOIN jsonb_to_recordset($11::jsonb)
      AS p(user_id uuid, name text, is_bot boolean, rank int, final_worth bigint, rent_earned bigint, hotels_built int)
  RETURNING 1
), up AS (
  UPDATE users u SET
         games = u.games + r.lg,
         wins = u.wins + r.lw,
         xp = u.xp + r.xp,
         coins = u.coins + r.coins,
         best_worth = GREATEST(u.best_worth, LEAST(r.lworth, 2147483647)::int),
         rent_earned = u.rent_earned + r.lrent
    FROM ins
   CROSS JOIN jsonb_to_recordset($12::jsonb)
      AS r(user_id uuid, lg int, lw int, xp int, coins int, lworth bigint, lrent bigint)
   WHERE u.id = r.user_id
  RETURNING u.id, u.xp
), gs AS (
  INSERT INTO user_game_stats (user_id, game_id, games, wins, best_score, rating, updated_at)
  SELECT g.user_id, $14::text, 1, g.won, LEAST(g.score, 2147483647)::int, GREATEST(100, 1000 + g.delta), now()
    FROM ins
   CROSS JOIN jsonb_to_recordset($12::jsonb)
      AS g(user_id uuid, won int, score bigint, delta int)
   WHERE EXISTS (SELECT 1 FROM users x WHERE x.id = g.user_id)
  ON CONFLICT (user_id, game_id) DO UPDATE SET
         games = user_game_stats.games + 1,
         wins = user_game_stats.wins + EXCLUDED.wins,
         best_score = GREATEST(user_game_stats.best_score, EXCLUDED.best_score),
         rating = GREATEST(100, user_game_stats.rating + (EXCLUDED.rating - 1000)),
         updated_at = now()
  RETURNING 1
)
SELECT (SELECT count(*) FROM ins)::int AS inserted,
       (SELECT coalesce(json_agg(json_build_object('id', up.id, 'xp', up.xp)), '[]'::json) FROM up) AS users
`;

/** Current ratings of the human players in this game (missing rows = a new player at 1000). */
async function loadRatings(env, rec) {
  const ids = rec.users.map((u) => u.user_id);
  if (!ids.length) return {};
  try {
    const rows = await query(
      env,
      'SELECT user_id, rating FROM user_game_stats WHERE game_id = $1 AND user_id = ANY($2::uuid[])',
      [rec.gameId, ids],
    );
    return Object.fromEntries(rows.map((r) => [r.user_id, r.rating]));
  } catch {
    return {}; // ratings are secondary: never block the match record on them
  }
}

/** Write a match record. Resolves to `{ inserted }` (false = it had already been stored). */
export async function persistMatch(env, rec) {
  const ratings = await loadRatings(env, rec);
  const deltas = ratingDeltas(rec.seats.map((s) => ({ ...s, rating: ratings[s.id] })));
  const users = rec.users.map((u) => ({ ...u, delta: deltas[u.user_id] || 0 }));
  const rows = await query(env, PERSIST_SQL, [
    rec.id,
    rec.roomCode,
    rec.startedAt,
    rec.endedAt,
    rec.rounds,
    rec.winnerId,
    rec.winReason,
    rec.goal,
    rec.maxRounds,
    rec.playerCount,
    JSON.stringify(rec.players),
    JSON.stringify(users),
    rec.diceMode,
    rec.gameId,
  ]);
  const row = rows[0] || { inserted: 0, users: [] };
  const updated = typeof row.users === 'string' ? JSON.parse(row.users) : row.users || [];
  if (row.inserted > 0 && updated.length) {
    try {
      // Level is derived from XP (also recomputed when read); keep the column in step.
      await transaction(
        env,
        updated.map((u) => ['UPDATE users SET level = $2 WHERE id = $1 AND level <> $2', [u.id, levelFromXp(u.xp)]]),
      );
    } catch {
      /* cosmetic: the API recomputes level from xp */
    }
  }
  return { inserted: row.inserted > 0 };
}
