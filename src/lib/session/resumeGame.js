/**
 * Move an accepted legacy save to single-die play without replaying completed actions.
 * The caller keeps the original save until the player accepts this change. This function
 * does not persist anything, advance RNG or settle pending purchases, auctions or debts.
 */
export function upgradeSavedGame(state) {
  if (!state || !Array.isArray(state.players) || state.cfg?.diceCount === 1) return state;

  const upgraded = structuredClone(state);
  upgraded.cfg = { ...upgraded.cfg, diceCount: 1 };
  upgraded.dice = [0]; // No single-die result exists until the next roll.
  for (const player of upgraded.players) {
    // Old doubles are not sixes. Keep any already-earned extraRoll entitlement, but
    // start the new six streak and lucky-die dry-spell counter from zero.
    player.doubles = 0;
    player.rollsSinceDouble = 0;
  }
  return upgraded;
}
