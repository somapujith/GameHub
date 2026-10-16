// Dice engine (CONTRACT section 3c). Pure, deterministic, no I/O. Runs in the browser AND the Worker.
//
// `lucky` (default) applies a small, disclosed, bounded bias to the six single-die outcomes.
// `fair` gives each face 1/6. Saved two-die games keep their 36 outcomes. The engine injects
// `ctx = { previewRent(state, tileId, diceSum) }` so this module never imports engine.js.
//
// Player fields read (the engine maintains them):
//   cash, pos, jailTurns, bankrupt      existing fields
//   doubles          doubles thrown so far in the CURRENT turn (0 after a non-double, reset each turn)
//   rollsSinceDouble consecutive non-double rolls (reset to 0 by a double, +1 by a non-double)
//   rentStreak       consecutive turns in which the player paid rent >= DICE_RULES.mercy.minRent
// State fields read: cfg.dice, cfg.diceCount, owners[28], levels[28], mortgaged[28] (optional), players[], rng (written by rollDice only).

import { BOARD_SIZE, JAIL_TILE, START_TILE, TILES, isBuyable, mortgageValue, upgradeCost } from './board.js';
import { nextFloat } from './rng.js';

export const DICE_MODES = ['lucky', 'fair'];

/** The 36 dice combos as [a, b] pairs, index = (a - 1) * 6 + (b - 1). */
export const COMBOS = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1]);

// Missing diceCount belongs to a saved game from before single-die play.
const SINGLE_COMBOS = [[1], [2], [3], [4], [5], [6]];
const outcomes = (state) => state?.cfg?.diceCount === 1 ? SINGLE_COMBOS : COMBOS;
const totalOf = (values) => values.reduce((sum, value) => sum + value, 0);
const bonusOf = (values) => values.length === 1 ? values[0] === 6 : values[0] === values[1];

/** Fair probability of each dice total 2..12 (1/36 .. 6/36 .. 1/36). */
export const FAIR_TOTAL_PROBS = Object.fromEntries(
  Array.from({ length: 11 }, (_, k) => [k + 2, (6 - Math.abs(k + 2 - 7)) / 36]),
);

/** Names a rule can have in `assist` / `active`. */
export const ASSIST_NAMES = ['comeback', 'mercy', 'pity', 'antibust'];

/** The disclosed tuning of the lucky dice (so the UI/rules sheet can quote the same numbers). */
export const DICE_RULES = {
  // (1) comeback: below `below` x average worth -> x`boost` on helpful landings (x`strongBoost` below `strongBelow`),
  //     and x`penalty` on landings whose rent is >= `rentShare` of the player's cash.
  comeback: { below: 0.8, strongBelow: 0.5, boost: 1.15, strongBoost: 1.25, rentShare: 0.25, penalty: 0.85 },
  // (2) mercy: after `streak` rent-paying turns (rent >= minRent), landings on an opponent tile asking >= minRent get x`mult`.
  mercy: { streak: 2, minRent: 1000, mult: 0.7 },
  // (3) pity doubles: after `rolls` non-double rolls in a row, doubles get x`mult`.
  pity: { rolls: 6, mult: 1.5 },
  // (4) anti-bust: after `doubles` doubles in the same turn, doubles get x`mult` (the clamp floors it at `clamp[0]`).
  antibust: { doubles: 2, mult: 0.5 },
  // every combo's combined multiplier is clamped to this range BEFORE normalising.
  clamp: [0.6, 1.5],
  // if the final distribution is within this total-variation distance of fair, `assist` is reported as null.
  minShift: 0.005,
};

const ONES = (state) => new Array(outcomes(state).length).fill(1);
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

/** Classify the destination of a combo: 'good' (unowned buyable / START / own tile), 'opp' (opponent tile, mortgage-free) or 'other'. */
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
 * Per-rule multiplier arrays (36 each, 1 = unchanged) or null when the rule's condition does not hold.
 * Jailed players only get pity (a jailed player moves only on doubles, so landing-based rules are moot,
 * and the three-doubles rule cannot apply).
 */
