import { formatINR } from '@shared/format.js';

/* Pre-game settings shared by Quick Play setup and the campaign cards (contract section 3b). */
export const GOAL_PRESETS = [30000, 50000, 70000, 100000];
export const GOAL_MIN = 10000;
export const GOAL_MAX = 1000000;
export const GOAL_STEP = 5000;
export const DEFAULT_GOAL = 70000;

export const ROUND_OPTIONS = [30, 50, null]; // null = unlimited (never Infinity)
export const DEFAULT_ROUNDS = 50;

export const CASH_PRESETS = [10000, 15000, 20000, 25000];
export const DEFAULT_CASH = 15000;

export const DICE_MODES = ['lucky', 'fair'];
export const DEFAULT_DICE = 'lucky';
export const DEFAULT_AUCTION_ON_DECLINE = true;

export const SETUP_KEY = 'hyd:lastSetup';

export const clampGoal = (g) => Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(Number(g) || DEFAULT_GOAL)));

/** Lowest target that still leaves room to win from this start cash. */
export const minGoalFor = (startCash) => Math.max(GOAL_MIN, Math.ceil((Number(startCash) + GOAL_STEP) / GOAL_STEP) * GOAL_STEP);

export const roundsLabel = (maxRounds, { short = false } = {}) => {
  if (maxRounds === null) return short ? 'Unlimited' : 'Unlimited rounds';
  return short ? String(maxRounds) : `${maxRounds} rounds`;
};

export const diceLabel = (dice) => (dice === 'fair' ? 'Fair dice' : 'Lucky dice');

/**
 * "Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice". Missing keys mean the engine
 * defaults (50 rounds, lucky dice).
 */
export function settingsSummary(s = {}) {
  const rounds = s.maxRounds === undefined ? DEFAULT_ROUNDS : s.maxRounds;
  return [
    `Target ${formatINR(s.goal ?? DEFAULT_GOAL)}`,
    roundsLabel(rounds),
    `Start ${formatINR(s.startCash ?? DEFAULT_CASH)}`,
    diceLabel(s.dice ?? DEFAULT_DICE),
  ].join(' · ');
}
