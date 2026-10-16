import { describe, it, expect } from 'vitest';
import {
  COMBOS, FAIR_TOTAL_PROBS, DICE_MODES, DICE_RULES, ASSIST_NAMES,
  rawMultipliers, diceWeights, sampleCombo, rollDice, diceOdds, landingOdds,
} from './dice.js';
import {
  BOARD_SIZE, JAIL_TILE, TILES, isBuyable, rentFor, upgradeCost, mortgageValue, TRANSPORT_RENT, UTILITY_MULT,
} from './board.js';
import { nextFloat, mulberry32 } from './rng.js';

// ---------------------------------------------------------------- fixtures
const IDS = ['p0', 'p1', 'p2', 'p3'];
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const idx = (a, b) => (a - 1) * 6 + (b - 1);

/** Hand-made minimal state: n players on an empty board, equal cash, no streaks. */
function mkState({ n = 3, dice = 'lucky', rng = 12345, cash = 15000 } = {}) {
  return {
    cfg: { dice },
    rng,
    players: Array.from({ length: n }, (_, i) => ({
      id: IDS[i], name: `P${i}`, cash, pos: 0, jailTurns: 0, doubles: 0, bankrupt: false, rollsSinceDouble: 0, rentStreak: 0,
    })),
    owners: new Array(BOARD_SIZE).fill(null),
    levels: new Array(BOARD_SIZE).fill(0),
    mortgaged: new Array(BOARD_SIZE).fill(false),
  };
}
const P = (s, id) => s.players.find((p) => p.id === id);
const clone = (s) => structuredClone(s);
const give = (s, owner, tiles, level = 0) => {
  for (const t of tiles) {
    s.owners[t] = owner;
    s.levels[t] = level;
  }
};
const assets = (s, id) => {
  let w = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (s.owners[i] !== id) continue;
    w += (s.mortgaged[i] ? TILES[i].price - mortgageValue(TILES[i]) : TILES[i].price) + s.levels[i] * upgradeCost(TILES[i]);
  }
  return w;
};
/** Set every player's cash so that all net worths equal `target` (neutral for the comeback rule). */
const equalise = (s, target = 30000) => {
  for (const p of s.players) p.cash = target - assets(s, p.id);
  return s;
};

/** Same maths as the engine's previewRent (without the set bonus), so rents in fixtures are realistic. */
function stubRent(s, tileId, diceSum = 7) {
  const t = TILES[tileId];
  const owner = s.owners[tileId];
  if (!owner || !isBuyable(t)) return 0;
  if (t.type === 'property') return rentFor(t, s.levels[tileId]);
  let n = 0;
  for (let i = 0; i < BOARD_SIZE; i++) if (s.owners[i] === owner && TILES[i].type === t.type) n++;
  if (t.type === 'transport') return TRANSPORT_RENT[Math.min(n, 3)];
  return diceSum * UTILITY_MULT[Math.min(n, 2)];
}
const ctx = { previewRent: stubRent };

const fairOf = (s) => ({ ...clone(s), cfg: { ...s.cfg, dice: 'fair' } });
const odds = (s, id = 'p0') => landingOdds(s, id, ctx);
const probOn = (s, tiles, id = 'p0') => {
  const o = odds(s, id);
  return sum(tiles.map((t) => o[t]));
};
const tv = (w) => sum(w.map((x) => Math.abs(x - 1 / 36))) / 2;
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

/** A 3-player state where p0 (pos 10) trails badly and tiles 15,17,19,20 (reachable, unowned) are the "good" landings. */
function trailing() {
  const s = mkState({ n: 3 });
  P(s, 'p0').pos = 10;
  P(s, 'p0').cash = 2000;
  give(s, 'p1', [12, 13]);
  give(s, 'p2', [22, 23, 25, 26, 27]);
  return s;
}
const GOOD_FROM_10 = [15, 17, 19, 20]; // unowned buyable tiles within 2..12 of tile 10 in trailing()

