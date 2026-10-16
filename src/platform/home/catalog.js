// Thin, defensive reads of the game registry for the hub screens. The registry is written by another
// module (src/games/registry.js); every call is wrapped so a hiccup there can never blank the home page.
import * as registry from '@/games/registry.js';

function safe(fn, fallback) {
  try {
    const v = typeof fn === 'function' ? fn() : undefined;
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

export const allGames = () => asList(safe(() => registry.GAMES, []));
export const liveList = () => {
  const l = asList(safe(() => registry.liveGames(), null));
  return l.length ? l : allGames().filter((g) => g.status === 'live');
};
export const soonList = () => {
  const l = asList(safe(() => registry.comingSoonGames(), null));
  return l.length ? l : allGames().filter((g) => g.status === 'coming_soon');
};
export const categoryList = () => asList(safe(() => registry.CATEGORIES, []));
export const featured = () => safe(() => registry.featuredGame(), null) || liveList()[0] || null;
export const gameById = (id) => safe(() => registry.getGame(id), null) || allGames().find((g) => g.id === id) || null;

export const categoryLabel = (id) => categoryList().find((c) => c.id === id)?.label || id || '';

/** Live games first, then coming soon, in registry order. */
export function orderedGames() {
  const all = allGames();
  const live = all.filter((g) => g.status === 'live');
  const rest = all.filter((g) => g.status !== 'live');
  return [...live, ...rest];
}

/** Categories that have at least one game, each with its games (live first). */
export function groupByCategory() {
  const games = orderedGames();
  const cats = categoryList();
  const known = new Set(cats.map((c) => c.id));
  const out = cats
    .map((c) => ({ ...c, games: games.filter((g) => g.category === c.id) }))
    .filter((c) => c.games.length);
  // Games whose category the registry does not list still get a row rather than disappearing.
  const strays = games.filter((g) => !known.has(g.category));
  if (strays.length) out.push({ id: 'other', label: 'More games', icon: null, games: strays });
  return out;
}
