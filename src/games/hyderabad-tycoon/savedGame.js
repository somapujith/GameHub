// "Continue playing" entry for the hub: the unfinished offline game on this device, or null.
// Sync and cheap (a localStorage read); safe to call on every render of the home page.
import { formatINR } from '@shared/format.js';
import { loadGame } from '@/lib/storage.js';
import { paths } from '@/platform/paths.js';
import { GAME_ID } from './constants.js';

export default function savedGame() {
  let saved = null;
  try {
    saved = loadGame();
  } catch {
    saved = null;
  }
  const st = saved?.state;
  if (!st || st.phase === 'over' || st.winner) return null;

  const meta = saved.meta || {};
  const players = Array.isArray(st.players) ? st.players : [];
  const me = players.find((p) => p.id === meta.me) || players.find((p) => !p.isBot) || players[0];
  const round = Number(meta.round ?? st.round) || 1;
  // `meta.worth` is written by useOfflineGame; saves from older builds only have the player's cash.
  const worth = Number.isFinite(meta.worth) ? meta.worth : null;
  const tail = worth !== null ? `${formatINR(worth)} net worth` : typeof me?.cash === 'number' ? `${formatINR(me.cash)} cash` : null;

  return {
    title: 'Hyderabad Tycoon',
    subtitle: tail ? `Round ${round} · ${tail}` : `Round ${round}`,
    to: paths.offline(GAME_ID),
  };
}
