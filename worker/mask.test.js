import { describe, it, expect } from 'vitest';
import { maskStateFor, hasSealedBids } from './mask.js';

const auctionState = () => ({
  phase: 'auction',
  round: 3,
  pending: { type: 'auction', tile: 5, minBid: 50, bids: { a: 300, b: 0, c: 120 } },
  players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
});

describe('sealed-bid masking', () => {
  it('shows a player only their own amount; keeps every key (so "has bid" stays visible)', () => {
    const s = auctionState();
    expect(maskStateFor(s, 'a').pending.bids).toEqual({ a: 300, b: 0, c: 0 });
    expect(maskStateFor(s, 'c').pending.bids).toEqual({ a: 0, b: 0, c: 120 });
    expect(Object.keys(maskStateFor(s, 'b').pending.bids).sort()).toEqual(['a', 'b', 'c']);
    // spectators / unknown users see no amounts at all
    expect(maskStateFor(s, 'zzz').pending.bids).toEqual({ a: 0, b: 0, c: 0 });
    expect(maskStateFor(s, undefined).pending.bids).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('never mutates the authoritative state and leaves everything else untouched', () => {
    const s = auctionState();
    const copy = structuredClone(s);
    const masked = maskStateFor(s, 'a');
    expect(s).toEqual(copy);
    expect(masked).not.toBe(s);
    expect(masked.pending).not.toBe(s.pending);
    expect({ ...masked, pending: null }).toEqual({ ...s, pending: null });
    expect(masked.pending).toMatchObject({ type: 'auction', tile: 5, minBid: 50 });
  });

  it('is a no-op (same object) when no auction is pending', () => {
    const buy = { phase: 'buy', pending: { type: 'buy', tile: 3, price: 700 } };
    expect(maskStateFor(buy, 'a')).toBe(buy);
    const none = { phase: 'roll', pending: null };
    expect(maskStateFor(none, 'a')).toBe(none);
    expect(maskStateFor(null, 'a')).toBeNull();
    expect(hasSealedBids(buy)).toBe(false);
    expect(hasSealedBids(auctionState())).toBe(true);
  });

  it('survives an auction with no bids yet and malformed bids', () => {
    expect(maskStateFor({ pending: { type: 'auction', bids: {} } }, 'a').pending.bids).toEqual({});
    const odd = { pending: { type: 'auction' } };
    expect(maskStateFor(odd, 'a')).toBe(odd);
  });
});
