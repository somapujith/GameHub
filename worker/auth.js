// Authentication: Google ID-token verification, user upsert, guests, session JWT + cookie.
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { query, isUniqueViolation, HttpError } from './db.js';
import { newFriendCode } from './codes.js';
import { sanitizeName, validateName, parseAvatar } from './validate.js';
import { USER_COLUMNS, getUserById } from './users.js';

export const COOKIE_NAME = 'hyd_session';
export const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;
const JWT_ISSUER = 'hyderabad-tycoon';
const JWT_AUDIENCE = 'hyd-web';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// ---------------------------------------------------------------- session JWT

function secretKey(env) {
  const secret = env && env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new HttpError(500, 'Server is not configured (session secret).');
  return new TextEncoder().encode(secret);
}

/** Issue an HS256 session token (30 days) for a user. */
export async function signSession(env, { id, isGuest }) {
  return new SignJWT({ guest: !!isGuest })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey(env));
}

/** Verify a session token. Resolves to `{ uid, guest }` or null (never throws on a bad token). */
export async function verifySession(env, token) {
  if (!token || typeof token !== 'string' || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(env), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string') return null;
    return { uid: payload.sub, guest: payload.guest === true };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return null;
  }
}

// ---------------------------------------------------------------- cookies

export const isSecureRequest = (request) => new URL(request.url).protocol === 'https:';

export function sessionCookie(token, secure) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** Extract one cookie value from a `Cookie` header string. */
export function readCookie(header, name = COOKIE_NAME) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

// ---------------------------------------------------------------- Google ID tokens

let googleJwks;
const defaultGoogleKeys = (header, token) => {
  googleJwks ||= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return googleJwks(header, token);
};

/**
 * Verify a Google Identity Services credential (an ID token JWT).
 * Checks signature (Google JWKS), aud === clientId, iss, exp and email_verified.
 * `getKey` is injectable for tests. Returns the verified claims or throws HttpError(401).
 */
export async function verifyGoogleCredential(credential, clientId, getKey = defaultGoogleKeys) {
  if (!clientId) throw new HttpError(503, 'Google sign-in is not configured.');
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 6000) {
    throw new HttpError(400, 'Missing Google credential.');
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(credential, getKey, {
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
      algorithms: ['RS256'],
    }));
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified.');
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new HttpError(401, 'Your Google email address is not verified.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) throw new HttpError(401, 'Invalid Google token.');
  return payload;
}

// ---------------------------------------------------------------- users

/** Insert a user, retrying with a fresh friend code if it collides (unique violation). */
async function withFreshFriendCode(attempt) {
  for (let i = 0; i < 8; i += 1) {
    try {
      return await attempt(newFriendCode());
    } catch (err) {
      if (isUniqueViolation(err, 'friend_code')) continue;
      throw err;
    }
  }
  throw new HttpError(503, 'Could not allocate a friend code, please try again.');
}

const randomAvatar = () => crypto.getRandomValues(new Uint8Array(1))[0] % 12;

/** Create or update the user for a verified Google identity. Resolves to the DB row. */
export async function upsertGoogleUser(env, claims) {
  const email = typeof claims.email === 'string' ? claims.email.slice(0, 254) : null;
  const fallback = email ? email.split('@')[0] : '';
  const name = sanitizeName(claims.name || claims.given_name || fallback) || 'Player';
  return withFreshFriendCode(async (friendCode) => {
    const rows = await query(
      env,
      `INSERT INTO users (google_sub, email, name, avatar, friend_code, is_guest)
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, last_seen = now()
       RETURNING ${USER_COLUMNS}`,
      [claims.sub, email, name, randomAvatar(), friendCode],
    );
    return rows[0];
  });
}

/** Create a guest user. `name` is validated strictly when given. */
export async function createGuestUser(env, { name, avatar } = {}) {
  let finalName = 'Guest';
  if (name !== undefined && name !== null && name !== '') {
    const v = validateName(name);
    if (!v.ok) throw new HttpError(400, v.error);
    finalName = v.value;
  }
  let finalAvatar = randomAvatar();
  if (avatar !== undefined && avatar !== null) {
    const a = parseAvatar(avatar);
    if (a == null) throw new HttpError(400, 'Avatar must be a number from 0 to 11.');
    finalAvatar = a;
  }
  return withFreshFriendCode(async (friendCode) => {
    const rows = await query(
      env,
      `INSERT INTO users (name, avatar, friend_code, is_guest)
       VALUES ($1, $2, $3, true)
       RETURNING ${USER_COLUMNS}`,
      [finalName, finalAvatar, friendCode],
    );
    return rows[0];
  });
}

// ---------------------------------------------------------------- Hono middleware

/** Reads the session cookie and exposes `c.get('session')` = `{uid, guest}` | null. */
export async function sessionMiddleware(c, next) {
  const token = readCookie(c.req.header('cookie'));
  c.set('session', token ? await verifySession(c.env, token) : null);
  await next();
}

/** The signed-in user's DB row, or null (no/invalid session or the user no longer exists). */
export async function currentUser(c) {
  const session = c.get('session');
  return session ? getUserById(c.env, session.uid) : null;
}

/** Resolve the signed-in user row, or a ready-made 401 response. */
async function loadUser(c) {
  const session = c.get('session');
  if (!session) return { res: c.json({ error: 'Please sign in first.' }, 401) };
  const user = await getUserById(c.env, session.uid);
  if (!user) {
    c.header('Set-Cookie', clearSessionCookie(isSecureRequest(c.req.raw)));
    return { res: c.json({ error: 'Your session has expired. Please sign in again.' }, 401) };
  }
  return { user };
}

/** Loads the signed-in user row into `c.get('user')`; 401 when absent. */
export async function requireUser(c, next) {
  const r = await loadUser(c);
  if (r.res) return r.res;
  c.set('user', r.user);
  await next();
}

/** Like requireUser, but guests are rejected (friends, leaderboard, invites). */
export async function requireMember(c, next) {
  const r = await loadUser(c);
  if (r.res) return r.res;
  if (r.user.is_guest) return c.json({ error: 'Sign in with Google to use this feature.' }, 403);
  c.set('user', r.user);
  await next();
}

/**
 * Same-origin guard for state-changing requests and WebSocket upgrades. Browsers always
 * send Origin on those; a foreign Origin is refused. Loopback hosts are treated as equal
 * so `vite` (5173) proxying to `wrangler dev` (8787) keeps working in development.
 */
export function isSameOrigin(originHeader, requestUrl) {
  if (!originHeader) return true; // non-browser client (curl, tests): cookie auth still applies
  let origin;
  let req;
  try {
    origin = new URL(originHeader);
    req = new URL(requestUrl);
  } catch {
    return false;
  }
  if (origin.host === req.host) return true;
  const loop = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  return loop(origin.hostname) && loop(req.hostname);
}
