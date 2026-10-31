import { describe, it, expect } from 'vitest';
import { GAME_ADAPTERS, getAdapter, listGames, missingFromAdapter, DEFAULT_GAME_ID } from './index.js';
import tycoon, { ID, TRADE_MS, pendingActors, estimateAnimMs, autoMove, isCurrentBoard } from './hyderabad-tycoon.js';
import { sanitizeSettings, normalizeSettings, ROOM_DEFAULTS } from '../settings.js';
import { maskStateFor } from '../mask.js';
import * as engine from '../../shared/index.js';

describe('registry', () => {
  it('knows Hyderabad Tycoon and nothing else by default', () => {
    expect(DEFAULT_GAME_ID).toBe('hyderabad-tycoon');
    expect(getAdapter('hyderabad-tycoon')).toBe(tycoon);
    expect(Object.keys(GAME_ADAPTERS)).toEqual(['hyderabad-tycoon']);
  });

  it('getAdapter returns null for anything unknown (no prototype leaks)', () => {
    for (const bad of ['', 'ludo', 'Hyderabad-Tycoon', '__proto__', 'constructor', 'toString', 'hasOwnProperty', null, undefined, 5, {}, []]) {
      expect(getAdapter(bad), String(bad)).toBeNull();
    }
  });

  it('listGames is the public, function-free description', () => {
    expect(listGames()).toEqual([{ id: 'hyderabad-tycoon', name: 'Hyderabad Tycoon', minPlayers: 2, maxPlayers: 6 }]);
    expect(() => JSON.stringify(listGames())).not.toThrow();
  });

  it('the Tycoon adapter implements the required interface', () => {
    expect(missingFromAdapter(tycoon)).toEqual([]);
    expect(tycoon.id).toBe(ID);
    expect(missingFromAdapter({ id: 'x' })).toEqual(expect.arrayContaining(['name', 'validateSettings', 'redact']));
    expect(missingFromAdapter(null)).toEqual(['adapter']);
  });
});

describe('Tycoon adapter: validateSettings keeps parity with the settings validator', () => {
  const inputs = [
    undefined,
    null,
    {},
    { goal: 100000, startCash: 25000, maxRounds: 30, dice: 'fair', auctionOnDecline: false },
    { maxRounds: null },
    { goal: 5 },
    { goal: '70000' },
    { goal: 1000001 },
    { startCash: 1 },
    { maxRounds: 120 },
    { maxRounds: 0 },
    { maxRounds: '30' },
    { dice: 'loaded' },
    { auctionOnDecline: 'yes' },
    { debug: true, seed: 5, passStart: 99999, goal: 50000 },
    { maxPlayers: 3, goal: 20000 },
    { maxPlayers: 9 },
    [],
    'goal',
    42,
  ];

  it('same verdict, same first error, normalised settings on success', () => {
    for (const raw of inputs) {
      const legacy = sanitizeSettings(raw);
      const v = tycoon.validateSettings(raw);
      expect(v.ok, JSON.stringify(raw)).toBe(legacy.errors.length === 0);
      if (v.ok) expect(v.settings).toEqual(normalizeSettings(legacy.settings));
      else expect(v.error).toBe(legacy.errors[0]);
    }
  });

  it('fills defaults and drops unknown keys', () => {
    const v = tycoon.validateSettings({ goal: 50000, debug: true });
    expect(v).toEqual({ ok: true, settings: { ...ROOM_DEFAULTS, goal: 50000 } });
    expect(tycoon.defaultSettings).toEqual(ROOM_DEFAULTS);
    expect(tycoon.minPlayers).toBe(2);
    expect(tycoon.maxPlayers).toBe(6);
  });

  it('lobbySettings is exactly what createGame runs with', () => {
    const settings = tycoon.validateSettings({ goal: 40000, maxRounds: null, dice: 'fair' }).settings;
    const state = tycoon.createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], settings, seed: 7 });
    expect(tycoon.lobbySettings(settings)).toEqual(state.cfg);
  });

  it('summarize is one short line', () => {
    expect(tycoon.summarize(ROOM_DEFAULTS)).toBe('Target ₹70,000 · 50 rounds');
    expect(tycoon.summarize({ ...ROOM_DEFAULTS, maxRounds: null })).toBe('Target ₹70,000 · unlimited rounds');
  });
});

const twoPlayers = () => engine.createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], seed: 3 });

