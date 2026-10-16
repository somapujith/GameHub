// In-process tests of the HTTP API (Hono app) with the database and the Durable Objects faked:
// the marketplace endpoints, their validation, auth and caching. No Workers runtime needed.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(ctx, env) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const queryMock = vi.fn(async () => []);
vi.mock('./db.js', async (importOriginal) => ({ ...(await importOriginal()), query: (...a) => queryMock(...a) }));

const roomCallMock = vi.fn();
const pushMock = vi.fn(async () => 1);
vi.mock('./hub.js', async (importOriginal) => ({
  ...(await importOriginal()),
  roomCall: (...a) => roomCallMock(...a),
  pushToUser: (...a) => pushMock(...a),
  isUserOnline: async () => false,
}));

const { default: worker } = await import('./index.js');
const { signSession } = await import('./auth.js');
const { _resetForTests } = await import('./ratelimit.js');
const roomsdb = await import('./roomsdb.js');
const { inviteMessage } = await import('./routes/invites.js');
const { friendRelation } = await import('./routes/friends.js');
const { withOpenTables } = await import('./routes/games.js');

const env = { JWT_SECRET: 'unit-test-secret-unit-test-secret-1234', DATABASE_URL: 'postgres://fake' };
const ME = '00000000-0000-4000-8000-0000000000a1';
const FRIEND = '00000000-0000-4000-8000-0000000000b2';

const userRow = (id, over = {}) => ({
  id,
  google_sub: null,
  email: null,
  name: id === ME ? 'Me' : 'Friend',
  avatar: 3,
  friend_code: id === ME ? 'HYD-ME22' : 'HYD-FR22',
  is_guest: false,
  xp: 250,
  coins: 500,
  level: 1,
  games: 3,
  wins: 1,
  best_worth: 80000,
  rent_earned: 1200,
  ...over,
});
const users = new Map();

async function cookieFor(id, isGuest = false) {
  return `hyd_session=${await signSession(env, { id, isGuest })}`;
}

async function call(path, { method = 'GET', cookie, body } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const res = await worker.fetch(
    new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
    {},
  );
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, headers: res.headers };
}

/** Routes SQL by its text so each endpoint sees the rows it expects. */
function installDb(extra = () => undefined) {
  queryMock.mockImplementation(async (e, text, params = []) => {
    const custom = extra(text, params);
    if (custom !== undefined) return custom;
    if (/FROM users WHERE id = \$1/.test(text)) {
      const row = users.get(params[0]);
      return row ? [row] : [];
    }
    if (/UPDATE users SET last_seen/.test(text)) return [users.get(params[0])].filter(Boolean);
    return [];
  });
}

beforeEach(() => {
  queryMock.mockReset();
  roomCallMock.mockReset();
  pushMock.mockClear();
  _resetForTests();
  roomsdb._resetRoomsCacheForTests();
  users.clear();
  users.set(ME, userRow(ME));
  users.set(FRIEND, userRow(FRIEND, { xp: 10 }));
  installDb();
});

