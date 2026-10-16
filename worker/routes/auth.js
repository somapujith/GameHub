import { Hono } from 'hono';
import {
  verifyGoogleCredential,
  upsertGoogleUser,
  createGuestUser,
  signSession,
  sessionCookie,
  clearSessionCookie,
  isSecureRequest,
} from '../auth.js';
import { limit } from '../ratelimit.js';
import { rowToUser } from '../users.js';
import { readJson } from '../http.js';

const auth = new Hono();

async function startSession(c, row) {
  const token = await signSession(c.env, { id: row.id, isGuest: row.is_guest });
  c.header('Set-Cookie', sessionCookie(token, isSecureRequest(c.req.raw)));
  return c.json({ user: rowToUser(row) });
}

// POST /api/auth/google { credential }
auth.post('/google', limit('auth-google', 20, 60), async (c) => {
  const body = await readJson(c);
  const claims = await verifyGoogleCredential(body.credential, c.env.GOOGLE_CLIENT_ID);
  const row = await upsertGoogleUser(c.env, claims);
  return startSession(c, row);
});

// POST /api/auth/guest { name?, avatar? }
auth.post('/guest', limit('auth-guest', 10, 60), async (c) => {
  const body = await readJson(c);
  const row = await createGuestUser(c.env, { name: body.name, avatar: body.avatar });
  return startSession(c, row);
});

// POST /api/auth/logout
auth.post('/logout', (c) => {
  c.header('Set-Cookie', clearSessionCookie(isSecureRequest(c.req.raw)));
  return c.json({ ok: true });
});

export default auth;
