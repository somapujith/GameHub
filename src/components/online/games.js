// The online pages' only door to the game registry (`src/games/registry.js`, owned by platform-core).
// Everything here is defensive: an unknown id, a missing registry entry or a throwing loader never crashes a page.
import { getGame, liveGames } from '@/games/registry.js';
import { DEFAULT_GAME_ID } from './gameRoute.js';

/** The manifest of a game, or null. */
export function gameOf(id) {
  try {
    return (id && getGame(id)) || null;
  } catch {
    return null;
  }
}

/** Display name for a game id (falls back to the id itself, then to a neutral word). */
export function gameName(id, game = gameOf(id)) {
  return (game && game.name) || id || 'this game';
}

/** Games that can host a friends room right now (live, online-capable): the "Invite to game" choices. */
export function inviteGames() {
  let list = [];
  try {
    list = liveGames() || [];
  } catch {
    list = [];
  }
  return list.filter((g) => g && g.status !== 'coming_soon' && (!g.modes || g.modes.friends !== false) && g.loaders && g.loaders.onlineGame);
}

/** The game used when something does not say which one (old links, `?host=1`). */
export function defaultGame() {
  return gameOf(DEFAULT_GAME_ID) || inviteGames()[0] || null;
}

/** The component a module exports for a page: the default export, else the first exported function. */
export function pickComponent(mod) {
  if (!mod) return null;
  if (typeof mod === 'function') return mod;
  if (mod.default) return mod.default;
  return Object.values(mod).find((v) => typeof v === 'function') || null;
}

const loading = new Map(); // gameId -> Promise<Component>
const loaded = new Map(); // gameId -> Component

/** Component of a game's online page if it was loaded before (so a revisit renders without a spinner). */
export function loadedOnlineGame(gameId) {
  return loaded.get(gameId) || null;
}

/**
 * Load `manifest.loaders.onlineGame` once per game. Rejects when the game has no online page or the chunk
 * fails to load (a failed load is forgotten, so "Try again" really tries again).
 */
export function loadOnlineGame(game) {
  if (!game || !game.loaders || typeof game.loaders.onlineGame !== 'function') {
    return Promise.reject(new Error('This game has no online mode.'));
  }
  const id = game.id;
  if (loaded.has(id)) return Promise.resolve(loaded.get(id));
  let p = loading.get(id);
  if (!p) {
    p = Promise.resolve()
      .then(() => game.loaders.onlineGame())
      .then((mod) => {
        const Comp = pickComponent(mod);
        if (!Comp) throw new Error('The game page did not export a component.');
        loaded.set(id, Comp);
        return Comp;
      });
    p.then(
      () => loading.delete(id),
      () => loading.delete(id),
    );
    loading.set(id, p);
  }
  return p;
}

/** Start loading a game's online page in the background (lobby: so "Start" feels instant). Never throws. */
export function warmOnlineGame(game) {
  if (!game) return;
  loadOnlineGame(game).catch(() => {});
}
