// In-process tests of the GameRoom Durable Object logic with a fake DO context: lobby rules,
// strict settings, auto-play timers, reconnection, exactly-once persistence. No Workers runtime
// needed; the real runtime is exercised separately with `wrangler dev`.
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
      if (persisted.some((r) => r.id === rec.id)) return { inserted: false }; // same guard the SQL has
      persisted.push(rec);
      return { inserted: true };
    }),
  };
});

const { GameRoom, pendingActors, estimateAnimMs, autoMove, TURN_MS, GRACE_MS, TRADE_MS } = await import('./GameRoom.js');
const { persistMatch } = await import('./match.js');
const engine = await import('../shared/index.js');

// ---- fakes ---------------------------------------------------------------------------

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
      const live = sockets.filter((s) => s.readyState !== 3 || true);
      return tag ? live.filter((s) => s.tags.includes(tag)) : [...live];
    },
  };
  return ctx;
}

const U = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const user = (n, name = `P${n}`) => ({ id: U(n), name, avatar: n % 12 });
let t0;

class Harness {
  constructor() {
    this.ctx = makeCtx();
    this.room = new GameRoom(this.ctx, {});
  }
  async init(host = user(1), settings = {}, maxPlayers = 4) {
    const res = await this.room.fetch({ url: 'https://x/init', method: 'POST', headers: new Headers(), json: async () => ({ code: 'ABCD23', host, settings, maxPlayers }) });
    return res;
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
  async say(ws, msg) {
    await this.room.webSocketMessage(ws, JSON.stringify(msg));
  }
  async close(ws) {
    ws.readyState = 3;
    await this.room.webSocketClose(ws, 1000);
  }
  async info(member) {
    const res = await this.room.fetch({ url: `https://x/info${member ? `?member=${member}` : ''}`, method: 'GET', headers: new Headers() });
    return res.json();
  }
  /** Advance the fake clock to the scheduled alarm and run it. */
  async tick() {
    const at = this.ctx.alarmAt;
    if (at == null) return false;
    vi.setSystemTime(Math.max(Date.now(), at));
    await this.room.alarm();
    return true;
  }
  get state() {
    return this.room.room.state;
  }
}

beforeEach(() => {
  vi.stubGlobal('WebSocketPair', class {
    constructor() {
      const a = new FakeSocket();
      const b = new FakeSocket();
      this[0] = a;
      this[1] = b;
    }
  });
  vi.stubGlobal('Response', FakeResponse);
  vi.stubGlobal('WebSocketRequestResponsePair', class {});
  vi.useFakeTimers({ toFake: ['Date'] });
  t0 = new Date('2026-10-16T10:00:00Z').getTime();
  vi.setSystemTime(t0);
  persisted.length = 0;
  persistMatch.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// The server's WebSocketPair gives [client, server]; the harness reads the *server* side via ctx.sockets.
// FakeSocket for server is the second of each pair; accepted ones are recorded in ctx.sockets.

describe('pure helpers', () => {
  it('estimateAnimMs adds up dice + steps and is capped', () => {
    expect(estimateAnimMs([])).toBe(0);
    expect(estimateAnimMs([{ type: 'dice' }, { type: 'move', path: [1, 2, 3] }])).toBe(900 + 170 * 3);
    expect(estimateAnimMs([{ type: 'move', path: new Array(500).fill(1) }])).toBeLessThanOrEqual(6000);
  });

  it('pendingActors: turn player / auction bidders / debtor / trade recipient', () => {
    const base = engine.createGame({
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C', isBot: true }],
      seed: 1,
    });
    expect(pendingActors(base)).toEqual(['a']);
    const auction = { ...base, phase: 'auction', pending: { type: 'auction', tile: 1, minBid: 10, bids: { b: 0 } } };
    expect(pendingActors(auction)).toEqual(['a', 'c']);
    const debt = { ...base, phase: 'debt', debt: { player: 'b', amount: 100, creditor: null, reason: 'tax' } };
    expect(pendingActors(debt)).toEqual(['b']);
    const trade = { ...base, trade: { id: 't1', from: 'a', to: 'b', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } } };
    expect(pendingActors(trade)).toEqual(['b']);
    const bankruptRecipient = { ...trade, players: trade.players.map((p) => (p.id === 'b' ? { ...p, bankrupt: true } : p)) };
    expect(pendingActors(bankruptRecipient)).toEqual([]);
    expect(pendingActors({ ...base, phase: 'over' })).toEqual([]);
  });

  it('autoMove picks a legal move for a human in the roll phase', () => {
    const s = engine.createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed: 5 });
    const a = autoMove(s, 'a');
    expect(a).toMatchObject({ type: 'ROLL', playerId: 'a' });
    expect(engine.applyAction(s, a).error).toBeUndefined();
    expect(autoMove(s, 'b')).toBeNull(); // not b's turn
  });
});

