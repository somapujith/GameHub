// GameRoom: one Durable Object per room code (WebSocket Hibernation API). Game-agnostic: every
// rule of the game being played lives in the adapter chosen by the room's `gameId`
// (worker/games/<id>.js, see worker/games/index.js); this class only knows about seats, timers,
// sockets and persistence.
//
// Lobby: players join over WS, ready up, the host edits settings and visibility, adds/removes
// bots, kicks, starts (>= adapter.minPlayers). Game: the server owns the game state; clients only
// send intents (`{t:'action'}`), the server forces `playerId`, applies them through the adapter
// and broadcasts the result. Bots, idle humans (45 s) and disconnected humans (15 s grace) are
// driven by DO alarms. The whole room record lives in DO storage, so eviction/hibernation is safe.
// A listing row in the `rooms` table is kept in step on a best-effort basis (never breaks a room).
import { DurableObject } from 'cloudflare:workers';
import { getAdapter, DEFAULT_GAME_ID } from './games/index.js';
import { buildMatchRecord, persistMatch } from './match.js';
import {
  parseRoomInit,
  parseSettingsPatch,
  parseVisibility,
  defaultSanitizeAction,
  DEFAULT_VISIBILITY,
} from './roomrules.js';
import { roomRow, rowSignature, upsertRoomRow, deleteRoomRow, hasDb, LISTING_HEARTBEAT_MS } from './roomsdb.js';
import { sanitizeName, parseAvatar, sanitizeChat, sanitizeEmote, isUuid } from './validate.js';

export const TURN_MS = 45_000; // human idle limit per decision
export const GRACE_MS = 15_000; // disconnected human is auto-played after this
const BOT_DELAY_MS = 900; // pause before an automated move (adapters may shorten it via moveDelayMs)
const LOBBY_GRACE_MS = 60_000; // a disconnected lobby member is dropped after this
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const ABANDON_MS = 5 * 60 * 1000; // nobody connected for this long -> stop playing the game
const KICK_BAN_MS = 10 * 60 * 1000;
const CHAT_GAP_MS = 700;
const MAX_MESSAGE_CHARS = 4096;
const MAX_SOCKETS_PER_USER = 3;
const PERSIST_BACKOFF_MS = [2_000, 10_000, 30_000, 120_000, 600_000];
const PERSIST_MAX_ATTEMPTS = 8;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const randomId = (n = 6) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
};

