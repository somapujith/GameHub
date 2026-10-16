import { describe, it, expect } from 'vitest';
import {
  sanitizeName,
  validateName,
  parseAvatar,
  sanitizeChat,
  sanitizeEmote,
  sanitizeAction,
  isUuid,
  NAME_MAX,
} from './validate.js';

describe('names', () => {
  it('trims, collapses whitespace and strips control / invisible characters', () => {
    expect(sanitizeName('  Chai   Uncle  ')).toBe('Chai Uncle');
    expect(sanitizeName('A\u0000B\u0007C')).toBe('A B C');
    expect(sanitizeName('x‮y')).toBe('x y'); // bidi override
    expect(sanitizeName('​​')).toBe('');
    expect(sanitizeName(42)).toBe('');
  });

  it('truncates to 24 code points (emoji / Telugu safe)', () => {
    expect(sanitizeName('a'.repeat(40))).toHaveLength(NAME_MAX);
    const emoji = '\u{1F600}'.repeat(30);
    expect([...sanitizeName(emoji)]).toHaveLength(NAME_MAX);
  });

  it('validateName rejects empty and over-long names', () => {
    expect(validateName('  ')).toEqual({ ok: false, error: 'Name cannot be empty.' });
    expect(validateName('x'.repeat(25)).ok).toBe(false);
    expect(validateName('x'.repeat(24))).toEqual({ ok: true, value: 'x'.repeat(24) });
    expect(validateName('  Techie Teja ')).toEqual({ ok: true, value: 'Techie Teja' });
    expect(validateName('తెలుగు').ok).toBe(true); // Telugu
    expect(validateName(null).ok).toBe(false);
    expect(validateName({}).ok).toBe(false);
  });
});

describe('avatar / uuid / chat / emote', () => {
  it('avatar is an integer 0..11', () => {
    expect(parseAvatar(0)).toBe(0);
    expect(parseAvatar(11)).toBe(11);
    expect(parseAvatar('7')).toBe(7);
    for (const bad of [-1, 12, 1.5, NaN, null, undefined, '12', 'x', {}]) expect(parseAvatar(bad)).toBeNull();
  });

  it('isUuid', () => {
    expect(isUuid('0b9d7c3e-1d2a-4f5b-8c6d-123456789abc')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(5)).toBe(false);
  });

  it('chat text is cleaned and capped at 200', () => {
    expect(sanitizeChat('  hi\n\nthere\u0000 ')).toBe('hi there');
    expect(sanitizeChat('y'.repeat(500))).toHaveLength(200);
    expect(sanitizeChat(undefined)).toBe('');
  });

  it('only known emotes pass', () => {
    expect(sanitizeEmote('emote_mass')).toBe('emote_mass');
    expect(sanitizeEmote('emote_hack')).toBe('');
    expect(sanitizeEmote(5)).toBe('');
  });
});

describe('sanitizeAction forces the player id and drops everything unexpected', () => {
  it('parameter-less actions (including rules v2)', () => {
    const simple = [
      'ROLL', 'PAY_BAIL', 'BUY', 'SKIP_BUY', 'END_TURN', 'RESIGN',
      'PAY_DEBT', 'USE_JAIL_CARD', 'TRADE_ACCEPT', 'TRADE_REJECT', 'TRADE_CANCEL',
    ];
    for (const type of simple) {
      expect(sanitizeAction({ type, playerId: 'victim', dice: [6, 6], extra: 1 }, 'me')).toEqual({ type, playerId: 'me' });
    }
  });

  it('tile actions need a valid tile', () => {
    for (const type of ['UPGRADE', 'MORTGAGE', 'UNMORTGAGE', 'SELL_BUILDING']) {
      expect(sanitizeAction({ type, tile: 5 }, 'me')).toEqual({ type, tile: 5, playerId: 'me' });
      expect(sanitizeAction({ type, tile: 27 }, 'me')).toEqual({ type, tile: 27, playerId: 'me' });
      expect(sanitizeAction({ type, tile: 28 }, 'me')).toBeNull();
      expect(sanitizeAction({ type, tile: -1 }, 'me')).toBeNull();
      expect(sanitizeAction({ type, tile: '5' }, 'me')).toBeNull();
      expect(sanitizeAction({ type }, 'me')).toBeNull();
    }
  });

  it('BID needs a non-negative integer', () => {
    expect(sanitizeAction({ type: 'BID', amount: 0 }, 'me')).toEqual({ type: 'BID', amount: 0, playerId: 'me' });
    expect(sanitizeAction({ type: 'BID', amount: 1200 }, 'me')).toEqual({ type: 'BID', amount: 1200, playerId: 'me' });
    expect(sanitizeAction({ type: 'BID', amount: -1 }, 'me')).toBeNull();
    expect(sanitizeAction({ type: 'BID', amount: 1.5 }, 'me')).toBeNull();
    expect(sanitizeAction({ type: 'BID', amount: Infinity }, 'me')).toBeNull();
    expect(sanitizeAction({ type: 'BID', amount: 1e12 }, 'me')).toBeNull();
  });

  it('TRADE_OFFER is shape-checked and cleaned', () => {
    const ok = sanitizeAction(
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 500, tiles: [1, 2] }, get: { tiles: [4] }, junk: 1 },
      'me',
    );
    expect(ok).toEqual({
      type: 'TRADE_OFFER',
      to: 'bob',
      give: { cash: 500, tiles: [1, 2] },
      get: { cash: 0, tiles: [4] },
      playerId: 'me',
    });
    const bad = [
      { type: 'TRADE_OFFER', to: 'me', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } }, // to self
      { type: 'TRADE_OFFER', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } }, // no recipient
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 0, tiles: [] }, get: { cash: 0, tiles: [] } }, // empty deal
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: -5, tiles: [] }, get: { cash: 0, tiles: [] } },
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 1.5, tiles: [] }, get: { cash: 0, tiles: [] } },
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 0, tiles: [1, 1] }, get: { cash: 0, tiles: [] } }, // duplicate tile
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 0, tiles: [99] }, get: { cash: 0, tiles: [] } }, // off board
      { type: 'TRADE_OFFER', to: 'bob', give: { cash: 0, tiles: 'x' }, get: { cash: 1, tiles: [] } },
      { type: 'TRADE_OFFER', to: 'bob', give: 'cash', get: { cash: 1, tiles: [] } },
      { type: 'TRADE_OFFER', to: { id: 'bob' }, give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } },
    ];
    for (const b of bad) expect(sanitizeAction(b, 'me')).toBeNull();
  });

  it('rejects unknown / malformed actions', () => {
    for (const bad of [null, undefined, 'ROLL', [], { type: 'CHEAT' }, { type: 5 }, {}]) {
      expect(sanitizeAction(bad, 'me')).toBeNull();
    }
  });
});
