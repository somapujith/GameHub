import { describe, it, expect } from 'vitest';
import {
  parseRoomInit,
  parseSettingsPatch,
  parseVisibility,
  parseSeats,
  defaultSeats,
  defaultSanitizeAction,
  gameIdOf,
} from './roomrules.js';
import { getAdapter } from './games/index.js';
import { ROOM_DEFAULTS } from './settings.js';

const tycoon = getAdapter('hyderabad-tycoon');

describe('visibility', () => {
  it("is exactly 'private' or 'public'", () => {
    expect(parseVisibility('private')).toBe('private');
    expect(parseVisibility('public')).toBe('public');
    for (const bad of ['Public', 'PRIVATE', '', 'friends', null, undefined, true, 1, {}, []]) expect(parseVisibility(bad), String(bad)).toBeNull();
  });
});

describe('seats', () => {
  it('follow the adapter range; new rooms default to 4 (never above the adapter maximum)', () => {
    expect(parseSeats(tycoon, 2)).toBe(2);
    expect(parseSeats(tycoon, 6)).toBe(6);
    for (const bad of [1, 7, 2.5, '3', null, undefined, NaN]) expect(parseSeats(tycoon, bad), String(bad)).toBeNull();
    expect(defaultSeats(tycoon)).toBe(4);
    expect(defaultSeats({ minPlayers: 2, maxPlayers: 3 })).toBe(3);
    expect(defaultSeats({ minPlayers: 2, maxPlayers: 8, defaultMaxPlayers: 5 })).toBe(5);
  });
});

describe('parseRoomInit (POST /api/rooms and the room /init)', () => {
  it('an empty body creates a private Tycoon room with the defaults (old clients)', () => {
    const r = parseRoomInit({});
    expect(r).toMatchObject({ ok: true, gameId: 'hyderabad-tycoon', visibility: 'private', maxPlayers: 4, settings: ROOM_DEFAULTS });
    expect(parseRoomInit(undefined).ok).toBe(true);
    expect(parseRoomInit(null).ok).toBe(true);
    expect(gameIdOf(undefined)).toBe('hyderabad-tycoon');
    expect(gameIdOf(null)).toBe('hyderabad-tycoon');
  });

  it("rejects unknown games with the message 'unknown game'", () => {
    for (const gameId of ['ludo', '', 'HYDERABAD-TYCOON', '__proto__', 7, {}, [], false]) {
      expect(parseRoomInit({ gameId }), JSON.stringify(gameId)).toEqual({ ok: false, error: 'unknown game' });
    }
  });

  it('visibility is validated; public rooms are accepted', () => {
    expect(parseRoomInit({ visibility: 'public' })).toMatchObject({ ok: true, visibility: 'public' });
    expect(parseRoomInit({ visibility: 'secret' })).toMatchObject({ ok: false });
    expect(parseRoomInit({ visibility: 3 })).toMatchObject({ ok: false });
  });

  it('settings go through the adapter; seats may ride along in settings or in the body', () => {
    expect(parseRoomInit({ settings: { goal: 40000, maxRounds: null } })).toMatchObject({ ok: true, settings: { ...ROOM_DEFAULTS, goal: 40000, maxRounds: null } });
    expect(parseRoomInit({ settings: { maxPlayers: 5 } })).toMatchObject({ ok: true, maxPlayers: 5 });
    expect(parseRoomInit({ maxPlayers: 3, settings: { maxPlayers: 5 } })).toMatchObject({ maxPlayers: 3 });
    expect(parseRoomInit({ maxPlayers: 3 })).toMatchObject({ maxPlayers: 3 });
    expect(parseRoomInit({ maxPlayers: 9 })).toEqual({ ok: false, error: 'Players must be between 2 and 6.' });
    expect(parseRoomInit({ settings: { goal: 5 } })).toMatchObject({ ok: false, error: expect.stringMatching(/Winning target/) });
    expect(parseRoomInit({ settings: 'goal' })).toEqual({ ok: false, error: 'Settings must be an object.' });
    expect(parseRoomInit({ settings: [1] })).toEqual({ ok: false, error: 'Settings must be an object.' });
  });

  it('works for any registered adapter (lookup is injectable)', () => {
    const fake = { id: 'fake', name: 'Fake', minPlayers: 2, maxPlayers: 3, validateSettings: (raw) => ({ ok: true, settings: { ...raw } }) };
    const lookup = (id) => (id === 'fake' ? fake : null);
    expect(parseRoomInit({ gameId: 'fake', settings: { x: 1 }, visibility: 'public' }, lookup)).toMatchObject({
      ok: true,
      gameId: 'fake',
      maxPlayers: 3,
      visibility: 'public',
      settings: { x: 1 },
    });
    expect(parseRoomInit({ gameId: 'fake', maxPlayers: 4 }, lookup)).toEqual({ ok: false, error: 'Players must be between 2 and 3.' });
    expect(parseRoomInit({}, lookup)).toEqual({ ok: false, error: 'unknown game' }); // default game is not registered there
  });
});

describe('parseSettingsPatch (host settings message)', () => {
  const current = { ...ROOM_DEFAULTS };

  it('merges a partial patch over the current settings', () => {
    expect(parseSettingsPatch(tycoon, current, { goal: 100000 })).toEqual({ ok: true, settings: { ...ROOM_DEFAULTS, goal: 100000 } });
    expect(parseSettingsPatch(tycoon, current, { maxRounds: null }).settings.maxRounds).toBeNull();
    expect(parseSettingsPatch(tycoon, current, undefined)).toEqual({ ok: true, settings: ROOM_DEFAULTS });
  });

  it('maxPlayers is a shared setting handled outside the adapter', () => {
    expect(parseSettingsPatch(tycoon, current, { maxPlayers: 3 })).toEqual({ ok: true, settings: ROOM_DEFAULTS, maxPlayers: 3 });
    expect(parseSettingsPatch(tycoon, current, { maxPlayers: 9 })).toEqual({ ok: false, error: 'Players must be between 2 and 6.' });
  });

  it('rejects bad values and non-objects; unknown keys are ignored', () => {
    for (const bad of [{ goal: 5 }, { maxRounds: 120 }, { dice: 'loaded' }, { auctionOnDecline: 'yes' }]) {
      expect(parseSettingsPatch(tycoon, current, bad).ok, JSON.stringify(bad)).toBe(false);
    }
    for (const bad of ['x', 5, [1], true]) expect(parseSettingsPatch(tycoon, current, bad)).toEqual({ ok: false, error: 'Settings must be an object.' });
    expect(parseSettingsPatch(tycoon, current, { debug: true })).toEqual({ ok: true, settings: ROOM_DEFAULTS });
  });
});

describe('defaultSanitizeAction', () => {
  it('forces the player id and refuses anything that is not a typed object', () => {
    expect(defaultSanitizeAction({ type: 'INC', n: 2, playerId: 'evil' }, 'me')).toEqual({ type: 'INC', n: 2, playerId: 'me' });
    for (const bad of [null, undefined, 'INC', 5, [], {}, { type: 5 }, { type: '' }, { type: 'x'.repeat(41) }]) {
      expect(defaultSanitizeAction(bad, 'me'), JSON.stringify(bad)).toBeNull();
    }
  });
});
