import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReconnectingSocket, backoffDelay, wsUrl, MAX_QUEUE } from './socket.js';

class FakeWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWS.instances.push(this);
  }
  send(data) {
    if (this.readyState !== 1) throw new Error('not open');
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.readyState = 3;
    this.closedWith = code;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  push(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code, reason: '', wasClean: false });
  }
}

const last = () => FakeWS.instances[FakeWS.instances.length - 1];
const make = (opts = {}) =>
  new ReconnectingSocket('/ws/room/ABC234', { WebSocketImpl: FakeWS, rnd: () => 1, ...opts });

describe('backoffDelay', () => {
  it('doubles from 500 ms and caps at 8 s', () => {
    const d = (n) => backoffDelay(n, { jitter: false });
    expect([0, 1, 2, 3, 4, 5, 20, 1000].map(d)).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000, 8000]);
  });
  it('jitter stays within 50-100% of the exponential value and never above the cap', () => {
    for (let n = 0; n < 12; n++) {
      const full = backoffDelay(n, { jitter: false });
      expect(backoffDelay(n, { rnd: () => 0 })).toBe(Math.round(full / 2));
      expect(backoffDelay(n, { rnd: () => 0.999999 })).toBeLessThanOrEqual(8000);
      expect(backoffDelay(n, { rnd: () => 1 })).toBe(full);
    }
  });
  it('tolerates junk input', () => {
    expect(backoffDelay(undefined, { jitter: false })).toBe(500);
    expect(backoffDelay(-5, { jitter: false })).toBe(500);
    expect(backoffDelay(NaN, { jitter: false })).toBe(500);
  });
});