function ruleMultipliers(state, playerId, ctx) {
  const combos = outcomes(state);
  const rules = { comeback: null, mercy: null, pity: null, antibust: null };
  const p = playerOf(state, playerId);
  if (!p) return rules;
  const jailed = (p.jailTurns || 0) > 0;

  // (3) pity doubles: after 6 non-double rolls in a row doubles x1.5.
  if ((p.rollsSinceDouble || 0) >= DICE_RULES.pity.rolls) {
    rules.pity = combos.map((values) => (bonusOf(values) ? DICE_RULES.pity.mult : 1));
  }
  if (jailed) return rules;

  // (4) anti-bust: after two doubles in the same turn doubles x0.5 (floored to 0.6 by the clamp).
  if ((p.doubles || 0) >= DICE_RULES.antibust.doubles) {
    rules.antibust = combos.map((values) => (bonusOf(values) ? DICE_RULES.antibust.mult : 1));
  }

  const boost = comebackBoost(state, playerId);
  const mercyOn = (p.rentStreak || 0) >= DICE_RULES.mercy.streak;
  if (!boost && !mercyOn) return rules;

  const comeback = boost ? ONES(state) : null;
  const mercy = mercyOn ? ONES(state) : null;
  const pos = p.pos || 0;
  for (let i = 0; i < combos.length; i++) {
    const sum = totalOf(combos[i]);
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

/** Total-variation distance (0..1) between a 36-weight distribution and the fair one. */
function shiftFromFair(weights) {
  let s = 0;
  for (const w of weights) s += Math.abs(w - 1 / weights.length);
  return s / 2;
}

/**
 * Multipliers before normalising: `{ raw, clamped, rules }`. `raw` = product of every active rule per combo,
 * `clamped` = `raw` clamped to [0.6, 1.5] (what `diceWeights` normalises), `rules` = per-rule arrays or null.
 * In `fair` mode everything is 1.
 */
export function rawMultipliers(state, playerId, ctx) {
  const rules = { comeback: null, mercy: null, pity: null, antibust: null };
  if (state?.cfg?.dice === 'fair') return { raw: ONES(state), clamped: ONES(state), rules };
  Object.assign(rules, ruleMultipliers(state, playerId, ctx));
  const raw = ONES(state);
  for (const name of ASSIST_NAMES) {
    if (!rules[name]) continue;
    for (let i = 0; i < raw.length; i++) raw[i] *= rules[name][i];
  }
  return { raw, clamped: clampAll(raw), rules };
}

/**
 * `{ weights:number[36], assist, active, shift }`. Weights sum to 1. `assist` = the most influential rule
 * ('comeback' | 'mercy' | 'pity' | 'antibust') or null when the distribution is < 0.5 pp (total variation) from fair.
 * `active` = every rule that actually moved the distribution (most influential first; the engine resets
 * `rentStreak` after a roll in which 'mercy' was active). `shift` = total-variation distance from fair.
 */
export function diceWeights(state, playerId, ctx) {
  if (state?.cfg?.dice === 'fair') {
    const count = outcomes(state).length;
    return { weights: new Array(count).fill(1 / count), assist: null, active: [], shift: 0 };
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
 * Pick a combo index (0..35) from `weights` with one uniform `u` in [0, 1). Pure; zero-weight combos are never returned.
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
 * Roll the dice for `playerId`: ONE `nextFloat(state)` draw (mutates `state.rng` in place) sampled against
 * `diceWeights`. Returns `{ values:[a,b], assist, active }`.
 */
export function rollDice(state, playerId, ctx) {
  const { weights, assist, active } = diceWeights(state, playerId, ctx);
  const idx = sampleCombo(weights, nextFloat(state));
  return { values: [...outcomes(state)[idx]], assist, active };
}

/**
 * `{ totals:{2..12:p}, doubles:p, assist }` for the player's next roll (same weights as `rollDice`).
 */
export function diceOdds(state, playerId, ctx) {
  const { weights, assist } = diceWeights(state, playerId, ctx);
  const combos = outcomes(state);
  const totals = {};
  for (const values of combos) totals[totalOf(values)] = 0;
  let doubles = 0;
  let bonus = 0;
  for (let i = 0; i < combos.length; i++) {
    const values = combos[i];
    totals[totalOf(values)] += weights[i];
    if (bonusOf(values)) bonus += weights[i];
    if (values.length === 2 && bonusOf(values)) doubles += weights[i];
  }
  return state?.cfg?.diceCount === 1 ? { totals, doubles, bonus, assist } : { totals, doubles, assist };
}

/**
 * `number[28]`: probability that the player's next roll ENDS on each tile (same weights as `rollDice`).
 * Jailed player: moves only on doubles, so P(stay) = 1 - P(doubles) stays on their tile (14) and the rest is
 * spread by the doubles totals. A third double in a turn (doubles already 2) sends the player to jail (tile 14).
 */
export function landingOdds(state, playerId, ctx) {
  const out = new Array(BOARD_SIZE).fill(0);
  const p = playerOf(state, playerId);
  if (!p) return out;
  const { weights } = diceWeights(state, playerId, ctx);
  const combos = outcomes(state);
  const pos = p.pos || 0;
  const jailed = (p.jailTurns || 0) > 0;
  const thirdDouble = !jailed && (p.doubles || 0) >= 2;
  for (let i = 0; i < combos.length; i++) {
    const sum = totalOf(combos[i]);
    const isDouble = bonusOf(combos[i]);
    let dest;
    if (jailed) dest = isDouble ? (pos + sum) % BOARD_SIZE : pos;
    else if (thirdDouble && isDouble) dest = JAIL_TILE;
    else dest = (pos + sum) % BOARD_SIZE;
    out[dest] += weights[i];
  }
  return out;
}
