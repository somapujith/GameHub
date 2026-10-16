// Per-game numbers for the profile and leaderboard: the server's `user.gameStats[gameId]` when present,
// otherwise (the default game only) the legacy account totals or the offline record kept on this device.
import { compactINR } from '@shared/format.js';
import { BRAND } from '@/platform/brand.js';

const n = (v) => Math.max(0, Math.round(Number(v) || 0));

/** `{ games, wins, bestScore, rating, source: 'server'|'account'|'local' }` or `null` when there is no data. */
export function resolveGameStats({ user, profile, gameId }) {
  const server = user?.gameStats?.[gameId];
  if (server && typeof server === 'object') {
    return { games: n(server.games), wins: n(server.wins), bestScore: n(server.bestScore), rating: n(server.rating), source: 'server' };
  }
  if (gameId !== BRAND.defaultGameId) return null;
  const acct = user?.stats;
  if (acct && (acct.games || acct.wins || acct.bestWorth)) {
    return { games: n(acct.games), wins: n(acct.wins), bestScore: n(acct.bestWorth), rating: 0, source: 'account' };
  }
  const local = profile?.stats;
  if (local && (local.games || local.wins || local.bestWorth)) {
    return { games: n(local.games), wins: n(local.wins), bestScore: n(local.bestWorth), rating: 0, source: 'local' };
  }
  return null;
}

/** Columns to show for a game: its manifest `stats`, or a sensible default. */
export function statDefs(game, max = 3) {
  const list = Array.isArray(game?.stats) && game.stats.length ? game.stats : [{ key: 'wins', label: 'Wins' }, { key: 'games', label: 'Games' }, { key: 'rating', label: 'Rating' }];
  return list.slice(0, max);
}

/** A stat value from a leaderboard row or a stats object (`bestScore` falls back to the legacy `bestWorth`). */
export function statValue(source, key) {
  if (!source) return null;
  const v = source[key] ?? (key === 'bestScore' ? source.bestWorth : undefined);
  return v === undefined || v === null ? null : Number(v);
}

const NF = new Intl.NumberFormat('en-IN');

/** Display text for one stat; `def.format === 'inr'` -> rupees, otherwise Indian digit grouping. Missing -> an em dash. */
export function fmtStat(value, def) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return def?.format === 'inr' ? compactINR(value) : NF.format(Math.round(Number(value)));
}
