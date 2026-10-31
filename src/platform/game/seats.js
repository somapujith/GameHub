// Seat choices on the game page ("How many players?"). Pure, so it is unit-tested.

const DEFAULT_SEATS = 4;

/** The seat counts a game offers: `players.min` .. `players.max`, e.g. [2, 3, 4, 5, 6]. */
export function seatOptions(players) {
  const min = Number.isInteger(players?.min) && players.min >= 1 ? players.min : 2;
  const max = Number.isInteger(players?.max) && players.max >= min ? players.max : min;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** The preselected seat count: 4 when the game allows it, else the nearest allowed number. */
export function defaultSeats(options) {
  if (options.includes(DEFAULT_SEATS)) return DEFAULT_SEATS;
  return options.reduce((best, n) => (Math.abs(n - DEFAULT_SEATS) < Math.abs(best - DEFAULT_SEATS) ? n : best), options[0]);
}
