// The `rooms` table: a listing of live rooms that powers "Open tables" (public lobbies) and
// "Continue playing" (rooms you are in). The GameRoom Durable Object is the source of truth and
// keeps its row in step on a best-effort basis; nothing here may ever break a room. Query builders
// are pure (unit-tested); the functions that touch the database take `env`.
import { query } from './db.js';
import { getAdapter } from './games/index.js';
import { isUuid } from './validate.js';

export const OPEN_ROOMS_MAX = 20;
export const OPEN_FRESH_MINUTES = 60; // a public lobby unseen for this long is not listed
export const ROOM_MAX_AGE_HOURS = 24; // older rows are ignored by every query
export const OPEN_CACHE_MS = 5000;
export const LISTING_HEARTBEAT_MS = 20 * 60 * 1000; // public lobbies refresh their row this often

/** Does this environment have a database to write to? (Unit tests run without one.) */
export const hasDb = (env) => !!(env && env.DATABASE_URL);

/** 1..OPEN_ROOMS_MAX (numbers or numeric strings); anything else -> the default (the maximum). */
export function clampLimit(raw, max = OPEN_ROOMS_MAX) {
  const n = typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? Number(raw) : raw;
  if (!Number.isInteger(n) || n < 1) return max;
  return Math.min(n, max);
}

// ---------------------------------------------------------------- query builders (pure)

const OPEN_WHERE = `visibility = 'public' AND status = 'lobby' AND player_count < max_players
            AND updated_at > now() - interval '${OPEN_FRESH_MINUTES} minutes'`;

/** Public lobbies with a free seat, newest activity first. `game` is optional. */
export function buildOpenRoomsQuery({ game, limit } = {}) {
  const params = [];
  let where = OPEN_WHERE;
  if (game) {
    params.push(game);
    where += ` AND game_id = $${params.length}`;
  }
  params.push(clampLimit(limit));
  return {
    text: `SELECT code, game_id, host_name, player_count, max_players, settings, created_at
       FROM rooms
      WHERE ${where}
      ORDER BY updated_at DESC
      LIMIT $${params.length}`,
    params,
  };
}

/** Number of open tables per game (for GET /api/games). */
export function buildOpenCountsQuery() {
  return {
    text: `SELECT game_id, count(*)::int AS n FROM rooms WHERE ${OPEN_WHERE} GROUP BY game_id`,
    params: [],
  };
}

/** Rooms (lobby or playing) the user is a human member of. */
export function buildMyRoomsQuery(userId) {
  return {
    text: `SELECT code, game_id, status, player_count, max_players
       FROM rooms
      WHERE member_ids @> ARRAY[$1::uuid]
        AND status IN ('lobby', 'playing')
        AND updated_at > now() - interval '${ROOM_MAX_AGE_HOURS} hours'
      ORDER BY updated_at DESC
      LIMIT ${OPEN_ROOMS_MAX}`,
    params: [userId],
  };
}

export const UPSERT_ROOM_SQL = `
INSERT INTO rooms (code, game_id, host_id, host_name, visibility, status, player_count, max_players, settings, member_ids, created_at, updated_at)
VALUES ($1, $2, $3::uuid, $4, $5, $6, $7::int, $8::int, $9::jsonb, $10::uuid[], to_timestamp($11::double precision / 1000.0), now())
ON CONFLICT (code) DO UPDATE SET
       game_id = EXCLUDED.game_id,
       host_id = EXCLUDED.host_id,
       host_name = EXCLUDED.host_name,
       visibility = EXCLUDED.visibility,
       status = EXCLUDED.status,
       player_count = EXCLUDED.player_count,
       max_players = EXCLUDED.max_players,
       settings = EXCLUDED.settings,
       member_ids = EXCLUDED.member_ids,
       created_at = EXCLUDED.created_at,
       updated_at = now()`;

export const DELETE_ROOM_SQL = 'DELETE FROM rooms WHERE code = $1';
// Housekeeping for rows whose Durable Object vanished without cleaning up (twice the max age).
export const DELETE_STALE_SQL = `DELETE FROM rooms WHERE updated_at < now() - interval '${ROOM_MAX_AGE_HOURS * 2} hours'`;

