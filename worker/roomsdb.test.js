import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn(async () => []);
vi.mock('./db.js', async (importOriginal) => ({ ...(await importOriginal()), query: (...a) => queryMock(...a) }));

const db = await import('./roomsdb.js');
const {
  buildOpenRoomsQuery,
  buildOpenCountsQuery,
  buildMyRoomsQuery,
  clampLimit,
  roomRow,
  rowSignature,
  rowToOpenRoom,
  rowToMyRoom,
  listOpenRooms,
  countOpenTables,
  upsertRoomRow,
  deleteRoomRow,
  hasDb,
  UPSERT_ROOM_SQL,
} = db;

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';

const room = (over = {}) => ({
  code: 'ABCD23',
  gameId: 'hyderabad-tycoon',
  visibility: 'public',
  status: 'lobby',
  hostId: U1,
  maxPlayers: 4,
  settings: { goal: 70000 },
  createdAt: 1_760_000_000_000,
  players: [
    { id: U1, name: 'Host', isBot: false },
    { id: U2, name: 'Guest', isBot: false, left: true },
    { id: 'bot_x', name: 'Chai Uncle', isBot: true },
  ],
  ...over,
});

describe('clampLimit', () => {
  it('is 1..20, defaulting to 20', () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit('5')).toBe(5);
    expect(clampLimit(7)).toBe(7);
    expect(clampLimit('500')).toBe(20);
    for (const bad of ['0', '-3', 'abc', '1.5', 0, -1, 2.5, NaN, null, {}, '1e3']) expect(clampLimit(bad), String(bad)).toBe(20);
  });
});

describe('open rooms query', () => {
  it('only public lobbies with a free seat that were seen recently, newest first, max 20', () => {
    const q = buildOpenRoomsQuery({});
    expect(q.text).toMatch(/visibility = 'public'/);
    expect(q.text).toMatch(/status = 'lobby'/);
    expect(q.text).toMatch(/player_count < max_players/);
    expect(q.text).toMatch(/updated_at > now\(\) - interval '60 minutes'/);
    expect(q.text).toMatch(/ORDER BY updated_at DESC/);
    expect(q.text).toMatch(/FROM rooms/);
    expect(q.text).not.toMatch(/game_id =/);
    expect(q.params).toEqual([20]);
    expect(q.text).toMatch(/LIMIT \$1$/);
  });

  it('a game filter is a bound parameter, never part of the SQL text', () => {
    const q = buildOpenRoomsQuery({ game: "x'; DROP TABLE rooms; --", limit: '3' });
    expect(q.text).not.toMatch(/DROP/);
    expect(q.text).toMatch(/game_id = \$1/);
    expect(q.text).toMatch(/LIMIT \$2$/);
    expect(q.params).toEqual(["x'; DROP TABLE rooms; --", 3]);
  });

  it('counts per game use the same filter', () => {
    const q = buildOpenCountsQuery();
    expect(q.text).toMatch(/GROUP BY game_id/);
    expect(q.text).toMatch(/visibility = 'public'/);
    expect(q.params).toEqual([]);
  });

  it('my rooms: membership by array containment, lobby or playing, last 24 h', () => {
    const q = buildMyRoomsQuery(U1);
    expect(q.text).toMatch(/member_ids @> ARRAY\[\$1::uuid\]/);
    expect(q.text).toMatch(/status IN \('lobby', 'playing'\)/);
    expect(q.text).toMatch(/interval '24 hours'/);
    expect(q.params).toEqual([U1]);
  });
});

