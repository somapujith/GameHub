import { describe, it, expect } from 'vitest';
import { createGame, standings, getOptions } from '../../../shared/index.js';
import { blankOptions, buildResult, isFatalRoomError, toConnection } from './gameHelpers.js';

const mk = () =>
  createGame({
    players: [
      { id: 'u-1', name: 'Anil', avatar: 3 },
      { id: 'u-2', name: 'Bhanu', avatar: 5 },
    ],
    seed: 7,
  });

describe('blankOptions', () => {
  it('covers every key the engine returns and enables nothing', () => {
    const real = getOptions(mk(), 'u-1');
    for (const like of [undefined, real]) {
      const blank = blankOptions(like);
      for (const k of Object.keys(real)) expect(blank).toHaveProperty(k);
      expect(Object.values(blank).some((v) => v === true)).toBe(false);
    }
  });
  it('has all rules-v2 keys with blank values', () => {
    const b = blankOptions();
    expect(b).toMatchObject({
      roll: false,
      payDebt: false,
      useJailCard: false,
      debt: null,
      tradeOffer: null,
      tradeSent: null,
      bid: null,
      trade: { canOffer: false },
    });
    for (const k of ['upgrade', 'mortgage', 'unmortgage', 'sellBuilding', 'sets']) expect(b[k]).toEqual([]);
  });
  it('blanks unknown future keys by type but keeps the informational sets list', () => {
    const b = blankOptions({ roll: true, sets: [{ group: 'west', owned: 2, size: 3, multiplier: 1.5 }], extraList: [1], extraFlag: true, extraObj: { a: 1 } });
    expect(b.sets).toHaveLength(1);
    expect(b.extraList).toEqual([]);
    expect(b.extraFlag).toBe(false);
    expect(b.extraObj).toBeNull();
    expect(b.roll).toBe(false);
  });
  it('returns fresh arrays (callers may not mutate shared state)', () => {
    expect(blankOptions().upgrade).not.toBe(blankOptions().upgrade);
  });
});

describe('toConnection', () => {
  it('maps socket statuses', () => {
    expect(toConnection('open')).toBe('open');
    expect(toConnection('closed')).toBe('closed');
    expect(toConnection('connecting')).toBe('connecting');
    expect(toConnection('reconnecting')).toBe('connecting');
    expect(toConnection('idle')).toBe('connecting');
  });
});

describe('isFatalRoomError', () => {
  it('only the room ending under us is fatal; rejected actions are not', () => {
    expect(isFatalRoomError('This room has expired.')).toBe(true);
    expect(isFatalRoomError('You were removed from this room.')).toBe(true);
    expect(isFatalRoomError('The room is full.')).toBe(false);
    expect(isFatalRoomError('Not your turn')).toBe(false);
    expect(isFatalRoomError('You need at least 2 players to start.')).toBe(false);
    expect(isFatalRoomError('')).toBe(false);
    expect(isFatalRoomError(undefined)).toBe(false);
  });
});

describe('buildResult', () => {
  it('is null until the game is over', () => {
    expect(buildResult(null, 'u-1', standings)).toBeNull();
    expect(buildResult(mk(), 'u-1', standings)).toBeNull();
  });

  it('builds standings and my summary for the winner and the loser', () => {
    const s = mk();
    s.phase = 'over';
    s.winner = 'u-2';
    s.winReason = 'net_worth';
    s.players[1].cash = 90000;
    s.players[1].stats.rentEarned = 1234;
    s.players[0].stats.propertiesBought = 4;
    const winner = buildResult(s, 'u-2', standings);
    expect(winner.winner).toBe('u-2');
    expect(winner.reason).toBe('net_worth');
    expect(winner.standings.map((r) => r.id)).toEqual(['u-2', 'u-1']);
    expect(winner.standings[0]).toMatchObject({ name: 'Bhanu', avatar: 5, rank: 1 });
    expect(winner.me).toMatchObject({ won: true, rank: 1, rentEarned: 1234 });
    expect(winner.rounds).toBe(s.round);
    expect(winner.maxRounds).toBe(s.cfg.maxRounds ?? null);

    const loser = buildResult(s, 'u-1', standings);
    expect(loser.me).toMatchObject({ won: false, rank: 2, propertiesBought: 4 });
  });

  it('copes with numeric/string id mismatches and spectators', () => {
    const s = mk();
    s.phase = 'over';
    s.winner = 'u-1';
    expect(buildResult(s, 'someone-else', standings).me).toMatchObject({ won: false, rank: 2, worth: 0 });
  });
});
