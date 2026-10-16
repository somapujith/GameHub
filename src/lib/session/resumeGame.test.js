import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getOptions } from '@shared/index.js';
import { upgradeSavedGame } from './resumeGame.js';

const legacyGame = () => createGame({
  players: [{ id: 'me', name: 'Miya' }, { id: 'bot', isBot: true }],
  settings: { diceCount: 2, debug: true, dice: 'fair', auctionOnDecline: false },
  seed: 42,
});
const act = (state, action) => {
  const result = applyAction(state, { playerId: 'me', ...action });
  expect(result.error).toBeUndefined();
  return result;
};

describe('legacy save upgrade to one die', () => {
  it('preserves game data and leaves the rollback save untouched', () => {
    const old = legacyGame();
    delete old.cfg.diceCount; // Saves created before diceCount existed.
    old.players[0].pos = 12;
    old.players[0].doubles = 2;
    old.players[1].rollsSinceDouble = 9;
    old.owners[1] = 'me';
    old.levels[1] = 0;
    old.mortgaged[1] = true;
    old.phase = 'manage';
    old.extraRoll = true;
    old.trade = { id: 'trade-7', from: 'me', to: 'bot', give: { cash: 100, tiles: [] }, get: { cash: 0, tiles: [] } };
    const before = structuredClone(old);
    const upgraded = upgradeSavedGame(old);
    const expected = structuredClone(before);
    expected.cfg.diceCount = 1;
    expected.dice = [0];
    expected.players = expected.players.map((player) => ({ ...player, doubles: 0, rollsSinceDouble: 0 }));
    expect(upgraded).toEqual(expected);
    expect(old).toEqual(before);
    expect(upgraded).not.toBe(old);
    expect(upgraded.cfg).not.toBe(old.cfg);
    expect(upgraded.players).not.toBe(old.players);
    expect(upgraded.owners).not.toBe(old.owners);
    expect(upgraded.extraRoll).toBe(true);
    expect(upgraded.rng).toBe(before.rng);
  });

  it('is idempotent and leaves modern saves unchanged by identity', () => {
    const modern = createGame({ players: [{ id: 'me' }, { id: 'bot' }], seed: 42 });
    expect(upgradeSavedGame(modern)).toBe(modern);
    const upgraded = upgradeSavedGame(legacyGame());
    expect(upgradeSavedGame(upgraded)).toBe(upgraded);
    expect(upgradeSavedGame(null)).toBeNull();
  });

  it('uses a real single-die outcome for the next roll', () => {
    const upgraded = upgradeSavedGame(legacyGame());
    const result = act(upgraded, { type: 'ROLL' });
    const rolled = result.events.find((event) => event.type === 'dice').values;
    expect(rolled).toHaveLength(1);
    expect(rolled[0]).toBeGreaterThanOrEqual(1);
    expect(rolled[0]).toBeLessThanOrEqual(6);
    expect(result.events.find((event) => event.type === 'move').path).toHaveLength(rolled[0]);
  });

  it('retains a pending buy and the bonus roll that was already earned', () => {
    const pending = act(legacyGame(), { type: 'ROLL', dice: [2, 2] }).state;
    expect(pending.phase).toBe('buy');
    expect(pending.extraRoll).toBe(true);
    const upgraded = upgradeSavedGame(pending);
    expect(upgraded.pending).toEqual(pending.pending);
    expect(upgraded.players[0].pos).toBe(4);
    expect(getOptions(upgraded, 'me').buy).toBe(true);
    const bought = act(upgraded, { type: 'BUY' }).state;
    expect(bought.owners[4]).toBe('me');
    expect(bought.players[0].cash).toBe(pending.players[0].cash - pending.pending.price);
    expect(bought.extraRoll).toBe(true);
    expect(getOptions(bought, 'me').roll).toBe(true);
    expect(act(bought, { type: 'ROLL' }).events.find((event) => event.type === 'dice').values).toHaveLength(1);
  });

  it('retains materialised debt and can mortgage and pay it without rerolling', () => {
    const old = legacyGame();
    old.players[0].pos = 12;
    old.players[0].cash = 300;
    for (const tile of [1, 2, 4]) old.owners[tile] = 'me';
    const pending = act(old, { type: 'ROLL', dice: [2, 2] }).state;
    expect(pending.phase).toBe('debt');
    const upgraded = upgradeSavedGame(pending);
    expect(upgraded.debt).toEqual(pending.debt);
    expect(upgraded.phase).toBe('debt');
    expect(upgraded.players[0].cash).toBe(300);
    let current = upgraded;
    for (const tile of [1, 2, 4]) current = act(current, { type: 'MORTGAGE', tile }).state;
    expect(getOptions(current, 'me').payDebt).toBe(true);
    const paid = act(current, { type: 'PAY_DEBT' }).state;
    expect(paid.debt).toBeNull();
    expect(paid.phase).toBe(pending.debt.returnPhase);
    expect(paid.players[0].cash).toBe(current.players[0].cash - pending.debt.amount);
    expect(pending.players[0].cash).toBe(300);
  });

  it('preserves outstanding auction bids and can resolve the auction', () => {
    const pending = act(legacyGame(), { type: 'ROLL', dice: [3, 4] }).state;
    expect(pending.phase).toBe('auction');
    const partiallyBid = act(pending, { type: 'BID', amount: pending.pending.minBid }).state;
    const upgraded = upgradeSavedGame(partiallyBid);
    expect(upgraded.pending).toEqual(partiallyBid.pending);
    const result = applyAction(upgraded, { playerId: 'bot', type: 'BID', amount: 0 });
    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('manage');
    expect(result.state.owners[partiallyBid.pending.tile]).toBe('me');
  });
});