/** A random-but-legal state for the sweep tests. */
function randomState(rnd) {
  const n = 2 + Math.floor(rnd() * 3);
  const s = mkState({ n, dice: 'lucky' });
  for (const p of s.players) {
    p.cash = Math.floor(rnd() * 30000);
    p.pos = Math.floor(rnd() * BOARD_SIZE);
    p.jailTurns = rnd() < 0.15 ? 1 : 0;
    if (p.jailTurns) p.pos = JAIL_TILE;
    p.doubles = Math.floor(rnd() * 3);
    p.rollsSinceDouble = Math.floor(rnd() * 10);
    p.rentStreak = Math.floor(rnd() * 4);
    p.bankrupt = rnd() < 0.05;
  }
  for (let t = 0; t < BOARD_SIZE; t++) {
    if (!isBuyable(TILES[t]) || rnd() < 0.4) continue;
    s.owners[t] = IDS[Math.floor(rnd() * n)];
    s.levels[t] = TILES[t].type === 'property' ? Math.floor(rnd() * 6) : 0;
    s.mortgaged[t] = s.levels[t] === 0 && rnd() < 0.2;
  }
  return s;
}

// ---------------------------------------------------------------- constants
describe('constants', () => {
  it('COMBOS has the 36 [a,b] pairs indexed (a-1)*6+(b-1)', () => {
    expect(COMBOS).toHaveLength(36);
    expect(new Set(COMBOS.map((c) => c.join(','))).size).toBe(36);
    COMBOS.forEach(([a, b], i) => expect(i).toBe(idx(a, b)));
  });
  it('FAIR_TOTAL_PROBS runs 1/36 .. 6/36 .. 1/36 and sums to 1', () => {
    expect(Object.keys(FAIR_TOTAL_PROBS)).toHaveLength(11);
    expect(FAIR_TOTAL_PROBS[2]).toBeCloseTo(1 / 36, 12);
    expect(FAIR_TOTAL_PROBS[7]).toBeCloseTo(6 / 36, 12);
    expect(FAIR_TOTAL_PROBS[12]).toBeCloseTo(1 / 36, 12);
    expect(sum(Object.values(FAIR_TOTAL_PROBS))).toBeCloseTo(1, 12);
  });
  it('DICE_MODES', () => {
    expect(DICE_MODES).toEqual(['lucky', 'fair']);
    expect(ASSIST_NAMES).toEqual(['comeback', 'mercy', 'pity', 'antibust']);
  });
});

// ---------------------------------------------------------------- weights
describe('diceWeights', () => {
  it('sums to 1 in both modes and for random lucky states', () => {
    expect(sum(diceWeights(mkState({ dice: 'fair' }), 'p0', ctx).weights)).toBeCloseTo(1, 12);
    expect(sum(diceWeights(trailing(), 'p0', ctx).weights)).toBeCloseTo(1, 12);
    const rnd = mulberry32(99);
    for (let k = 0; k < 300; k++) {
      const s = randomState(rnd);
      for (const p of s.players) {
        const { weights } = diceWeights(s, p.id, ctx);
        expect(weights).toHaveLength(36);
        expect(sum(weights)).toBeCloseTo(1, 12);
        expect(Math.min(...weights)).toBeGreaterThan(0);
      }
    }
  });

  it('fair mode is uniform 1/36 with no assist, whatever the situation', () => {
    const s = trailing();
    s.cfg.dice = 'fair';
    P(s, 'p0').rollsSinceDouble = 8;
    P(s, 'p0').rentStreak = 3;
    const r = diceWeights(s, 'p0', ctx);
    expect(r.weights.every((w) => w === 1 / 36)).toBe(true);
    expect(r.assist).toBeNull();
    expect(r.active).toEqual([]);
  });

  it('fair totals are 1/36..6/36 and doubles 1/6 (diceOdds)', () => {
    const o = diceOdds(mkState({ dice: 'fair' }), 'p0', ctx);
    for (let t = 2; t <= 12; t++) expect(o.totals[t]).toBeCloseTo(FAIR_TOTAL_PROBS[t], 12);
    expect(o.doubles).toBeCloseTo(1 / 6, 12);
    expect(o.assist).toBeNull();
  });

  it('a neutral lucky player (equal worth, no streaks) is identical to fair', () => {
    const s = mkState({ n: 4 });
    give(s, 'p1', [1, 2]);
    give(s, 'p2', [27]);
    give(s, 'p3', [12, 13], 2);
    equalise(s);
    P(s, 'p0').pos = 5;
    for (const p of s.players) {
      const r = diceWeights(s, p.id, ctx);
      expect(r.weights).toEqual(new Array(36).fill(1 / 36));
      expect(r.assist).toBeNull();
    }
  });

  it('works without ctx (rent rules then do nothing) and with a missing mortgaged array', () => {
    const s = trailing();
    delete s.mortgaged;
    P(s, 'p0').rentStreak = 2;
    const r = diceWeights(s, 'p0');
    expect(sum(r.weights)).toBeCloseTo(1, 12);
    expect(r.assist).toBe('comeback');
    expect(diceWeights(s, 'p0', {}).weights).toEqual(r.weights);
  });
});

