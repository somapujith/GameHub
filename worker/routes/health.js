import { Hono } from 'hono';
import { query } from '../db.js';

const health = new Hono();

const DB_TIMEOUT_MS = 2500;

/** `select 1` against Neon with a hard timeout. Any failure (or missing config) -> false. */
export async function checkDb(env, timeoutMs = DB_TIMEOUT_MS) {
  let timer;
  try {
    await Promise.race([
      query(env, 'select 1 as ok'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false; // never leak the reason (it could mention hosts or credentials)
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/health -> { ok:true, time, db:boolean }. Public, no secrets, no error details.
health.get('/', async (c) => c.json({ ok: true, time: new Date().toISOString(), db: await checkDb(c.env) }));

export default health;