describe('wsUrl', () => {
  it('uses wss on https and ws on http, same host', () => {
    expect(wsUrl('/ws/user', { protocol: 'https:', host: 'game.example.com' })).toBe('wss://game.example.com/ws/user');
    expect(wsUrl('ws/user', { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws/user');
  });
  it('falls back to the dev worker when there is no location (node)', () => {
    expect(wsUrl('/ws/user', null)).toBe('ws://localhost:8787/ws/user');
  });
});

describe('ReconnectingSocket', () => {
  beforeEach(() => {
    FakeWS.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defers the connection by one tick and builds the URL from the location option', () => {
    const s = make({ location: { protocol: 'https:', host: 'x.dev' } });
    expect(FakeWS.instances).toHaveLength(0);
    vi.advanceTimersByTime(0);
    expect(last().url).toBe('wss://x.dev/ws/room/ABC234');
    expect(s.status).toBe('connecting');
    s.close();
  });

  it('never opens a socket when closed before the first tick (StrictMode)', () => {
    const s = make();
    s.close();
    vi.advanceTimersByTime(10);
    expect(FakeWS.instances).toHaveLength(0);
    expect(s.status).toBe('closed');
  });

  it('queues messages while connecting and flushes them in order on open', () => {
    const s = make();
    s.send({ t: 'ready', ready: true });
    s.send({ t: 'chat', text: 'hi' });
    expect(s.queued).toBe(2);
    vi.advanceTimersByTime(0);
    expect(last().sent).toEqual([]);
    last().open();
    expect(last().sent).toEqual([{ t: 'ready', ready: true }, { t: 'chat', text: 'hi' }]);
    expect(s.queued).toBe(0);
    s.send({ t: 'start' });
    expect(last().sent.at(-1)).toEqual({ t: 'start' });
    s.close();
  });

  it('caps the queue and honours {queue:false}', () => {
    const s = make();
    for (let i = 0; i < MAX_QUEUE + 10; i++) s.send({ i });
    expect(s.queued).toBe(MAX_QUEUE);
    expect(s.send({ t: 'x' }, { queue: false })).toBe(false);
    s.close();
  });

  it('emits parsed messages, swallows pong and ignores junk', () => {
    const s = make();
    const got = [];
    s.on('message', (m) => got.push(m));
    vi.advanceTimersByTime(0);
    last().open();
    last().push({ t: 'room', room: { code: 'ABC234' } });
    last().push({ t: 'pong' });
    last().onmessage({ data: 'not json' });
    last().onmessage({ data: '42' });
    expect(got).toEqual([{ t: 'room', room: { code: 'ABC234' } }]);
    s.close();
  });

  it('sends a ping every 20 s while open', () => {
    const s = make();
    vi.advanceTimersByTime(0);
    last().open();
    vi.advanceTimersByTime(20000);
    vi.advanceTimersByTime(20000);
    expect(last().sent.filter((m) => m.t === 'ping')).toHaveLength(2);
    s.close();
  });

  it('reconnects with exponential backoff, flags reconnect on open, and flushes the queue', () => {
    const s = make();
    const statuses = [];
    const opens = [];
    s.on('status', (st) => statuses.push(st));
    s.on('open', (o) => opens.push(o.reconnect));
    vi.advanceTimersByTime(0);
    last().open();
    expect(opens).toEqual([false]);

    last().drop(1006);
    expect(s.status).toBe('reconnecting');
    s.send({ t: 'ready', ready: true }); // while down
    expect(FakeWS.instances).toHaveLength(1);
    vi.advanceTimersByTime(499);
    expect(FakeWS.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(2); // attempt 1 after 500 ms

    last().drop(1006); // fails to connect: next delay is 1000 ms
    vi.advanceTimersByTime(999);
    expect(FakeWS.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(3);

    last().open();
    expect(opens).toEqual([false, true]);
    expect(last().sent).toEqual([{ t: 'ready', ready: true }]);
    expect(statuses).toContain('open');
    expect(s.attempt).toBe(2);
    s.close();
  });

  it('resets the backoff after a healthy connection', () => {
    const s = make();
    vi.advanceTimersByTime(0);
    last().open();
    vi.advanceTimersByTime(6000);
    last().drop(1006);
    expect(s.attempt).toBe(1); // reset to 0, then this retry counted
    vi.advanceTimersByTime(500);
    expect(FakeWS.instances).toHaveLength(2);
    s.close();
  });

  it('keeps growing the backoff when the server accepts and drops immediately', () => {
    const s = make();
    vi.advanceTimersByTime(0);
    for (let i = 0; i < 4; i++) {
      last().open();
      last().drop(1006);
      vi.advanceTimersByTime(8000);
    }
    expect(s.attempt).toBeGreaterThanOrEqual(4);
    s.close();
  });

  it('caps the delay at 8 s', () => {
    const s = make();
    vi.advanceTimersByTime(0);
    for (let i = 0; i < 8; i++) {
      last().drop(1006);
      vi.advanceTimersByTime(8000);
    }
    const n = FakeWS.instances.length;
    last().drop(1006);
    vi.advanceTimersByTime(7999);
    expect(FakeWS.instances).toHaveLength(n);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances).toHaveLength(n + 1);
    s.close();
  });

  it('close() is terminal, idempotent and stops the heartbeat and reconnects', () => {
    const s = make();
    vi.advanceTimersByTime(0);
    const ws = last();
    ws.open();
    s.close();
    s.close();
    expect(ws.closedWith).toBe(1000);
    expect(s.status).toBe('closed');
    expect(s.send({ t: 'x' })).toBe(false);
    vi.advanceTimersByTime(120000);
    expect(FakeWS.instances).toHaveLength(1);
    expect(ws.sent.filter((m) => m.t === 'ping')).toHaveLength(0);
  });

  it('does not retry on fatal close codes and reports why', () => {
    const s = make();
    const infos = [];
    s.on('status', (st, info) => infos.push([st, info]));
    vi.advanceTimersByTime(0);
    last().open();
    last().drop(1008);
    vi.advanceTimersByTime(60000);
    expect(FakeWS.instances).toHaveLength(1);
    expect(s.status).toBe('closed');
    expect(infos.at(-1)).toEqual(['closed', { reason: 'fatal_close', code: 1008, closeReason: '' }]);
  });

  it("passes the server's close reason text through and treats the app codes as fatal", () => {
    for (const code of [4001, 4003, 4004, 4009]) {
      FakeWS.instances = [];
      const s = make();
      const infos = [];
      s.on('status', (st, info) => infos.push([st, info]));
      vi.advanceTimersByTime(0);
      last().open();
      last().readyState = 3;
      last().onclose({ code, reason: 'That room does not exist.', wasClean: true });
      vi.advanceTimersByTime(60000);
      expect(FakeWS.instances).toHaveLength(1);
      expect(infos.at(-1)).toEqual(['closed', { reason: 'fatal_close', code, closeReason: 'That room does not exist.' }]);
    }
  });

  it('gives up after maxAttempts', () => {
    const s = make({ maxAttempts: 2 });
    vi.advanceTimersByTime(0);
    last().drop(1006);
    vi.advanceTimersByTime(8000);
    last().drop(1006);
    vi.advanceTimersByTime(8000);
    last().drop(1006);
    vi.advanceTimersByTime(8000);
    expect(FakeWS.instances).toHaveLength(3);
    expect(s.status).toBe('closed');
  });

  it('reconnects when the connection goes silent past staleMs', () => {
    const s = make({ staleMs: 45000 });
    vi.advanceTimersByTime(0);
    last().open();
    vi.advanceTimersByTime(20000);
    last().push({ t: 'pong' });
    vi.advanceTimersByTime(20000);
    vi.advanceTimersByTime(20000);
    vi.advanceTimersByTime(20000); // 60 s since the last rx -> stale
    expect(s.status).toBe('reconnecting');
    vi.advanceTimersByTime(8000);
    expect(FakeWS.instances.length).toBe(2);
    s.close();
  });

  it('a throwing listener does not break delivery to others', () => {
    const s = make();
    const got = [];
    s.on('message', () => {
      throw new Error('boom');
    });
    s.on('message', (m) => got.push(m.t));
    vi.advanceTimersByTime(0);
    last().open();
    last().push({ t: 'a' });
    expect(got).toEqual(['a']);
    s.close();
  });

  it('survives a constructor that throws', () => {
    class Boom {
      constructor() {
        throw new Error('nope');
      }
    }
    const s = new ReconnectingSocket('/ws/user', { WebSocketImpl: Boom, rnd: () => 1 });
    vi.advanceTimersByTime(0);
    expect(s.status).toBe('reconnecting');
    s.close();
  });
});
