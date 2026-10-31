// Every URL in the app is built here, so screens never hard-code a path and a game never needs to
// know how the hub is laid out.

const enc = encodeURIComponent;

export const paths = {
  hub: () => '/',
  /** Game detail page. */
  game: (gameId) => `/games/${enc(gameId)}`,
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

/**
 * Old URLs that must keep working (bookmarks, shared links, installed PWA). The offline / campaign / story
 * screens are gone, so their links land on the game page, where a table is created.
 */
export const LEGACY_REDIRECTS = [
  ['/play', '/games/hyderabad-tycoon'],
  ['/campaign', '/games/hyderabad-tycoon'],
  ['/story', '/games/hyderabad-tycoon'],
  ['/settings', '/profile'],
];

export default paths;
