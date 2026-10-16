// GameRoom must be game-agnostic: this file defines a trivial second game ("Counter Race") inside
// the test, registers it as an adapter and drives the Durable Object through the same code paths
// Hyderabad Tycoon uses. Nothing here knows about properties, dice or auctions.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(ctx, env) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const persisted = [];
vi.mock('./match.js', async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    persistMatch: vi.fn(async (env, rec) => {
      if (persisted.some((r) => r.id === rec.id)) return { inserted: false };
      persisted.push(rec);
      return { inserted: true };
    }),
  };
});

// The listing table is faked: every write is recorded, failures can be injected.
const listing = { rows: [], deletes: [], fail: false };
vi.mock('./roomsdb.js', async (importOriginal) => {
  const orig = await importOriginal();
  return {
    ...orig,
    hasDb: (env) => !!env && !!env.DATABASE_URL,
    upsertRoomRow: vi.fn(async (env, row) => {
      if (listing.fail) throw new Error('neon down');
      listing.rows.push(structuredClone(row));
    }),
    deleteRoomRow: vi.fn(async (env, code) => {
      if (listing.fail) throw new Error('neon down');
      listing.deletes.push(code);
    }),
  };
});

const { GameRoom, TURN_MS } = await import('./GameRoom.js');
const { GAME_ADAPTERS } = await import('./games/index.js');
const { persistMatch } = await import('./match.js');

// ---- the second game ----------------------------------------------------------------------------

const counterRace = {
  id: 'counter-race',
  name: 'Counter Race',
  minPlayers: 2,
  maxPlayers: 3,
  defaultMaxPlayers: 2,
  defaultSettings: { target: 5 },
  validateSettings(raw) {
    const r = raw === undefined || raw === null ? {} : raw;
    if (typeof r !== 'object' || Array.isArray(r)) return { ok: false, error: 'Settings must be an object.' };
    const target = 'target' in r ? r.target : 5;
    if (!Number.isInteger(target) || target < 3 || target > 10) return { ok: false, error: 'Target must be a whole number from 3 to 10.' };
    return { ok: true, settings: { target } };
  },
  summarize: (s) => `First to ${s.target}`,
  createGame({ players, settings, seed }) {
    return {
      phase: 'play',
      turn: 0,
      moves: 0,
      target: settings.target,
      seed,
      winner: null,
      players: players.map((p, i) => ({ id: p.id, name: p.name, isBot: !!p.isBot, count: 0, secret: 100 + i })),
    };
  },
  applyAction(state, action) {
    if (state.phase === 'over') return { state, events: [], error: 'The race is over.' };
    const turn = state.players[state.turn];
    if (action.playerId !== turn.id) return { state, events: [], error: 'Not your turn.' };
    if (action.type !== 'STEP' && action.type !== 'PASS') return { state, events: [], error: 'Unknown action.' };
    const s = structuredClone(state);
    const events = [];
    if (action.type === 'STEP') {
      s.players[s.turn].count += 1;
      events.push({ type: 'step', player: turn.id, count: s.players[s.turn].count });
    } else events.push({ type: 'pass', player: turn.id });
    s.moves += 1;
    if (s.players[s.turn].count >= s.target) {
      s.phase = 'over';
      s.winner = turn.id;
      events.push({ type: 'win', player: turn.id });
    } else s.turn = (s.turn + 1) % s.players.length;
    return { state: s, events };
  },
  nextBotMove(state) {
    const p = state.players[state.turn];
    return state.phase === 'play' && p.isBot ? { type: 'STEP', playerId: p.id } : null;
  },
  turnPlayerId: (state) => (state.phase === 'play' ? state.players[state.turn].id : null),
  // a 10 s shot clock for a human on turn (shorter than the room's 45 s idle timer)
  deadlines(state) {
    if (state.phase !== 'play') return [];
    const p = state.players[state.turn];
    return p.isBot ? [] : [{ key: `clock:${state.moves}`, afterMs: 10_000, playerId: p.id, action: { type: 'PASS', playerId: p.id } }];
  },
  idleAction: (state, id) => (state.phase === 'play' && state.players[state.turn].id === id ? { type: 'STEP', playerId: id } : null),
  isOver: (state) => state.phase === 'over',
  result(state) {
    const order = [...state.players].sort((a, b) => b.count - a.count);
    return {
      winnerId: state.winner,
      reason: 'target',
      rounds: state.moves,
      standings: order.map((p, i) => ({ id: p.id, rank: i + 1, score: p.count })),
    };
  },
  // every viewer gets a fresh object in which the other players' secrets are hidden
  redact: (state, viewerId) => ({ ...state, players: state.players.map((p) => (p.id === viewerId ? p : { ...p, secret: null })) }),
  rivals: (count, taken = []) => {
    const out = [];
    for (let i = 1; out.length < count; i += 1) if (!taken.includes(`Robo ${i}`)) out.push({ name: `Robo ${i}`, avatar: i % 12 });
    return out;
  },
};

