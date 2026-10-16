import { describe, it, expect } from 'vitest';
import { ratingDeltas, expectedScore, applyDelta, RATING_FLOOR, RATING_K, BOT_RATING } from './rating.js';

const seats = (...rows) => rows.map(([id, rank, rating, isBot]) => ({ id, rank, rating, isBot }));

describe('rating (Elo-style, K=24, floor 100)', () => {
  it('equal ratings: the winner of a duel gains K/2, the loser loses it', () => {
    expect(ratingDeltas(seats(['a', 1, 1000], ['b', 2, 1000]))).toEqual({ a: 12, b: -12 });
    expect(RATING_K).toBe(24);
  });

  it('is (almost) zero-sum between equally rated humans, ordered by rank', () => {
    const d = ratingDeltas(seats(['a', 1, 1000], ['b', 2, 1000], ['c', 3, 1000], ['d', 4, 1000]));
    expect(d).toEqual({ a: 12, b: 4, c: -4, d: -12 });
    expect(Object.values(d).reduce((x, y) => x + y, 0)).toBe(0);
  });

  it('beating a stronger opponent pays more than beating a weaker one', () => {
    const up = ratingDeltas(seats(['a', 1, 1000], ['b', 2, 1400])).a;
    const down = ratingDeltas(seats(['a', 1, 1000], ['b', 2, 600])).a;
    expect(up).toBeGreaterThan(12);
    expect(down).toBeLessThan(12);
    expect(up).toBeLessThanOrEqual(RATING_K);
  });

  it('bots are opponents rated 1000 and never get a delta', () => {
    const d = ratingDeltas(seats(['h', 1, 1000], ['bot_1', 2, undefined, true], ['bot_2', 3, undefined, true]));
    expect(Object.keys(d)).toEqual(['h']);
    expect(d.h).toBe(Math.round(RATING_K * (1 - expectedScore(1000, BOT_RATING))));
  });

  it('a missing rating counts as the starting 1000; a single seat changes nothing', () => {
    expect(ratingDeltas(seats(['a', 1, undefined], ['b', 2, undefined]))).toEqual({ a: 12, b: -12 });
    expect(ratingDeltas(seats(['a', 1, 1000]))).toEqual({ a: 0 });
    expect(ratingDeltas([])).toEqual({});
  });

  it('applyDelta never goes below the floor', () => {
    expect(RATING_FLOOR).toBe(100);
    expect(applyDelta(1000, 12)).toBe(1012);
    expect(applyDelta(105, -24)).toBe(100);
    expect(applyDelta(100, -24)).toBe(100);
  });

  it('deltas stay within +-K', () => {
    for (const r of [100, 500, 1000, 1500, 2500]) {
      for (const o of [100, 1000, 3000]) {
        for (const rank of [1, 2]) {
          const d = ratingDeltas(seats(['a', rank, r], ['b', 3 - rank, o])).a;
          expect(Math.abs(d)).toBeLessThanOrEqual(RATING_K);
        }
      }
    }
  });
});
