// Deterministic RNG (mulberry32). The generator state is a single uint32 that lives on a plain
// "state object" under the key `rng`, so the whole game state stays JSON-serialisable and
// `same seed + same actions = same events`.

/** Turn any seed (number | string | undefined) into a uint32. */
export function seedToUint32(seed) {
  if (seed === undefined || seed === null) return (Math.random() * 4294967296) >>> 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) return (Math.floor(seed) >>> 0) || 0x9e3779b9;
  const str = String(seed);
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Next float in [0,1). Advances `obj.rng`. */
export function nextFloat(obj) {
  let a = (obj.rng + 0x6d2b79f5) | 0;
  obj.rng = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] (both inclusive). `randInt(obj, n)` is shorthand for [0, n-1]. */
export function randInt(obj, min, max) {
  if (max === undefined) {
    max = min - 1;
    min = 0;
  }
  return min + Math.floor(nextFloat(obj) * (max - min + 1));
}

/** Fisher-Yates. Returns a NEW shuffled array; the input is left alone. */
export function shuffle(obj, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(obj) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Closure form for callers that just want `rnd()` (e.g. bot simulations). */
export function mulberry32(seed) {
  const holder = { rng: seedToUint32(seed) };
  return () => nextFloat(holder);
}
