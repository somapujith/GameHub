// Every URL in the app is built here, so screens never hard-code a path and a game never needs to
// know how the hub is laid out. Owned by the orchestrator: do not edit.

const enc = encodeURIComponent;

export const paths = {
  hub: () => '/',
  /** Game detail page. */
  game: (gameId) => `/games/${enc(gameId)}`,
  /** The game's own "play vs bots" setup screen (a plugin component). */
  setup: (gameId) => `/games/${enc(gameId)}/play`,
  /** Public rooms ("open tables") for one game. */
  tables: (gameId) => `/games/${enc(gameId)}/tables`,
  /** Extra screens a game registers (story, campaign...). `extra` is the manifest `extras[].path`. */
  extra: (gameId, extra) => `/games/${enc(gameId)}/x/${enc(extra)}`,
  /** Full-screen offline game (no hub chrome). Config travels in `location.state`. */
  offline: (gameId) => `/play/${enc(gameId)}/offline`,
  /** Full-screen online game for a room code. */
  online: (gameId, code) => `/play/${enc(gameId)}/online/${enc(code)}`,
  lobby: (code) => `/lobby/${enc(code)}`,
  join: (code) => (code ? `/join/${enc(code)}` : '/join'),
  friends: () => '/friends',
  /** Opens "add this friend?" for a friend code (`HYD-XXXX`). */
  friendLink: (friendCode) => `/f/${enc(friendCode)}`,
  leaderboard: (gameId) => (gameId ? `/leaderboard?game=${enc(gameId)}` : '/leaderboard'),
  profile: () => '/profile',
  login: (next) => (next ? `/login?next=${enc(next)}` : '/login'),
};

/** Old single-game URLs that must keep working (bookmarks, shared links, installed PWA). */
export const LEGACY_REDIRECTS = [
  ['/play', '/games/hyderabad-tycoon/play'],
  ['/campaign', '/games/hyderabad-tycoon/x/campaign'],
  ['/story', '/games/hyderabad-tycoon/x/story'],
  ['/settings', '/profile'],
];

export default paths;
