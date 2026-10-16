// Registry of server game adapters (docs/MARKETPLACE.md section 5).
//
// An adapter is the only place that knows the rules of a game: GameRoom, the persistence code and
// the HTTP routes talk to games exclusively through it. To add a game, write worker/games/<id>.js
// (default export = adapter) and add it to GAME_ADAPTERS below; the id must equal the frontend
// manifest id (src/games/<id>/manifest.js).
//
// Adapter interface (see hyderabad-tycoon.js for a complete implementation):
//
//   required:  id, name, minPlayers, maxPlayers, defaultSettings,
//              validateSettings(raw) -> { ok:true, settings } | { ok:false, error }   (strict, untrusted input)
//              createGame({ players:[{id,name,avatar,isBot?,bot?}], settings, seed }) -> state
//              applyAction(state, action) -> { state, events, error? }                (pure; invalid -> same state + error)
//              nextBotMove(state, rnd) -> action | null       (the move some bot should make now)
//              turnPlayerId(state) -> playerId | null          (who the idle timer waits for)
//              deadlines(state) -> [{ key, afterMs, playerId, action }]   (game timers besides the turn timer;
//                                  `key` identifies one timer instance, it runs afterMs after it first appears)
//              idleAction(state, playerId) -> action | null    (auto-play for an AFK / disconnected human)
//              isOver(state) -> boolean
//              result(state, meta) -> { winnerId, reason, rounds?, standings:[{ id, rank, score, stats? }], legacy? }
//              redact(state, viewerId) -> state                (hide secrets; return `state` itself when nothing is hidden)
//              rivals(count, taken?) -> [{ name, avatar, bot }]   (bots added in the lobby)
//
//   optional (all have a harmless default):
//              defaultMaxPlayers            seats of a new room (default min(4, maxPlayers))
//              pendingPlayerIds(state)      every player the game waits for (default [turnPlayerId])
//              sanitizeAction(raw, playerId)  allow-list for client actions (default: any {type} object, playerId forced)
//              lobbySettings(settings)      settings as the lobby shows them (default: the settings)
//              summarize(settings)          one-line summary for open-table cards
//              animationMs(events)          client animation time of an action (the next move waits for it)
//              startAnimMs                  client animation time when the game starts
//              resignAction(state, playerId)  what leaving a running game does (default: nothing)
//              track(meta, events, state)   fold events into an opaque per-match `meta` kept in the room record
//              emotes                       whitelist for `{t:'chat', emote}` (default: none)
//
//   `result().legacy` is only for Hyderabad Tycoon: when present, the old users.games / wins /
//   best_worth / rent_earned columns and the matches goal / max_rounds / dice_mode columns are
//   kept up to date for the previous version of the app.
import hyderabadTycoon from './hyderabad-tycoon.js';

/** The game of rooms created before the marketplace existed (and of requests without `gameId`). */
export const DEFAULT_GAME_ID = hyderabadTycoon.id;

// A plain object on purpose: tests register extra adapters here (and remove them again).
export const GAME_ADAPTERS = {
  [hyderabadTycoon.id]: hyderabadTycoon,
};

/** The adapter for a game id, or null for anything unknown (including non-strings). */
export function getAdapter(id) {
  return typeof id === 'string' && Object.hasOwn(GAME_ADAPTERS, id) ? GAME_ADAPTERS[id] : null;
}

/** Public description of every registered game (no functions): `GET /api/games` adds `openTables`. */
export function listGames() {
  return Object.values(GAME_ADAPTERS).map((a) => ({
    id: a.id,
    name: a.name,
    minPlayers: a.minPlayers,
    maxPlayers: a.maxPlayers,
  }));
}

export const REQUIRED_METHODS = [
  'validateSettings',
  'createGame',
  'applyAction',
  'nextBotMove',
  'turnPlayerId',
  'deadlines',
  'idleAction',
  'isOver',
  'result',
  'redact',
  'rivals',
];

/** Names of everything an adapter is missing from the required interface ([] = conformant). */
export function missingFromAdapter(adapter) {
  const missing = [];
  if (!adapter || typeof adapter !== 'object') return ['adapter'];
  if (typeof adapter.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(adapter.id)) missing.push('id');
  if (typeof adapter.name !== 'string' || !adapter.name) missing.push('name');
  if (!Number.isInteger(adapter.minPlayers) || adapter.minPlayers < 1) missing.push('minPlayers');
  if (!Number.isInteger(adapter.maxPlayers) || adapter.maxPlayers < (adapter.minPlayers || 1)) missing.push('maxPlayers');
  if (!adapter.defaultSettings || typeof adapter.defaultSettings !== 'object') missing.push('defaultSettings');
  for (const m of REQUIRED_METHODS) if (typeof adapter[m] !== 'function') missing.push(m);
  return missing;
}
