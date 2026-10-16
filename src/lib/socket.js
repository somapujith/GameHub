// Robust JSON WebSocket client: heartbeat, exponential-backoff reconnect, send queue.
// Plain JS, no React. Used by the room hooks and by the signed-in user socket.
//
//   const sock = openRoomSocket('ABC234');
//   const off = sock.on('message', (msg) => …);   // parsed JSON objects ({t:'room'}, {t:'state'}, …)
//   sock.on('status', (status, info) => …);       // 'connecting' | 'open' | 'reconnecting' | 'closed'
//   sock.on('open', ({ reconnect }) => …);        // fired on every (re)connect
//   sock.send({ t: 'ready', ready: true });       // queued while the socket is not open
//   sock.close();                                 // terminal: no more reconnects

export const HEARTBEAT_MS = 20000;
export const BACKOFF_BASE_MS = 500;
export const BACKOFF_CAP_MS = 8000;
export const MAX_QUEUE = 50;
// A connection that lived this long counts as healthy: the backoff starts over after it drops.
const HEALTHY_MS = 5000;
// Close codes that mean "do not come back": policy violation, and app-level auth/forbidden/not-found codes.
// 4001 sign in, 4003 forbidden/kicked, 4004 not found, 4009 replaced by another tab/device (the server's codes).
export const NO_RETRY_CODES = [1008, 4001, 4003, 4004, 4009, 4401, 4403, 4404];

/**
 * Delay before reconnect attempt number `attempt` (0-based): 500 ms, 1 s, 2 s, 4 s, then 8 s.
 * "Equal jitter": the result is between 50% and 100% of the exponential value, never above `cap`.
 */
export function backoffDelay(attempt, { base = BACKOFF_BASE_MS, cap = BACKOFF_CAP_MS, rnd = Math.random, jitter = true } = {}) {
  const n = Math.min(30, Math.max(0, Math.floor(Number(attempt)) || 0));
  const exp = Math.min(cap, base * 2 ** n);
  if (!jitter) return exp;
  return Math.round(exp / 2 + (rnd() * exp) / 2);
}

