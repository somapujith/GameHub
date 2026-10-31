// What the lobby's seat grid and Start button say, from the room's numbers. Pure and unit-tested.

/**
 * `players` = people in the room, `joined` = taken seats, `maxPlayers` = seats, `minToStart` = the game's minimum.
 * -> { enough, full, emptySeats, label, help }
 */
export function startState({ players, joined, maxPlayers, minToStart = 2, starting = false }) {
  const emptySeats = Math.max(0, maxPlayers - joined);
  const enough = players >= minToStart;
  const full = emptySeats === 0;
  const label = starting ? 'Starting...' : !enough ? 'Waiting for more players...' : full ? 'Table full - start!' : `Start with ${players} players`;
  const help = !enough
    ? `Share the code or link above. You need at least ${minToStart} players to start.`
    : full
      ? 'Everyone is here.'
      : `${emptySeats} ${emptySeats === 1 ? 'seat is' : 'seats are'} still open. Start now, or wait for more.`;
  return { enough, full, emptySeats, label, help };
}

/** "2 of 4 joined". */
export const joinedLabel = (joined, maxPlayers) => `${joined} of ${maxPlayers} joined`;

/** Width (0..100) of the seat progress bar. */
export const joinedPercent = (joined, maxPlayers) => (maxPlayers > 0 ? Math.max(0, Math.min(100, (joined / maxPlayers) * 100)) : 0);
