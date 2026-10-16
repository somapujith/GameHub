// Hyderabad Tycoon host settings: presets, limits, the lobby schema (docs/MARKETPLACE.md section 4)
// and the one-line summary. Pure (no React), so the manifest stays tiny and tests run in node.
//
// The server is the source of truth: values here MUST equal worker/settings.js (enforced by
// settings.test.js). `src/components/shell/gameSettings.js` re-exports this file for older imports.
import { formatINR } from '@shared/format.js';

export const GOAL_PRESETS = [30000, 50000, 70000, 100000];
export const GOAL_MIN = 10000;
export const GOAL_MAX = 1000000;
export const GOAL_STEP = 5000;
export const DEFAULT_GOAL = 70000;

export const ROUND_OPTIONS = [30, 50, null]; // null = unlimited (never Infinity)
export const DEFAULT_ROUNDS = 50;

export const CASH_PRESETS = [10000, 15000, 20000, 25000];
export const CASH_MIN = 5000;
export const CASH_MAX = 100000;
export const DEFAULT_CASH = 15000;

export const DICE_MODES = ['lucky', 'fair'];
export const DEFAULT_DICE = 'lucky';
export const DEFAULT_AUCTION_ON_DECLINE = true;

/** localStorage key of the last offline setup choices. */
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

/** Host settings rendered by the lobby (and read-only for guests via `summarize`). */
export const SETTINGS_SCHEMA = [
  {
    key: 'goal',
    label: 'Winning target',
    type: 'stepper',
    format: 'inr',
    min: GOAL_MIN,
    max: GOAL_MAX,
    step: GOAL_STEP,
    // quick picks next to the +/- stepper
    options: GOAL_PRESETS.map((value) => ({ value, label: formatINR(value) })),
    default: DEFAULT_GOAL,
    help: 'First player to reach this net worth wins.',
  },
  {
    key: 'maxRounds',
    label: 'Rounds',
    type: 'segmented',
    options: [
      { value: 30, label: '30' },
      { value: 50, label: '50' },
      { value: null, label: 'Unlimited' },
    ],
    default: DEFAULT_ROUNDS,
    help: 'One round = every player plays once. When the rounds run out, the richest player wins.',
  },
  {
    key: 'startCash',
    label: 'Start cash',
    type: 'segmented',
    format: 'inr',
    min: CASH_MIN,
    max: CASH_MAX,
    options: CASH_PRESETS.map((value) => ({ value, label: formatINR(value) })),
    default: DEFAULT_CASH,
  },
  {
    key: 'dice',
    label: 'Dice',
    type: 'segmented',
    options: [
      { value: 'lucky', label: 'Lucky' },
      { value: 'fair', label: 'Fair' },
    ],
    default: DEFAULT_DICE,
    help: 'Fair gives every face an equal chance; Lucky gently helps the player behind.',
  },
  {
    key: 'auctionOnDecline',
    label: 'Auction skipped properties',
    type: 'toggle',
    default: DEFAULT_AUCTION_ON_DECLINE,
    help: 'A skipped tile goes to a sealed-bid auction, so everyone can bid.',
  },
];