describe('GET /api/games', () => {
  it('lists the registered games with the number of open tables (public, short cache)', async () => {
    installDb((text) => (/GROUP BY game_id/.test(text) ? [{ game_id: 'hyderabad-tycoon', n: 3 }] : undefined));
    const res = await call('/api/games');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ games: [{ id: 'hyderabad-tycoon', name: 'Hyderabad Tycoon', minPlayers: 2, maxPlayers: 6, openTables: 3 }] });
    expect(res.headers.get('cache-control')).toBe('public, max-age=5');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff'); // the other security headers still apply
  });

  it('works when the listing is unavailable (zero open tables)', async () => {
    installDb((text) => {
      if (/GROUP BY game_id/.test(text)) throw new Error('neon down');
      return undefined;
    });
    const res = await call('/api/games');
    expect(res.status).toBe(200);
    expect(res.json.games[0].openTables).toBe(0);
    expect(withOpenTables([{ id: 'a' }, { id: 'b' }], { a: 2 })).toEqual([{ id: 'a', openTables: 2 }, { id: 'b', openTables: 0 }]);
  });

  it('every other endpoint stays no-store', async () => {
    const res = await call('/api/config');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /api/rooms/open', () => {
  const row = { code: 'ABCD23', game_id: 'hyderabad-tycoon', host_name: 'Host', player_count: 2, max_players: 4, settings: { goal: 70000, maxRounds: 50 }, created_at: '2026-10-16T10:00:00Z' };

  it('needs no sign-in and returns the documented rows', async () => {
    installDb((text) => (/FROM rooms/.test(text) && /^\s*SELECT/.test(text) ? [row] : undefined));
    const res = await call('/api/rooms/open');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      rooms: [
        {
          code: 'ABCD23',
          gameId: 'hyderabad-tycoon',
          hostName: 'Host',
          players: 2,
          maxPlayers: 4,
          summary: 'Target ₹70,000 · 50 rounds',
          createdAt: '2026-10-16T10:00:00.000Z',
        },
      ],
    });
    expect(res.headers.get('cache-control')).toBe('public, max-age=5');
  });

  it('filters by game, clamps the limit and refuses unknown games', async () => {
    let seen;
    installDb((text, params) => {
      if (/FROM rooms/.test(text) && /^\s*SELECT/.test(text)) {
        seen = { text, params };
        return [];
      }
      return undefined;
    });
    expect((await call('/api/rooms/open?game=hyderabad-tycoon&limit=3')).status).toBe(200);
    expect(seen.params).toEqual(['hyderabad-tycoon', 3]);
    roomsdb._resetRoomsCacheForTests();
    expect((await call('/api/rooms/open?limit=9999')).status).toBe(200);
    expect(seen.params).toEqual([20]);
    const bad = await call('/api/rooms/open?game=ludo');
    expect(bad.status).toBe(400);
    expect(bad.json).toEqual({ error: 'unknown game' });
  });

  it('answers from the cache for 5 seconds', async () => {
    let selects = 0;
    installDb((text) => {
      if (/FROM rooms/.test(text) && /^\s*SELECT/.test(text)) {
        selects += 1;
        return [];
      }
      return undefined;
    });
    await call('/api/rooms/open');
    await call('/api/rooms/open');
    await call('/api/rooms/open');
    expect(selects).toBe(1);
  });

  it('is not shadowed by /api/rooms/:code', async () => {
    const res = await call('/api/rooms/open');
    expect(res.json).toEqual({ rooms: [] });
    expect(roomCallMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/rooms/mine', () => {
  it('needs a session (guests are fine) and lists my live rooms', async () => {
    expect((await call('/api/rooms/mine')).status).toBe(401);
    installDb((text, params) => {
      if (/member_ids @>/.test(text)) {
        expect(params).toEqual([ME]);
        return [{ code: 'ABCD23', game_id: 'hyderabad-tycoon', status: 'playing', player_count: 3, max_players: 4 }];
      }
      return undefined;
    });
    users.set(ME, userRow(ME, { is_guest: true }));
    const res = await call('/api/rooms/mine', { cookie: await cookieFor(ME, true) });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ rooms: [{ code: 'ABCD23', gameId: 'hyderabad-tycoon', status: 'playing', players: 3, maxPlayers: 4 }] });
  });
});