describe('lobby', () => {
  it('creates a room, enforces 409 on reuse and answers /info', async () => {
    const h = new Harness();
    expect((await h.init()).status).toBe(201);
    expect((await h.init()).status).toBe(409);
    const info = await h.info(U(1));
    expect(info).toMatchObject({ exists: true, status: 'lobby', players: 1, maxPlayers: 4, isMember: true });
    expect((await h.info(U(2))).isMember).toBe(false);
  });

  it('rejects a bad init (settings are validated again inside the room)', async () => {
    const h = new Harness();
    const res = await h.init(user(1), { maxRounds: 120 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Round limit/);
    const h2 = new Harness();
    expect((await h2.init(user(1), { goal: 5 })).status).toBe(400);
  });

  it('unknown rooms close with 4004', async () => {
    const h = new Harness();
    const res = await h.room.fetch({
      url: 'https://x/ws',
      method: 'GET',
      headers: new Headers({ Upgrade: 'websocket', 'X-User-Id': U(1), 'X-User-Name': 'x', 'X-User-Avatar': '0' }),
    });
    expect(res.status).toBe(101);
    const ws = h.ctx.sockets[0];
    expect(ws.closeCode).toBe(4004);
    expect(ws.last('error').message).toMatch(/does not exist/);
  });

  it('host settings are strict and host-only; defaults are normalised into room.settings', async () => {
    const h = new Harness();
    await h.init();
    const host = await h.connect(user(1));
    expect(host.last('room').room.settings).toMatchObject({ goal: 70000, startCash: 15000, maxRounds: 50, dice: 'lucky', auctionOnDecline: true });
    const guest = await h.connect(user(2));

    await h.say(guest, { t: 'settings', settings: { goal: 30000 } });
    expect(guest.last('error').message).toMatch(/host/);

    for (const bad of [{ goal: 5 }, { maxRounds: 120 }, { maxRounds: 0 }, { maxRounds: '30' }, { startCash: 1 }, { dice: 'loaded' }, { auctionOnDecline: 'yes' }]) {
      const before = host.of('error').length;
      await h.say(host, { t: 'settings', settings: bad });
      expect(host.of('error').length, JSON.stringify(bad)).toBe(before + 1);
    }
    expect(h.room.room.settings).toMatchObject({ goal: 70000, maxRounds: 50 });

    await h.say(host, { t: 'settings', settings: { goal: 100000, maxRounds: null, startCash: 20000, dice: 'fair', auctionOnDecline: false, debug: true } });
    const s = host.last('room').room.settings;
    expect(s).toMatchObject({ goal: 100000, maxRounds: null, startCash: 20000, dice: 'fair', auctionOnDecline: false });
    expect(s.debug).toBeUndefined();
    expect(guest.last('room').room.settings.maxRounds).toBeNull();
  });

  it('bots, kick, ready, capacity and start rules', async () => {
    const h = new Harness();
    await h.init(user(1), {}, 3);
    const host = await h.connect(user(1));
    const p2 = await h.connect(user(2));

    await h.say(p2, { t: 'start' });
    expect(p2.last('error').message).toMatch(/host/);
    await h.say(p2, { t: 'addBot' });
    expect(p2.last('error').message).toMatch(/host/);

    await h.say(p2, { t: 'ready', ready: true });
    expect(host.last('room').room.players.find((p) => p.id === U(2)).ready).toBe(true);
    await h.say(p2, { t: 'ready', ready: 'yes' });
    expect(p2.last('error').message).toMatch(/ready/i);

    await h.say(host, { t: 'addBot' });
    const players = host.last('room').room.players;
    expect(players).toHaveLength(3);
    const bot = players.find((p) => p.isBot);
    expect(bot).toMatchObject({ ready: true, connected: true });

    await h.say(host, { t: 'addBot' }); // full (3)
    expect(host.last('error').message).toMatch(/full/);
    // a 4th person cannot join
    const res = await h.room.fetch({
      url: 'https://x/ws',
      method: 'GET',
      headers: new Headers({ Upgrade: 'websocket', 'X-User-Id': U(3), 'X-User-Name': 'z', 'X-User-Avatar': '0' }),
    });
    expect(res.status).toBe(101);
    expect(h.ctx.sockets.at(-1).closeCode).toBe(4003);

    await h.say(host, { t: 'removeBot', id: bot.id });
    expect(host.last('room').room.players).toHaveLength(2);
    await h.say(host, { t: 'removeBot', id: U(2) }); // not a bot
    expect(host.last('error').message).toMatch(/bot/);

    await h.say(host, { t: 'kick', id: U(1) });
    expect(host.last('error').message).toMatch(/yourself/);
    await h.say(host, { t: 'kick', id: U(2) });
    expect(p2.of('kicked')).toHaveLength(1);
    expect(p2.closeCode).toBe(4003);
    expect(host.last('room').room.players).toHaveLength(1);
    // kicked users cannot walk straight back in
    const again = await h.room.fetch({
      url: 'https://x/ws',
      method: 'GET',
      headers: new Headers({ Upgrade: 'websocket', 'X-User-Id': U(2), 'X-User-Name': 'P2', 'X-User-Avatar': '2' }),
    });
    expect(again.status).toBe(101);
    expect(h.ctx.sockets.at(-1).closeCode).toBe(4003);

    await h.say(host, { t: 'start' });
    expect(host.last('error').message).toMatch(/at least 2/);
  });

  it('chat is rate limited (700 ms), length capped, emotes whitelisted', async () => {
    const h = new Harness();
    await h.init();
    const host = await h.connect(user(1));
    await h.say(host, { t: 'chat', text: 'hello' });
    await h.say(host, { t: 'chat', text: 'flood' }); // same instant: dropped
    expect(host.of('chat')).toHaveLength(1);
    vi.setSystemTime(Date.now() + 800);
    await h.say(host, { t: 'chat', text: 'x'.repeat(500) });
    expect(host.of('chat')).toHaveLength(2);
    expect(host.last('chat').text).toHaveLength(200);
    expect(host.last('chat')).toMatchObject({ from: U(1), emote: '' });
    vi.setSystemTime(Date.now() + 800);
    await h.say(host, { t: 'chat', emote: 'emote_mass' });
    expect(host.last('chat').emote).toBe('emote_mass');
    vi.setSystemTime(Date.now() + 800);
    await h.say(host, { t: 'chat', emote: 'emote_nope' });
    expect(host.of('chat')).toHaveLength(3); // nothing to send -> ignored
  });

  it('validates message shapes and sizes', async () => {
    const h = new Harness();
    await h.init();
    const host = await h.connect(user(1));
    await h.room.webSocketMessage(host, 'not json');
    expect(host.last('error').message).toMatch(/Invalid/);
    await h.room.webSocketMessage(host, JSON.stringify([1, 2]));
    expect(host.last('error').message).toMatch(/Invalid/);
    await h.room.webSocketMessage(host, JSON.stringify({ t: 'chat', text: 'x'.repeat(5000) }));
    expect(host.last('error').message).toMatch(/too large/);
    await h.say(host, { t: 'explode' });
    expect(host.last('error').message).toMatch(/Unknown/);
    await h.say(host, { t: 'ping' });
    expect(host.last('pong')).toBeTruthy();
    await h.room.webSocketMessage(host, new ArrayBuffer(4));
    expect(host.last('error').message).toMatch(/text/);
  });
});

async function startedGame(settings = {}, extra = {}) {
  const h = new Harness();
  await h.init(user(1), settings, extra.maxPlayers || 4);
  const host = await h.connect(user(1));
  await h.say(host, { t: 'addBot' });
  if (extra.second) {
    const p2 = await h.connect(user(2));
    h.p2 = p2;
  }
  await h.say(host, { t: 'start' });
  h.host = host;
  return h;
}

/**
 * Let bots play (and refuse any trade a bot proposes to the human) until it is the human's
 * turn with nothing pending. Bots may propose trades (rules v2), so tests must not assume
 * that "turn == U(1)" means "free to act".
 */
async function toHumanTurn(h, socket) {
  for (let i = 0; i < 300; i += 1) {
    const st = h.state;
    if (st.trade && st.trade.to === U(1)) {
      await h.say(socket, { t: 'action', action: { type: 'TRADE_REJECT' } });
      continue;
    }
    const pending = pendingActors(st);
    // the human's own turn, at its start (roll phase), with nobody else being waited for
    if (!st.trade && st.phase === 'roll' && st.players[st.turn].id === U(1) && pending.length === 1 && pending[0] === U(1)) return;
    if (pending.includes(U(1)) && (st.phase !== 'roll' || st.players[st.turn].id !== U(1))) {
      // the human is needed mid-way (e.g. a sealed bid): play it by hand, like a real player would
      const a = autoMove(st, U(1));
      if (a) {
        await h.say(socket, { t: 'action', action: { type: a.type, tile: a.tile, amount: a.amount } });
        continue;
      }
    }
    await h.tick();
  }
  throw new Error('never reached the human turn');
}

describe('game start', () => {
  it('passes the normalised settings to the engine (state.cfg matches room.settings)', async () => {
    const h = await startedGame({ goal: 50000, startCash: 20000, maxRounds: 30, dice: 'fair', auctionOnDecline: false });
    const cfg = h.state.cfg;
    expect(cfg).toMatchObject({ goal: 50000, startCash: 20000, maxRounds: 30 });
    expect(h.state.players.every((p) => p.cash === 20000)).toBe(true);
    // rules v2 settings are forwarded too (once the engine knows them)
    if ('dice' in cfg) expect(cfg.dice).toBe('fair');
    if ('auctionOnDecline' in cfg) expect(cfg.auctionOnDecline).toBe(false);
    // what the lobby showed is exactly what the engine runs with
    expect(h.host.last('room').room.settings).toEqual(h.state.cfg);
    expect(h.host.last('room').room.status).toBe('playing');
    expect(h.host.last('state')).toMatchObject({ seq: 1, events: [] });
  });

  it('unlimited rounds stay unlimited', async () => {
    const h = await startedGame({ maxRounds: null });
    expect(h.room.room.settings.maxRounds).toBeNull();
    const m = h.state.cfg.maxRounds;
    expect(m === null || m === Infinity || m === undefined).toBe(true);
  });

  it('locks settings and joining once started; members can rejoin', async () => {
    const h = await startedGame();
    await h.say(h.host, { t: 'settings', settings: { goal: 30000 } });
    expect(h.host.last('error').message).toMatch(/locked/);
    const res = await h.room.fetch({
      url: 'https://x/ws',
      method: 'GET',
      headers: new Headers({ Upgrade: 'websocket', 'X-User-Id': U(3), 'X-User-Name': 'late', 'X-User-Avatar': '1' }),
    });
    expect(res.status).toBe(101);
    expect(h.ctx.sockets.at(-1).closeCode).toBe(4003);
    // reconnect of the host: gets room + the current state with events: []
    const again = await h.connect(user(1));
    expect(again.last('room').room.status).toBe('playing');
    expect(again.last('state')).toMatchObject({ events: [], seq: h.room.room.seq });
  });
});

describe('game flow', () => {
  it('forces playerId, rejects illegal actions without changing state, broadcasts legal ones', async () => {
    const h = await startedGame();
    await toHumanTurn(h, h.host);
    expect(h.state.players[h.state.turn].id).toBe(U(1));
    const seq = h.room.room.seq;

    await h.say(h.host, { t: 'action', action: { type: 'BUY' } }); // nothing to buy yet
    expect(h.host.last('error').message).toBeTruthy();
    expect(h.room.room.seq).toBe(seq);

    // spoofed playerId and debug dice are ignored: it is applied as U(1) with random dice
    await h.say(h.host, { t: 'action', action: { type: 'ROLL', playerId: 'someone-else', dice: [6, 6] } });
    expect(h.room.room.seq).toBe(seq + 1);
    const msg = h.host.last('state');
    expect(msg.seq).toBe(seq + 1);
    expect(msg.events.find((e) => e.type === 'dice').player).toBe(U(1));

    await h.say(h.host, { t: 'action', action: { type: 'CHEAT' } });
    expect(h.host.last('error').message).toMatch(/Invalid action/);
    await h.say(h.host, { t: 'action', action: { type: 'BID', amount: -5 } });
    expect(h.host.last('error').message).toMatch(/Invalid action/);
  });

  it('plays a whole game on its own (human idles, then bot-style auto-play) and persists exactly once', async () => {
    const h = await startedGame({ goal: 12000, maxRounds: 30, startCash: 5000 });
    let steps = 0;
    while (h.room.room.status === 'playing' && steps < 6000) {
      await h.tick();
      steps += 1;
    }
    expect(h.room.room.status).toBe('finished');
    expect(h.state.phase).toBe('over');
    // alarms keep firing until persisted
    for (let i = 0; i < 5 && !h.room.room.persisted; i += 1) await h.tick();
    expect(h.room.room.persisted).toBe(true);
    expect(persistMatch).toHaveBeenCalledTimes(1);
    const rec = persisted[0];
    expect(rec).toMatchObject({ roomCode: 'ABCD23', playerCount: 2, maxRounds: 30, goal: 12000 });
    expect(rec.id).toBe(h.room.room.matchId);
    expect(rec.players).toHaveLength(2);
    expect(rec.players.map((p) => p.rank).sort()).toEqual([1, 2]);
    expect(rec.players.find((p) => p.is_bot).user_id).toBeNull();
    expect(rec.users).toHaveLength(1); // only the human gets stats / xp
    expect(rec.users[0].user_id).toBe(U(1));
    expect(['net_worth', 'last_standing', 'rounds']).toContain(rec.winReason);
    if (rec.winReason === 'rounds') expect(rec.rounds).toBeLessThanOrEqual(30);
    // seq only ever went up, and the room told everyone it finished
    const seqs = h.host.of('state').map((m) => m.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(h.host.last('room').room.status).toBe('finished');
    // a further alarm must not persist again
    await h.tick();
    expect(persistMatch).toHaveBeenCalledTimes(1);
  });

  it('retries a failed persist with backoff and still writes once', async () => {
    persistMatch.mockRejectedValueOnce(new Error('neon down'));
    const h = await startedGame({ goal: 10000, startCash: 5000, maxRounds: 30 });
    let steps = 0;
    while (h.room.room.status === 'playing' && steps < 6000) {
      await h.tick();
      steps += 1;
    }
    expect(h.room.room.status).toBe('finished');
    await h.tick(); // first attempt fails
    expect(h.room.room.persisted).toBe(false);
    expect(h.room.room.persistAttempts).toBe(1);
    expect(h.room.room.persistAt).toBeGreaterThan(Date.now());
    await h.tick();
    expect(h.room.room.persisted).toBe(true);
    expect(persisted).toHaveLength(1);
  });

  it('the human gets TURN_MS to act; after that they are flagged idle and auto-played', async () => {
    const h = await startedGame();
    await toHumanTurn(h, h.host);
    expect(h.state.players[h.state.turn].id).toBe(U(1));
    const seq = h.room.room.seq;
    const plan = h.room.plan();
    expect(plan.timeout).toBe(true);
    expect(plan.at - h.room.room.lastApplyAt).toBe(h.room.room.animMs + TURN_MS);
    // nothing happens before the deadline
    vi.setSystemTime(plan.at - 1000);
    await h.room.alarm();
    expect(h.room.room.seq).toBe(seq);
    // at the deadline the server plays for the human
    await h.tick();
    expect(h.room.room.seq).toBeGreaterThan(seq);
    expect(h.room.room.afk[U(1)]).toBe(true);
    // idle humans move fast afterwards; acting yourself clears the flag
    await h.say(h.host, { t: 'action', action: { type: 'END_TURN' } });
    expect(h.room.room.afk[U(1)]).toBeUndefined();
  });

  it('a disconnected human is auto-played after the 15 s grace, and reconnecting stops it', async () => {
    const h = await startedGame();
    await toHumanTurn(h, h.host);
    const seq = h.room.room.seq;
    await h.close(h.host);
    expect(h.host.closeCode).toBe(1000);
    expect(h.room.room.disc[U(1)]).toBeDefined();
    const plan = h.room.plan();
    expect(plan.at).toBeGreaterThanOrEqual(h.room.room.disc[U(1)] + GRACE_MS);
    expect(plan.at).toBeLessThan(h.room.room.disc[U(1)] + GRACE_MS + 5000);
    await h.tick();
    expect(h.room.room.seq).toBeGreaterThan(seq);
    // reconnect: back in control, disc cleared, current state delivered
    const back = await h.connect(user(1));
    expect(h.room.room.disc[U(1)]).toBeUndefined();
    expect(back.last('state').events).toEqual([]);
    expect(back.last('room').room.players.find((p) => p.id === U(1)).connected).toBe(true);
  });

  it('abandons a game nobody is connected to (no persistence)', async () => {
    const h = await startedGame();
    await h.close(h.host);
    let steps = 0;
    while (h.room.room.status === 'playing' && steps < 6000) {
      await h.tick();
      steps += 1;
      if (Date.now() - t0 > 20 * 60 * 1000) break;
    }
    expect(h.room.room.status).toBe('finished');
    if (h.state.phase !== 'over') expect(h.room.room.abandoned).toBe(true);
    if (h.room.room.abandoned) expect(persistMatch).not.toHaveBeenCalled();
  });

  it('leaving a running game resigns the player', async () => {
    const h = new Harness();
    await h.init(user(1), {}, 3);
    const host = await h.connect(user(1));
    const p2 = await h.connect(user(2));
    await h.say(host, { t: 'addBot' });
    await h.say(host, { t: 'start' });
    await h.say(p2, { t: 'leave' });
    expect(h.state.players.find((p) => p.id === U(2)).bankrupt).toBe(true);
    expect(p2.closeCode).toBe(1000);
    expect(h.room.room.status).toBe('playing');
  });

  it('expires the room 24 h after the last activity and wipes storage', async () => {
    const h = new Harness();
    await h.init();
    const host = await h.connect(user(1));
    expect(h.ctx.alarmAt).toBeGreaterThanOrEqual(Date.now() + 23 * 3600 * 1000);
    vi.setSystemTime(Date.now() + 24 * 3600 * 1000 + 1000);
    await h.room.alarm();
    expect(h.room.room).toBeNull();
    expect(h.ctx.store.size).toBe(0);
    expect(host.last('error').message).toMatch(/expired/);
    expect((await h.info()).exists).toBe(false);
  });

  it('survives eviction: a fresh instance reloads the room from storage', async () => {
    const h = await startedGame();
    const seq = h.room.room.seq;
    const reborn = new GameRoom(h.ctx, {});
    await new Promise((r) => setImmediate(r)); // the real runtime blocks until the constructor's storage load is done
    expect(reborn.room.seq).toBe(seq);
    expect(reborn.room.state.phase).toBe(h.state.phase);
    expect(reborn.room.matchId).toBe(h.room.room.matchId);
  });
});

describe('rules v2: trades and debts', () => {
  async function withState(patch) {
    const h = await startedGame();
    // the state we patch in is what the room would hold after the engine produced it
    Object.assign(h.room.room.state, patch(h.room.room.state));
    h.room.room.lastApplyAt = Date.now();
    h.room.room.animMs = 0;
    return h;
  }
  const offer = (s, from, to) => ({
    id: 'trade-1',
    from,
    to,
    give: { cash: 100, tiles: [] },
    get: { cash: 0, tiles: [1] },
  });

  it('a pending trade to a human is rejected automatically after 30 s (and the recipient is not flagged idle)', async () => {
    const h = await withState((s) => {
      const bot = s.players.find((p) => p.isBot).id;
      return { trade: offer(s, bot, U(1)) };
    });
    const r = h.room.room;
    r.tradeId = 'trade-1';
    r.tradeAt = Date.now();
    const plan = h.room.plan();
    expect(plan.action).toEqual({ type: 'TRADE_REJECT', playerId: U(1) });
    expect(plan.at).toBe(r.tradeAt + TRADE_MS);
    expect(plan.timeout).toBe(false);
    vi.setSystemTime(r.tradeAt + TRADE_MS - 1000);
    expect(h.room.plan().at).toBeGreaterThan(Date.now());
  });

  it('a bot recipient answers at once; an absent human recipient is rejected without waiting 30 s', async () => {
    const h = await withState((s) => {
      const human = s.players.find((p) => !p.isBot).id;
      const bot = s.players.find((p) => p.isBot).id;
      return { trade: offer(s, human, bot) };
    });
    let plan = h.room.plan();
    expect(plan.id).toBe(h.state.trade.to);
    expect(plan.at).toBeLessThanOrEqual(Date.now() + 1000);

    const h2 = await withState((s) => {
      const bot = s.players.find((p) => p.isBot).id;
      return { trade: offer(s, bot, U(1)) };
    });
    h2.room.room.tradeAt = Date.now();
    h2.room.room.afk[U(1)] = true;
    plan = h2.room.plan();
    expect(plan.action.type).toBe('TRADE_REJECT');
    expect(plan.at).toBeLessThan(Date.now() + 5000);
  });

  it('a trade to a player who is out of the game is cancelled by the offerer', async () => {
    const h = await withState((s) => {
      const bot = s.players.find((p) => p.isBot).id;
      return { trade: offer(s, U(1), bot), players: s.players.map((p) => (p.id === bot ? { ...p, bankrupt: true } : p)) };
    });
    const plan = h.room.plan();
    expect(plan.action).toEqual({ type: 'TRADE_CANCEL', playerId: U(1) });
  });

  it('an idle turn player who made an offer takes it back', async () => {
    const h = await withState((s) => {
      const bot = s.players.find((p) => p.isBot).id;
      return { trade: offer(s, U(1), bot) };
    });
    // the recipient is a bot -> it answers first; make the bot a connected human instead
    h.room.room.state.players.find((p) => p.isBot).isBot = false;
    h.room.room.afk[U(1)] = true;
    const plan = h.room.plan();
    expect(plan.action).toEqual({ type: 'TRADE_CANCEL', playerId: U(1) });
  });

  it('a debtor is handled by the 45 s timer and resolved with the bot brain (or PAY_DEBT)', async () => {
    const h = await withState((s) => ({
      phase: 'debt',
      debt: { player: U(1), amount: 300, creditor: null, reason: 'tax' },
    }));
    const plan = h.room.plan();
    expect(plan.id).toBe(U(1));
    expect(plan.timeout).toBe(true);
    expect(plan.at).toBe(h.room.room.lastApplyAt + TURN_MS);
    expect(plan.action).toBeTruthy();
    expect(plan.action.playerId).toBe(U(1));
  });

  it('REAL ENGINE: an unanswered offer to a human is rejected after 30 s; answering in time keeps control', async () => {
    const h = new Harness();
    await h.init(user(1), {}, 2);
    const a = await h.connect(user(1));
    const b = await h.connect(user(2));
    await h.say(a, { t: 'start' });
    const r = h.room.room;
    const from = h.state.players[h.state.turn].id;
    const to = from === U(1) ? U(2) : U(1);
    const sockFrom = from === U(1) ? a : b;
    r.state.owners[1] = to; // the recipient owns Miyapur
    await h.say(sockFrom, { t: 'action', action: { type: 'TRADE_OFFER', to, give: { cash: 100, tiles: [] }, get: { cash: 0, tiles: [1] } } });
    expect(h.state.trade).toMatchObject({ from, to });
    expect(r.tradeId).toBe(h.state.trade.id);
    const plan = h.room.plan();
    expect(plan.action).toEqual({ type: 'TRADE_REJECT', playerId: to });
    expect(plan.at).toBe(r.tradeAt + TRADE_MS);
    // not yet: 29 s in nothing happens
    vi.setSystemTime(r.tradeAt + TRADE_MS - 1000);
    await h.room.alarm();
    expect(h.state.trade).not.toBeNull();
    // 30 s: auto-reject, broadcast with the engine's own event, no idle flag for the recipient
    const seq = r.seq;
    await h.tick();
    expect(h.state.trade).toBeNull();
    expect(r.seq).toBe(seq + 1);
    const ev = a.last('state').events.find((e) => e.type === 'trade_rejected');
    expect(ev).toMatchObject({ from, to, reason: 'rejected' });
    expect(r.tradeId).toBeNull();
    expect(r.afk[to]).toBeUndefined();
    expect(h.state.owners[1]).toBe(to);

    // second offer, this time the recipient answers within the window
    await h.say(sockFrom, { t: 'action', action: { type: 'TRADE_OFFER', to, give: { cash: 100, tiles: [] }, get: { cash: 0, tiles: [1] } } });
    expect(h.state.trade).not.toBeNull();
    const sockTo = to === U(1) ? a : b;
    await h.say(sockTo, { t: 'action', action: { type: 'TRADE_ACCEPT' } });
    expect(h.state.trade).toBeNull();
    expect(h.state.owners[1]).toBe(from);
    expect(a.last('state').events.some((e) => e.type === 'trade_done')).toBe(true);
  });

  it('REAL ENGINE: the 45 s timer resolves a debt for an idle human (mortgages, then pays)', async () => {
    const h = new Harness();
    await h.init(user(1), {}, 2);
    const a = await h.connect(user(1));
    await h.connect(user(2));
    await h.say(a, { t: 'start' });
    const r = h.room.room;
    const st = r.state;
    st.cfg.debug = true; // test-only: lets the harness force the dice (the real server never sets it)
    st.cfg.diceCount = 2; // This debt fixture exercises the original two-die saved-game rules.
    st.turn = st.players.findIndex((p) => p.id === U(1));
    const me = st.players[st.turn];
    me.cash = 300;
    me.pos = 12;
    for (const t of [1, 2, 4]) st.owners[t] = U(1);
    const res = await h.room.applyAndBroadcast({ type: 'ROLL', playerId: U(1), dice: [2, 2] }); // lands on the tax tile
    expect(res.error).toBeUndefined();
    expect(h.state.phase).toBe('debt');
    expect(h.state.debt).toMatchObject({ player: U(1) });
    const plan = h.room.plan();
    expect(plan.timeout).toBe(true);
    expect(plan.at).toBe(r.lastApplyAt + r.animMs + TURN_MS);
    // before the deadline: nothing; at the deadline the server resolves the debt step by step
    vi.setSystemTime(plan.at - 1000);
    await h.room.alarm();
    expect(h.state.phase).toBe('debt');
    let guard = 0;
    while (h.state.phase === 'debt' && guard < 20) {
      await h.tick();
      guard += 1;
    }
    expect(h.state.phase).not.toBe('debt');
    expect(h.state.debt).toBeNull();
    expect(h.state.players.find((p) => p.id === U(1)).bankrupt).toBe(false);
    expect(h.state.mortgaged.some(Boolean)).toBe(true);
    expect(r.afk[U(1)]).toBe(true);
  });

  it('every contract action type passes the allow-list (engine decides legality)', async () => {
    const h = await startedGame();
    for (const a of [
      { type: 'MORTGAGE', tile: 1 }, { type: 'UNMORTGAGE', tile: 1 }, { type: 'SELL_BUILDING', tile: 1 },
      { type: 'PAY_DEBT' }, { type: 'USE_JAIL_CARD' }, { type: 'TRADE_ACCEPT' }, { type: 'TRADE_REJECT' }, { type: 'TRADE_CANCEL' },
      { type: 'TRADE_OFFER', to: 'x', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [2] } },
    ]) {
      await h.say(h.host, { t: 'action', action: a });
      // never "Invalid action" (that is the allow-list's message); the engine may refuse for its own reasons
      expect(h.host.last('error')?.message).not.toBe('Invalid action.');
    }
  });
});

describe('sealed auctions: bids are masked per recipient', () => {
  async function twoHumansAndBot() {
    const h = new Harness();
    await h.init(user(1), {}, 3);
    const a = await h.connect(user(1));
    const b = await h.connect(user(2));
    await h.say(a, { t: 'addBot' });
    await h.say(a, { t: 'start' });
    const bot = h.state.players.find((p) => p.isBot).id;
    const st = h.room.room.state;
    st.phase = 'auction';
    st.owners[1] = null;
    st.pending = { type: 'auction', tile: 1, minBid: 50, bids: { [U(1)]: 300 } };
    h.room.room.lastApplyAt = Date.now();
    return { h, a, b, bot };
  }

  it("connect / reconnect snapshots hide other players' amounts", async () => {
    const { h, bot } = await twoHumansAndBot();
    h.room.room.state.pending.bids[bot] = 120;
    const a2 = await h.connect(user(1));
    const b2 = await h.connect(user(2));
    expect(a2.last('state').state.pending.bids).toEqual({ [U(1)]: 300, [bot]: 0 });
    expect(b2.last('state').state.pending.bids).toEqual({ [U(1)]: 0, [bot]: 0 }); // keys kept: "has bid" is visible
    expect(a2.last('state').events).toEqual([]);
    // the authoritative copy in the room is untouched
    expect(h.state.pending.bids).toEqual({ [U(1)]: 300, [bot]: 120 });
  });

  it('broadcasts mask per recipient; auction_end reveals everything; later states carry no bids', async () => {
    const { h, a, b, bot } = await twoHumansAndBot();
    await h.say(b, { t: 'action', action: { type: 'BID', amount: 100 } });
    expect(a.last('state').state.pending.bids).toEqual({ [U(1)]: 300, [U(2)]: 0 });
    expect(b.last('state').state.pending.bids).toEqual({ [U(1)]: 0, [U(2)]: 100 });
    expect(h.state.pending.bids).toEqual({ [U(1)]: 300, [U(2)]: 100 });
    // nothing in the events of a non-final bid leaks an amount
    expect(JSON.stringify(a.last('state').events)).not.toContain('300');

    const res = await h.room.applyAndBroadcast({ type: 'BID', playerId: bot, amount: 120 });
    expect(res.error).toBeUndefined();
    for (const sock of [a, b]) {
      const end = sock.last('state').events.find((e) => e.type === 'auction_end');
      expect(end.bids).toEqual({ [U(1)]: 300, [U(2)]: 100, [bot]: 120 }); // legitimately revealed
      expect(end.winner).toBe(U(1));
      expect(sock.last('state').state.pending).toBeNull();
    }
  });

  it('the stored room keeps the real bids (masking only happens on the way out)', async () => {
    const { h } = await twoHumansAndBot();
    h.room.room.state.pending.bids[U(2)] = 77;
    await h.room.save();
    const stored = await h.ctx.storage.get('room');
    expect(stored.state.pending.bids).toEqual({ [U(1)]: 300, [U(2)]: 77 });
  });
});

describe('debt phase: the debtor acts even when it is not their turn', () => {
  async function debtGame() {
    const h = new Harness();
    await h.init(user(1), {}, 2);
    const a = await h.connect(user(1));
    const b = await h.connect(user(2));
    await h.say(a, { t: 'start' });
    const st = h.room.room.state;
    st.cfg.debug = true; // test-only: lets the harness force the dice
    st.cfg.diceCount = 2; // This debt fixture exercises the original two-die saved-game rules.
    st.turn = st.players.findIndex((p) => p.id === U(1));
    st.players[st.turn].cash = 300;
    st.players[st.turn].pos = 12;
    for (const t of [1, 2, 4]) st.owners[t] = U(1);
    const res = await h.room.applyAndBroadcast({ type: 'ROLL', playerId: U(1), dice: [2, 2] }); // lands on the tax tile
    expect(res.error).toBeUndefined();
    expect(h.state.phase).toBe('debt');
    expect(h.state.debt.player).toBe(U(1));
    // make it somebody else's turn while the debt is still open
    h.room.room.state.turn = h.state.players.findIndex((p) => p.id === U(2));
    return { h, a, b };
  }

  it('allow-list + engine accept MORTGAGE / PAY_DEBT from a non-turn debtor; timers target the debtor', async () => {
    const { h, a, b } = await debtGame();
    expect(pendingActors(h.state)).toEqual([U(1)]);
    const plan = h.room.plan();
    expect(plan.id).toBe(U(1));
    expect(plan.timeout).toBe(true);
    // the other player cannot act for them
    await h.say(b, { t: 'action', action: { type: 'PAY_DEBT' } });
    expect(b.last('error')).toBeTruthy();
    // the debtor raises cash although it is not their turn
    const errors = a.of('error').length;
    await h.say(a, { t: 'action', action: { type: 'MORTGAGE', tile: 4 } });
    expect(a.of('error').length).toBe(errors);
    expect(h.state.mortgaged[4]).toBe(true);
    await h.say(a, { t: 'action', action: { type: 'MORTGAGE', tile: 1 } });
    await h.say(a, { t: 'action', action: { type: 'MORTGAGE', tile: 2 } });
    await h.say(a, { t: 'action', action: { type: 'PAY_DEBT' } });
    expect(a.of('error').length).toBe(errors);
    expect(h.state.debt).toBeNull();
    expect(h.state.phase).not.toBe('debt');
  });

  it('RESIGN is accepted from a non-turn debtor', async () => {
    const { h, a } = await debtGame();
    await h.say(a, { t: 'action', action: { type: 'RESIGN' } });
    expect(h.state.players.find((p) => p.id === U(1)).bankrupt).toBe(true);
  });

  it('an idle non-turn debtor is resolved by the 45 s timer (bot brain on their behalf)', async () => {
    const { h } = await debtGame();
    const r = h.room.room;
    r.lastApplyAt = Date.now();
    r.animMs = 0;
    let guard = 0;
    while (h.state.phase === 'debt' && guard < 30) {
      await h.tick();
      guard += 1;
    }
    expect(h.state.phase).not.toBe('debt');
    expect(r.afk[U(1)]).toBe(true);
  });
});
