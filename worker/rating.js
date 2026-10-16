// Per-game player rating: a deliberately simple Elo variant. Pure functions, no I/O.
//
// Formula (applied once per finished match, to every HUMAN player; bots are opponents with a
// fixed rating and are never rated themselves):
//
//   N        = number of seats in the match (humans + bots)
//   actual   = (N - rank) / (N - 1)                      1 for the winner ... 0 for last place
//   oppAvg   = average rating of the other N - 1 seats   (bots count as BOT_RATING)
//   expected = 1 / (1 + 10 ^ ((oppAvg - own) / 400))     the classic Elo expectation
//   delta    = round(K * (actual - expected))            K = 24
//   rating'  = max(100, rating + delta)                  floor 100
//
// A new player starts at 1000, so one match moves a rating by at most +-24 and a fresh
// (rating 1000) row is created as GREATEST(100, 1000 + delta) - see PERSIST_SQL in match.js.
export const RATING_START = 1000;
export const RATING_FLOOR = 100;
export const RATING_K = 24;
export const BOT_RATING = 1000;

/** Elo expectation of a player rated `own` against opponents averaging `oppAvg`. */
export const expectedScore = (own, oppAvg) => 1 / (1 + 10 ** ((oppAvg - own) / 400));

/** Apply a delta with the floor. */
export const applyDelta = (rating, delta) => Math.max(RATING_FLOOR, Math.round(rating + delta));

/**
 * Rating change for every human in a match.
 * `seats`: [{ id, rank, rating?, isBot? }] for ALL seats (rank 1 = best; ties share a rank).
 * Returns { [id]: delta } for the humans only. Fewer than two seats -> everyone gets 0.
 */
export function ratingDeltas(seats) {
  const out = {};
  const n = seats.length;
  const rated = seats.map((s) => ({
    ...s,
    r: s.isBot ? BOT_RATING : Number.isFinite(s.rating) ? s.rating : RATING_START,
  }));
  const sum = rated.reduce((a, s) => a + s.r, 0);
  for (const s of rated) {
    if (s.isBot) continue;
    if (n < 2) {
      out[s.id] = 0;
      continue;
    }
    const actual = (n - s.rank) / (n - 1);
    const oppAvg = (sum - s.r) / (n - 1);
    out[s.id] = Math.round(RATING_K * (actual - expectedScore(s.r, oppAvg))) || 0; // || 0 turns -0 into 0
  }
  return out;
}