describe('row mapping', () => {
  it('roomRow: counts bots as seats, lists only present humans as members', () => {
    const row = roomRow(room());
    expect(row).toMatchObject({
      code: 'ABCD23',
      gameId: 'hyderabad-tycoon',
      hostId: U1,
      hostName: 'Host',
      visibility: 'public',
      status: 'lobby',
      playerCount: 3,
      maxPlayers: 4,
      settings: { goal: 70000 },
      memberIds: [U1],
    });
    expect(roomRow(room({ hostId: 'not-a-uuid' })).hostId).toBeNull();
  });

  it('rowSignature ignores createdAt but notices every listing-relevant change', () => {
    const base = rowSignature(roomRow(room()));
    expect(rowSignature(roomRow(room({ createdAt: 5 })))).toBe(base);
    expect(rowSignature(roomRow(room({ visibility: 'private' })))).not.toBe(base);
    expect(rowSignature(roomRow(room({ status: 'playing' })))).not.toBe(base);
    expect(rowSignature(roomRow(room({ maxPlayers: 5 })))).not.toBe(base);
    expect(rowSignature(roomRow(room({ settings: { goal: 5 } })))).not.toBe(base);
    expect(rowSignature(roomRow(room({ players: room().players.slice(0, 2) })))).not.toBe(base);
  });

  it('rowToOpenRoom: the documented shape, with a game summary', () => {
    const out = rowToOpenRoom({
      code: 'ABCD23',
      game_id: 'hyderabad-tycoon',
      host_name: 'Host',
      player_count: 2,
      max_players: 4,
      settings: { goal: 70000, maxRounds: 50 },
      created_at: new Date('2026-10-16T10:00:00Z'),
    });
    expect(out).toEqual({
      code: 'ABCD23',
      gameId: 'hyderabad-tycoon',
      hostName: 'Host',
      players: 2,
      maxPlayers: 4,
      summary: 'Target ₹70,000 · 50 rounds',
      createdAt: '2026-10-16T10:00:00.000Z',
    });
    // an unknown game still lists (without a summary)
    const other = rowToOpenRoom({ code: 'ZZZZ22', game_id: 'ludo', host_name: null, player_count: 1, max_players: 2, settings: {}, created_at: '2026-10-16T10:00:00Z' });
    expect(other.summary).toBeUndefined();
    expect(other.hostName).toBeNull();
  });

  it('rowToMyRoom', () => {
    expect(rowToMyRoom({ code: 'ABCD23', game_id: 'g', status: 'playing', player_count: 3, max_players: 4 })).toEqual({
      code: 'ABCD23',
      gameId: 'g',
      status: 'playing',
      players: 3,
      maxPlayers: 4,
    });
  });
});

describe('database access', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    db._resetRoomsCacheForTests();
  });

  it('hasDb', () => {
    expect(hasDb({ DATABASE_URL: 'postgres://x' })).toBe(true);
    expect(hasDb({})).toBe(false);
    expect(hasDb(undefined)).toBe(false);
  });

  it('upsert / delete are no-ops without a database and parameterised with one', async () => {
    await upsertRoomRow({}, roomRow(room()));
    await deleteRoomRow({}, 'ABCD23');
    expect(queryMock).not.toHaveBeenCalled();

    const env = { DATABASE_URL: 'postgres://x' };
    await upsertRoomRow(env, roomRow(room()));
    const [, text, params] = queryMock.mock.calls[0];
    expect(text).toBe(UPSERT_ROOM_SQL);
    expect(text).toMatch(/ON CONFLICT \(code\) DO UPDATE/);
    expect(params).toEqual(['ABCD23', 'hyderabad-tycoon', U1, 'Host', 'public', 'lobby', 3, 4, '{"goal":70000}', [U1], 1_760_000_000_000]);
    await deleteRoomRow(env, 'ABCD23');
    expect(queryMock.mock.calls[1].slice(1)).toEqual(['DELETE FROM rooms WHERE code = $1', ['ABCD23']]);
  });

  it('listOpenRooms caches for 5 seconds per (game, limit)', async () => {
    const env = { DATABASE_URL: 'postgres://x' };
    queryMock.mockResolvedValue([
      { code: 'ABCD23', game_id: 'hyderabad-tycoon', host_name: 'Host', player_count: 1, max_players: 4, settings: {}, created_at: '2026-10-16T10:00:00Z' },
    ]);
    const t = 1_000_000;
    const a = await listOpenRooms(env, {}, t);
    expect(a).toHaveLength(1);
    const selects = () => queryMock.mock.calls.filter(([, text]) => /FROM rooms/.test(text) && /^\s*SELECT/.test(text)).length;
    expect(selects()).toBe(1);
    expect(await listOpenRooms(env, {}, t + 4_999)).toBe(a); // cached
    expect(selects()).toBe(1);
    await listOpenRooms(env, {}, t + 5_001); // expired
    expect(selects()).toBe(2);
    await listOpenRooms(env, { game: 'hyderabad-tycoon' }, t + 5_002); // another key
    expect(selects()).toBe(3);
  });

  it('countOpenTables sums per game and never throws', async () => {
    const env = { DATABASE_URL: 'postgres://x' };
    queryMock.mockResolvedValueOnce([{ game_id: 'hyderabad-tycoon', n: 3 }]);
    expect(await countOpenTables(env, 10)).toEqual({ 'hyderabad-tycoon': 3 });
    db._resetRoomsCacheForTests();
    queryMock.mockRejectedValueOnce(new Error('neon down'));
    expect(await countOpenTables(env, 10)).toEqual({});
  });
});