describe('Tycoon adapter: turn, idle and deadlines', () => {
  it('turnPlayerId is the turn player, the debtor during debt, the trade recipient during a trade', () => {
    const base = twoPlayers();
    expect(tycoon.turnPlayerId(base)).toBe('a');
    const debt = { ...base, phase: 'debt', turn: 0, debt: { player: 'b', amount: 100, creditor: null, reason: 'tax' } };
    expect(tycoon.turnPlayerId(debt)).toBe('b');
    const trade = { ...base, trade: { id: 7, from: 'a', to: 'b', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } } };
    expect(tycoon.turnPlayerId(trade)).toBe('b');
    expect(tycoon.turnPlayerId({ ...base, phase: 'over' })).toBeNull();
    expect(pendingActors(base)).toEqual(['a']);
  });

  it('pendingPlayerIds adds the offerer to a pending trade, everyone who has not bid to an auction', () => {
    const base = twoPlayers();
    const trade = { ...base, trade: { id: 7, from: 'a', to: 'b', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } } };
    expect(tycoon.pendingPlayerIds(trade)).toEqual(['b', 'a']);
    const auction = { ...base, phase: 'auction', pending: { type: 'auction', tile: 1, minBid: 10, bids: { b: 0 } } };
    expect(tycoon.pendingPlayerIds(auction)).toEqual(['a', 'c']);
    expect(tycoon.pendingPlayerIds({ ...base, phase: 'over' })).toEqual([]);
  });

  it('has no bot interface: no nextBotMove, no rivals', () => {
    expect(tycoon.nextBotMove).toBeUndefined();
    expect(tycoon.rivals).toBeUndefined();
  });

  it('autoMove always has an answer for an absent debtor', () => {
    const base = twoPlayers();
    const debtor = { ...base, phase: 'debt', debt: { player: 'c', amount: 99999, creditor: null, reason: 'tax' } };
    const a = autoMove(debtor, 'c');
    expect(a && a.playerId).toBe('c');
  });

  it('deadlines: a trade offer to a human is rejected after 30 s; a gone recipient voids it', () => {
    const base = twoPlayers();
    const offer = (to) => ({ ...base, trade: { id: 9, from: 'a', to, give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } } });
    expect(tycoon.deadlines(base)).toEqual([]);
    expect(tycoon.deadlines(offer('b'))).toEqual([
      { key: 'trade:9', afterMs: TRADE_MS, playerId: 'b', action: { type: 'TRADE_REJECT', playerId: 'b' } },
    ]);
    expect(TRADE_MS).toBe(30_000);
    const gone = offer('b');
    gone.players = gone.players.map((p) => (p.id === 'b' ? { ...p, bankrupt: true } : p));
    const [d] = tycoon.deadlines(gone);
    expect(d).toMatchObject({ playerId: 'a', action: { type: 'TRADE_CANCEL', playerId: 'a' } });
    expect(d.afterMs).toBeLessThan(2000);
    expect(tycoon.deadlines({ ...offer('b'), phase: 'over' })).toEqual([]);
  });

  it('idleAction: ignoring a trade means rejecting it; otherwise the move chooser plays for the absent player', () => {
    const base = twoPlayers();
    const trade = { ...base, trade: { id: 1, from: 'a', to: 'b', give: { cash: 1, tiles: [] }, get: { cash: 0, tiles: [] } } };
    expect(tycoon.idleAction(trade, 'b')).toEqual({ type: 'TRADE_REJECT', playerId: 'b' });
    expect(tycoon.idleAction(trade, 'a')).toEqual({ type: 'TRADE_CANCEL', playerId: 'a' });
    expect(tycoon.idleAction(trade, 'c')).toBeNull();
    expect(tycoon.idleAction(base, 'a')).toMatchObject({ type: 'ROLL', playerId: 'a' });
    expect(tycoon.idleAction(base, 'b')).toBeNull(); // not b's turn
    expect(autoMove(base, 'a')).toMatchObject({ type: 'ROLL' });
  });

  it('resignAction only for players still in the game', () => {
    const base = twoPlayers();
    expect(tycoon.resignAction(base, 'a')).toEqual({ type: 'RESIGN', playerId: 'a' });
    expect(tycoon.resignAction(base, 'nobody')).toBeNull();
    const out = { ...base, players: base.players.map((p) => (p.id === 'a' ? { ...p, bankrupt: true } : p)) };
    expect(tycoon.resignAction(out, 'a')).toBeNull();
  });

  it('applyAction passes the engine result through (illegal -> same state + error)', () => {
    const s = twoPlayers();
    const bad = tycoon.applyAction(s, { type: 'BUY', playerId: 'a' });
    expect(bad.error).toBeTruthy();
    expect(bad.state).toBe(s);
    const ok = tycoon.applyAction(s, { type: 'ROLL', playerId: 'a' });
    expect(ok.error).toBeUndefined();
    expect(ok.events.length).toBeGreaterThan(0);
    expect(tycoon.isOver(s)).toBe(false);
    expect(tycoon.isOver({ ...s, phase: 'over' })).toBe(true);
  });

  it('animationMs / moveDelayMs', () => {
    expect(tycoon.animationMs([{ type: 'dice' }, { type: 'move', path: [1, 2, 3] }])).toBe(900 + 170 * 3);
    expect(estimateAnimMs([{ type: 'move', path: new Array(500).fill(1) }])).toBeLessThanOrEqual(6000);
    expect(tycoon.moveDelayMs({ type: 'BID' })).toBeLessThan(tycoon.moveDelayMs({ type: 'ROLL' }));
  });
});

