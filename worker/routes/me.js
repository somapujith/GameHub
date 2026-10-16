import { Hono } from 'hono';
import { query } from '../db.js';
import { HttpError } from '../db.js';
import { requireUser, clearSessionCookie, isSecureRequest } from '../auth.js';
import { USER_COLUMNS, rowToUser } from '../users.js';
import { validateName, parseAvatar } from '../validate.js';
import { limit } from '../ratelimit.js';
import { readJson } from '../http.js';

const me = new Hono();

// GET /api/me -> { user|null }  (also refreshes last_seen)
me.get('/', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ user: null });
  const rows = await query(c.env, `UPDATE users SET last_seen = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`, [session.uid]);
  if (!rows[0]) {
    c.header('Set-Cookie', clearSessionCookie(isSecureRequest(c.req.raw)));
    return c.json({ user: null });
  }
  return c.json({ user: rowToUser(rows[0]) });
});

// PATCH /api/me { name?, avatar? }
me.patch('/', requireUser, limit('me-patch', 30, 60), async (c) => {
  const body = await readJson(c);
  const sets = [];
  const params = [c.get('user').id];
  if (body.name !== undefined) {
    const v = validateName(body.name);
    if (!v.ok) throw new HttpError(400, v.error);
    params.push(v.value);
    sets.push(`name = $${params.length}`);
  }
  if (body.avatar !== undefined) {
    const a = parseAvatar(body.avatar);
    if (a == null) throw new HttpError(400, 'Avatar must be a number from 0 to 11.');
    params.push(a);
    sets.push(`avatar = $${params.length}`);
  }
  if (!sets.length) return c.json({ user: rowToUser(c.get('user')) });
  // `sets` only ever contains the fixed fragments built above; values are bound parameters.
  const rows = await query(c.env, `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${USER_COLUMNS}`, params);
  return c.json({ user: rowToUser(rows[0]) });
});

export default me;
