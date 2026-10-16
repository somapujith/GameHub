// Room settings model shared by the lobby host controls and the read-only summary (pure, unit-tested).
// Contract 3b: goal 10,000-1,000,000 (presets 30k/50k/70k/1L + 5k stepper), maxRounds 30 | 50 | null
// (null = unlimited, never Infinity), startCash presets 10k/15k/20k/25k, 2-6 players.
// Contract 3c (rules v2): dice 'lucky' (default) | 'fair', auctionOnDecline boolean (default true).
import { formatINR, compactINR } from '@shared/format.js';

export const GOAL_MIN = 10000;
export const GOAL_MAX = 1000000;
export const GOAL_STEP = 5000;
export const GOAL_PRESETS = [30000, 50000, 70000, 100000];
export const CASH_PRESETS = [10000, 15000, 20000, 25000];
export const ROUND_CHOICES = [
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: null, label: 'Unlimited' },
];
export const DICE_CHOICES = [
  { value: 'lucky', label: '🍀 Lucky' },
  { value: 'fair', label: '⚖️ Fair' },
];
export const PLAYERS_MIN = 2;
export const PLAYERS_MAX = 6;
export const DEFAULT_ROOM_SETTINGS = { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true };

/** Only 30, 50 and null are valid; undefined (and anything else) means the default (50). */
export function normalizeRounds(v) {
  if (v === null) return null;
  if (v === 30 || v === 50) return v;
  return DEFAULT_ROOM_SETTINGS.maxRounds;
}

/** 'fair' stays fair; anything else (including undefined) is the default 'lucky'. */
export function normalizeDice(v) {
  return v === 'fair' ? 'fair' : 'lucky';
}

export function clampGoal(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_ROOM_SETTINGS.goal;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, n));
}

/** One stepper press: +/- 5,000, snapped to the 5,000 grid, clamped to the valid range. */
export function stepGoal(goal, dir) {
  const g = clampGoal(goal);
  const snapped = dir > 0 ? Math.floor(g / GOAL_STEP) * GOAL_STEP + GOAL_STEP : Math.ceil(g / GOAL_STEP) * GOAL_STEP - GOAL_STEP;
  return clampGoal(snapped);
}

/** Server settings (possibly partial / missing) -> complete, valid values for display and editing. */
export function resolveSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const cash = Number(s.startCash);
  return {
    goal: Number.isFinite(Number(s.goal)) && s.goal != null ? clampGoal(s.goal) : DEFAULT_ROOM_SETTINGS.goal,
    startCash: Number.isFinite(cash) && s.startCash != null && cash > 0 ? Math.round(cash) : DEFAULT_ROOM_SETTINGS.startCash,
    maxRounds: normalizeRounds(s.maxRounds),
    dice: normalizeDice(s.dice),
    auctionOnDecline: s.auctionOnDecline !== false,
  };
}

/**
 * The exact message body for a host change: always the full set with explicit values
 * (`maxRounds: null` = unlimited, never Infinity), so a partial echo from the server can never leave gaps.
 */
export function settingsMessage(current, patch) {
  const next = resolveSettings({ ...current, ...patch });
  return {
    t: 'settings',
    settings: { goal: next.goal, startCash: next.startCash, maxRounds: next.maxRounds, dice: next.dice, auctionOnDecline: next.auctionOnDecline },
  };
}

export function roundsLabel(maxRounds) {
  const r = normalizeRounds(maxRounds);
  return r === null ? 'Unlimited rounds' : `${r} rounds`;
}

export function diceLabel(dice) {
  return normalizeDice(dice) === 'fair' ? 'Fair dice' : 'Lucky dice';
}

/** "Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice" */
export function settingsSummary(raw) {
  const s = resolveSettings(raw);
  return `Target ${formatINR(s.goal)} · ${roundsLabel(s.maxRounds)} · Start ${formatINR(s.startCash)} · ${diceLabel(s.dice)}`;
}

/** Short chips for the read-only view: ["Target ₹70k", "50 rounds", "Start ₹15k", "🍀 Lucky dice", "Auction on skip"]. */
export function settingsChips(raw) {
  const s = resolveSettings(raw);
  return [
    `Target ${compactINR(s.goal)}`,
    roundsLabel(s.maxRounds),
    `Start ${compactINR(s.startCash)}`,
    `${s.dice === 'fair' ? '⚖️' : '🍀'} ${diceLabel(s.dice)}`,
    s.auctionOnDecline ? 'Auction on skip' : 'No auction on skip',
  ];
}

export const ROUNDS_HELP = 'One round = every player plays once. When the rounds run out, the richest player wins.';
export const DICE_HELP = 'Lucky dice gently help whoever is behind. Nothing is guaranteed.';
export const AUCTION_LABEL = 'Auction when a player skips a property';