// ---------------------------------------------------------------- row <-> record mapping (pure)

/** The row a GameRoom record maps to. */
export function roomRow(room) {
  const host = room.players.find((p) => p.id === room.hostId);
  return {
    code: room.code,
    gameId: room.gameId,
    hostId: isUuid(room.hostId) ? room.hostId : null,
    hostName: host ? host.name : null,
    visibility: room.visibility,
    status: room.status,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    settings: room.settings || {},
    memberIds: room.players.filter((p) => !p.isBot && !p.left && isUuid(p.id)).map((p) => p.id),
    createdAt: room.createdAt,
  };
}

/** Everything about a row that matters to a listing (so unchanged rows are not rewritten). */
export const rowSignature = (row) => JSON.stringify({ ...row, createdAt: 0 });

/** A listing row from the database -> the API shape of GET /api/rooms/open. */
export function rowToOpenRoom(r, lookup = getAdapter) {
  const adapter = lookup(r.game_id);
  let summary;
  try {
    summary = adapter && adapter.summarize ? adapter.summarize(r.settings || {}) : undefined;
  } catch {
    summary = undefined;
  }
  const out = {
    code: r.code,
    gameId: r.game_id,
    hostName: r.host_name || null,
    players: r.player_count,
    maxPlayers: r.max_players,
    createdAt: new Date(r.created_at).toISOString(),
  };
  if (summary) out.summary = summary;
  return out;
}

export const rowToMyRoom = (r) => ({
  code: r.code,
  gameId: r.game_id,
  status: r.status,
  players: r.player_count,
  maxPlayers: r.max_players,
});

// ---------------------------------------------------------------- database access

/** Insert or update a room's listing row. Throws on failure: callers swallow it. */
export async function upsertRoomRow(env, row) {
  if (!hasDb(env)) return;
  await query(env, UPSERT_ROOM_SQL, [
    row.code,
    row.gameId,
    row.hostId,
    row.hostName,
    row.visibility,
    row.status,
    row.playerCount,
    row.maxPlayers,
    JSON.stringify(row.settings),
    row.memberIds,
    row.createdAt,
  ]);
}

export async function deleteRoomRow(env, code) {
  if (!hasDb(env)) return;
  await query(env, DELETE_ROOM_SQL, [code]);
}

const caches = { open: new Map(), counts: null, cleanedAt: 0 };

/** Test helper. */
export function _resetRoomsCacheForTests() {
  caches.open.clear();
  caches.counts = null;
  caches.cleanedAt = 0;
}

/** Public lobbies, cached for OPEN_CACHE_MS per (game, limit) in this isolate. */
export async function listOpenRooms(env, { game, limit } = {}, now = Date.now()) {
  const q = buildOpenRoomsQuery({ game, limit });
  const key = q.params.join('|');
  const hit = caches.open.get(key);
  if (hit && now - hit.at < OPEN_CACHE_MS) return hit.rooms;
  const rows = await query(env, q.text, q.params);
  const rooms = rows.map((r) => rowToOpenRoom(r));
  if (caches.open.size > 50) caches.open.clear();
  caches.open.set(key, { at: now, rooms });
  // Now and then drop rows whose Durable Object vanished without cleaning up (best effort).
  if (now - caches.cleanedAt > 60 * 60 * 1000) {
    caches.cleanedAt = now;
    query(env, DELETE_STALE_SQL).catch(() => {});
  }
  return rooms;
}

/** { [gameId]: number of open tables }, cached like listOpenRooms. Never throws (zeros on failure). */
export async function countOpenTables(env, now = Date.now()) {
  if (caches.counts && now - caches.counts.at < OPEN_CACHE_MS) return caches.counts.map;
  const map = {};
  try {
    const q = buildOpenCountsQuery();
    for (const r of await query(env, q.text, q.params)) map[r.game_id] = r.n;
  } catch {
    /* the games list must work without the listing */
  }
  caches.counts = { at: now, map };
  return map;
}

/** The caller's live rooms. */
export async function listMyRooms(env, userId) {
  const q = buildMyRoomsQuery(userId);
  const rows = await query(env, q.text, q.params);
  return rows.map(rowToMyRoom);
}