function shuffled(list) {
  const a = [...list];
  const r = crypto.getRandomValues(new Uint32Array(a.length));
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = r[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** WebSocket close codes must be 1000 or 3000-4999 for close(); coerce anything else. */
const safeCode = (code) => (code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000);

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.adapter = null;
    this.chatAt = new Map(); // userId -> last chat time
    this.rate = new Map(); // userId -> { start, count }
    this.autoFailures = new Map(); // playerId -> consecutive failed auto moves
    this.lastActivitySaved = 0;
    this.listingChain = Promise.resolve(); // listing writes run strictly in order
    this.listedSig = null; // signature of the last row written to `rooms`
    this.listedAt = 0;
    // Answer heartbeats without waking a hibernating object.
    try {
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    } catch {
      /* older runtimes: the message handler answers pings instead */
    }
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      this.bindAdapter();
    });
  }

  // ------------------------------------------------------------------ plumbing

  /**
   * Pick the adapter of the loaded room and fill in fields that rooms created by older versions
   * lack (they were all Hyderabad Tycoon rooms, private, without per-match meta or deadlines).
   */
  bindAdapter() {
    const r = this.room;
    this.adapter = null;
    if (!r) return;
    r.gameId ||= DEFAULT_GAME_ID;
    r.visibility ||= DEFAULT_VISIBILITY;
    r.meta ||= {};
    r.deadlines ||= {};
    this.adapter = getAdapter(r.gameId);
    if (this.adapter && typeof this.adapter.upgradeRecord === 'function') this.adapter.upgradeRecord(r);
  }

  async save() {
    if (this.room) {
      await this.ctx.storage.put('room', this.room);
      this.syncListing();
    }
  }

  touch() {
    if (this.room) this.room.lastActivity = Date.now();
  }

  liveSockets() {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1);
  }

  /** Set of user ids that have at least one open socket. */
  connectedIds() {
    const ids = new Set();
    for (const ws of this.liveSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.userId) ids.add(a.userId);
    }
    return ids;
  }

  send(ws, msg) {
    try {
      ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } catch {
      /* socket is gone */
    }
  }

  broadcast(msg, skip) {
    const payload = JSON.stringify(msg);
    for (const ws of this.liveSockets()) if (ws !== skip) this.send(ws, payload);
  }

  sendError(ws, message) {
    this.send(ws, { t: 'error', message });
  }

  /** What the state looks like to one viewer (the adapter hides secrets; same object = nothing hidden). */
  viewOf(userId) {
    const a = this.adapter;
    return a && typeof a.redact === 'function' ? a.redact(this.room.state, userId) : this.room.state;
  }

  /** Settings as the lobby shows them (adapters may complete them with the engine's own defaults). */
  lobbySettings() {
    const a = this.adapter;
    const s = this.room.settings;
    return a && typeof a.lobbySettings === 'function' ? a.lobbySettings(s) : s;
  }

  roomView() {
    const r = this.room;
    const connected = this.connectedIds();
    return {
      code: r.code,
      status: r.status,
      hostId: r.hostId,
      maxPlayers: r.maxPlayers,
      gameId: r.gameId,
      visibility: r.visibility,
      settings: this.lobbySettings(),
      players: r.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        ready: p.isBot ? true : !!p.ready,
        connected: p.isBot ? true : connected.has(p.id),
        isBot: !!p.isBot,
      })),
    };
  }

  /**
   * Broadcast the authoritative state. Each recipient gets the adapter's `redact` view of it;
   * when nothing is hidden (the view is the state itself) one serialised payload fits everyone.
   */
  broadcastState(events) {
    const r = this.room;
    let shared = null;
    for (const ws of this.liveSockets()) {
      const uid = ws.deserializeAttachment()?.userId;
      const view = this.viewOf(uid);
      if (view === r.state) {
        shared ||= JSON.stringify({ t: 'state', state: r.state, events, seq: r.seq });
        this.send(ws, shared);
      } else {
        this.send(ws, { t: 'state', state: view, events, seq: r.seq });
      }
    }
  }

  broadcastRoom() {
    this.broadcast({ t: 'room', room: this.roomView() });
  }

  hostName() {
    const h = this.room.players.find((p) => p.id === this.room.hostId);
    return h ? h.name : null;
  }

  humans() {
    return this.room.players.filter((p) => !p.isBot);
  }

  /** Make sure the host is a present human (transfer if not). */
  fixHost() {
    const r = this.room;
    if (r.players.some((p) => p.id === r.hostId && !p.isBot)) return;
    const next = r.players.find((p) => !p.isBot && !p.left);
    r.hostId = next ? next.id : null;
  }

  /** A lobby with no humans left is pointless: let it expire in ~10 minutes instead of 24 h. */
  expireSoonIfEmpty() {
    const r = this.room;
    if (r.status === 'lobby' && !r.players.some((p) => !p.isBot)) {
      r.lastActivity = Math.min(r.lastActivity, Date.now() - ROOM_TTL_MS + 10 * 60 * 1000);
    }
  }

  // ------------------------------------------------------------------ listing (`rooms` table)

  /** Run one listing write after the previous ones; failures are logged, never thrown. */
  queueListing(op) {
    this.listingChain = this.listingChain.then(op).catch((err) => {
      this.listedSig = null; // try again on the next change
      console.error('room listing failed:', err && err.code ? `${err.code} ${err.message}` : err && err.message);
    });
    try {
      this.ctx.waitUntil(this.listingChain);
    } catch {
      /* no execution context (tests): the chain still runs */
    }
  }

  /**
   * Keep this room's row in `rooms` in step with the record (called after every save). Unchanged
   * rows are only rewritten every LISTING_HEARTBEAT_MS; a lobby without humans is removed.
   */
  syncListing(force = false) {
    const r = this.room;
    if (!r || !hasDb(this.env)) return;
    const now = Date.now();
    const empty = r.status === 'lobby' && !r.players.some((p) => !p.isBot);
    const row = roomRow(r);
    const sig = empty ? 'empty' : rowSignature(row);
    if (!force && sig === this.listedSig && now - this.listedAt < LISTING_HEARTBEAT_MS) return;
    this.listedSig = sig;
    this.listedAt = now;
    this.queueListing(() => (empty ? deleteRoomRow(this.env, row.code) : upsertRoomRow(this.env, row)));
  }

  dropListing(code) {
    this.listedSig = 'gone';
    if (hasDb(this.env)) this.queueListing(() => deleteRoomRow(this.env, code));
  }

  // ------------------------------------------------------------------ HTTP / WS entry

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') return this.handleInit(request);
    if (url.pathname === '/info') return this.handleInfo(url);

    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected WebSocket' }, 426);
    return this.handleUpgrade(request);
  }

  async handleInit(request) {
    if (this.room) return json({ error: 'Room code already in use.' }, 409);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Bad request.' }, 400);
    }
    const host = body && body.host;
    const code = body && body.code;
    if (!host || !isUuid(host.id) || typeof code !== 'string' || !/^[A-Z0-9]{4,10}$/.test(code)) {
      return json({ error: 'Bad request.' }, 400);
    }
    // Defence in depth: the route validated this already, the room validates it again.
    const init = parseRoomInit(body);
    if (!init.ok) return json({ error: init.error }, 400);
    const now = Date.now();
    this.room = {
      v: 2,
      code,
      gameId: init.gameId,
      visibility: init.visibility,
      status: 'lobby',
      hostId: host.id,
      maxPlayers: init.maxPlayers,
      settings: init.settings,
      players: [
        {
          id: host.id,
          name: sanitizeName(host.name) || 'Player',
          avatar: parseAvatar(host.avatar) ?? 0,
          ready: true,
          isBot: false,
          guest: !!host.guest,
        },
      ],
      state: null,
      seq: 0,
      matchId: null,
      startedAt: null,
      endedAt: null,
      persisted: false,
      abandoned: false,
      persistAttempts: 0,
      persistAt: null,
      lastActivity: now,
      createdAt: now,
      lastApplyAt: now,
      animMs: 0,
      meta: {}, // opaque per-match data the adapter folds events into (see adapter.track)
      deadlines: {}, // adapter timer key -> when it started counting
      afk: {},
      disc: { [host.id]: now }, // the host must connect within LOBBY_GRACE_MS
      banned: {},
      noHumanSince: null,
    };
    this.adapter = init.adapter;
    await this.save();
    await this.scheduleAlarm();
    return json({ code, gameId: init.gameId }, 201);
  }

  handleInfo(url) {
    const r = this.room;
    if (!r) return json({ exists: false });
    const member = url.searchParams.get('member');
    return json({
      exists: true,
      status: r.status,
      players: r.players.length,
      maxPlayers: r.maxPlayers,
      hostName: this.hostName(),
      isMember: !!member && r.players.some((p) => p.id === member),
      gameId: r.gameId,
      visibility: r.visibility,
      settings: this.lobbySettings(),
    });
  }

  /** Accept a socket just to tell the client why it cannot join, then close it. */
  rejectSocket(closeCode, message) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, ['rejected']);
    this.send(server, { t: 'error', message });
    try {
      server.close(closeCode, message.slice(0, 100));
    } catch {
      /* ignore */
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async handleUpgrade(request) {
    const userId = request.headers.get('X-User-Id');
    if (!isUuid(userId)) return json({ error: 'Unauthorized' }, 401);
    let name = '';
    try {
      name = sanitizeName(decodeURIComponent(request.headers.get('X-User-Name') || ''));
    } catch {
      /* malformed encoding */
    }
    name = name || 'Player';
    const avatar = parseAvatar(Number(request.headers.get('X-User-Avatar'))) ?? 0;
    const guest = request.headers.get('X-User-Guest') === '1';

    const r = this.room;
    if (!r) return this.rejectSocket(4004, 'That room does not exist.');
    if (!this.adapter) return this.rejectSocket(4004, 'This game is no longer available.');

    const now = Date.now();
    const banUntil = r.banned[userId];
    if (banUntil && banUntil > now) return this.rejectSocket(4003, 'You were removed from this room.');

    let member = r.players.find((p) => p.id === userId);
    if (!member) {
      if (r.status !== 'lobby') return this.rejectSocket(4003, 'This game has already started.');
      if (r.players.length >= r.maxPlayers) return this.rejectSocket(4003, 'This room is full.');
      member = { id: userId, name, avatar, ready: false, isBot: false, guest };
      r.players.push(member);
      if (!r.hostId) r.hostId = userId;
    } else {
      // Rejoin: refresh the display identity, clear absence markers.
      member.name = name;
      member.avatar = avatar;
      member.guest = guest;
      member.left = false;
    }
    delete r.disc[userId];
    delete r.afk[userId];
    r.noHumanSince = null;
    this.touch();

    // Keep a bounded number of sockets per user (stale ones from flaky networks pile up).
    const mine = this.ctx.getWebSockets(userId).filter((ws) => ws.readyState === 1);
    if (mine.length >= MAX_SOCKETS_PER_USER) {
      const oldest = mine.sort(
        (a, b) => (a.deserializeAttachment()?.at || 0) - (b.deserializeAttachment()?.at || 0),
      )[0];
      try {
        oldest.close(4009, 'replaced');
      } catch {
        /* ignore */
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [userId]);
    server.serializeAttachment({ userId, name, avatar, guest, at: now });

    await this.save();
    this.broadcastRoom();
    if (r.state) this.send(server, { t: 'state', state: this.viewOf(userId), events: [], seq: r.seq });
    await this.scheduleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ------------------------------------------------------------------ socket events

  allowMessage(userId) {
    const now = Date.now();
    const b = this.rate.get(userId);
    if (!b || now - b.start > 5000) {
      this.rate.set(userId, { start: now, count: 1 });
      return true;
    }
    b.count += 1;
    return b.count <= 40;
  }

  async webSocketMessage(ws, message) {
    const att = ws.deserializeAttachment();
    if (!att || !att.userId || !this.room) return;
    if (typeof message !== 'string') return this.sendError(ws, 'Only text messages are supported.');
    if (message.length > MAX_MESSAGE_CHARS) return this.sendError(ws, 'Message too large.');
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return this.sendError(ws, 'Invalid message.');
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return this.sendError(ws, 'Invalid message.');
    if (msg.t === 'ping') return this.send(ws, { t: 'pong' });
    if (!this.allowMessage(att.userId)) return this.sendError(ws, 'You are sending messages too fast.');
    if (!this.adapter) return this.sendError(ws, 'This game is no longer available.');

    const r = this.room;
    const me = r.players.find((p) => p.id === att.userId);
    if (!me) return this.sendError(ws, 'You are not in this room.');
    const isHost = r.hostId === me.id;

    switch (msg.t) {
      case 'ready':
        return this.onReady(ws, me, msg);
      case 'settings':
        return this.onSettings(ws, isHost, msg);
      case 'visibility':
        return this.onVisibility(ws, isHost, msg);
      case 'addBot':
        return this.onAddBot(ws, isHost);
      case 'removeBot':
        return this.onRemoveBot(ws, isHost, msg);
      case 'kick':
        return this.onKick(ws, isHost, msg);
      case 'start':
        return this.onStart(ws, isHost);
      case 'action':
        return this.onAction(ws, me, msg);
      case 'chat':
        return this.onChat(ws, me, msg);
      case 'leave':
        return this.onLeave(ws, me);
      default:
        return this.sendError(ws, 'Unknown message type.');
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(safeCode(code), 'closed');
    } catch {
      /* already closed */
    }
    await this.onDisconnect(ws);
  }

  async webSocketError(ws) {
    await this.onDisconnect(ws);
  }

  async onDisconnect(ws) {
    const r = this.room;
    if (!r) return;
    if (r.players.length && this.reconcileConnections(Date.now())) await this.save();
    this.broadcastRoom();
    await this.scheduleAlarm();
  }

  // ------------------------------------------------------------------ lobby handlers

  onReady(ws, me, msg) {
    if (this.room.status !== 'lobby') return this.sendError(ws, 'The game has already started.');
    if (typeof msg.ready !== 'boolean') return this.sendError(ws, 'Invalid ready value.');
    me.ready = msg.ready;
    this.touch();
    return this.save().then(() => this.broadcastRoom());
  }

  async onSettings(ws, isHost, msg) {
    const r = this.room;
    if (!isHost) return this.sendError(ws, 'Only the host can change settings.');
    if (r.status !== 'lobby') return this.sendError(ws, 'Settings are locked once the game starts.');
    const parsed = parseSettingsPatch(this.adapter, r.settings, msg.settings);
    if (!parsed.ok) return this.sendError(ws, parsed.error);
    if (parsed.maxPlayers !== undefined && parsed.maxPlayers < r.players.length) {
      return this.sendError(ws, 'There are already more players than that.');
    }
    r.settings = parsed.settings;
    if (parsed.maxPlayers !== undefined) r.maxPlayers = parsed.maxPlayers;
    this.touch();
    await this.save();
    this.broadcastRoom();
  }

  async onVisibility(ws, isHost, msg) {
    const r = this.room;
    if (!isHost) return this.sendError(ws, 'Only the host can change who can see this room.');
    if (r.status !== 'lobby') return this.sendError(ws, 'Visibility is locked once the game starts.');
    const visibility = parseVisibility(msg.visibility);
    if (!visibility) return this.sendError(ws, 'Visibility must be private or public.');
    r.visibility = visibility;
    this.touch();
    await this.save();
    this.broadcastRoom();
    await this.scheduleAlarm();
  }

  async onAddBot(ws, isHost) {
    const r = this.room;
    if (!isHost) return this.sendError(ws, 'Only the host can add bots.');
    if (r.status !== 'lobby') return this.sendError(ws, 'Bots can only be added in the lobby.');
    if (r.players.length >= r.maxPlayers) return this.sendError(ws, 'The room is full.');
    const [rival] = this.adapter.rivals(1, r.players.map((p) => p.name));
    r.players.push({
      id: `bot_${randomId(6)}`,
      name: rival.name,
      avatar: rival.avatar,
      ready: true,
      isBot: true,
      ...(rival.bot ? { bot: { ...rival.bot } } : {}),
    });
    this.touch();
    await this.save();
    this.broadcastRoom();
  }

  async onRemoveBot(ws, isHost, msg) {
    const r = this.room;
    if (!isHost) return this.sendError(ws, 'Only the host can remove bots.');
    if (r.status !== 'lobby') return this.sendError(ws, 'Bots can only be removed in the lobby.');
    const idx = r.players.findIndex((p) => p.isBot && p.id === msg.id);
    if (idx < 0) return this.sendError(ws, 'That bot is not in the room.');
    r.players.splice(idx, 1);
    this.touch();
    await this.save();
    this.broadcastRoom();
  }

  async onKick(ws, isHost, msg) {
    const r = this.room;
    if (!isHost) return this.sendError(ws, 'Only the host can remove players.');
    if (r.status !== 'lobby') return this.sendError(ws, 'Players can only be removed in the lobby.');
    const target = r.players.find((p) => !p.isBot && p.id === msg.id);
    if (!target) return this.sendError(ws, 'That player is not in the room.');
    if (target.id === r.hostId) return this.sendError(ws, 'You cannot remove yourself.');
    r.players = r.players.filter((p) => p.id !== target.id);
    r.banned[target.id] = Date.now() + KICK_BAN_MS;
    this.touch();
    for (const sock of this.ctx.getWebSockets(target.id)) {
      this.send(sock, { t: 'kicked' });
      try {
        sock.close(4003, 'kicked');
      } catch {
        /* ignore */
      }
    }
    await this.save();
    this.broadcastRoom();
  }

  async onLeave(ws, me) {
    const r = this.room;
    if (r.status === 'lobby') {
      r.players = r.players.filter((p) => p.id !== me.id);
      delete r.disc[me.id];
      this.fixHost();
      this.touch();
      this.expireSoonIfEmpty();
      await this.save();
      for (const sock of this.ctx.getWebSockets(me.id)) {
        try {
          sock.close(1000, 'left');
        } catch {
          /* ignore */
        }
      }
      this.broadcastRoom();
      await this.scheduleAlarm();
      return;
    }
    if (r.status === 'playing' && r.state && !this.adapter.isOver(r.state)) {
      const resign = typeof this.adapter.resignAction === 'function' ? this.adapter.resignAction(r.state, me.id) : null;
      if (resign) await this.applyAndBroadcast(resign);
    }
    me.left = true;
    this.touch();
    await this.save();
    for (const sock of this.ctx.getWebSockets(me.id)) {
      try {
        sock.close(1000, 'left');
      } catch {
        /* ignore */
      }
    }
    this.broadcastRoom();
    await this.scheduleAlarm();
  }

  async onStart(ws, isHost) {
    const r = this.room;
    const a = this.adapter;
    if (!isHost) return this.sendError(ws, 'Only the host can start the game.');
    if (r.status !== 'lobby') return this.sendError(ws, 'The game has already started.');
    if (r.players.length < a.minPlayers) {
      return this.sendError(ws, `You need at least ${a.minPlayers} players to start.`);
    }
    if (r.players.length > r.maxPlayers) return this.sendError(ws, 'Too many players for this room.');

    const order = shuffled(r.players);
    let state;
    try {
      state = a.createGame({
        players: order.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isBot: !!p.isBot,
          ...(p.bot ? { bot: p.bot } : {}),
        })),
        settings: { ...r.settings },
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      });
    } catch (err) {
      console.error('createGame failed:', err && err.message);
      return this.sendError(ws, 'Could not start the game.');
    }
    const now = Date.now();
    r.status = 'playing';
    r.state = state;
    r.seq = 1;
    r.matchId = crypto.randomUUID();
    r.startedAt = now;
    r.endedAt = null;
    r.persisted = false;
    r.persistAttempts = 0;
    r.persistAt = null;
    r.abandoned = false;
    r.lastApplyAt = now;
    r.animMs = a.startAnimMs || 0; // e.g. a short "game start" intro the client plays
    r.meta = {};
    r.deadlines = {};
    this.syncDeadlines(); // a game may start with a timer already running
    r.afk = {};
    r.disc = {};
    r.noHumanSince = null;
    this.autoFailures.clear();
    this.touch();
    await this.save();
    this.broadcastRoom();
    this.broadcastState([]);
    await this.scheduleAlarm();
  }

  // ------------------------------------------------------------------ game handlers

  async onAction(ws, me, msg) {
    const r = this.room;
    if (r.status !== 'playing' || !r.state) return this.sendError(ws, 'No game is in progress.');
    const a = this.adapter;
    // playerId is forced to the socket's user
    const action = typeof a.sanitizeAction === 'function' ? a.sanitizeAction(msg.action, me.id) : defaultSanitizeAction(msg.action, me.id);
    if (!action) return this.sendError(ws, 'Invalid action.');
    delete r.afk[me.id]; // a human who acts is no longer idle
    delete r.disc[me.id];
    const res = await this.applyAndBroadcast(action);
    if (res.error) {
      this.sendError(ws, res.error);
      await this.scheduleAlarm();
    }
  }

  /**
   * Apply one action to the authoritative state, bump seq, broadcast, persist, reschedule.
   * Returns the adapter result (with `error` when rejected; nothing is changed then).
   */
  async applyAndBroadcast(action) {
    const r = this.room;
    const a = this.adapter;
    const res = a.applyAction(r.state, action);
    if (res.error) return res;
    r.state = res.state;
    r.seq += 1;
    r.lastApplyAt = Date.now();
    r.animMs = typeof a.animationMs === 'function' ? a.animationMs(res.events) : 0;
    if (typeof a.track === 'function') r.meta = a.track(r.meta || {}, res.events, r.state) || r.meta || {};
    this.syncDeadlines();
    this.touch();
    this.broadcastState(res.events);
    if (a.isOver(r.state)) {
      r.status = 'finished';
      r.endedAt = Date.now();
      r.persistAt = Date.now();
      this.broadcastRoom();
    }
    await this.save();
    await this.scheduleAlarm();
    return res;
  }

  /**
   * Game timers (adapter.deadlines): a timer that is new gets its clock started when the animation
   * of the action that created it ends; timers that persist keep their start; finished ones go.
   */
  syncDeadlines() {
    const r = this.room;
    const list = typeof this.adapter.deadlines === 'function' ? this.adapter.deadlines(r.state) || [] : [];
    const next = {};
    for (const d of list) next[d.key] = r.deadlines?.[d.key] ?? r.lastApplyAt + r.animMs;
    r.deadlines = next;
  }

  async onChat(ws, me, msg) {
    const now = Date.now();
    if (now - (this.chatAt.get(me.id) || 0) < CHAT_GAP_MS) return; // silently drop floods
    const text = sanitizeChat(msg.text);
    const emote = sanitizeEmote(msg.emote, this.adapter.emotes || []);
    if (!text && !emote) return;
    this.chatAt.set(me.id, now);
    this.broadcast({ t: 'chat', id: randomId(8), from: me.id, name: me.name, text, emote, ts: now });
    this.touch();
    if (now - this.lastActivitySaved > 10 * 60 * 1000) {
      this.lastActivitySaved = now;
      await this.save();
      await this.scheduleAlarm();
    }
  }

  // ------------------------------------------------------------------ timers (alarms)

  /**
   * What the game is waiting for next: `{ at, id, action, timeout }` or null. Candidates:
   * - the adapter's own timers (`deadlines`, e.g. an unanswered offer is auto-rejected);
   * - the bot that should move (`nextBotMove`), after a short pause;
   * - every human the game waits for (`pendingPlayerIds`): idle (afk) and disconnected-past-grace
   *   humans are auto-played (`idleAction`) after the same short pause; a connected human gets
   *   TURN_MS (counted from when the last animation ends), then is flagged idle.
   * The earliest one wins.
   */
  plan() {
    const r = this.room;
    const a = this.adapter;
    if (!r || !a || r.status !== 'playing' || !r.state || a.isOver(r.state)) return null;
    const pace = (action) => {
      const delay = typeof a.moveDelayMs === 'function' ? a.moveDelayMs(action) : BOT_DELAY_MS;
      return r.lastApplyAt + Math.max(delay, r.animMs);
    };
    const candidates = [];

    const deadlines = typeof a.deadlines === 'function' ? a.deadlines(r.state) || [] : [];
    for (const d of deadlines) {
      const startedAt = r.deadlines?.[d.key] ?? r.lastApplyAt + r.animMs;
      candidates.push({ at: startedAt + d.afterMs, id: d.playerId, action: d.action, timeout: false });
    }

    const botMove = a.nextBotMove(r.state, Math.random);
    if (botMove) candidates.push({ at: pace(botMove), id: botMove.playerId, action: botMove, timeout: false });

    const waiting = typeof a.pendingPlayerIds === 'function' ? a.pendingPlayerIds(r.state) : [a.turnPlayerId(r.state)];
    for (const id of waiting) {
      const seat = id == null ? null : r.players.find((p) => p.id === id);
      if (!seat || seat.isBot) continue; // bots are covered by nextBotMove
      const action = a.idleAction(r.state, id);
      if (!action) continue;
      let at;
      let timeout = false;
      if (r.afk[id]) at = pace(action);
      else if (r.disc[id] != null) at = Math.max(pace(action), r.disc[id] + GRACE_MS);
      else {
        at = r.lastApplyAt + r.animMs + TURN_MS;
        timeout = true;
      }
      candidates.push({ at, id, action, timeout });
    }

    let best = null;
    for (const c of candidates) if (!best || c.at < best.at) best = c;
    return best;
  }

  /** Reconcile `disc` with the live sockets (covers restarts that dropped sockets silently). */
  reconcileConnections(now) {
    const r = this.room;
    if (!r || r.status === 'finished') return false;
    const connected = this.connectedIds();
    let changed = false;
    for (const p of r.players) {
      if (p.isBot) continue;
      if (connected.has(p.id)) {
        if (r.disc[p.id] != null) {
          delete r.disc[p.id];
          changed = true;
        }
      } else if (r.disc[p.id] == null) {
        r.disc[p.id] = now;
        changed = true;
      }
    }
    const anyHuman = r.players.some((p) => !p.isBot && !p.left && connected.has(p.id));
    const marker = anyHuman ? null : r.noHumanSince ?? now;
    if (marker !== r.noHumanSince) {
      r.noHumanSince = marker;
      changed = true;
    }
    return changed;
  }

  async scheduleAlarm() {
    const r = this.room;
    if (!r) return;
    const now = Date.now();
    const times = [r.lastActivity + ROOM_TTL_MS];
    if (r.status === 'finished' && !r.persisted && !r.abandoned && r.persistAt != null) times.push(r.persistAt);
    if (r.status === 'playing') {
      const plan = this.plan();
      if (plan) times.push(plan.at);
      if (r.noHumanSince != null) times.push(r.noHumanSince + ABANDON_MS);
    }
    if (r.status === 'lobby') {
      for (const p of r.players) {
        if (!p.isBot && r.disc[p.id] != null) times.push(r.disc[p.id] + LOBBY_GRACE_MS);
      }
      // A public lobby refreshes its listing row now and then so it keeps counting as fresh.
      if (r.visibility === 'public' && hasDb(this.env)) times.push(this.listedAt + LISTING_HEARTBEAT_MS);
    }
    const when = Math.max(Math.min(...times), now + 5);
    await this.ctx.storage.setAlarm(when);
  }

  async alarm() {
    try {
      await this.tick();
    } catch (err) {
      // Never let an unexpected error spin the alarm retry loop: log and try again shortly.
      console.error('alarm failed:', err && err.message);
      try {
        await this.ctx.storage.setAlarm(Date.now() + 5000);
      } catch {
        /* ignore */
      }
    }
  }

  async tick() {
    const r = this.room;
    if (!r) return;
    const now = Date.now();

    // 1) Expired room: tell everyone, close, wipe (and take it off the listing).
    if (now - r.lastActivity >= ROOM_TTL_MS) {
      for (const ws of this.ctx.getWebSockets()) {
        this.send(ws, { t: 'error', message: 'This room has expired.' });
        try {
          ws.close(4004, 'expired');
        } catch {
          /* ignore */
        }
      }
      this.dropListing(r.code);
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.room = null;
      this.adapter = null;
      return;
    }
    if (!this.adapter) {
      // The game was removed from the registry: nothing can be played, just wait for the expiry.
      await this.scheduleAlarm();
      return;
    }

    let dirty = this.reconcileConnections(now);

    // 2) Lobby housekeeping: drop members who vanished; keep a public listing fresh.
    if (r.status === 'lobby') {
      const gone = r.players.filter((p) => !p.isBot && r.disc[p.id] != null && now - r.disc[p.id] >= LOBBY_GRACE_MS);
      if (gone.length) {
        const ids = new Set(gone.map((p) => p.id));
        r.players = r.players.filter((p) => !ids.has(p.id));
        for (const id of ids) delete r.disc[id];
        this.fixHost();
        this.expireSoonIfEmpty();
        await this.save();
        this.broadcastRoom();
        dirty = false;
      } else if (r.visibility === 'public') {
        this.syncListing(); // no-op unless the heartbeat is due
      }
    }

    // 3) Game over -> write the match to Neon (retried with backoff, exactly once overall).
    if (r.status === 'finished' && !r.persisted && !r.abandoned && r.persistAt != null && now >= r.persistAt) {
      await this.persist();
      dirty = false;
    }

    // 4) Playing: abandon when nobody is around, else make the due automated move.
    if (r.status === 'playing' && r.state) {
      const allLeft = !r.players.some((p) => !p.isBot && !p.left);
      const deserted = r.noHumanSince != null && now - r.noHumanSince >= ABANDON_MS;
      if (allLeft || deserted) {
        r.status = 'finished';
        r.abandoned = true;
        r.endedAt = now;
        await this.save();
        this.broadcastRoom();
        dirty = false;
      } else {
        const plan = this.plan();
        if (plan && plan.at <= now + 25) {
          if (plan.timeout) r.afk[plan.id] = true;
          const res = await this.applyAndBroadcast(plan.action);
          dirty = false;
          if (res.error) await this.handleAutoFailure(plan.id, res.error);
          else this.autoFailures.delete(plan.id);
        }
      }
    }

    if (dirty) await this.save();
    await this.scheduleAlarm();
  }

  /** Safety net: an automated move the game rejected must never stall it. */
  async handleAutoFailure(playerId, error) {
    const r = this.room;
    const n = (this.autoFailures.get(playerId) || 0) + 1;
    this.autoFailures.set(playerId, n);
    console.error(`auto-move rejected (${n}):`, error);
    if (n >= 3) {
      this.autoFailures.delete(playerId);
      const resign = typeof this.adapter.resignAction === 'function' ? this.adapter.resignAction(r.state, playerId) : null;
      if (resign) {
        await this.applyAndBroadcast(resign);
      } else {
        // Nothing can unstick this game: call it off (it is not recorded).
        r.status = 'finished';
        r.abandoned = true;
        r.endedAt = Date.now();
        await this.save();
        this.broadcastRoom();
      }
    }
  }

  async persist() {
    const r = this.room;
    try {
      const rec = buildMatchRecord(r, this.adapter);
      await persistMatch(this.env, rec);
      r.persisted = true;
      r.persistAt = null;
      await this.save();
    } catch (err) {
      r.persistAttempts += 1;
      console.error('match persist failed:', err && err.code ? `${err.code} ${err.message}` : err && err.message);
      if (r.persistAttempts >= PERSIST_MAX_ATTEMPTS) {
        r.persistAt = null; // give up; the room still works
      } else {
        const wait = PERSIST_BACKOFF_MS[Math.min(r.persistAttempts - 1, PERSIST_BACKOFF_MS.length - 1)];
        r.persistAt = Date.now() + wait;
      }
      await this.save();
    }
  }
}
