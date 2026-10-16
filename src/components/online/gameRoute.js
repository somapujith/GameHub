// Pure routing logic for the generic online-game page and the lobby (no React, unit-tested).
// A room belongs to exactly one game. `/play/:gameId/online/:code` must show THAT game's page, so the
// dispatcher compares the URL's game with the room's and redirects when they differ.
import BRAND from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';

/** Rooms created before the marketplace have no `gameId`: they are the first game. */
export const DEFAULT_GAME_ID = BRAND.defaultGameId;

/** The game of a room payload (HTTP `GET /api/rooms/:code` or the socket's `{t:'room'}` room). */
export function roomGameId(room) {
  return room && typeof room.gameId === 'string' && room.gameId ? room.gameId : DEFAULT_GAME_ID;
}

/** 'public' | 'private' (anything unknown is private: safest default). */
export function roomVisibility(room) {
  return room && room.visibility === 'public' ? 'public' : 'private';
}

/**
 * What to do for `/play/:routeGameId/online/:code` once the room is known.
 *  - `room` = GET /api/rooms/:code payload, or null/undefined when the lookup failed for a reason other than "no such room"
 *  - `{ kind: 'ok' }`                      render the route game's page
 *  - `{ kind: 'redirect', to }`            the room belongs to another game: go to paths.online(thatGame, code)
 *  - `{ kind: 'missing' }`                 the server says there is no such room
 */
export function resolveOnlineRoute({ gameId, code, room }) {
  if (room && room.exists === false) return { kind: 'missing' };
  if (!room) return { kind: 'ok' };
  const actual = roomGameId(room);
  if (actual !== gameId) return { kind: 'redirect', to: paths.online(actual, code) };
  return { kind: 'ok' };
}

/**
 * Turn the outcome of `api.get('/api/rooms/:code')` into the `room` argument of `resolveOnlineRoute`:
 * a 404 means "missing"; offline and other failures are inconclusive (the game page shows its own reconnect state).
 */
export function lookupResult(err, info) {
  if (!err) return info || null;
  if (err.status === 404) return { exists: false };
  return null;
}

// ---- remember which game a room is, so the lobby -> game hop does not need another lookup

const known = new Map(); // code -> { gameId, at }
const KNOWN_TTL = 2 * 60 * 1000;
const KNOWN_MAX = 20;

export function rememberRoomGame(code, gameId, now = Date.now()) {
  if (!code || !gameId) return;
  known.delete(code);
  known.set(code, { gameId, at: now });
  while (known.size > KNOWN_MAX) known.delete(known.keys().next().value);
}

export function knownRoomGame(code, now = Date.now()) {
  const hit = known.get(code);
  if (!hit) return null;
  if (now - hit.at > KNOWN_TTL) {
    known.delete(code);
    return null;
  }
  return hit.gameId;
}

export function forgetRoomGames() {
  known.clear();
}
