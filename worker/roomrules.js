// Game-agnostic room rules shared by POST /api/rooms and the GameRoom Durable Object: which game,
// who can see the room, how many seats, and which settings. Pure functions, no I/O. Everything
// here treats its input as untrusted; game-specific checks are delegated to the adapter.
import { getAdapter, DEFAULT_GAME_ID } from './games/index.js';

export const VISIBILITIES = ['private', 'public'];
export const DEFAULT_VISIBILITY = 'private';

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (error) => ({ ok: false, error });

/** 'private' | 'public' | null (anything else). */
export const parseVisibility = (v) => (v === 'private' || v === 'public' ? v : null);

/** Seats of a new room when the host picks none. */
export const defaultSeats = (adapter) => adapter.defaultMaxPlayers ?? Math.min(4, adapter.maxPlayers);

/** Integer within the adapter's player range, else null. */
export const parseSeats = (adapter, v) =>
  Number.isInteger(v) && v >= adapter.minPlayers && v <= adapter.maxPlayers ? v : null;

export const seatsMessage = (adapter) => `Players must be between ${adapter.minPlayers} and ${adapter.maxPlayers}.`;

/** Missing (or null) `gameId` means the original game, so old clients keep working. */
export const gameIdOf = (v) => (v === undefined || v === null ? DEFAULT_GAME_ID : v);

/**
 * Validate a room-creation request `{ gameId?, settings?, maxPlayers?, visibility? }`.
 * -> { ok:true, adapter, gameId, settings (full, validated), maxPlayers, visibility } | { ok:false, error }
 * `error` is 'unknown game' for an unregistered game, else a human-readable message.
 */
export function parseRoomInit(body, lookup = getAdapter) {
  const b = isPlainObject(body) ? body : {};
  const gameId = gameIdOf(b.gameId);
  const adapter = lookup(gameId);
  if (!adapter) return fail('unknown game');

  let visibility = DEFAULT_VISIBILITY;
  if (b.visibility !== undefined && b.visibility !== null) {
    visibility = parseVisibility(b.visibility);
    if (!visibility) return fail('Visibility must be private or public.');
  }

  const rawSettings = b.settings === undefined || b.settings === null ? {} : b.settings;
  if (!isPlainObject(rawSettings)) return fail('Settings must be an object.');
  const { maxPlayers: seatsInSettings, ...rest } = rawSettings; // convenience: seats may ride along in settings
  let maxPlayers = defaultSeats(adapter);
  const wanted = b.maxPlayers !== undefined ? b.maxPlayers : seatsInSettings;
  if (wanted !== undefined) {
    const mp = parseSeats(adapter, wanted);
    if (mp == null) return fail(seatsMessage(adapter));
    maxPlayers = mp;
  }

  const v = adapter.validateSettings(rest);
  if (!v.ok) return fail(v.error);
  return { ok: true, adapter, gameId: adapter.id, settings: v.settings, maxPlayers, visibility };
}

/**
 * Validate a host's settings message over the current settings.
 * `patch` may carry `maxPlayers` (room seats, a shared setting); everything else goes to the adapter.
 * -> { ok:true, settings, maxPlayers? } | { ok:false, error }
 */
export function parseSettingsPatch(adapter, current, patch) {
  const p = patch === undefined || patch === null ? {} : patch;
  if (!isPlainObject(p)) return fail('Settings must be an object.');
  const { maxPlayers: seats, ...rest } = p;
  let maxPlayers;
  if (seats !== undefined) {
    maxPlayers = parseSeats(adapter, seats);
    if (maxPlayers == null) return fail(seatsMessage(adapter));
  }
  const v = adapter.validateSettings({ ...current, ...rest });
  if (!v.ok) return fail(v.error);
  return maxPlayers === undefined ? { ok: true, settings: v.settings } : { ok: true, settings: v.settings, maxPlayers };
}

/** Fallback action allow-list for adapters without `sanitizeAction`: a `{type}` object, playerId forced. */
export function defaultSanitizeAction(input, playerId) {
  if (!isPlainObject(input) || typeof input.type !== 'string' || !input.type || input.type.length > 40) return null;
  return { ...input, playerId };
}
