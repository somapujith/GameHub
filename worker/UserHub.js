// UserHub: one Durable Object per user. Holds the user's `/ws/user` sockets (WebSocket
// Hibernation API) and relays real-time notifications to them:
//   {t:'friend_request',from}, {t:'friend_accepted',by}, {t:'invite',from,code},
//   {t:'presence',userId,online}
// Online = the hub has at least one live socket. When that flips, friends are told
// (best effort, debounced so a page reload does not flap the presence dot).
import { DurableObject } from 'cloudflare:workers';
import { query } from './db.js';
import { pushToUser } from './hub.js';

const OFFLINE_DEBOUNCE_MS = 4000;
const MAX_MESSAGE_BYTES = 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class UserHub extends DurableObject {
  // Open sockets only (a socket that is closing still shows up in getWebSockets()).
  liveSockets() {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1);
  }

  isOnline() {
    return this.liveSockets().length > 0;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Internal calls from the Worker (service binding only - not reachable from the internet).
    if (url.pathname === '/push' && request.method === 'POST') {
      let message;
      try {
        message = await request.json();
      } catch {
        return json({ error: 'bad json' }, 400);
      }
      const payload = JSON.stringify(message);
      let delivered = 0;
      for (const ws of this.liveSockets()) {
        try {
          ws.send(payload);
          delivered += 1;
        } catch {
          /* socket went away */
        }
      }
      return json({ delivered });
    }
    if (url.pathname === '/online') return json({ online: this.isOnline() });

    // WebSocket upgrade (identity headers were set by the Worker after cookie auth).
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected WebSocket' }, 426);
    const userId = request.headers.get('X-User-Id');
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId });
    await this.ctx.storage.put('userId', userId);
    try {
      server.send(JSON.stringify({ t: 'presence', userId, online: true }));
    } catch {
      /* ignore */
    }
    // First socket -> tell friends right away (if we had told them we were offline).
    this.ctx.waitUntil(this.syncPresence());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return;
    if (message === 'ping' || message.includes('"ping"')) {
      try {
        ws.send(JSON.stringify({ t: 'pong' }));
      } catch {
        /* ignore */
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    try {
      ws.close(code && code !== 1005 && code !== 1006 ? code : 1000, reason || 'closed');
    } catch {
      /* already closed */
    }
    await this.onSocketGone();
  }

  async webSocketError() {
    await this.onSocketGone();
  }

  async onSocketGone() {
    if (this.isOnline()) return;
    // Debounce "offline": a reload re-opens a socket within a couple of seconds.
    await this.ctx.storage.setAlarm(Date.now() + OFFLINE_DEBOUNCE_MS);
  }

  async alarm() {
    await this.syncPresence();
  }

  /** Tell friends about presence if it differs from what they were last told. */
  async syncPresence() {
    const online = this.isOnline();
    const told = (await this.ctx.storage.get('told')) === true;
    if (online === told) return;
    await this.ctx.storage.put('told', online);
    const userId = await this.ctx.storage.get('userId');
    if (!userId) return;
    try {
      const rows = await query(
        this.env,
        `SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS fid
           FROM friendships
          WHERE status = 'accepted' AND (user_id = $1 OR friend_id = $1)`,
        [userId],
      );
      await Promise.all(rows.map((r) => pushToUser(this.env, r.fid, { t: 'presence', userId, online })));
    } catch {
      /* best effort */
    }
  }
}
