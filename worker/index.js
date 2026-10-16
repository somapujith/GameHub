// Hyderabad Tycoon - Cloudflare Worker entry.
// Same-origin API (no CORS), cookie sessions, WebSocket upgrades forwarded to Durable
// Objects, everything else served from the static bundle (ASSETS).
import { Hono } from 'hono';
import { sessionMiddleware, isSameOrigin, isSecureRequest, currentUser } from './auth.js';
import { apiSecurityHeaders } from './security.js';
import { HttpError } from './db.js';
import { normalizeRoomCode } from './codes.js';
import { roomStub, userHubStub } from './hub.js';
import configRoutes from './routes/config.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import friendRoutes from './routes/friends.js';
import roomRoutes from './routes/rooms.js';
import inviteRoutes from './routes/invites.js';
import leaderboardRoutes from './routes/leaderboard.js';
import healthRoutes from './routes/health.js';

export { GameRoom } from './GameRoom.js';
export { UserHub } from './UserHub.js';

const app = new Hono();

// ---- API ---------------------------------------------------------------------------
const api = new Hono();

// Security headers on every API response (static assets get theirs from public/_headers).
api.use('*', async (c, next) => {
  await next();
  for (const [k, v] of Object.entries(apiSecurityHeaders(isSecureRequest(c.req.raw)))) c.header(k, v);
});

// CSRF defence in depth (cookies are SameSite=Lax): refuse cross-origin state changes.
api.use('*', async (c, next) => {
  const m = c.req.method;
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isSameOrigin(c.req.header('origin'), c.req.url)) {
    return c.json({ error: 'Cross-origin request refused.' }, 403);
  }
  await next();
});

// Health first: it must answer even when secrets are missing (no session parsing).
api.route('/health', healthRoutes);

api.use('*', sessionMiddleware);

api.route('/config', configRoutes);
api.route('/auth', authRoutes);
api.route('/me', meRoutes);
api.route('/friends', friendRoutes);
api.route('/rooms', roomRoutes);
api.route('/invites', inviteRoutes);
api.route('/leaderboard', leaderboardRoutes);
api.notFound((c) => c.json({ error: 'Not found.' }, 404));

app.route('/api', api);

// ---- WebSockets ----------------------------------------------------------------------
const WS_FORWARD_HEADERS = [
  'upgrade',
  'connection',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-protocol',
  'sec-websocket-extensions',
];

/**
 * Build the request forwarded to a Durable Object. Only handshake headers are copied from
 * the client; the identity headers are set here from the verified session (never from the
 * client). Names are percent-encoded because HTTP header values must be Latin-1.
 */
function forwardRequest(request, user, extra = {}) {
  const headers = new Headers();
  for (const h of WS_FORWARD_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('X-User-Id', user.id);
  headers.set('X-User-Name', encodeURIComponent(user.name));
  headers.set('X-User-Avatar', String(user.avatar));
  headers.set('X-User-Guest', user.is_guest ? '1' : '0');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Request('https://internal.invalid/ws', { headers });
}

/**
 * Accept a WebSocket only to close it at once with an application close code, so the
 * browser client learns *why* (4001 sign in, 4004 not found) and does not retry blindly.
 */
function closedSocket(code, reason) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

async function wsGuard(c, next) {
  if ((c.req.header('upgrade') || '').toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected a WebSocket upgrade.' }, 426);
  }
  if (!isSameOrigin(c.req.header('origin'), c.req.url)) {
    return c.json({ error: 'Cross-origin request refused.' }, 403);
  }
  await next();
}

app.get('/ws/room/:code', wsGuard, sessionMiddleware, async (c) => {
  const user = await currentUser(c);
  if (!user) return closedSocket(4001, 'Please sign in first.');
  const code = normalizeRoomCode(c.req.param('code'));
  if (!code) return closedSocket(4004, 'That room code is not valid.');
  return roomStub(c.env, code).fetch(forwardRequest(c.req.raw, user, { 'X-Room-Code': code }));
});

app.get('/ws/user', wsGuard, sessionMiddleware, async (c) => {
  const user = await currentUser(c);
  if (!user) return closedSocket(4001, 'Please sign in first.');
  return userHubStub(c.env, user.id).fetch(forwardRequest(c.req.raw, user));
});

// ---- errors --------------------------------------------------------------------------
function onError(err, c) {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  // Log only the message/code: errors from the DB driver must never leak parameters.
  console.error('Unhandled error:', err && err.code ? `${err.code} ${err.message}` : err && err.message);
  return c.json({ error: 'Something went wrong. Please try again.' }, 500);
}
app.onError(onError);
api.onError(onError);

const isWorkerPath = (p) => p === '/api' || p.startsWith('/api/') || p.startsWith('/ws/');

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (isWorkerPath(pathname)) return app.fetch(request, env, ctx);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
