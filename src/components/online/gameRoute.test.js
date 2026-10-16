import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_ID,
  forgetRoomGames,
  knownRoomGame,
  lookupResult,
  rememberRoomGame,
  resolveOnlineRoute,
  roomGameId,
  roomVisibility,
} from './gameRoute.js';

describe('roomGameId / roomVisibility', () => {
  it('reads the game of a room, defaulting to the first game for old rooms', () => {
    expect(roomGameId({ gameId: 'ludo-lanes' })).toBe('ludo-lanes');
    expect(roomGameId({})).toBe(DEFAULT_GAME_ID);
    expect(roomGameId({ gameId: '' })).toBe(DEFAULT_GAME_ID);
    expect(roomGameId({ gameId: 42 })).toBe(DEFAULT_GAME_ID);
    expect(roomGameId(null)).toBe(DEFAULT_GAME_ID);
    expect(DEFAULT_GAME_ID).toBe('hyderabad-tycoon');
  });
  it('anything but "public" is private', () => {
    expect(roomVisibility({ visibility: 'public' })).toBe('public');
    expect(roomVisibility({ visibility: 'private' })).toBe('private');
    expect(roomVisibility({})).toBe('private');
    expect(roomVisibility(null)).toBe('private');
  });
});

describe('resolveOnlineRoute (the dispatcher redirect logic)', () => {
  it('renders the route game when the room belongs to it', () => {
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: { exists: true, gameId: 'hyderabad-tycoon' } })).toEqual({ kind: 'ok' });
  });
  it('treats a room without gameId as the default game (old rooms, old servers)', () => {
    expect(resolveOnlineRoute({ gameId: DEFAULT_GAME_ID, code: 'ABC234', room: { exists: true } })).toEqual({ kind: 'ok' });
    expect(resolveOnlineRoute({ gameId: 'ludo-lanes', code: 'ABC234', room: { exists: true } })).toEqual({ kind: 'redirect', to: '/play/hyderabad-tycoon/online/ABC234' });
  });
  it("redirects to the room's own game when the URL names another one", () => {
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: { exists: true, gameId: 'ludo-lanes' } })).toEqual({
      kind: 'redirect',
      to: '/play/ludo-lanes/online/ABC234',
    });
  });
  it('redirects even from an unknown game id (the room decides)', () => {
    expect(resolveOnlineRoute({ gameId: 'nope', code: 'XYZ789', room: { exists: true, gameId: 'hyderabad-tycoon' } }).to).toBe('/play/hyderabad-tycoon/online/XYZ789');
  });
  it('escapes ids in the redirect', () => {
    expect(resolveOnlineRoute({ gameId: 'a', code: 'ABC234', room: { gameId: 'we ird/id' } }).to).toBe('/play/we%20ird%2Fid/online/ABC234');
  });
  it('reports a room that does not exist', () => {
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: { exists: false } })).toEqual({ kind: 'missing' });
  });
  it('an inconclusive lookup lets the game page show its own reconnect state', () => {
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: null })).toEqual({ kind: 'ok' });
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: undefined })).toEqual({ kind: 'ok' });
  });
});

describe('lookupResult', () => {
  it('maps the outcome of GET /api/rooms/:code', () => {
    const info = { exists: true, gameId: 'g' };
    expect(lookupResult(null, info)).toBe(info);
    expect(lookupResult(null, undefined)).toBeNull();
    expect(lookupResult({ status: 404 })).toEqual({ exists: false });
    expect(lookupResult({ status: 0 })).toBeNull(); // offline
    expect(lookupResult({ status: 500 })).toBeNull();
    expect(lookupResult({ status: 429 })).toBeNull();
  });
});

describe('remembered room games (lobby -> game hop without another lookup)', () => {
  beforeEach(() => forgetRoomGames());
  it('remembers for a couple of minutes, then forgets', () => {
    rememberRoomGame('ABC234', 'ludo-lanes', 1000);
    expect(knownRoomGame('ABC234', 1000 + 60 * 1000)).toBe('ludo-lanes');
    expect(knownRoomGame('ABC234', 1000 + 3 * 60 * 1000)).toBeNull();
    expect(knownRoomGame('ABC234', 1000 + 60 * 1000)).toBeNull(); // dropped once expired
  });
  it('ignores empty input and keeps the cache bounded', () => {
    rememberRoomGame('', 'x');
    rememberRoomGame('ABC234', '');
    expect(knownRoomGame('ABC234')).toBeNull();
    for (let i = 0; i < 40; i += 1) rememberRoomGame(`C${i}`, 'g', 5);
    expect(knownRoomGame('C0', 5)).toBeNull();
    expect(knownRoomGame('C39', 5)).toBe('g');
  });
  it('feeds the dispatcher: a remembered room of the same game needs no lookup', () => {
    rememberRoomGame('ABC234', 'ludo-lanes');
    const known = knownRoomGame('ABC234');
    expect(resolveOnlineRoute({ gameId: 'ludo-lanes', code: 'ABC234', room: { gameId: known } })).toEqual({ kind: 'ok' });
    expect(resolveOnlineRoute({ gameId: 'hyderabad-tycoon', code: 'ABC234', room: { gameId: known } }).kind).toBe('redirect');
  });
});
