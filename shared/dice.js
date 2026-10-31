// Dice engine (CONTRACT section 3c). Pure, deterministic, no I/O. Runs in the browser AND the Worker.
//
// There is exactly ONE die. `lucky` (default) applies a small, disclosed, bounded bias to the six faces.
// `fair` gives each face 1/6. The engine injects `ctx = { previewRent(state, tileId, diceSum) }` so this
// module never imports engine.js.
//
// Player fields read (the engine maintains them):
//   cash, pos, jailTurns, bankrupt   existing fields
//   sixes            sixes thrown so far in the CURRENT turn (0 after a non-six, reset each turn)
//   rollsSinceSix    consecutive non-six rolls (reset to 0 by a six, +1 by a non-six)
//   rentStreak       consecutive turns in which the player paid rent >= DICE_RULES.mercy.minRent
// State fields read: cfg.dice, owners[BOARD_SIZE], levels[BOARD_SIZE], mortgaged[BOARD_SIZE] (optional), players[], rng (written by rollDice only).

import { BOARD_SIZE, START_TILE, TILES, isBuyable, mortgageValue, upgradeCost } from './board.js';
import { nextFloat } from './rng.js';

export const DICE_MODES = ['lucky', 'fair'];

/** The six faces of the die as one-element arrays (the shape of `state.dice` and of dice events), index = face - 1. */
export const FACES = [[1], [2], [3], [4], [5], [6]];

const isSix = (values) => values[0] === 6;

/** Fair probability of each face 1..6. */
export const FAIR_TOTAL_PROBS = Object.fromEntries(FACES.map(([face]) => [face, 1 / 6]));

/** Names a rule can have in `assist` / `active`. */
export const ASSIST_NAMES = ['comeback', 'mercy', 'pity', 'antibust'];

/** The disclosed tuning of the lucky dice (so the UI/rules sheet can quote the same numbers). */
export const DICE_RULES = {
  // (1) comeback: below `below` x average worth -> x`boost` on helpful landings (x`strongBoost` below `strongBelow`),
  //     and x`penalty` on landings whose rent is >= `rentShare` of the player's cash.
  comeback: { below: 0.8, strongBelow: 0.5, boost: 1.15, strongBoost: 1.25, rentShare: 0.25, penalty: 0.85 },
  // (2) mercy: after `streak` rent-paying turns (rent >= minRent), landings on an opponent tile asking >= minRent get x`mult`.
  mercy: { streak: 2, minRent: 1000, mult: 0.7 },
  // (3) pity six: after `rolls` non-six rolls in a row, a six gets x`mult`.
  pity: { rolls: 6, mult: 1.5 },
  // (4) anti-streak: after `sixes` sixes in the same turn, a six gets x`mult` (the clamp floors it at `clamp[0]`).
  antibust: { sixes: 2, mult: 0.5 },
  // every face's combined multiplier is clamped to this range BEFORE normalising.
  clamp: [0.6, 1.5],
  // if the final distribution is within this total-variation distance of fair, `assist` is reported as null.
  minShift: 0.005,
};

const ONES = () => new Array(FACES.length).fill(1);
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// ---------------------------------------------------------------------------------------------
// State helpers (local copies of what the engine knows; never import engine.js)
// ---------------------------------------------------------------------------------------------

const playerOf = (state, id) => (state.players || []).find((p) => p.id === id);
const isMortgaged = (state, tile) => !!(state.mortgaged && state.mortgaged[tile]);

/** Net worth: cash + owned tiles (price + levels x upgradeCost; a mortgaged tile counts price - mortgageValue). */
function worthOf(state, playerId) {
  const p = playerOf(state, playerId);
  if (!p) return 0;
  let w = p.cash || 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (state.owners[i] !== playerId) continue;
    const t = TILES[i];
    w += (isMortgaged(state, i) ? t.price - mortgageValue(t) : t.price) + ((state.levels && state.levels[i]) || 0) * upgradeCost(t);
  }
  return w;
}

/** Comeback tier: 0 = none, else the boost multiplier for the player's current standing. */
function comebackBoost(state, playerId) {
  const active = (state.players || []).filter((p) => !p.bankrupt);
  if (active.length < 2) return 0;
  const avg = active.reduce((s, p) => s + worthOf(state, p.id), 0) / active.length;
  if (!(avg > 0)) return 0;
  const w = worthOf(state, playerId);
  const R = DICE_RULES.comeback;
  if (w < R.strongBelow * avg) return R.strongBoost;
  if (w < R.below * avg) return R.boost;
  return 0;
}

