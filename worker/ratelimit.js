// Tiny in-memory sliding-window limiter. State is per Worker isolate, which is good
// enough to blunt abuse of the sensitive routes (it is not a global quota).
const buckets = new Map();
let lastSweep = 0;

/** Returns true if the call is allowed, false if the limit is exceeded. */
export function allow(key, limit, windowMs, now = Date.now()) {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (now - b.start > b.windowMs) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** Hono middleware factory: `limit('guest', 10, 60)` = 10 requests / 60 s per client IP. */
export function limit(name, max, windowSec) {
  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local';
    const who = c.get('session')?.uid || ip;
    if (!allow(`${name}:${who}`, max, windowSec * 1000)) {
      c.header('Retry-After', String(windowSec));
      return c.json({ error: 'Too many requests, slow down.' }, 429);
    }
    await next();
  };
}

export function _resetForTests() {
  buckets.clear();
  lastSweep = 0;
}
