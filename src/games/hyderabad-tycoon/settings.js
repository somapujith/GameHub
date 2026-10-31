// Hyderabad Tycoon host settings: presets, limits, the lobby schema (docs/MARKETPLACE.md section 4)
// and the one-line summary. Pure (no React), so the manifest stays tiny and tests run in node.
//
// The server is the source of truth: values here MUST equal worker/settings.js (enforced by
// settings.test.js). The schema keeps every key the server accepts, but the lobby only shows the
// end-cash limit (`LOBBY_SETTINGS`); rounds, dice, start cash and the auction stay at their defaults.
import { formatINR } from '@shared/format.js';

export const GOAL_PRESETS = [30000, 50000, 70000, 100000];
export const GOAL_MIN = 10000;
export const GOAL_MAX = 1000000;
export const GOAL_STEP = 5000;
export const DEFAULT_GOAL = 70000;

export const DEFAULT_ROUNDS = 50; // the schema also offers 30 and null (unlimited), but the lobby never shows it

export const CASH_PRESETS = [10000, 15000, 20000, 25000];
export const CASH_MIN = 5000;
export const CASH_MAX = 100000;
export const DEFAULT_CASH = 15000;

export const DEFAULT_DICE = 'lucky';
export const DEFAULT_AUCTION_ON_DECLINE = true;

// Snatch (docs/GAME_RULES.md section 9): engine settings with defaults, validated by worker/settings.js.
// They are not host settings: not in SETTINGS_SCHEMA and never shown in the lobby.
export const SNATCHES_DEFAULT = 1; // tokens each player starts with
export const SNATCHES_MAX = 3;
export const SNATCH_MS_DEFAULT = 3000; // how long the snatch window stays open
export const SNATCH_MS_MIN = 1000;
export const SNATCH_MS_MAX = 10000;

export const clampGoal = (g) => Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(Number(g) || DEFAULT_GOAL)));

/** The one line the lobby shows everyone: "First to reach ₹70,000 wins". A missing goal means the default. */
export function settingsSummary(s = {}) {
  return `First to reach ${formatINR(s.goal ?? DEFAULT_GOAL)} wins`;
}

/** The only schema keys the lobby renders (manifest `lobbySettings`): the end-cash limit. */
export const LOBBY_SETTINGS = ['goal'];

/** The fixed table rules, one muted line under the end-cash limit (manifest `tableRules`). */
export const TABLE_RULES = `Single die - ${SNATCHES_DEFAULT} Snatch${SNATCHES_DEFAULT === 1 ? '' : 'es'} each - sealed bidding on a tie`;

/** Host settings schema. The lobby renders just `LOBBY_SETTINGS`; the full set is what the server validates. */
export const SETTINGS_SCHEMA = [
  {
    key: 'goal',
    label: 'End cash limit',
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