describe('Tycoon adapter: redact, results', () => {
  it('redact hides other players sealed bids and the server-only rng and deck', () => {
    const base = twoPlayers();
    const view = tycoon.redact(base, 'a');
    expect(view.rng).toBe(0);
    expect(view.deck).toEqual([]);
    expect({ ...view, rng: base.rng, deck: base.deck }).toEqual(base);
    const auction = { ...base, phase: 'auction', pending: { type: 'auction', tile: 1, minBid: 10, bids: { a: 300, b: 120 } } };
    expect(tycoon.redact(auction, 'a').pending.bids).toEqual({ a: 300, b: 0 });
    expect(tycoon.redact(auction, 'a')).toEqual(maskStateFor(auction, 'a'));
    expect(auction.pending.bids).toEqual({ a: 300, b: 120 });
  });

  it('track counts hotels from level events; result maps standings, legacy columns and hotels', () => {
    const s = twoPlayers();
    s.owners[1] = 'a';
    const meta = tycoon.track({}, [{ type: 'level', tile: 1, level: 5, reason: 'upgrade' }, { type: 'level', tile: 1, level: 3, reason: 'upgrade' }, { type: 'level', tile: 1, level: 5, reason: 'sell' }], s);
    expect(meta).toEqual({ hotels: { a: 1 } });
    const same = {};
    expect(tycoon.track(same, [{ type: 'cash' }], s)).toBe(same);

    const over = { ...s, phase: 'over', winner: 'a', winReason: 'net_worth', round: 12 };
    const res = tycoon.result(over, meta);
    expect(res).toMatchObject({ winnerId: 'a', reason: 'net_worth', rounds: 12 });
    expect(res.standings.map((r) => r.rank).sort()).toEqual([1, 2, 3]);
    expect(res.standings.find((r) => r.id === 'a').stats.hotelsBuilt).toBe(1);
    expect(res.standings.find((r) => r.id === 'b').stats.hotelsBuilt).toBe(0);
    expect(res.standings.every((r) => Number.isInteger(r.score))).toBe(true);
    expect(res.legacy).toEqual({ goal: 70000, maxRounds: 50, diceMode: 'lucky' });
    // unlimited rounds are reported as null, the round count is not capped then
    const unlimited = tycoon.result({ ...over, cfg: { ...over.cfg, maxRounds: null }, round: 99 }, {});
    expect(unlimited.legacy.maxRounds).toBeNull();
    expect(unlimited.rounds).toBe(99);
  });

  it('upgradeRecord moves the previous version fields (hotels, trade clock) into meta / deadlines', () => {
    const old = { hotels: { a: 2 }, tradeId: 4, tradeAt: 12345, meta: {}, deadlines: {} };
    tycoon.upgradeRecord(old);
    expect(old).toEqual({ meta: { hotels: { a: 2 } }, deadlines: { 'trade:4': 12345 } });
    const fresh = { meta: { hotels: { a: 1 } }, deadlines: { 'trade:9': 5 } };
    tycoon.upgradeRecord(fresh);
    expect(fresh).toEqual({ meta: { hotels: { a: 1 } }, deadlines: { 'trade:9': 5 } });
  });

  it('upgradeRecord calls off a game stored on the old 28-tile board (and keeps current ones)', () => {
    const live = engine.createGame({ players: [{ id: 'a' }, { id: 'b' }], seed: 1 });
    expect(isCurrentBoard(live)).toBe(true);
    expect(isCurrentBoard({ owners: Array(28).fill(null) })).toBe(false);
    expect(isCurrentBoard(null)).toBe(false);
    const keep = { status: 'playing', state: live, meta: {}, deadlines: {} };
    tycoon.upgradeRecord(keep);
    expect(keep).toMatchObject({ status: 'playing', state: live });

    const stale = { ...live, owners: Array(28).fill(null), levels: Array(28).fill(0), mortgaged: Array(28).fill(false) };
    const playing = { status: 'playing', state: stale, meta: {}, deadlines: {} };
    tycoon.upgradeRecord(playing);
    expect(playing).toMatchObject({ status: 'finished', abandoned: true, state: null });
    expect(playing.endedAt).toEqual(expect.any(Number));
    const lobby = { status: 'lobby', state: null, meta: {}, deadlines: {} };
    tycoon.upgradeRecord(lobby);
    expect(lobby.status).toBe('lobby');
  });
});
