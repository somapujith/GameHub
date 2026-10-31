import { describe, expect, it } from 'vitest';
import { joinedLabel, joinedPercent, startState } from './lobbyModel.js';

describe('startState', () => {
  const base = { maxPlayers: 4, minToStart: 2 };
  it('cannot start alone', () => {
    const s = startState({ ...base, players: 1, joined: 1 });
    expect(s).toMatchObject({ enough: false, full: false, emptySeats: 3, label: 'Waiting for more players...' });
    expect(s.help).toContain('at least 2 players');
  });
  it('starts with whoever is there once the minimum is met', () => {
    const s = startState({ ...base, players: 3, joined: 3 });
    expect(s).toMatchObject({ enough: true, full: false, emptySeats: 1, label: 'Start with 3 players' });
    expect(s.help).toBe('1 seat is still open. Start now, or wait for more.');
    expect(startState({ ...base, players: 2, joined: 2 }).help).toBe('2 seats are still open. Start now, or wait for more.');
  });
  it('celebrates a full table', () => {
    expect(startState({ ...base, players: 4, joined: 4 })).toMatchObject({ enough: true, full: true, emptySeats: 0, label: 'Table full - start!', help: 'Everyone is here.' });
  });
  it('says Starting... once Start was pressed', () => {
    expect(startState({ ...base, players: 4, joined: 4, starting: true }).label).toBe('Starting...');
  });
  it('a game that needs 3 players waits for 3', () => {
    expect(startState({ maxPlayers: 6, minToStart: 3, players: 2, joined: 2 }).enough).toBe(false);
  });
});

describe('seat progress', () => {
  it('labels and sizes the bar', () => {
    expect(joinedLabel(2, 4)).toBe('2 of 4 joined');
    expect(joinedPercent(2, 4)).toBe(50);
    expect(joinedPercent(5, 4)).toBe(100);
    expect(joinedPercent(0, 0)).toBe(0);
  });
});