/** Rent the injected engine says `tile` would ask for a roll of `sum` (0 when ctx/previewRent is missing). */
function rentAt(state, ctx, tile, sum) {
  if (!ctx || typeof ctx.previewRent !== 'function') return 0;
  const r = Number(ctx.previewRent(state, tile, sum));
  return Number.isFinite(r) && r > 0 ? r : 0;
}

/** Classify the destination of a face: 'good' (unowned buyable / START / own tile), 'opp' (opponent tile, mortgage-free) or 'other'. */
function classify(state, playerId, dest) {
  if (dest === START_TILE) return 'good';
  const tile = TILES[dest];
  if (!isBuyable(tile)) return 'other';
  const owner = state.owners[dest] ?? null;
  if (owner === null) return 'good';
  if (owner === playerId) return 'good';
  const op = playerOf(state, owner);
  if (op && !op.bankrupt && !isMortgaged(state, dest)) return 'opp';
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// Rule multipliers
// ---------------------------------------------------------------------------------------------

/**
 * Per-rule multiplier arrays (6 each, 1 = unchanged) or null when the rule's condition does not hold.
 * Jailed players only get pity (a jailed player moves only on a six, so landing-based rules are moot).
 */
function ruleMultipliers(state, playerId, ctx) {
  const rules = { comeback: null, mercy: null, pity: null, antibust: null };
  const p = playerOf(state, playerId);
  if (!p) return rules;
  const jailed = (p.jailTurns || 0) > 0;

  // (3) pity six: after 6 non-six rolls in a row a six x1.5.
  if ((p.rollsSinceSix || 0) >= DICE_RULES.pity.rolls) {
    rules.pity = FACES.map((values) => (isSix(values) ? DICE_RULES.pity.mult : 1));
  }
  if (jailed) return rules;

  // (4) anti-streak: after two sixes in the same turn a six x0.5 (floored to 0.6 by the clamp).
  if ((p.sixes || 0) >= DICE_RULES.antibust.sixes) {
    rules.antibust = FACES.map((values) => (isSix(values) ? DICE_RULES.antibust.mult : 1));
  }

  const boost = comebackBoost(state, playerId);
  const mercyOn = (p.rentStreak || 0) >= DICE_RULES.mercy.streak;
  if (!boost && !mercyOn) return rules;

  const comeback = boost ? ONES() : null;
  const mercy = mercyOn ? ONES() : null;
  const pos = p.pos || 0;
  for (let i = 0; i < FACES.length; i++) {
    const sum = FACES[i][0];
    const dest = (pos + sum) % BOARD_SIZE;
    const kind = classify(state, playerId, dest);
    if (kind === 'good') {
      if (comeback) comeback[i] = boost;
    } else if (kind === 'opp') {
      const rent = rentAt(state, ctx, dest, sum);
      if (comeback && rent > 0 && rent >= DICE_RULES.comeback.rentShare * (p.cash || 0)) comeback[i] = DICE_RULES.comeback.penalty;
      if (mercy && rent >= DICE_RULES.mercy.minRent) mercy[i] = DICE_RULES.mercy.mult;
    }
  }
  rules.comeback = comeback;
  rules.mercy = mercy;
  return rules;
}

const clampAll = (arr) => arr.map((m) => clamp(m, DICE_RULES.clamp[0], DICE_RULES.clamp[1]));

function normalise(mults) {
  let sum = 0;
  for (const m of mults) sum += m;
  return mults.map((m) => m / sum);
}

/** Total-variation distance (0..1) between a 6-weight distribution and the fair one. */
function shiftFromFair(weights) {
  let s = 0;
  for (const w of weights) s += Math.abs(w - 1 / weights.length);
  return s / 2;
}

/**
 * Multipliers before normalising: `{ raw, clamped, rules }`. `raw` = product of every active rule per face,
 * `clamped` = `raw` clamped to [0.6, 1.5] (what `diceWeights` normalises), `rules` = per-rule arrays or null.
 * In `fair` mode everything is 1.
 */
export function rawMultipliers(state, playerId, ctx) {
  const rules = { comeback: null, mercy: null, pity: null, antibust: null };
  if (state?.cfg?.dice === 'fair') return { raw: ONES(), clamped: ONES(), rules };
  Object.assign(rules, ruleMultipliers(state, playerId, ctx));
  const raw = ONES();
  for (const name of ASSIST_NAMES) {
    if (!rules[name]) continue;
    for (let i = 0; i < raw.length; i++) raw[i] *= rules[name][i];
  }
  return { raw, clamped: clampAll(raw), rules };
}

/**
 * `{ weights:number[6], assist, active, shift }`. Weights sum to 1 (index = face - 1). `assist` = the most influential
 * rule ('comeback' | 'mercy' | 'pity' | 'antibust') or null when the distribution is < 0.5 pp (total variation) from fair.
 * `active` = every rule that actually moved the distribution (most influential first; the engine resets
 * `rentStreak` after a roll in which 'mercy' was active). `shift` = total-variation distance from fair.
 */
export function diceWeights(state, playerId, ctx) {
  if (state?.cfg?.dice === 'fair') {
    return { weights: new Array(FACES.length).fill(1 / FACES.length), assist: null, active: [], shift: 0 };
  }
  const { clamped, rules } = rawMultipliers(state, playerId, ctx);
  const weights = normalise(clamped);
  const shift = shiftFromFair(weights);

  // Influence of a rule = how far the distribution would sit from fair if ONLY that rule applied.
  const scored = [];
  for (const name of ASSIST_NAMES) {
    if (!rules[name]) continue;
    const influence = shiftFromFair(normalise(clampAll(rules[name])));
    if (influence > 1e-9) scored.push({ name, influence });
  }
  scored.sort((x, y) => y.influence - x.influence); // stable: ties keep ASSIST_NAMES order
  const assist = shift < DICE_RULES.minShift || !scored.length ? null : scored[0].name;
  return { weights, assist, active: scored.map((s) => s.name), shift };
}

/**
 * Pick a face index (0..5) from `weights` with one uniform `u` in [0, 1). Pure; zero-weight faces are never returned.
 */
export function sampleCombo(weights, u) {
  let total = 0;
  for (const w of weights) total += w;
  const target = clamp(u, 0, 1) * total;
  let acc = 0;
  let last = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    last = i;
    acc += weights[i];
    if (target < acc) return i;
  }
  return last; // floating-point slack at the very top end
}