describe('rawMultipliers clamp', () => {
  it('clamped multipliers are always within [0.6, 1.5] and final weights stay sane (random sweep)', () => {
    const rnd = mulberry32(2024);
    let maxRatio = 0;
    let minRatio = Infinity;
    for (let k = 0; k < 500; k++) {
      const s = randomState(rnd);
      for (const p of s.players) {
        const { raw, clamped } = rawMultipliers(s, p.id, ctx);
        expect(clamped).toHaveLength(36);
        clamped.forEach((m, i) => {
          expect(m).toBeGreaterThanOrEqual(0.6);
          expect(m).toBeLessThanOrEqual(1.5);
          expect(m).toBeCloseTo(Math.min(1.5, Math.max(0.6, raw[i])), 12);
        });
        for (const w of diceWeights(s, p.id, ctx).weights) {
          maxRatio = Math.max(maxRatio, w * 36);
          minRatio = Math.min(minRatio, w * 36);
        }
      }
    }
    // mathematically 0.6/1.5 .. 1.5/0.6 after normalising; in practice far tighter
    expect(minRatio).toBeGreaterThanOrEqual(0.4);
    expect(maxRatio).toBeLessThanOrEqual(2.5);
  });

  it('the clamp actually bites: anti-bust x0.5 -> 0.6 and comeback x1.25 stacked with pity x1.5 -> 1.5', () => {
    const a = mkState();
    P(a, 'p0').doubles = 2;
    const ra = rawMultipliers(a, 'p0', ctx);
    expect(ra.raw[idx(3, 3)]).toBeCloseTo(0.5, 12);
    expect(ra.clamped[idx(3, 3)]).toBeCloseTo(0.6, 12);
    expect(ra.clamped[idx(3, 4)]).toBe(1);

    const b = trailing();
    P(b, 'p0').rollsSinceDouble = 6;
    const rb = rawMultipliers(b, 'p0', ctx);
    // (5,5) from tile 10 lands on tile 20 (unowned utility): 1.25 * 1.5 = 1.875 raw
    expect(rb.raw[idx(5, 5)]).toBeCloseTo(1.875, 12);
    expect(rb.clamped[idx(5, 5)]).toBe(1.5);
  });

  it('fair mode multipliers are all 1', () => {
    const r = rawMultipliers(mkState({ dice: 'fair' }), 'p0', ctx);
    expect(r.raw.every((m) => m === 1)).toBe(true);
    expect(r.clamped.every((m) => m === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------- the four rules
describe('rule 1: comeback assist', () => {
  it('raises the chance of landing on unowned tiles for a trailing player, not for a leader', () => {
    const s = trailing();
    const fairP = probOn(fairOf(s), GOOD_FROM_10);
    const trail = probOn(s, GOOD_FROM_10);
    expect(trail).toBeGreaterThan(fairP);
    expect(diceWeights(s, 'p0', ctx).assist).toBe('comeback');

    // leader p2 standing on the same tile: nothing changes
    P(s, 'p2').pos = 10;
    P(s, 'p2').cash = 30000;
    expect(probOn(s, GOOD_FROM_10, 'p2')).toBeCloseTo(fairP, 12);
    expect(diceWeights(s, 'p2', ctx).assist).toBeNull();
  });

  it('the strong tier (< 0.5x average) helps more than the mild tier (< 0.8x)', () => {
    const strong = trailing(); // p0 cash 2000 -> far below half the average
    const mild = trailing();
    P(mild, 'p0').cash = 15948; // worth ~0.7x of the average of the three players
    const avg = sum(mild.players.map((p) => p.cash + assets(mild, p.id))) / 3;
    const ratio = P(mild, 'p0').cash / avg;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(0.8);
    expect(rawMultipliers(mild, 'p0', ctx).raw[idx(5, 5)]).toBeCloseTo(DICE_RULES.comeback.boost, 12); // tile 20, unowned
    expect(rawMultipliers(strong, 'p0', ctx).raw[idx(5, 5)]).toBeCloseTo(DICE_RULES.comeback.strongBoost, 12);
    const fairP = probOn(fairOf(strong), GOOD_FROM_10);
    expect(probOn(mild, GOOD_FROM_10)).toBeGreaterThan(fairP);
    expect(probOn(strong, GOOD_FROM_10)).toBeGreaterThan(probOn(mild, GOOD_FROM_10));
    // just above 0.8x: no assist at all
    P(mild, 'p0').cash = 30000;
    expect(diceWeights(mild, 'p0', ctx).assist).toBeNull();
  });

  it('boosts START and own tiles (mortgaged ones too)', () => {
    const s = mkState({ n: 2 });
    P(s, 'p0').pos = 22; // START is 6 away; tile 25 (own, mortgaged) is 3 away
    give(s, 'p1', [1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 13, 15, 17, 19, 20, 22, 23, 24, 26, 27]);
    give(s, 'p0', [25]);
    s.mortgaged[25] = true;
    P(s, 'p1').cash = 60000; // p0 clearly trails
    const o = odds(s);
    const f = odds(fairOf(s));
    expect(o[0]).toBeGreaterThan(f[0]); // START
    expect(o[25]).toBeGreaterThan(f[25]); // own mortgaged tile
    expect(o[24]).toBeLessThan(f[24] * 1.0000001); // opponent tile is not boosted
  });

  it('lowers the chance of landing on a tile whose rent is >= 25% of the trailing player cash', () => {
    const s = mkState({ n: 3 });
    P(s, 'p0').pos = 20;
    P(s, 'p0').cash = 2000;
    give(s, 'p1', [27], 3); // rent 3500 >= 500
    const f = probOn(fairOf(s), [27]);
    expect(f).toBeCloseTo(6 / 36, 12);
    expect(probOn(s, [27])).toBeLessThan(f);
    expect(rawMultipliers(s, 'p0', ctx).raw[idx(3, 4)]).toBeCloseTo(DICE_RULES.comeback.penalty, 12);
    // but a cheap tile (rent < 25% of cash) is not penalised
    const cheap = mkState({ n: 3 });
    P(cheap, 'p0').pos = 20;
    P(cheap, 'p0').cash = 2000;
    give(cheap, 'p1', [27], 0); // rent 400 < 500
    expect(rawMultipliers(cheap, 'p0', ctx).raw[idx(3, 4)]).toBe(1);
  });

  it('is off for a solo survivor and ignores bankrupt players in the average', () => {
    const s = trailing();
    P(s, 'p1').bankrupt = true;
    P(s, 'p2').bankrupt = true;
    expect(diceWeights(s, 'p0', ctx).assist).toBeNull();
    const t = trailing();
    P(t, 'p1').bankrupt = true;
    P(t, 'p1').cash = 0;
    expect(diceWeights(t, 'p0', ctx).assist).toBe('comeback');
  });
});

describe('rule 2: mercy', () => {
  const mercyState = (streak) => {
    const s = mkState({ n: 3 });
    P(s, 'p0').pos = 20;
    give(s, 'p1', [27], 3); // rent 3500
    equalise(s); // neutral for the comeback rule
    P(s, 'p0').rentStreak = streak;
    return s;
  };

  it('lowers high-rent landings on an opponent tile after two rent-paying turns', () => {
    const f = 6 / 36;
    const s = mercyState(2);
    const p = probOn(s, [27]);
    expect(p).toBeLessThan(f);
    // exact: weight of each of the six 7-combos = 0.7 / (36 - 6 * 0.3)
    expect(p).toBeCloseTo((6 * 0.7) / (36 - 6 * 0.3), 12);
    expect(diceWeights(s, 'p0', ctx).assist).toBe('mercy');
    expect(diceWeights(s, 'p0', ctx).active).toEqual(['mercy']);
  });

  it('needs a streak of 2, rent >= 1000, and an unmortgaged opponent tile', () => {
    expect(probOn(mercyState(1), [27])).toBeCloseTo(6 / 36, 12);
    expect(diceWeights(mercyState(1), 'p0', ctx).assist).toBeNull();

    const cheap = mercyState(2);
    cheap.levels[27] = 0; // rent 400
    expect(probOn(cheap, [27])).toBeCloseTo(6 / 36, 12);

    const mort = mercyState(2);
    mort.levels[27] = 0;
    mort.mortgaged[27] = true; // collects no rent
    equalise(mort);
    expect(probOn(mort, [27])).toBeCloseTo(6 / 36, 12);

    const own = mercyState(2);
    own.owners[27] = 'p0'; // own tile: no mercy
    equalise(own);
    expect(probOn(own, [27])).toBeCloseTo(6 / 36, 12);
  });
});

describe('rules 3 and 4: pity doubles and anti-bust', () => {
  const neutral = () => mkState({ n: 3 });

  it('pity: after 6 non-double rolls doubles are likelier than 1/6', () => {
    const s = neutral();
    P(s, 'p0').rollsSinceDouble = 5;
    expect(diceOdds(s, 'p0', ctx).doubles).toBeCloseTo(1 / 6, 12);
    expect(diceWeights(s, 'p0', ctx).assist).toBeNull();
    P(s, 'p0').rollsSinceDouble = 6;
    const o = diceOdds(s, 'p0', ctx);
    expect(o.doubles).toBeGreaterThan(1 / 6);
    expect(o.doubles).toBeCloseTo(9 / 39, 12); // 6*1.5 / (6*1.5 + 30)
    expect(o.assist).toBe('pity');
  });

  it('anti-bust: after two doubles in a turn doubles are rarer than 1/6', () => {
    const s = neutral();
    P(s, 'p0').doubles = 1;
    expect(diceOdds(s, 'p0', ctx).doubles).toBeCloseTo(1 / 6, 12);
    P(s, 'p0').doubles = 2;
    const o = diceOdds(s, 'p0', ctx);
    expect(o.doubles).toBeLessThan(1 / 6);
    expect(o.doubles).toBeCloseTo(3.6 / 33.6, 12); // x0.5 clamped to 0.6
    expect(o.assist).toBe('antibust');
  });

  it('assist reports the most influential of several active rules', () => {
    const s = mercyStateWithPity();
    const r = diceWeights(s, 'p0', ctx);
    expect(r.active).toEqual(expect.arrayContaining(['mercy', 'pity']));
    expect(ASSIST_NAMES).toContain(r.assist);
    expect(r.active[0]).toBe(r.assist);
  });

  function mercyStateWithPity() {
    const s = mkState({ n: 3 });
    P(s, 'p0').pos = 20;
    give(s, 'p1', [27], 3);
    equalise(s);
    P(s, 'p0').rentStreak = 2;
    P(s, 'p0').rollsSinceDouble = 7;
    return s;
  }
});

describe('assist reporting', () => {
  it('is null when no combo is affected (distribution equals fair)', () => {
    // trailing player, but every buyable tile within reach is an opponent tile with trivial rent
    const s = mkState({ n: 2 });
    give(s, 'p1', [1, 2, 3, 4, 6, 8, 9, 10, 11, 12]);
    expect(diceWeights(clone(s), 'p0', ctx).active).toEqual([]);
    const r = diceWeights(s, 'p0', ctx);
    expect(r.weights).toEqual(new Array(36).fill(1 / 36));
    expect(r.assist).toBeNull();
    expect(r.shift).toBe(0);
  });

  it('shift is the total-variation distance and drives the 0.5 pp threshold', () => {
    const r = diceWeights(trailing(), 'p0', ctx);
    expect(r.shift).toBeCloseTo(tv(r.weights), 12);
    expect(r.shift).toBeGreaterThanOrEqual(DICE_RULES.minShift);
    expect(r.assist).not.toBeNull();
  });
});

describe('jailed players', () => {
  const jailed = () => {
    const s = trailing();
    const p = P(s, 'p0');
    p.pos = JAIL_TILE;
    p.jailTurns = 1;
    p.rentStreak = 2;
    return s;
  };

  it('ignore comeback and mercy (weights are fair, assist null)', () => {
    const r = diceWeights(jailed(), 'p0', ctx);
    expect(r.weights).toEqual(new Array(36).fill(1 / 36));
    expect(r.assist).toBeNull();
  });

  it('still get pity doubles', () => {
    const s = jailed();
    P(s, 'p0').rollsSinceDouble = 6;
    const r = diceWeights(s, 'p0', ctx);
    expect(r.assist).toBe('pity');
    expect(diceOdds(s, 'p0', ctx).doubles).toBeCloseTo(9 / 39, 12);
  });

  it('landingOdds: stays on tile 14 with 1 - P(doubles), moves only by doubles totals', () => {
    const s = jailed();
    P(s, 'p0').rollsSinceDouble = 6;
    const o = odds(s);
    const d = diceOdds(s, 'p0', ctx).doubles;
    expect(sum(o)).toBeCloseTo(1, 12);
    const w = diceWeights(s, 'p0', ctx).weights;
    const doublesTo = (t) => sum([1, 2, 3, 4, 5, 6].filter((a) => (JAIL_TILE + 2 * a) % BOARD_SIZE === t).map((a) => w[idx(a, a)]));
    expect(o[JAIL_TILE]).toBeCloseTo(1 - d, 12);
    for (let a = 1; a <= 6; a++) expect(o[(JAIL_TILE + 2 * a) % BOARD_SIZE]).toBeCloseTo(doublesTo((JAIL_TILE + 2 * a) % BOARD_SIZE), 12);
    // tiles reachable only by odd totals get nothing
    expect(o[JAIL_TILE + 1]).toBe(0);
    expect(o[JAIL_TILE + 3]).toBe(0);
  });
});

// ---------------------------------------------------------------- sampling
describe('sampleCombo / rollDice', () => {
  it('sampleCombo maps u to a combo index through the cumulative weights', () => {
    const uniform = new Array(36).fill(1 / 36);
    expect(sampleCombo(uniform, 0)).toBe(0);
    expect(sampleCombo(uniform, 0.9999999999)).toBe(35);
    expect(sampleCombo(uniform, 1 / 36 + 1e-9)).toBe(1);
    expect(sampleCombo(uniform, 0.5)).toBe(18);
    const w = new Array(36).fill(0);
    w[4] = 0.25;
    w[9] = 0.75;
    expect(sampleCombo(w, 0)).toBe(4);
    expect(sampleCombo(w, 0.2499)).toBe(4);
    expect(sampleCombo(w, 0.2501)).toBe(9);
    expect(sampleCombo(w, 1)).toBe(9); // never returns a zero-weight combo
  });

  it('is deterministic: same state + rng gives the same rolls and ends on the same rng', () => {
    const a = trailing();
    const b = clone(a);
    const ra = Array.from({ length: 200 }, () => rollDice(a, 'p0', ctx));
    const rb = Array.from({ length: 200 }, () => rollDice(b, 'p0', ctx));
    expect(ra).toEqual(rb);
    expect(a.rng).toBe(b.rng);
    const c = { ...clone(trailing()), rng: 777 };
    expect(Array.from({ length: 20 }, () => rollDice(c, 'p0', ctx).values)).not.toEqual(ra.slice(0, 20).map((r) => r.values));
  });

  it('consumes exactly ONE rng draw and only touches state.rng', () => {
    const s = trailing();
    const before = JSON.stringify({ ...s, rng: 0 });
    const probe = { rng: s.rng };
    const u = nextFloat(probe);
    const r = rollDice(s, 'p0', ctx);
    expect(s.rng).toBe(probe.rng);
    expect(JSON.stringify({ ...s, rng: 0 })).toBe(before);
    expect(r.values).toEqual(COMBOS[sampleCombo(diceWeights(trailing(), 'p0', ctx).weights, u)]);
    expect(r.assist).toBe(diceWeights(trailing(), 'p0', ctx).assist);
    // fair mode also uses one draw
    const f = mkState({ dice: 'fair' });
    const probeF = { rng: f.rng };
    nextFloat(probeF);
    rollDice(f, 'p0', ctx);
    expect(f.rng).toBe(probeF.rng);
  });

  it('values are always valid dice', () => {
    const s = trailing();
    for (let i = 0; i < 2000; i++) {
      const { values } = rollDice(s, 'p0', ctx);
      expect(values).toHaveLength(2);
      for (const v of values) expect(v >= 1 && v <= 6 && Number.isInteger(v)).toBe(true);
    }
  });

  it('is pure for queries: frozen states are fine', () => {
    const s = deepFreeze(trailing());
    expect(() => diceWeights(s, 'p0', ctx)).not.toThrow();
    expect(() => diceOdds(s, 'p0', ctx)).not.toThrow();
    expect(() => landingOdds(s, 'p0', ctx)).not.toThrow();
    expect(() => rawMultipliers(s, 'p0', ctx)).not.toThrow();
  });
});

// ---------------------------------------------------------------- empirical
describe('empirical distributions (200,000 rolls)', () => {
  const N = 200000;

  it('fair mode approximates the theory', () => {
    const s = mkState({ dice: 'fair', rng: 424242 });
    const totals = {};
    for (let t = 2; t <= 12; t++) totals[t] = 0;
    const combos = new Array(36).fill(0);
    let doubles = 0;
    for (let i = 0; i < N; i++) {
      const [a, b] = rollDice(s, 'p0', ctx).values;
      totals[a + b]++;
      combos[idx(a, b)]++;
      if (a === b) doubles++;
    }
    for (let t = 2; t <= 12; t++) expect(Math.abs(totals[t] / N - FAIR_TOTAL_PROBS[t])).toBeLessThan(0.005);
    expect(Math.abs(doubles / N - 1 / 6)).toBeLessThan(0.005);
    for (const c of combos) expect(Math.abs(c / N - 1 / 36)).toBeLessThan(0.002);
  });

  it('lucky mode for a neutral player produces exactly the same rolls as fair mode', () => {
    const neutral = mkState({ n: 3, rng: 31337 });
    give(neutral, 'p1', [1, 2]);
    equalise(neutral);
    const fair = fairOf(neutral);
    for (let i = 0; i < 5000; i++) expect(rollDice(neutral, 'p0', ctx).values).toEqual(rollDice(fair, 'p0', ctx).values);
  });

  it('lucky rolls follow diceWeights, and landingOdds matches the simulated landings', () => {
    // trailing + mercy + pity all at once: a genuinely skewed case
    const s = trailing();
    const p = P(s, 'p0');
    p.pos = 20;
    p.rentStreak = 2;
    p.rollsSinceDouble = 6;
    give(s, 'p1', [27], 3);
    s.rng = 987654321;
    const { weights, active } = diceWeights(s, 'p0', ctx);
    expect(active.length).toBeGreaterThanOrEqual(2);
    const lo = odds(s);
    expect(sum(lo)).toBeCloseTo(1, 12);

    const combos = new Array(36).fill(0);
    const land = new Array(BOARD_SIZE).fill(0);
    for (let i = 0; i < N; i++) {
      const [a, b] = rollDice(s, 'p0', ctx).values;
      combos[idx(a, b)]++;
      land[(p.pos + a + b) % BOARD_SIZE]++;
    }
    weights.forEach((w, i) => expect(Math.abs(combos[i] / N - w)).toBeLessThan(0.003));
    lo.forEach((q, t) => expect(Math.abs(land[t] / N - q)).toBeLessThan(0.004));
  });

  it('landingOdds matches a simulation for a jailed player and for a third-double roll', () => {
    const j = trailing();
    P(j, 'p0').pos = JAIL_TILE;
    P(j, 'p0').jailTurns = 1;
    P(j, 'p0').rollsSinceDouble = 6;
    j.rng = 5150;
    const lj = odds(j);
    const landJ = new Array(BOARD_SIZE).fill(0);
    for (let i = 0; i < N; i++) {
      const [a, b] = rollDice(j, 'p0', ctx).values;
      landJ[a === b ? (JAIL_TILE + a + b) % BOARD_SIZE : JAIL_TILE]++;
    }
    lj.forEach((q, t) => expect(Math.abs(landJ[t] / N - q)).toBeLessThan(0.004));

    const d = mkState({ n: 3, rng: 2718 });
    P(d, 'p0').pos = 3;
    P(d, 'p0').doubles = 2;
    const ld = odds(d);
    const landD = new Array(BOARD_SIZE).fill(0);
    for (let i = 0; i < N; i++) {
      const [a, b] = rollDice(d, 'p0', ctx).values;
      landD[a === b ? JAIL_TILE : (3 + a + b) % BOARD_SIZE]++;
    }
    ld.forEach((q, t) => expect(Math.abs(landD[t] / N - q)).toBeLessThan(0.004));
    // tile 14 = every double (third double -> jail) + the non-double total 11 from tile 3
    const wd = diceWeights(d, 'p0', ctx).weights;
    expect(ld[JAIL_TILE]).toBeCloseTo(diceOdds(d, 'p0', ctx).doubles + wd[idx(5, 6)] + wd[idx(6, 5)], 12);
  });
});

describe('landingOdds / diceOdds', () => {
  it('landingOdds sums to 1 for every player of every random state', () => {
    const rnd = mulberry32(7);
    for (let k = 0; k < 200; k++) {
      const s = randomState(rnd);
      for (const p of s.players) {
        const o = landingOdds(s, p.id, ctx);
        expect(o).toHaveLength(BOARD_SIZE);
        expect(sum(o)).toBeCloseTo(1, 12);
        expect(Math.min(...o)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('landingOdds in fair mode is the textbook 2d6 distribution shifted by the position', () => {
    const s = mkState({ dice: 'fair' });
    P(s, 'p0').pos = 25;
    const o = odds(s);
    for (let t = 2; t <= 12; t++) expect(o[(25 + t) % BOARD_SIZE]).toBeCloseTo(FAIR_TOTAL_PROBS[t], 12);
    expect(o[25]).toBe(0); // you always move at least 2
  });

  it('uses the very same weights as rollDice (diceOdds totals == summed weights)', () => {
    const s = trailing();
    P(s, 'p0').rollsSinceDouble = 6;
    const { weights, assist } = diceWeights(s, 'p0', ctx);
    const o = diceOdds(s, 'p0', ctx);
    expect(o.assist).toBe(assist);
    expect(sum(Object.values(o.totals))).toBeCloseTo(1, 12);
    for (let t = 2; t <= 12; t++) {
      expect(o.totals[t]).toBeCloseTo(sum(COMBOS.map(([a, b], i) => (a + b === t ? weights[i] : 0))), 12);
    }
    expect(o.doubles).toBeCloseTo(sum([1, 2, 3, 4, 5, 6].map((a) => weights[idx(a, a)])), 12);
    const lo = odds(s);
    const manual = new Array(BOARD_SIZE).fill(0);
    COMBOS.forEach(([a, b], i) => {
      manual[(10 + a + b) % BOARD_SIZE] += weights[i];
    });
    lo.forEach((q, t) => expect(q).toBeCloseTo(manual[t], 12));
  });

  it('unknown player id yields neutral weights / zero odds without throwing', () => {
    const s = trailing();
    expect(diceWeights(s, 'ghost', ctx).weights).toEqual(new Array(36).fill(1 / 36));
    expect(sum(landingOdds(s, 'ghost', ctx))).toBe(0);
  });
});