// ---- fakes (same shape as room.test.js) -------------------------------------------------------------

class FakeSocket {
  constructor() {
    this.readyState = 1;
    this.sent = [];
    this.att = null;
    this.tags = [];
    this.closeCode = null;
  }
  send(m) {
    this.sent.push(JSON.parse(m));
  }
  close(code) {
    this.readyState = 3;
    this.closeCode = code;
  }
  serializeAttachment(v) {
    this.att = structuredClone(v);
  }
  deserializeAttachment() {
    return this.att;
  }
  of(type) {
    return this.sent.filter((m) => m.t === type);
  }
  last(type) {
    return this.of(type).at(-1);
  }
}

class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.webSocket = init.webSocket;
  }
  async json() {
    return JSON.parse(this.body);
  }
}

function makeCtx() {
  const store = new Map();
  const sockets = [];
  const ctx = {
    alarmAt: null,
    store,
    sockets,
    storage: {
      get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined),
      put: async (k, v) => void store.set(k, structuredClone(v)),
      setAlarm: async (t) => void (ctx.alarmAt = t),
      deleteAlarm: async () => void (ctx.alarmAt = null),
      deleteAll: async () => store.clear(),
    },
    blockConcurrencyWhile: async (fn) => fn(),
    setWebSocketAutoResponse() {},
    acceptWebSocket(ws, tags = []) {
      ws.tags = tags;
      sockets.push(ws);
    },
    getWebSockets(tag) {
      return tag ? sockets.filter((s) => s.tags.includes(tag)) : [...sockets];
    },
  };
  return ctx;
}

const U = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const user = (n, name = `P${n}`) => ({ id: U(n), name, avatar: n % 12 });

class Harness {
  constructor(env = {}, ctx = makeCtx()) {
    this.ctx = ctx;
    this.env = env;
    this.room = new GameRoom(this.ctx, env);
  }
  async init(body = {}, host = user(1)) {
    return this.room.fetch({ url: 'https://x/init', method: 'POST', headers: new Headers(), json: async () => ({ code: 'RACE22', host, ...body }) });
  }
  async connect(u) {
    const headers = new Headers({
      Upgrade: 'websocket',
      'X-User-Id': u.id,
      'X-User-Name': encodeURIComponent(u.name),
      'X-User-Avatar': String(u.avatar),
      'X-User-Guest': '0',
    });
    const before = this.ctx.sockets.length;
    const res = await this.room.fetch({ url: 'https://x/ws', method: 'GET', headers });
    expect(res.status).toBe(101);
    return this.ctx.sockets[before] || this.ctx.sockets.at(-1);
  }
  say(ws, msg) {
    return this.room.webSocketMessage(ws, JSON.stringify(msg));
  }
  async info(member) {
    return (await this.room.fetch({ url: `https://x/info${member ? `?member=${member}` : ''}`, method: 'GET', headers: new Headers() })).json();
  }
  async tick() {
    const at = this.ctx.alarmAt;
    if (at == null) return false;
    vi.setSystemTime(Math.max(Date.now(), at));
    await this.room.alarm();
    return true;
  }
  flush() {
    return this.room.listingChain;
  }
  /** The real runtime blocks until the constructor's storage load is done; the fake does not. */
  async loaded() {
    await new Promise((r) => setImmediate(r));
    return this;
  }
  get r() {
    return this.room.room;
  }
}

