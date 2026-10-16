// User row <-> API shape mapping and simple user queries.
import { query } from './db.js';
import { levelFromXp } from './xp.js';

export const USER_COLUMNS =
  'id, google_sub, email, name, avatar, friend_code, is_guest, xp, coins, level, games, wins, best_worth, rent_earned, created_at, last_seen';

/** Full profile (only ever sent to the user themselves). */
export function rowToUser(r) {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    friendCode: r.friend_code,
    isGuest: !!r.is_guest,
    level: levelFromXp(r.xp),
    xp: r.xp,
    coins: r.coins,
    stats: {
      games: r.games,
      wins: r.wins,
      bestWorth: r.best_worth,
      rentEarned: Number(r.rent_earned),
    },
  };
}

/** What other players may see: no email / stats beyond level. */
export function rowToFriend(r, online = false) {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    friendCode: r.friend_code,
    online,
    level: levelFromXp(r.xp),
  };
}

export async function getUserById(env, id) {
  const rows = await query(env, `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function getUserByFriendCode(env, code) {
  const rows = await query(env, `SELECT ${USER_COLUMNS} FROM users WHERE friend_code = $1`, [code]);
  return rows[0] || null;
}

/** `{id,name,avatar}` – the small identity blob pushed over sockets. */
export const identity = (r) => ({ id: r.id, name: r.name, avatar: r.avatar });
