import { describe, it, expect } from 'vitest';
import { readBodyText, MAX_BODY_BYTES } from './http.js';
import { allow, _resetForTests } from './ratelimit.js';
import { levelFromXp, xpToNext, matchRewards } from './xp.js';

describe('request body cap (16 KB)', () => {
  const post = (body, headers = {}) => new Request('https://t.example/api/x', { method: 'POST', body, headers });

  it('reads small bodies', async () => {
    expect(await readBodyText(post('{"a":1}'))).toBe('{"a":1}');
    expect(await readBodyText(post(''))).toBe('');
  });

  it('accepts exactly the limit and rejects one byte over', async () => {
    expect(MAX_BODY_BYTES).toBe(16384);
    expect(await readBodyText(post('x'.repeat(MAX_BODY_BYTES)))).toHaveLength(MAX_BODY_BYTES);
    await expect(readBodyText(post('x'.repeat(MAX_BODY_BYTES + 1)))).rejects.toMatchObject({ status: 413 });
  });

  it('rejects an oversized body even when Content-Length lies / is absent (streamed)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 40; i += 1) controller.enqueue(new TextEncoder().encode('y'.repeat(1024)));
        controller.close();
      },
    });
    const req = new Request('https://t.example/api/x', { method: 'POST', body: stream, duplex: 'half' });
    await expect(readBodyText(req)).rejects.toMatchObject({ status: 413 });
  });

  it('rejects by declared Content-Length without reading', async () => {
    const req = post('tiny', { 'content-length': String(MAX_BODY_BYTES + 5000) });
    await expect(readBodyText(req)).rejects.toMatchObject({ status: 413 });
  });
});

describe('rate limiter', () => {
  it('allows `limit` calls per window then blocks, then recovers', () => {
    _resetForTests();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i += 1) expect(allow('k', 5, 1000, t0 + i)).toBe(true);
    expect(allow('k', 5, 1000, t0 + 10)).toBe(false);
    expect(allow('other', 5, 1000, t0 + 10)).toBe(true); // keys are independent
    expect(allow('k', 5, 1000, t0 + 1500)).toBe(true); // new window
  });
});

describe('xp / levels / rewards', () => {
  it('levels up on a growing curve', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpToNext(1) - 1)).toBe(1);
    expect(levelFromXp(xpToNext(1))).toBe(2);
    expect(levelFromXp(xpToNext(1) + xpToNext(2))).toBe(3);
    expect(levelFromXp(-5)).toBe(1);
    expect(levelFromXp(NaN)).toBe(1);
  });

  it('winners earn more than runners-up, and everyone earns something', () => {
    const win = matchRewards({ won: true, rank: 1, playerCount: 4 });
    const second = matchRewards({ won: false, rank: 2, playerCount: 4 });
    const last = matchRewards({ won: false, rank: 4, playerCount: 4 });
    expect(win.xp).toBeGreaterThan(second.xp);
    expect(second.xp).toBeGreaterThan(last.xp);
    expect(last.xp).toBeGreaterThan(0);
    expect(last.coins).toBeGreaterThan(0);
  });
});