beforeEach(() => {
  GAME_ADAPTERS['counter-race'] = counterRace;
  vi.stubGlobal('WebSocketPair', class {
    constructor() {
      this[0] = new FakeSocket();
      this[1] = new FakeSocket();
    }
  });
  vi.stubGlobal('Response', FakeResponse);
  vi.stubGlobal('WebSocketRequestResponsePair', class {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z').getTime());
  persisted.length = 0;
  persistMatch.mockClear();
  listing.rows.length = 0;
  listing.deletes.length = 0;
  listing.fail = false;
});

afterEach(() => {
  delete GAME_ADAPTERS['counter-race'];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const started = async (settings = { target: 3 }) => {
  const h = new Harness();
  expect((await h.init({ gameId: 'counter-race', settings })).status).toBe(201);
  const host = await h.connect(user(1));
  await h.say(host, { t: 'addBot' });
  await h.say(host, { t: 'start' });
  h.host = host;
  return h;
};

describe('a second game through the same room', () => {
  it('creates a room for the adapter chosen by gameId, with its own defaults and validation', async () => {
    const h = new Harness();
    const res = await h.init({ gameId: 'counter-race' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ code: 'RACE22', gameId: 'counter-race' });
    expect(h.r).toMatchObject({ gameId: 'counter-race', visibility: 'private', maxPlayers: 2, settings: { target: 5 } });
    expect(await h.info(U(1))).toMatchObject({ exists: true, gameId: 'counter-race', visibility: 'private', settings: { target: 5 }, maxPlayers: 2, isMember: true });

    const bad = [
      [{ gameId: 'nope' }, /unknown game/],
      [{ gameId: 'counter-race', settings: { target: 99 } }, /Target must be/],
      [{ gameId: 'counter-race', maxPlayers: 4 }, /Players must be between 2 and 3/],
      [{ gameId: 'counter-race', visibility: 'secret' }, /Visibility/],
    ];
    for (const [body, msg] of bad) {
      const r = await new Harness().init(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect((await r.json()).error).toMatch(msg);
    }
    // a request without gameId is the original game (it validates against Tycoon's settings)
    const tycoon = new Harness();
    expect((await tycoon.init({ settings: { goal: 40000 } })).status).toBe(201);
    expect(tycoon.r.gameId).toBe('hyderabad-tycoon');
  });

  it('lobby: the room payload carries gameId + visibility; settings, seats and bots follow the adapter', async () => {
    const h = new Harness();
    await h.init({ gameId: 'counter-race', maxPlayers: 3 });
    const host = await h.connect(user(1));
    const guest = await h.connect(user(2));
    expect(host.last('room').room).toMatchObject({ gameId: 'counter-race', visibility: 'private', maxPlayers: 3, settings: { target: 5 } });

    await h.say(guest, { t: 'settings', settings: { target: 4 } });
    expect(guest.last('error').message).toMatch(/host/);
    await h.say(host, { t: 'settings', settings: { target: 99 } });
    expect(host.last('error').message).toMatch(/Target must be/);
    await h.say(host, { t: 'settings', settings: { target: 7 } });
    expect(guest.last('room').room.settings).toEqual({ target: 7 });
    await h.say(host, { t: 'settings', settings: { maxPlayers: 4 } });
    expect(host.last('error').message).toMatch(/Players must be between 2 and 3/);
    await h.say(host, { t: 'settings', settings: { maxPlayers: 2 } });
    expect(host.last('room').room.maxPlayers).toBe(2);
    expect(host.last('room').room.settings).toEqual({ target: 7 }); // seats are not a game setting
    await h.say(host, { t: 'settings', settings: 'target' });
    expect(host.last('error').message).toMatch(/object/);

    await h.say(host, { t: 'kick', id: U(2) });
    await h.say(host, { t: 'addBot' });
    const bot = host.last('room').room.players.find((p) => p.isBot);
    expect(bot.name).toBe('Robo 1'); // the adapter's roster, not Tycoon's
    await h.say(host, { t: 'addBot' });
    expect(host.last('error').message).toMatch(/full/);
  });

  it('visibility: host only, lobby only, validated, and broadcast to everyone', async () => {
    const h = new Harness();
    await h.init({ gameId: 'counter-race' });
    const host = await h.connect(user(1));
    const guest = await h.connect(user(2));
    await h.say(guest, { t: 'visibility', visibility: 'public' });
    expect(guest.last('error').message).toMatch(/host/);
    for (const bad of ['secret', 'PUBLIC', 5, null, undefined]) {
      const before = host.of('error').length;
      await h.say(host, { t: 'visibility', visibility: bad });
      expect(host.of('error').length, String(bad)).toBe(before + 1);
    }
    expect(h.r.visibility).toBe('private');
    await h.say(host, { t: 'visibility', visibility: 'public' });
    expect(h.r.visibility).toBe('public');
    expect(host.last('room').room.visibility).toBe('public');
    expect(guest.last('room').room.visibility).toBe('public');
    expect((await h.info()).visibility).toBe('public');
    await h.say(host, { t: 'visibility', visibility: 'private' });
    expect(guest.last('room').room.visibility).toBe('private');

    await h.say(host, { t: 'start' });
    await h.say(host, { t: 'visibility', visibility: 'public' });
    expect(host.last('error').message).toMatch(/locked/);
    expect(h.r.visibility).toBe('private');
  });

  it('start rules come from the adapter; each viewer gets their own redacted copy of the state', async () => {
    const h = new Harness();
    await h.init({ gameId: 'counter-race', maxPlayers: 3 });
    const host = await h.connect(user(1));
    await h.say(host, { t: 'start' });
    expect(host.last('error').message).toMatch(/at least 2/);
    const guest = await h.connect(user(2));
    await h.say(host, { t: 'start' });
    expect(h.r.status).toBe('playing');
    expect(h.r.state.target).toBe(5);
    const seen = (ws, id) => ws.last('state').state.players.find((p) => p.id === id).secret;
    // secrets are hidden from everyone but their owner, in the very first state message
    expect(seen(host, U(1))).toEqual(expect.any(Number));
    expect(seen(host, U(2))).toBeNull();
    expect(seen(guest, U(2))).toEqual(expect.any(Number));
    expect(seen(guest, U(1))).toBeNull();
    // and after an action, and on reconnect
    const turnId = h.r.state.players[h.r.state.turn].id;
    const mover = turnId === U(1) ? host : guest;
    await h.say(mover, { t: 'action', action: { type: 'STEP' } });
    expect(seen(host, U(2))).toBeNull();
    const again = await h.connect(user(2));
    expect(again.last('state').state.players.find((p) => p.id === U(1)).secret).toBeNull();
    expect(h.r.state.players.every((p) => typeof p.secret === 'number')).toBe(true); // the stored copy is intact
  });

  it('actions: playerId is forced to the sender, junk is refused, the adapter judges legality', async () => {
    const h = new Harness();
    await h.init({ gameId: 'counter-race' });
    const a = await h.connect(user(1));
    const b = await h.connect(user(2));
    await h.say(a, { t: 'start' });
    const first = h.r.state.players[h.r.state.turn].id;
    const [mover, other] = first === U(1) ? [a, b] : [b, a];
    const otherId = first === U(1) ? U(2) : U(1);
    await h.say(other, { t: 'action', action: { type: 'STEP', playerId: first } }); // spoof the mover
    expect(other.last('error').message).toBe('Not your turn.');
    await h.say(mover, { t: 'action', action: { type: 'STEP', playerId: otherId } }); // spoof: still applied as the sender
    expect(mover.last('state').events).toEqual([{ type: 'step', player: first, count: 1 }]);
    expect(h.r.seq).toBe(2);
    await h.say(other, { t: 'action', action: 'STEP' });
    expect(other.last('error').message).toBe('Invalid action.');
    await h.say(other, { t: 'action', action: { type: 'EXPLODE' } });
    expect(other.last('error').message).toBe('Unknown action.');
    await h.say(other, { t: 'chat', emote: 'emote_mass' }); // this game has no soundboard
    expect(other.of('chat')).toHaveLength(0);
    await h.say(other, { t: 'chat', text: 'gl hf' });
    expect(other.last('chat').text).toBe('gl hf');
  });

  it('timers: the adapter deadline beats the idle timer, bots follow nextBotMove, the game ends through isOver/result', async () => {
    const h = await started({ target: 3 });
    // the human is on turn (or the bot moves first)
    for (let i = 0; i < 20 && h.r.state.players[h.r.state.turn].isBot; i += 1) await h.tick();
    const mover = h.r.state.players[h.r.state.turn];
    expect(mover.id).toBe(U(1));
    const plan = h.room.plan();
    expect(plan.action).toEqual({ type: 'PASS', playerId: U(1) }); // the 10 s shot clock, not the 45 s idle STEP
    expect(plan.timeout).toBe(false);
    expect(plan.at).toBe(h.r.lastApplyAt + h.r.animMs + 10_000);
    expect(plan.at).toBeLessThan(h.r.lastApplyAt + TURN_MS);
    expect(Object.keys(h.r.deadlines)).toEqual([`clock:${h.r.state.moves}`]);
    // nothing before the deadline
    const seq = h.r.seq;
    vi.setSystemTime(plan.at - 1000);
    await h.room.alarm();
    expect(h.r.seq).toBe(seq);
    // at the deadline the PASS is applied; the human is NOT flagged idle (deadlines do not count as idling)
    await h.tick();
    expect(h.host.last('state').events[0]).toEqual({ type: 'pass', player: U(1) });
    expect(h.r.afk[U(1)]).toBeUndefined();
    // let it play to the end: bots step on their own, the human is eventually flagged idle and auto-stepped
    let steps = 0;
    while (h.r.status === 'playing' && steps < 200) {
      await h.tick();
      steps += 1;
    }
    expect(h.r.status).toBe('finished');
    expect(h.room.adapter.isOver(h.r.state)).toBe(true);
    for (let i = 0; i < 5 && !h.r.persisted; i += 1) await h.tick();
    expect(h.r.persisted).toBe(true);
    expect(persistMatch).toHaveBeenCalledTimes(1);
    const rec = persisted[0];
    expect(rec).toMatchObject({ gameId: 'counter-race', roomCode: 'RACE22', playerCount: 2, winReason: 'target', goal: null, maxRounds: null, diceMode: null });
    expect(rec.players.map((p) => p.rank).sort()).toEqual([1, 2]);
    expect(rec.players.find((p) => p.is_bot).user_id).toBeNull();
    expect(rec.users).toHaveLength(1);
    expect(rec.users[0]).toMatchObject({ user_id: U(1), lg: 0, lw: 0, lworth: 0, lrent: 0 }); // no legacy Tycoon columns
    expect(rec.seats).toHaveLength(2);
  });

  it('leaving a running game does nothing special when the adapter has no resign action; the game still ends', async () => {
    const h = new Harness();
    await h.init({ gameId: 'counter-race', maxPlayers: 3 });
    const a = await h.connect(user(1));
    const b = await h.connect(user(2));
    await h.say(a, { t: 'start' });
    await h.say(b, { t: 'leave' });
    expect(h.r.status).toBe('playing');
    expect(h.r.players.find((p) => p.id === U(2)).left).toBe(true);
    let steps = 0;
    while (h.r.status === 'playing' && steps < 400) {
      await h.tick();
      steps += 1;
    }
    expect(h.r.status).toBe('finished');
  });
});

describe('listing rows (the rooms table)', () => {
  const env = { DATABASE_URL: 'postgres://fake' };

  it('upserts on create / join / settings / visibility / start / finish and deletes on expiry', async () => {
    const h = new Harness(env);
    await h.init({ gameId: 'counter-race', settings: { target: 3 }, visibility: 'public' });
    await h.flush();
    expect(listing.rows.at(-1)).toMatchObject({
      code: 'RACE22',
      gameId: 'counter-race',
      hostId: U(1),
      hostName: 'P1',
      visibility: 'public',
      status: 'lobby',
      playerCount: 1,
      maxPlayers: 2,
      settings: { target: 3 },
      memberIds: [U(1)],
    });
    const host = await h.connect(user(1));
    await h.flush();
    expect(listing.rows).toHaveLength(1); // reconnecting changes nothing: no rewrite
    await h.say(host, { t: 'chat', text: 'hi' });
    await h.flush();
    expect(listing.rows).toHaveLength(1);

    await h.say(host, { t: 'addBot' });
    await h.flush();
    expect(listing.rows.at(-1)).toMatchObject({ playerCount: 2, memberIds: [U(1)] });
    await h.say(host, { t: 'settings', settings: { target: 6 } });
    await h.flush();
    expect(listing.rows.at(-1).settings).toEqual({ target: 6 });
    await h.say(host, { t: 'visibility', visibility: 'private' });
    await h.flush();
    expect(listing.rows.at(-1).visibility).toBe('private');
    await h.say(host, { t: 'start' });
    await h.flush();
    expect(listing.rows.at(-1).status).toBe('playing');
    let steps = 0;
    while (h.r.status === 'playing' && steps < 200) {
      await h.tick();
      steps += 1;
    }
    await h.flush();
    expect(listing.rows.at(-1).status).toBe('finished');
    expect(listing.deletes).toEqual([]);

    vi.setSystemTime(Date.now() + 25 * 3600 * 1000);
    await h.room.alarm();
    await h.flush();
    expect(h.room.room).toBeNull();
    expect(listing.deletes).toEqual(['RACE22']);
  });

  it('a joining player becomes a member; leaving removes them; an empty lobby leaves the listing', async () => {
    const h = new Harness(env);
    await h.init({ gameId: 'counter-race', maxPlayers: 3 });
    const host = await h.connect(user(1));
    const guest = await h.connect(user(2));
    await h.flush();
    expect(listing.rows.at(-1)).toMatchObject({ playerCount: 2, memberIds: [U(1), U(2)] });
    await h.say(guest, { t: 'leave' });
    await h.flush();
    expect(listing.rows.at(-1)).toMatchObject({ playerCount: 1, memberIds: [U(1)] });
    await h.say(host, { t: 'leave' });
    await h.flush();
    expect(listing.deletes).toEqual(['RACE22']);
  });

  it('a failing database never breaks the room, and the next change retries', async () => {
    listing.fail = true;
    const h = new Harness(env);
    expect((await h.init({ gameId: 'counter-race' })).status).toBe(201);
    const host = await h.connect(user(1));
    await h.say(host, { t: 'addBot' });
    await h.flush();
    expect(host.last('room').room.players).toHaveLength(2); // the room carried on
    expect(listing.rows).toHaveLength(0);
    listing.fail = false;
    await h.say(host, { t: 'visibility', visibility: 'public' });
    await h.flush();
    expect(listing.rows.at(-1)).toMatchObject({ visibility: 'public', playerCount: 2 });
  });

  it('a public lobby refreshes its row on a 20 minute heartbeat; private ones need no alarm for it', async () => {
    const h = new Harness(env);
    await h.init({ gameId: 'counter-race', visibility: 'public' });
    await h.connect(user(1));
    await h.flush();
    const writes = listing.rows.length;
    expect(h.ctx.alarmAt).toBeLessThanOrEqual(Date.now() + 20 * 60 * 1000 + 50);
    vi.setSystemTime(Date.now() + 21 * 60 * 1000);
    await h.room.alarm();
    await h.flush();
    expect(listing.rows.length).toBe(writes + 1);

    const p = new Harness(env);
    await p.init({ gameId: 'counter-race' });
    await p.connect(user(1));
    expect(p.ctx.alarmAt).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
  });

  it('without a database nothing is written', async () => {
    const h = new Harness({});
    await h.init({ gameId: 'counter-race' });
    await h.connect(user(1));
    await h.flush();
    expect(listing.rows).toHaveLength(0);
  });
});

describe('rooms stored by the previous version keep working', () => {
  const oldRecord = (over = {}) => ({
    v: 1,
    code: 'OLD222',
    status: 'lobby',
    hostId: U(1),
    maxPlayers: 4,
    settings: { goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true },
    players: [{ id: U(1), name: 'P1', avatar: 1, ready: true, isBot: false, guest: false }],
    state: null,
    seq: 0,
    matchId: null,
    startedAt: null,
    endedAt: null,
    persisted: false,
    abandoned: false,
    persistAttempts: 0,
    persistAt: null,
    lastActivity: Date.now(),
    createdAt: Date.now(),
    lastApplyAt: Date.now(),
    animMs: 0,
    tradeId: null,
    tradeAt: 0,
    hotels: {},
    afk: {},
    disc: {},
    banned: {},
    noHumanSince: null,
    ...over,
  });

  it('a record without gameId / visibility is a private Hyderabad Tycoon room', async () => {
    const ctx = makeCtx();
    ctx.store.set('room', oldRecord());
    const h = await new Harness({}, ctx).loaded();
    expect(h.r).toMatchObject({ gameId: 'hyderabad-tycoon', visibility: 'private', meta: {}, deadlines: {} });
    expect(h.r.tradeId).toBeUndefined();
    expect(h.r.hotels).toBeUndefined();
    const host = await h.connect(user(1));
    expect(host.last('room').room).toMatchObject({ gameId: 'hyderabad-tycoon', visibility: 'private', status: 'lobby' });
    expect(host.last('room').room.settings).toMatchObject({ goal: 70000, passStart: expect.any(Number) });
  });

  it('a game in flight keeps its hotel counts and its trade clock', async () => {
    const ctx = makeCtx();
    ctx.store.set('room', oldRecord({ tradeId: 4, tradeAt: 1234, hotels: { [U(1)]: 2 } }));
    const h = await new Harness({}, ctx).loaded();
    expect(h.r.meta).toEqual({ hotels: { [U(1)]: 2 } });
    expect(h.r.deadlines).toEqual({ 'trade:4': 1234 });
  });

  it('a room whose game is no longer registered refuses sockets politely and expires normally', async () => {
    const ctx = makeCtx();
    ctx.store.set('room', oldRecord({ gameId: 'retired-game' }));
    const h = await new Harness({}, ctx).loaded();
    expect(h.room.adapter).toBeNull();
    const res = await h.room.fetch({
      url: 'https://x/ws',
      method: 'GET',
      headers: new Headers({ Upgrade: 'websocket', 'X-User-Id': U(1), 'X-User-Name': 'x', 'X-User-Avatar': '0' }),
    });
    expect(res.status).toBe(101);
    expect(ctx.sockets[0].closeCode).toBe(4004);
    expect(ctx.sockets[0].last('error').message).toMatch(/no longer available/);
    await expect(h.room.alarm()).resolves.toBeUndefined();
    expect((await h.info()).gameId).toBe('retired-game');
  });
});
