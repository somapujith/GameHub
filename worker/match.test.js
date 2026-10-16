import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const transactionMock = vi.fn(async () => []);
vi.mock('./db.js', async (importOriginal) => ({
  ...(await importOriginal()),
  query: (...a) => queryMock(...a),
  transaction: (...a) => transactionMock(...a),
}));

const { buildMatchRecord, persistMatch, PERSIST_SQL } = await import('./match.js');
const { getAdapter } = await import('./games/index.js');
const engine = await import('../shared/index.js');

const tycoon = getAdapter('hyderabad-tycoon');
const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';

function finishedTycoonRoom() {
  const players = [
    { id: U1, name: 'Host', avatar: 1 },
    { id: U2, name: 'Guest', avatar: 2 },
    { id: 'bot_1', name: 'Chai Uncle', avatar: 3, isBot: true, bot: { reserve: 500, greed: 1 } },
  ];
  const state = engine.createGame({ players, seed: 11 });
  state.players[0].stats.rentEarned = 1234;
  state.owners[1] = U1;
  state.phase = 'over';
  state.winner = U1;
  state.winReason = 'net_worth';
  state.round = 9;
  return {
    code: 'ABCD23',
    matchId: '11111111-1111-4111-8111-111111111111',
    startedAt: Date.parse('2026-10-16T10:00:00Z'),
    endedAt: Date.parse('2026-10-16T10:20:00Z'),
    state,
    meta: { hotels: { [U1]: 2 } },
    players: players.map((p) => ({ ...p })),
  };
}

describe('buildMatchRecord (game-agnostic, via the adapter)', () => {
  it('maps a finished Tycoon room: game id, legacy columns, hotels, rewards', () => {
    const rec = buildMatchRecord(finishedTycoonRoom(), tycoon);
    expect(rec).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      gameId: 'hyderabad-tycoon',
      roomCode: 'ABCD23',
      rounds: 9,
      winnerId: U1,
      winReason: 'net_worth',
      goal: 70000,
      maxRounds: 50,
      diceMode: 'lucky',
      playerCount: 3,
    });
    expect(rec.startedAt).toBe('2026-10-16T10:00:00.000Z');
    expect(rec.players).toHaveLength(3);
    const host = rec.players.find((p) => p.user_id === U1);
    expect(host).toMatchObject({ name: 'Host', is_bot: false, hotels_built: 2, rent_earned: 1234 });
    const bot = rec.players.find((p) => p.is_bot);
    expect(bot).toMatchObject({ user_id: null, name: 'Chai Uncle', hotels_built: 0 });
    expect(rec.players.map((p) => p.rank).sort()).toEqual([1, 2, 3]);

    expect(rec.users.map((u) => u.user_id).sort()).toEqual([U1, U2]);
    const win = rec.users.find((u) => u.user_id === U1);
    expect(win).toMatchObject({ won: 1, lg: 1, lw: 1, lrent: 1234 });
    expect(win.lworth).toBe(win.score);
    expect(win.xp).toBeGreaterThan(rec.users.find((u) => u.user_id === U2).xp);
    expect(rec.users.find((u) => u.user_id === U2)).toMatchObject({ won: 0, lw: 0, lg: 1 });
    expect(rec.seats).toHaveLength(3);
    expect(rec.seats.filter((s) => s.isBot)).toHaveLength(1);
  });

  it('a bot winner has no winner_id; a game without legacy columns leaves users.* alone', () => {
    const room = finishedTycoonRoom();
    room.state.winner = 'bot_1';
    expect(buildMatchRecord(room, tycoon).winnerId).toBeNull();

    const other = {
      id: 'counter-race',
      result: () => ({
        winnerId: U1,
        reason: 'target',
        rounds: 3,
        standings: [
          { id: U1, rank: 1, score: 5 },
          { id: U2, rank: 2, score: 2 },
        ],
      }),
    };
    const rec = buildMatchRecord({ ...room, players: room.players.slice(0, 2) }, other);
    expect(rec).toMatchObject({ gameId: 'counter-race', rounds: 3, goal: null, maxRounds: null, diceMode: null, winnerId: U1 });
    for (const u of rec.users) expect(u).toMatchObject({ lg: 0, lw: 0, lworth: 0, lrent: 0 });
    expect(rec.users.find((u) => u.user_id === U1)).toMatchObject({ won: 1, score: 5 });
  });
});

