import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import {
  signSession,
  verifySession,
  sessionCookie,
  clearSessionCookie,
  readCookie,
  isSecureRequest,
  isSameOrigin,
  verifyGoogleCredential,
  COOKIE_NAME,
  GOOGLE_ISSUERS,
} from './auth.js';

const env = { JWT_SECRET: 'unit-test-secret-unit-test-secret-1234' };
const USER = { id: '0b9d7c3e-1d2a-4f5b-8c6d-123456789abc', isGuest: false };

describe('session JWT', () => {
  it('round-trips subject and guest flag', async () => {
    const token = await signSession(env, USER);
    expect(await verifySession(env, token)).toEqual({ uid: USER.id, guest: false });
    const g = await signSession(env, { id: USER.id, isGuest: true });
    expect(await verifySession(env, g)).toEqual({ uid: USER.id, guest: true });
  });

  it('rejects tampered tokens, wrong secrets and junk without throwing', async () => {
    const token = await signSession(env, USER);
    const [h, p, s] = token.split('.');
    expect(await verifySession(env, `${h}.${p}.${s.slice(0, -2)}xx`)).toBeNull();
    expect(await verifySession({ JWT_SECRET: 'another-secret-another-secret-0000' }, token)).toBeNull();
    for (const junk of ['', 'abc', 'a.b.c', null, undefined, 42, 'x'.repeat(5000)]) {
      expect(await verifySession(env, junk)).toBeNull();
    }
  });

  it('rejects expired tokens and tokens for another audience/issuer', async () => {
    const key = new TextEncoder().encode(env.JWT_SECRET);
    const make = (claims) =>
      new SignJWT({ guest: false, ...claims.payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(USER.id)
        .setIssuer(claims.iss ?? 'hyderabad-tycoon')
        .setAudience(claims.aud ?? 'hyd-web')
        .setIssuedAt(claims.iat)
        .setExpirationTime(claims.exp)
        .sign(key);
    const now = Math.floor(Date.now() / 1000);
    expect(await verifySession(env, await make({ exp: now + 60 }))).not.toBeNull();
    expect(await verifySession(env, await make({ exp: now - 10, iat: now - 100 }))).toBeNull();
    expect(await verifySession(env, await make({ exp: now + 60, aud: 'someone-else' }))).toBeNull();
    expect(await verifySession(env, await make({ exp: now + 60, iss: 'evil' }))).toBeNull();
  });

  it('refuses to sign with a missing / weak secret', async () => {
    await expect(signSession({}, USER)).rejects.toThrow();
    await expect(signSession({ JWT_SECRET: 'short' }, USER)).rejects.toThrow();
  });

  it('is valid for 30 days', async () => {
    const token = await signSession(env, USER);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
  });
});

describe('cookies', () => {
  it('production cookie is Secure; HttpOnly; SameSite=Lax; Path=/', () => {
    const c = sessionCookie('tok', true);
    expect(c).toContain(`${COOKIE_NAME}=tok`);
    for (const flag of ['; Secure', '; HttpOnly', '; SameSite=Lax', '; Path=/', '; Max-Age=2592000']) {
      expect(c).toContain(flag);
    }
  });

  it('is not Secure over plain http (local dev) but keeps the other flags', () => {
    const c = sessionCookie('tok', false);
    expect(c).not.toContain('Secure');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
  });

  it('logout cookie expires immediately', () => {
    expect(clearSessionCookie(true)).toMatch(/hyd_session=; .*Max-Age=0/);
    expect(clearSessionCookie(true)).toContain('Secure');
  });

  it('detects https from the request url', () => {
    expect(isSecureRequest(new Request('https://tycoon.example/api/me'))).toBe(true);
    expect(isSecureRequest(new Request('http://localhost:8787/api/me'))).toBe(false);
  });

  it('reads one cookie from a Cookie header', () => {
    expect(readCookie('a=1; hyd_session=abc.def.ghi; b=2')).toBe('abc.def.ghi');
    expect(readCookie('a=1')).toBeNull();
    expect(readCookie('hyd_session=')).toBeNull();
    expect(readCookie(undefined)).toBeNull();
    expect(readCookie('xhyd_session=zzz')).toBeNull();
  });
});

describe('same-origin guard', () => {
  it('allows no Origin (non-browser), same host and loopback pairs; blocks others', () => {
    expect(isSameOrigin(undefined, 'https://t.example/api/x')).toBe(true);
    expect(isSameOrigin('https://t.example', 'https://t.example/api/x')).toBe(true);
    expect(isSameOrigin('https://evil.example', 'https://t.example/api/x')).toBe(false);
    expect(isSameOrigin('null', 'https://t.example/api/x')).toBe(false);
    expect(isSameOrigin('http://localhost:5173', 'http://localhost:8787/api/x')).toBe(true);
    expect(isSameOrigin('http://localhost:5173', 'https://t.example/api/x')).toBe(false);
    expect(isSameOrigin('https://t.example.evil.com', 'https://t.example/api/x')).toBe(false);
  });
});

describe('Google ID token verification', () => {
  const CLIENT_ID = 'test-client.apps.googleusercontent.com';
  let privateKey;
  let getKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
    getKey = createLocalJWKSet({ keys: [jwk] });
  });

  const now = () => Math.floor(Date.now() / 1000);
  const token = (over = {}) =>
    new SignJWT({ email: 'a@example.com', email_verified: true, name: 'Asha', ...over.payload })
      .setProtectedHeader({ alg: over.alg ?? 'RS256', kid: 'k1' })
      .setSubject(over.sub ?? 'google-sub-123')
      .setIssuer(over.iss ?? 'https://accounts.google.com')
      .setAudience(over.aud ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(over.exp ?? now() + 600)
      .sign(privateKey);

  it('accepts a valid token with either Google issuer form', async () => {
    for (const iss of GOOGLE_ISSUERS) {
      const claims = await verifyGoogleCredential(await token({ iss }), CLIENT_ID, getKey);
      expect(claims.sub).toBe('google-sub-123');
      expect(claims.email).toBe('a@example.com');
    }
  });

  it('rejects wrong audience, wrong issuer, expired and unverified-email tokens', async () => {
    const fails = [
      token({ aud: 'other-client' }),
      token({ iss: 'https://evil.example' }),
      token({ exp: now() - 30 }),
      token({ payload: { email_verified: false } }),
    ];
    for (const t of fails) {
      await expect(verifyGoogleCredential(await t, CLIENT_ID, getKey)).rejects.toMatchObject({ status: 401 });
    }
  });

  it('rejects a token signed by an unknown key', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({ email: 'a@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('x')
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setExpirationTime(now() + 600)
      .sign(other.privateKey);
    await expect(verifyGoogleCredential(forged, CLIENT_ID, getKey)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects HS256-signed tokens (algorithm confusion) and garbage', async () => {
    const hs = await new SignJWT({ email_verified: true })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setSubject('x')
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT_ID)
      .setExpirationTime(now() + 600)
      .sign(new TextEncoder().encode('secret-secret-secret-secret-secret'));
    await expect(verifyGoogleCredential(hs, CLIENT_ID, getKey)).rejects.toMatchObject({ status: 401 });
    for (const junk of ['', 'abc', null, 7, 'x'.repeat(7000)]) {
      await expect(verifyGoogleCredential(junk, CLIENT_ID, getKey)).rejects.toMatchObject({ status: 400 });
    }
  });

  it('fails clearly when Google sign-in is not configured', async () => {
    await expect(verifyGoogleCredential(await token(), '', getKey)).rejects.toMatchObject({ status: 503 });
  });
});