/**
 * Roll the die for `playerId`: ONE `nextFloat(state)` draw (mutates `state.rng` in place) sampled against
 * `diceWeights`. Returns `{ values:[d], assist, active }`.
 */
export function rollDice(state, playerId, ctx) {
  const { weights, assist, active } = diceWeights(state, playerId, ctx);
  const idx = sampleCombo(weights, nextFloat(state));
  return { values: [...FACES[idx]], assist, active };
}

/**
 * `{ totals:{1..6:p}, six:p, assist }` for the player's next roll (same weights as `rollDice`).
 */
export function diceOdds(state, playerId, ctx) {
  const { weights, assist } = diceWeights(state, playerId, ctx);
  const totals = {};
  for (let i = 0; i < FACES.length; i++) totals[FACES[i][0]] = weights[i];
  return { totals, six: weights[FACES.length - 1], assist };
}

/**
 * `number[BOARD_SIZE]`: probability that the player's next roll ENDS on each tile (same weights as `rollDice`).
 * Jailed player: moves only on a six, so P(stay) = 1 - P(six) stays on their tile (JAIL_TILE) and a six lands 6 ahead.
 * A roll that lands on the Go-to-Jail square is reported on that square (the engine then jails the player).
 */
export function landingOdds(state, playerId, ctx) {
  const out = new Array(BOARD_SIZE).fill(0);
  const p = playerOf(state, playerId);
  if (!p) return out;
  const { weights } = diceWeights(state, playerId, ctx);
  const pos = p.pos || 0;
  const jailed = (p.jailTurns || 0) > 0;
  for (let i = 0; i < FACES.length; i++) {
    const sum = FACES[i][0];
    const dest = jailed && !isSix(FACES[i]) ? pos : (pos + sum) % BOARD_SIZE;
    out[dest] += weights[i];
  }
  return out;
}