describe('persistMatch', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockClear();
  });

  it('writes the match, the legacy columns and user_game_stats in ONE statement, ratings first', async () => {
    queryMock.mockImplementation(async (env, text) => {
      if (/FROM user_game_stats WHERE/.test(text)) return [{ user_id: U1, rating: 1100 }]; // U2 is new
      return [{ inserted: 1, users: [{ id: U1, xp: 130 }, { id: U2, xp: 60 }] }];
    });
    const rec = buildMatchRecord(finishedTycoonRoom(), tycoon);
    const res = await persistMatch({}, rec);
    expect(res).toEqual({ inserted: true });

    const [ratingCall, writeCall] = queryMock.mock.calls;
    expect(ratingCall[1]).toMatch(/SELECT user_id, rating FROM user_game_stats WHERE game_id = \$1/);
    expect(ratingCall[2]).toEqual(['hyderabad-tycoon', [U1, U2]]);

    expect(writeCall[1]).toBe(PERSIST_SQL);
    const params = writeCall[2];
    expect(params).toHaveLength(14);
    expect(params[0]).toBe(rec.id);
    expect(params[13]).toBe('hyderabad-tycoon');
    const users = JSON.parse(params[11]);
    expect(users.map((u) => u.user_id).sort()).toEqual([U1, U2]);
    for (const u of users) expect(Number.isInteger(u.delta) && Math.abs(u.delta) <= 24).toBe(true);
    // the winner (rated 1100) against a 1000 newcomer and a 1000 bot gains less than +24
    const winner = users.find((u) => u.user_id === U1);
    expect(winner.delta).toBeGreaterThan(0);
    expect(winner.delta).toBeLessThan(24);
    // the level sync follows the stat write
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it('the SQL is idempotent per match and keeps legacy + per-game stats in step', () => {
    expect(PERSIST_SQL).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(PERSIST_SQL).toMatch(/game_id\)/);
    expect(PERSIST_SQL).toMatch(/INSERT INTO user_game_stats/);
    expect(PERSIST_SQL).toMatch(/ON CONFLICT \(user_id, game_id\) DO UPDATE/);
    expect(PERSIST_SQL).toMatch(/GREATEST\(100, user_game_stats\.rating \+ \(EXCLUDED\.rating - 1000\)\)/);
    expect(PERSIST_SQL).toMatch(/games = u\.games \+ r\.lg/);
    // every write part (match_players, users, user_game_stats) reads from `ins`, so a replayed match changes nothing
    expect(PERSIST_SQL.match(/FROM ins/g)).toHaveLength(4); // mp, up, gs and the final count
  });

  it('a replayed match reports inserted:false and skips the level sync', async () => {
    queryMock.mockImplementation(async (env, text) => (/FROM user_game_stats WHERE/.test(text) ? [] : [{ inserted: 0, users: '[]' }]));
    const res = await persistMatch({}, buildMatchRecord(finishedTycoonRoom(), tycoon));
    expect(res).toEqual({ inserted: false });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('a failed rating lookup does not block the match (new players start at 1000)', async () => {
    queryMock.mockImplementation(async (env, text) => {
      if (/FROM user_game_stats WHERE/.test(text)) throw new Error('boom');
      return [{ inserted: 1, users: [] }];
    });
    await expect(persistMatch({}, buildMatchRecord(finishedTycoonRoom(), tycoon))).resolves.toEqual({ inserted: true });
  });

  it('a failed write is thrown (the room retries with backoff)', async () => {
    queryMock.mockImplementation(async (env, text) => {
      if (/FROM user_game_stats WHERE/.test(text)) return [];
      throw new Error('neon down');
    });
    await expect(persistMatch({}, buildMatchRecord(finishedTycoonRoom(), tycoon))).rejects.toThrow('neon down');
  });
});