/** ws(s) URL on the same host as the page, so the Vite `/ws` proxy and the Worker both just work. */
export function wsUrl(path, loc = globalThis.location) {
  const p = String(path).startsWith('/') ? String(path) : `/${path}`;
  if (!loc || !loc.host) return `ws://localhost:8787${p}`;
  return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}${p}`;
}

const hasWindow = () => typeof window !== 'undefined' && typeof window.addEventListener === 'function';

export class ReconnectingSocket {
  /**
   * @param {string} path  e.g. '/ws/room/ABC234'
   * @param {object} [opts] heartbeatMs, staleMs (0 = off), baseDelay, maxDelay, maxAttempts, noRetryCodes,
   *                        WebSocketImpl, location, rnd, autoConnect
   */
  constructor(path, opts = {}) {
    this.path = path;
    this.opts = {
      heartbeatMs: HEARTBEAT_MS,
      staleMs: 0,
      baseDelay: BACKOFF_BASE_MS,
      maxDelay: BACKOFF_CAP_MS,
      maxAttempts: Infinity,
      noRetryCodes: NO_RETRY_CODES,
      WebSocketImpl: globalThis.WebSocket,
      location: undefined,
      rnd: Math.random,
      autoConnect: true,
      ...opts,
    };
    this.status = 'idle';
    this.attempt = 0; // consecutive failed attempts (0 while healthy)
    this.everOpen = false;
    this._ws = null;
    this._queue = [];
    this._closed = false;
    this._listeners = { message: new Set(), status: new Set(), open: new Set(), close: new Set() };
    this._hb = null;
    this._retry = null;
    this._start = null;
    this._lastRx = 0;
    this._openedAt = 0;

    this._onOnline = () => this._kick();
    this._onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      this._kick();
    };
    if (hasWindow()) {
      window.addEventListener('online', this._onOnline);
      document.addEventListener('visibilitychange', this._onVisible);
    }
    if (this.opts.autoConnect) this.connect();
  }

  /** Start connecting (deferred one tick so a React StrictMode mount/unmount never opens a socket). */
  connect() {
    if (this._closed || this._ws || this._start || this._retry) return this;
    if (this.status === 'idle') this._setStatus('connecting');
    this._start = setTimeout(() => {
      this._start = null;
      this._open();
    }, 0);
    return this;
  }

  on(event, fn) {
    const set = this._listeners[event];
    if (!set || typeof fn !== 'function') return () => {};
    set.add(fn);
    return () => set.delete(fn);
  }

  /** Send JSON. Queued while the socket is not open (unless `{queue:false}`). Returns false if dropped. */
  send(msg, { queue = true } = {}) {
    if (this._closed) return false;
    if (this._isOpen()) {
      if (this._queue.length) this._flush();
      return this._rawSend(msg);
    }
    if (!queue) return false;
    if (this._queue.length >= MAX_QUEUE) this._queue.shift();
    this._queue.push(msg);
    return true;
  }

  get isOpen() {
    return this._isOpen();
  }

  get queued() {
    return this._queue.length;
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._clearTimers();
    this._queue = [];
    if (hasWindow()) {
      window.removeEventListener('online', this._onOnline);
      document.removeEventListener('visibilitychange', this._onVisible);
    }
    const ws = this._ws;
    this._ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close(1000, 'client');
      } catch {
        /* already closed */
      }
    }
    this._setStatus('closed', { reason: 'client' });
    this._emit('close', { code: 1000, reason: 'client', clean: true });
    Object.values(this._listeners).forEach((s) => s.clear());
  }

  // ---- internals

  _isOpen() {
    return !!this._ws && this._ws.readyState === 1;
  }

  _url() {
    return wsUrl(this.path, this.opts.location);
  }

  _open() {
    if (this._closed) return;
    this._retry = null;
    const Impl = this.opts.WebSocketImpl;
    if (!Impl) {
      this._terminate({ reason: 'unsupported' });
      return;
    }
    let ws;
    try {
      ws = new Impl(this._url());
    } catch {
      this._scheduleRetry();
      return;
    }
    this._ws = ws;
    ws.onopen = () => {
      if (ws !== this._ws || this._closed) return;
      const reconnect = this.everOpen;
      this.everOpen = true;
      this._openedAt = Date.now();
      this._lastRx = this._openedAt;
      this._setStatus('open', { reconnect });
      this._startHeartbeat();
      this._flush();
      this._emit('open', { reconnect });
    };
    ws.onmessage = (ev) => {
      if (ws !== this._ws) return;
      this._lastRx = Date.now();
      let data = ev.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;
      if (data.t === 'pong') return;
      this._emit('message', data);
    };
    ws.onerror = () => {
      /* a close event always follows; nothing useful to do here */
    };
    ws.onclose = (ev) => {
      if (ws !== this._ws) return;
      this._ws = null;
      this._stopHeartbeat();
      const code = ev && typeof ev.code === 'number' ? ev.code : 1006;
      if (this._openedAt && Date.now() - this._openedAt >= HEALTHY_MS) this.attempt = 0;
      this._openedAt = 0;
      this._emit('close', { code, reason: (ev && ev.reason) || '', clean: !!(ev && ev.wasClean) });
      if (this._closed) return;
      if (this.opts.noRetryCodes.includes(code)) {
        this._terminate({ reason: 'fatal_close', code, closeReason: (ev && ev.reason) || '' });
        return;
      }
      this._scheduleRetry();
    };
  }

  _scheduleRetry() {
    if (this._closed) return;
    this._stopHeartbeat();
    if (this.attempt >= this.opts.maxAttempts) {
      this._terminate({ reason: 'max_attempts' });
      return;
    }
    const delay = backoffDelay(this.attempt, { base: this.opts.baseDelay, cap: this.opts.maxDelay, rnd: this.opts.rnd });
    this.attempt += 1;
    this._setStatus('reconnecting', { attempt: this.attempt, delay });
    this._retry = setTimeout(() => this._open(), delay);
  }

  /** Give up for good (fatal close code, attempts exhausted). Behaves like close(), but reports why. */
  _terminate(info) {
    if (this._closed) return;
    this._closed = true;
    this._clearTimers();
    if (hasWindow()) {
      window.removeEventListener('online', this._onOnline);
      document.removeEventListener('visibilitychange', this._onVisible);
    }
    this._setStatus('closed', info);
  }

  /** Network came back / tab became visible: reconnect now instead of waiting, or detect a dead socket. */
  _kick() {
    if (this._closed) return;
    if (this._ws && this._isOpen()) {
      const { staleMs } = this.opts;
      if (staleMs && Date.now() - this._lastRx > staleMs) this._forceReconnect();
      return;
    }
    if (this._retry) {
      clearTimeout(this._retry);
      this._retry = null;
      this._open();
    }
  }

  _forceReconnect() {
    const ws = this._ws;
    this._ws = null;
    this._stopHeartbeat();
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close(4000, 'stale');
      } catch {
        /* ignore */
      }
    }
    this._openedAt = 0;
    this._emit('close', { code: 4000, reason: 'stale', clean: false });
    this._scheduleRetry();
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    const { heartbeatMs, staleMs } = this.opts;
    if (!heartbeatMs) return;
    this._hb = setInterval(() => {
      if (!this._isOpen()) return;
      if (staleMs && Date.now() - this._lastRx > staleMs) {
        this._forceReconnect();
        return;
      }
      this._rawSend({ t: 'ping' });
    }, heartbeatMs);
  }

  _stopHeartbeat() {
    if (this._hb) clearInterval(this._hb);
    this._hb = null;
  }

  _clearTimers() {
    this._stopHeartbeat();
    if (this._retry) clearTimeout(this._retry);
    if (this._start) clearTimeout(this._start);
    this._retry = this._start = null;
  }

  _rawSend(msg) {
    try {
      this._ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  _flush() {
    while (this._queue.length && this._isOpen()) {
      const m = this._queue.shift();
      if (!this._rawSend(m)) {
        this._queue.unshift(m);
        break;
      }
    }
  }

  _setStatus(status, info = {}) {
    this.status = status;
    this._emit('status', status, info);
  }

  _emit(event, ...args) {
    for (const fn of [...this._listeners[event]]) {
      try {
        fn(...args);
      } catch {
        /* a bad listener must never break the socket */
      }
    }
  }
}

/** Room socket: `/ws/room/:code`. Dead-connection detection is on (the room answers pings with pong). */
export function openRoomSocket(code, opts = {}) {
  return new ReconnectingSocket(`/ws/room/${encodeURIComponent(String(code))}`, {
    staleMs: HEARTBEAT_MS * 2 + 5000,
    ...opts,
  });
}

/** Signed-in user socket: `/ws/user` (friend requests, invites, presence). Calmer backoff cap. */
export function openUserSocket(opts = {}) {
  return new ReconnectingSocket('/ws/user', { maxDelay: 15000, ...opts });
}
