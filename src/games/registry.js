// The game catalogue. Every game is a plugin: a tiny `manifest.js` (see docs/MARKETPLACE.md section 3) whose
// heavy code sits behind `loaders`. Nothing outside src/games/<id>/ may know about a specific game.
//
// To add a game: create src/games/<id>/manifest.js and add one import + one entry to MANIFESTS below.
import tycoon from './hyderabad-tycoon/manifest.js';
import { SOON_GAMES } from './_soon/index.js';

/** Browse categories. `icon` is the id handed to the hub art kit's `<CategoryIcon id=... />`. */
export const CATEGORIES = [
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'card', label: 'Card', icon: 'card' },
  { id: 'arcade', label: 'Arcade', icon: 'arcade' },
  { id: 'social', label: 'Social', icon: 'social' },
  { id: 'word', label: 'Word', icon: 'word' },
  { id: 'sports', label: 'Sports', icon: 'sports' },
];

/** Ordered: live games first, then the teasers. */
const MANIFESTS = [tycoon, ...SOON_GAMES];

// Defensive: a malformed or duplicate manifest is dropped instead of breaking the whole catalogue.
const seen = new Set();
export const GAMES = Object.freeze(
  MANIFESTS.filter((g) => {
    const ok = !!g && typeof g === 'object' && typeof g.id === 'string' && g.id !== '' && !seen.has(g.id);
    if (ok) seen.add(g.id);
    return ok;
  }),
);

const BY_ID = new Map(GAMES.map((g) => [g.id, g]));

/** Manifest for an id, or null (unknown ids are normal: URLs come from users). */
export function getGame(id) {
  return BY_ID.get(String(id ?? '')) ?? null;
}

const isSoon = (g) => g.status === 'coming_soon';

export const liveGames = () => GAMES.filter((g) => !isSoon(g));
export const comingSoonGames = () => GAMES.filter(isSoon);

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}

/** The game the home hero shows: the first live game flagged `featured`, else the first live game. */
export function featuredGame() {
  const live = liveGames();
  return live.find((g) => g.featured) ?? live[0] ?? GAMES[0] ?? null;
}
