// XP / level / reward maths shared by the match-persistence code and the API mapper.

/** XP needed to advance from `level` to `level + 1`. */
export const xpToNext = (level) => 100 + (level - 1) * 50;

/** Level for a lifetime XP total (level 1 at 0 XP). */
export function levelFromXp(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(Number(xp) || 0));
  while (left >= xpToNext(level)) {
    left -= xpToNext(level);
    level += 1;
    if (level >= 999) break;
  }
  return level;
}

/**
 * Rewards for one finished match, for one human player.
 * rank: 1 = winner. playerCount: total seats (humans + bots).
 */
export function matchRewards({ won, rank, playerCount }) {
  const behind = Math.max(0, playerCount - rank);
  const xp = 30 + behind * 10 + (won ? 60 : 0);
  const coins = 40 + behind * 20 + (won ? 140 : 0);
  return { xp, coins };
}