describe('POST /api/rooms', () => {
  it('needs a session', async () => {
    expect((await call('/api/rooms', { method: 'POST', body: {} })).status).toBe(401);
  });

  it('creates a private Tycoon room when nothing is specified (old clients)', async () => {
    roomCallMock.mockResolvedValue({ status: 201, data: { code: 'X' } });
    const res = await call('/api/rooms', { method: 'POST', body: {}, cookie: await cookieFor(ME) });
    expect(res.status).toBe(201);
    expect(res.json.gameId).toBe('hyderabad-tycoon');
    expect(res.json.code).toMatch(/^[A-Z0-9]{6}$/);
    const [, code, path, payload] = roomCallMock.mock.calls[0];
    expect(path).toBe('/init');
    expect(payload).toMatchObject({
      code: res.json.code,
      gameId: 'hyderabad-tycoon',
      visibility: 'private',
      maxPlayers: 4,
      host: { id: ME, name: 'Me', avatar: 3, guest: false },
      settings: { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true },
    });
    expect(code).toBe(res.json.code);
  });

  it('passes gameId, visibility, seats and validated settings to the room', async () => {
    roomCallMock.mockResolvedValue({ status: 201, data: {} });
    const res = await call('/api/rooms', {
      method: 'POST',
      cookie: await cookieFor(ME),
      body: { gameId: 'hyderabad-tycoon', visibility: 'public', maxPlayers: 3, settings: { goal: 40000, maxRounds: null } },
    });
    expect(res.status).toBe(201);
    expect(roomCallMock.mock.calls[0][3]).toMatchObject({ visibility: 'public', maxPlayers: 3, settings: { goal: 40000, maxRounds: null } });
  });

  it('refuses unknown games and bad input with 400 (the room is never created)', async () => {
    const cookie = await cookieFor(ME);
    const unknown = await call('/api/rooms', { method: 'POST', cookie, body: { gameId: 'ludo' } });
    expect(unknown.status).toBe(400);
    expect(unknown.json).toEqual({ error: 'unknown game' });
    for (const body of [
      { visibility: 'friends' },
      { maxPlayers: 9 },
      { settings: { goal: 5 } },
      { settings: { maxRounds: 120 } },
      { settings: 'x' },
      { gameId: 7 },
    ]) {
      const r = await call('/api/rooms', { method: 'POST', cookie, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(typeof r.json.error).toBe('string');
    }
    expect(roomCallMock).not.toHaveBeenCalled();
  });

  it('retries another code when one is taken, and reports a failing room as 502', async () => {
    const cookie = await cookieFor(ME);
    roomCallMock.mockResolvedValueOnce({ status: 409, data: {} }).mockResolvedValueOnce({ status: 201, data: {} });
    expect((await call('/api/rooms', { method: 'POST', cookie, body: {} })).status).toBe(201);
    expect(roomCallMock).toHaveBeenCalledTimes(2);
    roomCallMock.mockReset();
    roomCallMock.mockResolvedValue({ status: 500, data: { error: 'nope' } });
    expect((await call('/api/rooms', { method: 'POST', cookie, body: {} })).status).toBe(502);
  });
});

describe('GET /api/rooms/:code', () => {
  it('adds gameId, visibility and settings', async () => {
    roomCallMock.mockResolvedValue({
      status: 200,
      data: { exists: true, status: 'lobby', players: 2, maxPlayers: 4, hostName: 'Host', isMember: true, gameId: 'hyderabad-tycoon', visibility: 'public', settings: { goal: 70000 } },
    });
    const res = await call('/api/rooms/abcd23', { cookie: await cookieFor(ME) });
    expect(res.json).toEqual({
      code: 'ABCD23',
      exists: true,
      status: 'lobby',
      players: 2,
      maxPlayers: 4,
      hostName: 'Host',
      isMember: true,
      gameId: 'hyderabad-tycoon',
      visibility: 'public',
      settings: { goal: 70000 },
    });
    expect(roomCallMock.mock.calls[0].slice(1)).toEqual(['ABCD23', `/info?member=${ME}`]);
  });

  it('a room that does not exist keeps the old shape (+ nulls)', async () => {
    roomCallMock.mockResolvedValue({ status: 200, data: { exists: false } });
    const res = await call('/api/rooms/ABCD23');
    expect(res.json).toMatchObject({ exists: false, status: null, players: 0, maxPlayers: 0, hostName: null, isMember: false, gameId: null, visibility: null, settings: null });
    expect((await call('/api/rooms/nope')).status).toBe(400);
  });
});

describe('POST /api/invites', () => {
  it('inviteMessage names the game', () => {
    expect(inviteMessage({ id: 'u', name: 'N', avatar: 1 }, 'ABCD23', 'hyderabad-tycoon')).toEqual({
      t: 'invite',
      from: { id: 'u', name: 'N', avatar: 1 },
      code: 'ABCD23',
      gameId: 'hyderabad-tycoon',
      gameName: 'Hyderabad Tycoon',
    });
    // rooms created before games existed, and games this build does not know
    expect(inviteMessage({}, 'ABCD23', undefined)).toMatchObject({ gameId: 'hyderabad-tycoon', gameName: 'Hyderabad Tycoon' });
    expect(inviteMessage({}, 'ABCD23', 'ludo')).toMatchObject({ gameId: 'ludo', gameName: 'ludo' });
  });

  it('pushes {t:"invite", from, code, gameId, gameName} to the friend', async () => {
    installDb((text) => (/FROM friendships/.test(text) ? [{ '?column?': 1 }] : undefined));
    roomCallMock.mockResolvedValue({ status: 200, data: { exists: true, isMember: true, status: 'lobby', gameId: 'hyderabad-tycoon' } });
    const res = await call('/api/invites', { method: 'POST', cookie: await cookieFor(ME), body: { code: 'abcd23', userId: FRIEND } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, delivered: true });
    expect(pushMock).toHaveBeenCalledWith(expect.anything(), FRIEND, {
      t: 'invite',
      from: { id: ME, name: 'Me', avatar: 3 },
      code: 'ABCD23',
      gameId: 'hyderabad-tycoon',
      gameName: 'Hyderabad Tycoon',
    });
  });

  it('still refuses strangers, outsiders and started games', async () => {
    const cookie = await cookieFor(ME);
    installDb((text) => (/FROM friendships/.test(text) ? [] : undefined));
    expect((await call('/api/invites', { method: 'POST', cookie, body: { code: 'ABCD23', userId: FRIEND } })).status).toBe(403);
    installDb((text) => (/FROM friendships/.test(text) ? [{ x: 1 }] : undefined));
    roomCallMock.mockResolvedValue({ status: 200, data: { exists: true, isMember: false, status: 'lobby' } });
    expect((await call('/api/invites', { method: 'POST', cookie, body: { code: 'ABCD23', userId: FRIEND } })).status).toBe(403);
    roomCallMock.mockResolvedValue({ status: 200, data: { exists: true, isMember: true, status: 'playing' } });
    expect((await call('/api/invites', { method: 'POST', cookie, body: { code: 'ABCD23', userId: FRIEND } })).status).toBe(409);
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/leaderboard', () => {
  const overallRow = { rank: 1, name: 'Teja', avatar: 2, xp: 250, wins: 4, games: 9, best_score: 99000, rating: 1040 };

  it('no parameter = overall, public, old fields kept (bestWorth)', async () => {
    let q;
    installDb((text, params) => {
      if (/user_game_stats/.test(text) && /ROW_NUMBER/.test(text)) {
        q = { text, params };
        return [overallRow];
      }
      return undefined;
    });
    const res = await call('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(q.text).toMatch(/ORDER BY u\.xp DESC/);
    expect(q.params).toEqual([]);
    expect(res.json.rows[0]).toEqual({ rank: 1, name: 'Teja', avatar: 2, level: 3, wins: 4, games: 9, bestScore: 99000, rating: 1040, bestWorth: 99000 });
    // cached: a second call does not hit the database again
    queryMock.mockClear();
    expect((await call('/api/leaderboard?game=overall')).status).toBe(200);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('?game=<id> ranks that game; unknown games are a 400', async () => {
    let q;
    installDb((text, params) => {
      if (/ROW_NUMBER/.test(text)) {
        q = { text, params };
        return [overallRow];
      }
      return undefined;
    });
    const res = await call('/api/leaderboard?game=hyderabad-tycoon');
    expect(res.status).toBe(200);
    expect(q.params).toEqual(['hyderabad-tycoon']);
    expect(q.text).toMatch(/ORDER BY s\.wins DESC, s\.rating DESC/);
    const bad = await call('/api/leaderboard?game=nope');
    expect(bad.status).toBe(400);
    expect(bad.json).toEqual({ error: 'unknown game' });
  });
});

describe('GET /api/me', () => {
  it('adds gameStats keyed by game id', async () => {
    installDb((text) =>
      /FROM user_game_stats WHERE user_id/.test(text)
        ? [{ game_id: 'hyderabad-tycoon', games: 3, wins: 1, best_score: 80000, rating: 1012 }]
        : undefined,
    );
    const res = await call('/api/me', { cookie: await cookieFor(ME) });
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ id: ME, level: 3, stats: { games: 3, wins: 1, bestWorth: 80000 } });
    expect(res.json.user.gameStats).toEqual({ 'hyderabad-tycoon': { games: 3, wins: 1, bestScore: 80000, rating: 1012 } });
  });

  it('a stats failure never breaks /api/me, and signed-out stays null', async () => {
    installDb((text) => {
      if (/FROM user_game_stats/.test(text)) throw new Error('relation does not exist');
      return undefined;
    });
    const res = await call('/api/me', { cookie: await cookieFor(ME) });
    expect(res.status).toBe(200);
    expect(res.json.user.gameStats).toEqual({});
    expect((await call('/api/me')).json).toEqual({ user: null });
  });
});

describe('GET /api/friends/by-code/:friendCode', () => {
  it('friendRelation', () => {
    expect(friendRelation(undefined, ME)).toBe('none');
    expect(friendRelation({ user_id: ME, status: 'accepted' }, ME)).toBe('friends');
    expect(friendRelation({ user_id: FRIEND, status: 'accepted' }, ME)).toBe('friends');
    expect(friendRelation({ user_id: ME, status: 'pending' }, ME)).toBe('outgoing');
    expect(friendRelation({ user_id: FRIEND, status: 'pending' }, ME)).toBe('incoming');
  });

  const lookup = (rel) =>
    installDb((text, params) => {
      if (/FROM users WHERE friend_code = \$1/.test(text)) return params[0] === 'HYD-FR22' ? [users.get(FRIEND)] : [];
      if (/FROM friendships/.test(text)) return rel ? [rel] : [];
      return undefined;
    });

  it('returns the profile card and my relation to the player', async () => {
    const cookie = await cookieFor(ME);
    lookup(null);
    let res = await call('/api/friends/by-code/hyd-fr22', { cookie });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ user: { id: FRIEND, name: 'Friend', avatar: 3, level: 1, friendCode: 'HYD-FR22', relation: 'none' } });
    lookup({ user_id: ME, status: 'pending' });
    expect((await call('/api/friends/by-code/HYD-FR22', { cookie })).json.user.relation).toBe('outgoing');
    lookup({ user_id: FRIEND, status: 'pending' });
    expect((await call('/api/friends/by-code/HYD-FR22', { cookie })).json.user.relation).toBe('incoming');
    lookup({ user_id: FRIEND, status: 'accepted' });
    expect((await call('/api/friends/by-code/HYD-FR22', { cookie })).json.user.relation).toBe('friends');
  });

  it('members only; bad, unknown and own codes are refused', async () => {
    const cookie = await cookieFor(ME);
    lookup(null);
    expect((await call('/api/friends/by-code/HYD-FR22')).status).toBe(401);
    users.set(ME, userRow(ME, { is_guest: true }));
    expect((await call('/api/friends/by-code/HYD-FR22', { cookie: await cookieFor(ME, true) })).status).toBe(403);
    users.set(ME, userRow(ME));
    expect((await call('/api/friends/by-code/hello!', { cookie })).status).toBe(400);
    expect((await call('/api/friends/by-code/HYD-ZZZZ', { cookie })).status).toBe(404);
    installDb((text, params) => (/FROM users WHERE friend_code = \$1/.test(text) ? [users.get(ME)] : undefined));
    expect((await call('/api/friends/by-code/HYD-ME22', { cookie })).status).toBe(400);
    // a guest's friend code is not a valid target
    installDb((text, params) => (/FROM users WHERE friend_code = \$1/.test(text) ? [userRow(FRIEND, { is_guest: true })] : undefined));
    expect((await call('/api/friends/by-code/HYD-FR22', { cookie })).status).toBe(404);
  });
});
