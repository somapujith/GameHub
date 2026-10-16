// Match persistence: builds the record for a finished game and writes it to Neon exactly once.
import { standings } from '../shared/index.js';
import { query, transaction } from './db.js';
import { matchRewards, levelFromXp } from './xp.js';

const INT_MAX = 2147483647;

/**
 * Hotels a player built: the room counts them from `level` events as the game goes
 * (`room.hotels`); falls back to an engine stat if one ever appears.
 */
const hotelsBuilt = (p, room) => {
  const n = Number(room.hotels?.[p.id] ?? p.stats?.hotelsBuilt ?? p.stats?.hotels ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 100) : 0;
};

/**
 * Turn a finished room (`room.state.phase === 'over'`) into plain rows.
 * Pure: no I/O. `room` needs { matchId, code, startedAt, endedAt, state }.
 */
export function buildMatchRecord(room) {
  const st = room.state;
  const table = standings(st);
  const byId = new Map(table.map((r) => [r.id, r]));
  const n = st.players.length;
  const rawMax = st.cfg && st.cfg.maxRounds;
  const maxRounds = Number.isFinite(rawMax) ? rawMax : null; // null = unlimited
  const rounds = maxRounds ? Math.min(st.round, maxRounds) : st.round;

  const players = st.players.map((p) => {
    const row = byId.get(p.id);
    return {
      user_id: p.isBot ? null : p.id,
      name: p.name,
      is_bot: !!p.isBot,
      rank: row.rank,
      final_worth: Math.round(row.worth),
      rent_earned: Math.round(p.stats?.rentEarned || 0),
      hotels_built: hotelsBuilt(p, room),
    };
  });

  const users = st.players
    .filter((p) => !p.isBot)
    .map((p) => {
      const row = byId.get(p.id);
      const won = st.winner === p.id;
      const { xp, coins } = matchRewards({ won, rank: row.rank, playerCount: n });
      return {
        user_id: p.id,
        won: won ? 1 : 0,
        xp,
        coins,
        worth: Math.min(Math.round(row.worth), INT_MAX),
        rent: Math.round(p.stats?.rentEarned || 0),
      };
    });

  const winner = st.winner ? st.players.find((p) => p.id === st.winner) : null;
  return {
    id: room.matchId,
    roomCode: room.code,
    startedAt: new Date(room.startedAt).toISOString(),
    endedAt: new Date(room.endedAt || Date.now()).toISOString(),
    rounds,
    winnerId: winner && !winner.isBot ? winner.id : null,
    winReason: st.winReason || null,
    goal: Number.isFinite(st.cfg?.goal) ? st.cfg.goal : null,
    maxRounds,
    diceMode: st.cfg?.dice === 'fair' ? 'fair' : 'lucky',
    playerCount: n,
    players,
    users,
  };
}

// One statement = one atomic transaction. `ins` only returns a row the first time a match id
// is seen (ON CONFLICT DO NOTHING), and both the match_players insert and the user stat
// update read from `ins`, so replaying the same match never double-counts anything.
const PERSIST_SQL = `
WITH ins AS (
  INSERT INTO matches (id, room_code, started_at, ended_at, rounds, winner_id, win_reason, goal, max_rounds, player_count, dice_mode)
  VALUES ($1::uuid, $2, $3::timestamptz, $4::timestamptz, $5::int,
          (SELECT id FROM users WHERE id = $6::uuid), $7, $8::int, $9::int, $10::int, $13)
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
         games = u.games + 1,
         wins = u.wins + r.won,
         xp = u.xp + r.xp,
         coins = u.coins + r.coins,
         best_worth = GREATEST(u.best_worth, LEAST(r.worth, 2147483647)::int),
         rent_earned = u.rent_earned + r.rent
    FROM ins
   CROSS JOIN jsonb_to_recordset($12::jsonb)
      AS r(user_id uuid, won int, xp int, coins int, worth bigint, rent bigint)
   WHERE u.id = r.user_id
  RETURNING u.id, u.xp
)
SELECT (SELECT count(*) FROM ins)::int AS inserted,
       (SELECT coalesce(json_agg(json_build_object('id', up.id, 'xp', up.xp)), '[]'::json) FROM up) AS users
`;

/** Write a match record. Resolves to `{ inserted }` (false = it had already been stored). */
export async function persistMatch(env, rec) {
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
    JSON.stringify(rec.users),
    rec.diceMode,
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
