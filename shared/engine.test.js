import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, standings,
  nextBotMove, chooseBotAction, DEFAULT_SETTINGS, PLAYER_COLORS, KISMET,
  TILES, GROUP_TILES, MAX_LEVEL, rentFor, upgradeCost, isBuyable, mulberry32, nextFloat, randInt, shuffle,
} from './index.js';

// ---------------------------------------------------------------- helpers
const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `Player ${i}`, avatar: i }));
// auctionOnDecline defaults to false here so the classic tests stay simple; the v2 tests switch it on.
const game = (n = 3, settings = {}, seed = 7) => createGame({ players: mkPlayers(n), seed, settings: { debug: true, diceCount: 2, auctionOnDecline: false, ...settings } });
const edit = (s, fn) => {
  const c = structuredClone(s);
  fn(c);
  return c;
};
const me = (s) => s.players[s.turn].id;
const roll = (s, a, b, pid) => applyAction(s, { type: 'ROLL', playerId: pid ?? me(s), dice: [a, b] });
const ok = (res) => {
  expect(res.error).toBeUndefined();
  return res;
};
const doIt = (s, action) => ok(applyAction(s, { playerId: me(s), ...action }));
const ofType = (events, type) => events.filter((e) => e.type === type);
const rig = (s, cardId) => {
  const idx = KISMET.findIndex((c) => c.id === cardId);
  s.deck = [idx, ...KISMET.map((_, i) => i).filter((i) => i !== idx)];
  s.deckPos = 0;
};
const giveAll = (s, groupId, owner, level = 0) => {
  for (const t of GROUP_TILES[groupId]) {
    s.owners[t] = owner;
    s.levels[t] = level;
  }
};
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

// ---------------------------------------------------------------- setup
describe('createGame', () => {
  it('builds the contract state shape', () => {
    const s = game(4);
    expect(s.players).toHaveLength(4);
    expect(s.phase).toBe('roll');
    expect(s.turn).toBe(0);
    expect(s.round).toBe(1);
    expect(s.owners).toHaveLength(28);
    expect(s.levels.every((l) => l === 0)).toBe(true);
    expect(s.pending).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.winReason).toBeNull();
    expect(s.turnCount).toBe(0);
    expect(s.players[0]).toMatchObject({ id: 'p0', cash: DEFAULT_SETTINGS.startCash, pos: 0, jailTurns: 0, doubles: 0, bankrupt: false });
    expect(s.players.map((p) => p.color)).toEqual(PLAYER_COLORS.slice(0, 4));
    expect(Object.keys(s.players[0].stats).sort()).toEqual(
      ['biggestRent', 'jailed', 'propertiesBought', 'rentEarned', 'rentPaid', 'taxPaid', 'upgrades'],
    );
    expect([...s.deck].sort((a, b) => a - b)).toEqual(KISMET.map((_, i) => i));
  });

  it('accepts 2-6 players only and merges settings', () => {
    expect(() => createGame({ players: mkPlayers(1) })).toThrow();
    expect(() => createGame({ players: [...mkPlayers(6), { id: 'x' }] })).toThrow();
    const s = createGame({ players: mkPlayers(6), settings: { startCash: 9000, goal: undefined } });
    expect(s.cfg.startCash).toBe(9000);
    expect(s.cfg.goal).toBe(DEFAULT_SETTINGS.goal);
    expect(s.players[5].cash).toBe(9000);
  });

  it('gives bots default params and keeps custom ones', () => {
    const s = createGame({
      players: [{ id: 'a', isBot: true }, { id: 'b', isBot: true, bot: { reserve: 900, greed: 1.3 } }, { id: 'c' }],
      seed: 1,
    });
    expect(s.players[0].bot).toEqual({ reserve: 500, greed: 1 });
    expect(s.players[1].bot).toEqual({ reserve: 900, greed: 1.3 });
    expect(s.players[2].bot).toBeNull();
  });
});

describe('rng', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const xs = Array.from({ length: 50 }, () => nextFloat(a));
    const ys = Array.from({ length: 50 }, () => nextFloat(b));
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const r = { rng: 5 };
    const dice = Array.from({ length: 200 }, () => randInt(r, 1, 6));
    expect(Math.min(...dice)).toBe(1);
    expect(Math.max(...dice)).toBe(6);
    expect(shuffle({ rng: 3 }, [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    const f = mulberry32(9);
    expect(f()).not.toBe(f());
  });
});

describe('determinism and purity', () => {
  const play = (seed) => {
    const players = [
      { id: 'a', isBot: true }, { id: 'b', isBot: true, bot: { reserve: 300, greed: 1.2 } }, { id: 'c', isBot: true },
    ];
    let s = createGame({ players, seed });
    const rnd = mulberry32(seed + 1);
    const all = [];
    for (let i = 0; i < 600 && s.phase !== 'over'; i++) {
      const res = applyAction(s, nextBotMove(s, rnd));
      expect(res.error).toBeUndefined();
      all.push(...res.events);
      s = res.state;
    }
    return { s, all };
  };

  it('same seed + same actions = same events and state', () => {
    const a = play(123);
    const b = play(123);
    expect(a.all.length).toBeGreaterThan(100);
    expect(JSON.stringify(a.all)).toBe(JSON.stringify(b.all));
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(JSON.stringify(play(124).all)).not.toBe(JSON.stringify(a.all));
  });

  it('never mutates the input state (deep-frozen state survives a whole game)', () => {
    let s = createGame({ players: [{ id: 'a', isBot: true }, { id: 'b', isBot: true }, { id: 'c', isBot: true }], seed: 99 });
    const rnd = mulberry32(5);
    for (let i = 0; i < 400 && s.phase !== 'over'; i++) {
      deepFreeze(s);
      const snapshot = JSON.stringify(s);
      const res = applyAction(s, nextBotMove(s, rnd));
      expect(res.error).toBeUndefined();
      expect(JSON.stringify(s)).toBe(snapshot);
      expect(res.state).not.toBe(s);
      s = res.state;
    }
  });
});

describe('validation', () => {
  it('returns the same state, no events and an error for invalid actions', () => {
    const s = game(3);
    const bad = [
      { type: 'ROLL', playerId: 'p1' }, // not your turn
      { type: 'ROLL', playerId: 'nobody' }, // unknown player
      { type: 'BUY', playerId: 'p0' }, // nothing to buy
      { type: 'END_TURN', playerId: 'p0' }, // must roll first
      { type: 'SKIP_BUY', playerId: 'p0' },
      { type: 'PAY_BAIL', playerId: 'p0' }, // not jailed
      { type: 'BID', playerId: 'p0', amount: 100 }, // no auction
      { type: 'UPGRADE', playerId: 'p0', tile: 6 }, // owns nothing
      { type: 'DANCE', playerId: 'p0' },
      null,
    ];
    for (const a of bad) {
      const res = applyAction(s, a);
      expect(res.state).toBe(s);
      expect(res.events).toEqual([]);
      expect(typeof res.error).toBe('string');
    }
  });

  it('rejects debug dice unless cfg.debug is true, and bad debug dice', () => {
    const s = createGame({ players: mkPlayers(2), seed: 3 }); // debug off
    expect(s.cfg.debug).toBeUndefined();
    const forced = applyAction(s, { type: 'ROLL', playerId: 'p0', dice: [6, 6] });
    const plain = applyAction(s, { type: 'ROLL', playerId: 'p0' });
    expect(forced.error).toBeUndefined();
    expect(forced.state.dice).toEqual(plain.state.dice); // the action's dice were ignored
    const d = game(2);
    expect(applyAction(d, { type: 'ROLL', playerId: 'p0', dice: [0, 9] }).error).toBeTruthy();
  });

  it('blocks everything after game over', () => {
    const s = edit(game(2), (c) => { c.phase = 'over'; c.winner = 'p0'; c.winReason = 'rounds'; });
    expect(applyAction(s, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(s, { type: 'RESIGN', playerId: 'p1' }).error).toBeTruthy();
    expect(getOptions(s, 'p0')).toMatchObject({ roll: false, resign: false, upgrade: [], bid: null });
  });
});

// ---------------------------------------------------------------- movement
describe('movement and salary', () => {
  it('moves by the dice, emits dice/move/land events', () => {
    const { events, state } = ok(roll(game(), 2, 4));
    expect(events.map((e) => e.type).slice(0, 3)).toEqual(['dice', 'move', 'land']);
    expect(ofType(events, 'dice')[0].values).toEqual([2, 4]);
    expect(ofType(events, 'move')[0]).toMatchObject({ player: 'p0', from: 0, to: 6, path: [1, 2, 3, 4, 5, 6], passedStart: false });
    expect(state.players[0].pos).toBe(6);
    expect(state.dice).toEqual([2, 4]);
  });

  it('pays salary when wrapping past START', () => {
    const s = edit(game(), (c) => { c.players[0].pos = 26; });
    const { events, state } = ok(roll(s, 1, 2)); // 26 -> 1
    expect(state.players[0].pos).toBe(1);
    expect(ofType(events, 'move')[0]).toMatchObject({ passedStart: true, path: [27, 0, 1] });
    expect(ofType(events, 'cash').find((e) => e.reason === 'salary')).toMatchObject({ player: 'p0', delta: DEFAULT_SETTINGS.passStart });
  });

  it('pays salary when landing exactly on START', () => {
    const s = edit(game(), (c) => { c.players[0].pos = 24; });
    const { events, state } = ok(roll(s, 1, 3));
    expect(state.players[0].pos).toBe(0);
    expect(ofType(events, 'cash').filter((e) => e.reason === 'salary')).toHaveLength(1);
    expect(state.phase).toBe('manage');
  });

  it('doubles grant an extra roll and END_TURN is blocked until then', () => {
    const s = edit(game(), (c) => { c.owners[2] = 'p1'; c.owners[4] = 'p1'; });
    let r = ok(roll(s, 1, 1)); // lands on owned Bachupally: pays rent, phase manage, extraRoll
    expect(r.state.phase).toBe('manage');
    expect(r.state.extraRoll).toBe(true);
    expect(applyAction(r.state, { type: 'END_TURN', playerId: 'p0' }).error).toBeTruthy();
    expect(getOptions(r.state, 'p0')).toMatchObject({ roll: true, endTurn: false });
    r = ok(roll(r.state, 1, 3)); // 2 -> 6 (non double)
    expect(r.state.extraRoll).toBe(false);
    expect(getOptions(r.state, 'p0').endTurn || r.state.phase === 'buy').toBe(true);
  });

  it('three doubles in a row go straight to jail without landing', () => {
    let s = game();
    let r = ok(roll(s, 1, 1));
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    r = ok(roll(s, 1, 1));
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    r = ok(roll(s, 1, 1));
    expect(ofType(r.events, 'move')[0]).toMatchObject({ player: 'p0', to: 14, teleport: true });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: true, reason: 'three_doubles' });
    expect(ofType(r.events, 'land')).toHaveLength(0);
    expect(r.state.players[0]).toMatchObject({ pos: 14, jailTurns: DEFAULT_SETTINGS.jailTurns, doubles: 0 });
    expect(r.state.players[0].stats.jailed).toBe(1);
    expect(ofType(r.events, 'turn')[0]).toMatchObject({ player: 'p1' });
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('roll');
  });

  it('round increments when the turn order wraps and bankrupt players are skipped', () => {
    let s = edit(game(3), (c) => { c.players[1].bankrupt = true; c.players[1].cash = 0; });
    s = ok(roll(s, 1, 2)).state; // lands on Metro: buy offer
    s = doIt(s, { type: 'SKIP_BUY' }).state;
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state.turn).toBe(2);
    expect(r.state.round).toBe(1);
    let t = ok(roll(r.state, 1, 2)).state;
    t = doIt(t, { type: 'SKIP_BUY' }).state;
    const r2 = doIt(t, { type: 'END_TURN' });
    expect(r2.state.turn).toBe(0);
    expect(r2.state.round).toBe(2);
    expect(ofType(r2.events, 'turn')[0]).toEqual({ type: 'turn', player: 'p0', round: 2 });
  });
});

// ---------------------------------------------------------------- buying
describe('buy / skip', () => {
  it('offers an unowned tile and BUY transfers ownership', () => {
    const s0 = game();
    const r = ok(roll(s0, 2, 4)); // Kukatpally, 700
    expect(r.state.phase).toBe('buy');
    expect(r.state.pending).toEqual({ type: 'buy', tile: 6, price: 700 });
    expect(getOptions(r.state, 'p0')).toMatchObject({ buy: true, skipBuy: true, roll: false, endTurn: false });
    const b = doIt(r.state, { type: 'BUY' });
    expect(b.state.owners[6]).toBe('p0');
    expect(b.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 700);
    expect(b.state.players[0].stats.propertiesBought).toBe(1);
    expect(b.state.phase).toBe('manage');
    expect(b.state.pending).toBeNull();
    expect(b.events).toEqual([
      { type: 'cash', player: 'p0', delta: -700, reason: 'buy' },
      { type: 'own', tile: 6, owner: 'p0', reason: 'buy' },
    ]);
  });

  it('SKIP_BUY leaves the tile unowned; an unaffordable tile is not offered', () => {
    const r = ok(roll(game(), 2, 4));
    const k = doIt(r.state, { type: 'SKIP_BUY' });
    expect(k.state.owners[6]).toBeNull();
    expect(k.state.phase).toBe('manage');
    const poor = edit(game(), (c) => { c.players[0].cash = 699; });
    const p = ok(roll(poor, 2, 4));
    expect(p.state.phase).toBe('manage');
    expect(p.state.pending).toBeNull();
    expect(getOptions(p.state, 'p0').buy).toBe(false);
  });

  it('cannot BUY when it is not the buy phase or by another player', () => {
    const r = ok(roll(game(), 2, 4));
    expect(applyAction(r.state, { type: 'BUY', playerId: 'p1' }).error).toBeTruthy();
    expect(applyAction(r.state, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
  });
});

// ---------------------------------------------------------------- rent
describe('rent', () => {
  const landOn = (s, from, a, b) => ok(roll(edit(s, (c) => { c.players[0].pos = from; }), a, b));

  it('charges base property rent with a cash event per side', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p1'; });
    const r = landOn(s, 0, 2, 4);
    const base = rentFor(TILES[6], 0);
    expect(base).toBe(60);
    const cash = ofType(r.events, 'cash');
    expect(cash).toEqual([
      { type: 'cash', player: 'p0', delta: -base, reason: 'rent', other: 'p1' },
      { type: 'cash', player: 'p1', delta: base, reason: 'rent', other: 'p0' },
    ]);
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - base);
    expect(r.state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + base);
    expect(r.state.players[0].stats.rentPaid).toBe(base);
    expect(r.state.players[1].stats).toMatchObject({ rentEarned: base, biggestRent: base });
    expect(r.state.phase).toBe('manage');
  });

  it('doubles level-0 rent when the owner holds the whole group, but not built rent', () => {
    const full = edit(game(), (c) => giveAll(c, 'east', 'p1'));
    expect(landOn(full, 0, 2, 4).state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + 120);
    expect(previewRent(full, 6)).toBe(120);
    const built = edit(full, (c) => { c.levels[6] = 2; });
    expect(previewRent(built, 6)).toBe(rentFor(TILES[6], 2)); // 280, no doubling
    const partial = edit(game(), (c) => { c.owners[6] = 'p1'; c.owners[8] = 'p1'; });
    expect(previewRent(partial, 6)).toBe(90); // 2 of 3 in a colour: x1.5
  });

  it('transport rent scales with the number of transport tiles owned', () => {
    const one = edit(game(), (c) => { c.owners[3] = 'p1'; });
    expect(landOn(one, 0, 1, 2).state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 150);
    const two = edit(one, (c) => { c.owners[11] = 'p1'; });
    expect(previewRent(two, 3)).toBe(350);
    const three = edit(two, (c) => { c.owners[24] = 'p1'; });
    expect(previewRent(three, 3)).toBe(700);
    expect(landOn(three, 0, 1, 2).state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + 700);
  });

  it('utility rent is the dice total times the multiplier for the count owned', () => {
    const one = edit(game(), (c) => { c.owners[9] = 'p1'; });
    const r1 = landOn(one, 0, 4, 5); // total 9
    expect(r1.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 9 * 40);
    const both = edit(one, (c) => { c.owners[20] = 'p1'; });
    const r2 = landOn(both, 0, 4, 5);
    expect(r2.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 9 * 100);
    expect(previewRent(both, 9, 10)).toBe(1000);
    expect(previewRent(both, 9)).toBe(700); // default sum of 7
  });

  it('own tiles and unowned tiles cost nothing; previewRent is 0 for those', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; });
    const r = landOn(s, 0, 2, 4);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
    expect(previewRent(s, 8)).toBe(0);
    expect(previewRent(s, 16)).toBe(0); // tax tile
  });

  it('tax goes to the bank and Film City pays out', () => {
    const t = landOn(game(), 10, 2, 4); // 10 -> 16
    expect(ofType(t.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -DEFAULT_SETTINGS.taxAmount, reason: 'tax' }]);
    expect(t.state.players[0].stats.taxPaid).toBe(DEFAULT_SETTINGS.taxAmount);
    const f = landOn(game(), 12, 2, 4); // 12 -> 18
    expect(ofType(f.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: DEFAULT_SETTINGS.filmFee, reason: 'film' }]);
  });
});

// ---------------------------------------------------------------- upgrades
describe('upgrades', () => {
  const eastSet = () => edit(game(), (c) => giveAll(c, 'east', 'p0'));

  it('requires the full set, enforces even building, and reports reasons', () => {
    const partial = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; });
    expect(canUpgrade(partial, 'p0', 6)).toMatchObject({ ok: false });
    expect(canUpgrade(partial, 'p0', 6).reason).toMatch(/Own all/);
    expect(canUpgrade(game(), 'p0', 6).reason).toMatch(/do not own/);
    expect(canUpgrade(game(), 'p0', 3).reason).toMatch(/properties/);

    let s = eastSet();
    expect(canUpgrade(s, 'p0', 6)).toEqual({ ok: true, cost: 350 });
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(s.levels[6]).toBe(1);
    expect(canUpgrade(s, 'p0', 6).reason).toMatch(/evenly/);
    expect(canUpgrade(s, 'p0', 8).ok).toBe(true);
    expect(applyAction(s, { type: 'UPGRADE', playerId: 'p0', tile: 6 }).error).toMatch(/evenly/);
  });

  it('charges the cost, emits cash+level events and tracks stats', () => {
    const r = doIt(eastSet(), { type: 'UPGRADE', tile: 8 });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -upgradeCost(TILES[8]), reason: 'upgrade' },
      { type: 'level', tile: 8, level: 1, reason: 'upgrade' },
    ]);
    expect(r.state.players[0].stats.upgrades).toBe(1);
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 350);
    expect(r.state.phase).toBe('roll'); // upgrading does not consume the roll
    expect(netWorth(r.state, 'p0')).toBe(netWorth(eastSet(), 'p0')); // building keeps net worth constant
  });

  it('stops at MAX_LEVEL, needs cash, the turn player and the right phase', () => {
    const maxed = edit(eastSet(), (c) => { for (const t of GROUP_TILES.east) c.levels[t] = MAX_LEVEL; });
    expect(canUpgrade(maxed, 'p0', 6).reason).toMatch(/fully built/);
    const poor = edit(eastSet(), (c) => { c.players[0].cash = 100; });
    expect(canUpgrade(poor, 'p0', 6)).toMatchObject({ ok: false, cost: 350 });
    expect(canUpgrade(poor, 'p0', 6).reason).toMatch(/Need/);
    const s = eastSet();
    expect(canUpgrade(s, 'p1', 6).ok).toBe(false);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: 1200 }; });
    expect(canUpgrade(buying, 'p0', 6).ok).toBe(false);
    expect(applyAction(buying, { type: 'UPGRADE', playerId: 'p0', tile: 6 }).error).toBeTruthy();
  });

  it('getOptions lists only upgradable tiles at the lowest level', () => {
    let s = eastSet();
    expect(getOptions(s, 'p0').upgrade.map((u) => u.tile).sort((a, b) => a - b)).toEqual([6, 8, 10]);
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(getOptions(s, 'p0').upgrade.map((u) => u.tile).sort((a, b) => a - b)).toEqual([8, 10]);
    expect(getOptions(s, 'p0').upgrade[0]).toHaveProperty('cost');
    expect(getOptions(s, 'p1').upgrade).toEqual([]);
  });

  it('raises rent with the level', () => {
    let s = eastSet();
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 1));
  });
});

// ---------------------------------------------------------------- jail
describe('jail', () => {
  const jailed = (settings) => edit(game(3, settings), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = c.cfg.jailTurns; });

  it('a failed roll serves the time and ends the turn', () => {
    const r = ok(roll(jailed(), 1, 2));
    expect(ofType(r.events, 'jail_stay')[0]).toEqual({ type: 'jail_stay', player: 'p0', left: 0 });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: false, reason: 'served' });
    expect(r.state.players[0]).toMatchObject({ jailTurns: 0, pos: 14 });
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'move')).toHaveLength(0);
  });

  it('longer sentences count down', () => {
    let r = ok(roll(jailed({ jailTurns: 2 }), 1, 2));
    expect(ofType(r.events, 'jail_stay')[0].left).toBe(1);
    expect(ofType(r.events, 'jail')).toHaveLength(0);
    expect(r.state.players[0].jailTurns).toBe(1);
  });

  it('doubles free you and you move by the total without an extra roll', () => {
    const r = ok(roll(jailed(), 3, 3));
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: false, reason: 'doubles' });
    expect(ofType(r.events, 'move')[0]).toMatchObject({ from: 14, to: 20 });
    expect(r.state.players[0]).toMatchObject({ pos: 20, jailTurns: 0 });
    expect(r.state.extraRoll).toBe(false);
  });

  it('PAY_BAIL charges the bank and lets you roll normally', () => {
    const s = jailed();
    expect(getOptions(s, 'p0')).toMatchObject({ roll: true, bail: true });
    const r = doIt(s, { type: 'PAY_BAIL' });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -DEFAULT_SETTINGS.bailFine, reason: 'bail' },
      { type: 'jail', player: 'p0', jailed: false, reason: 'bail' },
    ]);
    expect(r.state.phase).toBe('roll');
    expect(r.state.players[0].jailTurns).toBe(0);
    const moved = ok(roll(r.state, 2, 3));
    expect(moved.state.players[0].pos).toBe(19);
    const poor = edit(s, (c) => { c.players[0].cash = 499; });
    expect(applyAction(poor, { type: 'PAY_BAIL', playerId: 'p0' }).error).toBeTruthy();
    expect(getOptions(poor, 'p0').bail).toBe(false);
  });
});

// ---------------------------------------------------------------- kismet cards
describe('kismet cards', () => {
  const draw = (cardId, mutate = () => {}, n = 3, dice = [2, 3]) => {
    const s = edit(game(n), (c) => { rig(c, cardId); mutate(c); });
    return ok(roll(s, dice[0], dice[1])); // 0 -> 5 (kismet)
  };

  it('has 18 well-formed cards that never target a kismet tile', () => {
    expect(KISMET).toHaveLength(18);
    expect(new Set(KISMET.map((c) => c.id)).size).toBe(18);
    for (const c of KISMET) {
      expect(['good', 'bad', 'neutral']).toContain(c.kind);
      expect(c.title && c.text && /[ఀ-౿]/.test(c.te)).toBeTruthy();
      if (c.effect.type === 'moveTo') expect(TILES[c.effect.tile].type).not.toBe('kismet');
    }
  });

  it('emits a card event and applies cash effects', () => {
    const good = draw('it_hike');
    expect(ofType(good.events, 'card')[0]).toMatchObject({ player: 'p0', cardId: 'it_hike', kind: 'good', title: 'IT Hike!' });
    expect(ofType(good.events, 'cash')[0]).toEqual({ type: 'cash', player: 'p0', delta: 1000, reason: 'card' });
    const bad = draw('orr_challan');
    expect(bad.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 350);
    expect(ofType(bad.events, 'cash')[0]).toMatchObject({ delta: -350, reason: 'card' });
  });

  it('first metro: moves to START and collects the salary', () => {
    const r = draw('first_metro');
    expect(r.state.players[0].pos).toBe(0);
    expect(ofType(r.events, 'move')[1]).toMatchObject({ from: 5, to: 0, passedStart: true });
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash + DEFAULT_SETTINGS.passStart);
    expect(ofType(r.events, 'land').map((e) => e.tile)).toEqual([5, 0]);
  });

  it('advance to the Metro wraps past START (salary) and re-resolves the landing', () => {
    const r = draw('ride_metro');
    expect(r.state.players[0].pos).toBe(3);
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash + DEFAULT_SETTINGS.passStart);
    expect(r.state.phase).toBe('buy');
    expect(r.state.pending.tile).toBe(3);
  });

  it('rich uncle sends you to Banjara Hills with no salary; traffic jam goes back 3 with no salary', () => {
    const u = draw('rich_uncle');
    expect(u.state.players[0].pos).toBe(27);
    expect(u.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash);
    expect(u.state.pending).toMatchObject({ tile: 27, price: 5000 });
    const j = draw('hitec_jam');
    expect(j.state.players[0].pos).toBe(2);
    expect(ofType(j.events, 'move')[1]).toMatchObject({ path: [4, 3, 2], passedStart: false });
    expect(j.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash);
    const wrap = draw('hitec_jam', (c) => { c.owners[2] = 'p1'; }); // landing again charges rent
    expect(wrap.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - rentFor(TILES[2], 0));
  });

  it('naka-bandi sends you to jail and ends the turn', () => {
    const r = draw('naka_bandi');
    expect(r.state.players[0]).toMatchObject({ pos: 14, jailTurns: 1 });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: true, reason: 'card' });
    expect(ofType(r.events, 'move')[1]).toMatchObject({ to: 14, teleport: true });
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('roll');
  });

  it('birthday collects from everyone; biryani promise pays everyone', () => {
    const b = draw('birthday');
    expect(b.state.players.map((p) => p.cash)).toEqual([15400, 14800, 14800]);
    expect(ofType(b.events, 'cash').filter((e) => e.reason === 'card' && e.player === 'p1')[0]).toMatchObject({ delta: -200, other: 'p0' });
    const p = draw('biryani_promise');
    expect(p.state.players.map((c) => c.cash)).toEqual([14700, 15150, 15150]);
  });

  it('Paytm Karo makes the drawer pay ₹100 to every other player', () => {
    const r = draw('paytm_100');
    expect(r.state.players.map((c) => c.cash)).toEqual([14800, 15100, 15100]);
    expect(ofType(r.events, 'card')[0]).toMatchObject({ cardId: 'paytm_100', player: 'p0', kind: 'bad' });
    const paid = ofType(r.events, 'cash').filter((e) => e.reason === 'card' && e.delta === 100);
    expect(paid.map((e) => e.player).sort()).toEqual(['p1', 'p2']);
    expect(paid.every((e) => e.other === 'p0')).toBe(true);
  });

  it('reshuffles an exhausted deck', () => {
    const s = edit(game(), (c) => { c.deckPos = c.deck.length; });
    const r = ok(roll(s, 2, 3));
    expect(r.state.deckPos).toBe(1);
    expect(ofType(r.events, 'card')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- auction
describe('auction (sealed bids)', () => {
  const toAuction = (mutate = () => {}, n = 3) => {
    const s = edit(game(n), mutate);
    return ok(roll(s, 3, 4)); // 0 -> 7
  };
  const bid = (s, pid, amount) => ok(applyAction(s, { type: 'BID', playerId: pid, amount }));

  it('starts with a random unowned tile at half price', () => {
    const r = toAuction((c) => { c.owners[6] = 'p1'; });
    const start = ofType(r.events, 'auction_start')[0];
    expect(r.state.phase).toBe('auction');
    expect(r.state.pending).toMatchObject({ type: 'auction', tile: start.tile, minBid: start.minBid, bids: {} });
    expect(isBuyable(TILES[start.tile])).toBe(true);
    expect(r.state.owners[start.tile]).toBeNull();
    expect(start.tile).not.toBe(6);
    expect(start.minBid).toBe(Math.round((TILES[start.tile].price * 0.5) / 10) * 10);
    expect(getOptions(r.state, 'p2').bid).toEqual({ tile: start.tile, min: start.minBid, max: 15000 });
  });

  it('is sealed: resolves only once everyone has bid; highest bid wins and pays the bank', () => {
    let r = toAuction();
    const { tile, minBid } = r.state.pending;
    r = bid(r.state, 'p1', minBid + 100);
    expect(r.state.phase).toBe('auction');
    expect(r.events).toEqual([]);
    r = bid(r.state, 'p2', minBid + 300);
    expect(r.state.phase).toBe('auction');
    expect(getOptions(r.state, 'p1').bid).toBeNull();
    r = bid(r.state, 'p0', 0); // pass
    const end = ofType(r.events, 'auction_end')[0];
    expect(end).toEqual({ type: 'auction_end', tile, winner: 'p2', amount: minBid + 300, bids: { p0: 0, p1: minBid + 100, p2: minBid + 300 } });
    expect(r.state.owners[tile]).toBe('p2');
    expect(r.state.players[2].cash).toBe(15000 - minBid - 300);
    expect(r.state.players[2].stats.propertiesBought).toBe(1);
    expect(ofType(r.events, 'own')[0]).toEqual({ type: 'own', tile, owner: 'p2', reason: 'auction' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
  });

  it('ties go to the earliest player in turn order from the current turn player', () => {
    let r = toAuction();
    const { minBid } = r.state.pending;
    r = bid(r.state, 'p2', minBid + 50);
    r = bid(r.state, 'p1', minBid + 50);
    r = bid(r.state, 'p0', minBid + 50);
    expect(ofType(r.events, 'auction_end')[0].winner).toBe('p0'); // turn player first
    // with p1 on turn the order starts at p1
    const s = edit(game(3), (c) => { c.turn = 1; });
    let a = ok(roll(s, 3, 4, 'p1'));
    const m = a.state.pending.minBid;
    a = bid(a.state, 'p0', m);
    a = bid(a.state, 'p2', m);
    a = bid(a.state, 'p1', m);
    expect(ofType(a.events, 'auction_end')[0].winner).toBe('p1');
    // p2 vs p0 tie with p1 on turn: order p1, p2, p0 -> p2 wins
    let b = ok(roll(s, 3, 4, 'p1'));
    b = bid(b.state, 'p0', m);
    b = bid(b.state, 'p1', 0);
    b = bid(b.state, 'p2', m);
    expect(ofType(b.events, 'auction_end')[0].winner).toBe('p2');
  });

  it('auto-passes players who cannot afford the minimum bid', () => {
    let r = toAuction((c) => { c.players[2].cash = 0; });
    expect(r.state.pending.bids).toEqual({ p2: 0 });
    expect(getOptions(r.state, 'p2').bid).toBeNull();
    const { minBid } = r.state.pending;
    r = bid(r.state, 'p0', minBid);
    r = bid(r.state, 'p1', 0);
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ winner: 'p0', amount: minBid });
  });

  it('with no valid bids the auction ends with no winner', () => {
    const none = toAuction((c) => { for (const p of c.players) p.cash = 0; });
    expect(ofType(none.events, 'auction_end')[0]).toMatchObject({ winner: null, amount: 0 });
    expect(none.state.phase).toBe('manage');
    let r = toAuction();
    r = bid(r.state, 'p0', 0);
    r = bid(r.state, 'p1', 0);
    r = bid(r.state, 'p2', 0);
    expect(ofType(r.events, 'auction_end')[0].winner).toBeNull();
    expect(r.state.owners.filter(Boolean)).toHaveLength(0);
  });

  it('pays a bazaar bonus when every tile is owned', () => {
    const r = toAuction((c) => { TILES.forEach((t) => { if (isBuyable(t)) c.owners[t.id] = 'p1'; }); });
    expect(ofType(r.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: 500, reason: 'bazaar' }]);
    expect(ofType(r.events, 'auction_start')).toHaveLength(0);
    expect(r.state.phase).toBe('manage');
  });

  it('validates bids', () => {
    const r = toAuction();
    const { minBid } = r.state.pending;
    const err = (pid, amount) => applyAction(r.state, { type: 'BID', playerId: pid, amount }).error;
    expect(err('p1', minBid - 10)).toMatch(/minimum/);
    expect(err('p1', 15001)).toMatch(/cash/);
    expect(err('p1', 12.5)).toBeTruthy();
    expect(err('p1', -1)).toBeTruthy();
    expect(err('ghost', minBid)).toBeTruthy();
    const after = bid(r.state, 'p1', minBid).state;
    expect(applyAction(after, { type: 'BID', playerId: 'p1', amount: minBid }).error).toMatch(/already/);
    expect(applyAction(r.state, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(r.state, { type: 'END_TURN', playerId: 'p0' }).error).toBeTruthy();
  });

  it('a doubles roll onto the auction corner still grants the extra roll afterwards', () => {
    const s = edit(game(), (c) => { c.players[0].pos = 3; });
    let r = ok(roll(s, 2, 2)); // 3 -> 7 with doubles
    expect(r.state.extraRoll).toBe(true);
    for (const pid of ['p0', 'p1', 'p2']) r = bid(r.state, pid, 0);
    expect(r.state.phase).toBe('manage');
    expect(getOptions(r.state, 'p0').roll).toBe(true);
  });
});

// ---------------------------------------------------------------- winning and resigning
describe('winning', () => {
  it('wins by net worth after an action; highest worth wins when several qualify', () => {
    const s = edit(game(), (c) => { c.players[0].cash = DEFAULT_SETTINGS.goal; });
    const r = ok(roll(s, 1, 2));
    expect(r.state).toMatchObject({ phase: 'over', winner: 'p0', winReason: 'net_worth' });
    expect(r.events.at(-1)).toMatchObject({ type: 'win', player: 'p0', reason: 'net_worth' });
    expect(r.events.at(-1).worth).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.goal);
    expect(r.state.pending).toBeNull();
    const both = edit(game(), (c) => { c.players[0].cash = 71000; c.players[1].cash = 90000; });
    expect(ok(roll(both, 1, 2)).state.winner).toBe('p1');
  });

  it('counts property and buildings in net worth and ranks standings', () => {
    const s = edit(game(), (c) => { giveAll(c, 'east', 'p0', 2); c.players[0].cash = 1000; c.players[1].cash = 20000; });
    const expected = 1000 + (700 + 700 + 800) + 2 * (350 + 350 + 400);
    expect(netWorth(s, 'p0')).toBe(expected);
    const st = standings(s);
    expect(st.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(st[0]).toEqual({ id: 'p1', cash: 20000, worth: 20000, rank: 1 });
    expect(st[1].id).toBe('p2');
    expect(st[2]).toMatchObject({ id: 'p0', worth: expected });
  });

  it('last player standing wins', () => {
    const r = ok(applyAction(game(2), { type: 'RESIGN', playerId: 'p0' }));
    expect(r.state).toMatchObject({ phase: 'over', winner: 'p1', winReason: 'last_standing' });
    expect(r.events.at(-1)).toMatchObject({ type: 'win', player: 'p1', reason: 'last_standing' });
    expect(ofType(r.events, 'turn')).toHaveLength(0);
  });

  it('the richest player wins when maxRounds is exceeded', () => {
    const s = edit(game(3), (c) => { c.round = c.cfg.maxRounds; c.turn = 2; c.players[1].cash = 30000; c.phase = 'manage'; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state).toMatchObject({ phase: 'over', winner: 'p1', winReason: 'rounds', round: s.cfg.maxRounds + 1 });
    expect(r.events.at(-1)).toMatchObject({ type: 'win', reason: 'rounds' });
  });
});

describe('resign', () => {
  it('clears holdings, ends the resigner\'s turn and continues with the others', () => {
    const s = edit(game(3), (c) => { giveAll(c, 'east', 'p0', 1); c.owners[3] = 'p0'; });
    const r = doIt(s, { type: 'RESIGN' });
    expect(r.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(r.state.owners.includes('p0')).toBe(false);
    expect(r.state.levels.every((l) => l === 0)).toBe(true);
    expect(r.events.filter((e) => e.type === 'own' && e.reason === 'bankrupt').map((e) => e.tile).sort((a, b) => a - b)).toEqual([3, 6, 8, 10]);
    expect(r.events.filter((e) => e.type === 'level' && e.reason === 'bankrupt')).toHaveLength(3);
    expect(ofType(r.events, 'bankrupt')).toEqual([{ type: 'bankrupt', player: 'p0' }]);
    expect(ofType(r.events, 'turn')[0]).toMatchObject({ player: 'p1' });
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('roll');
    expect(applyAction(r.state, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
  });

  it('a non-turn player can resign without touching the turn', () => {
    const r = ok(applyAction(game(3), { type: 'RESIGN', playerId: 'p2' }));
    expect(r.state.turn).toBe(0);
    expect(r.state.players[2].bankrupt).toBe(true);
    expect(r.state.phase).toBe('roll');
  });

  it('resigning during an auction passes the bid and resolves it', () => {
    let r = ok(roll(game(3), 3, 4));
    const { tile, minBid } = r.state.pending;
    r = ok(applyAction(r.state, { type: 'BID', playerId: 'p0', amount: minBid }));
    r = ok(applyAction(r.state, { type: 'BID', playerId: 'p1', amount: 0 }));
    r = ok(applyAction(r.state, { type: 'RESIGN', playerId: 'p2' }));
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ tile, winner: 'p0', amount: minBid });
    expect(ofType(r.events, 'auction_end')[0].bids.p2).toBe(0);
    expect(r.state.phase).toBe('manage');
    expect(r.state.turn).toBe(0);
  });

  it('the turn player resigning during an auction ends their turn once it resolves', () => {
    let r = ok(roll(game(3), 3, 4));
    r = ok(applyAction(r.state, { type: 'RESIGN', playerId: 'p0' }));
    expect(r.state.phase).toBe('auction');
    r = ok(applyAction(r.state, { type: 'BID', playerId: 'p1', amount: 0 }));
    r = ok(applyAction(r.state, { type: 'BID', playerId: 'p2', amount: 0 }));
    expect(r.state.phase).toBe('roll');
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'turn')[0]).toMatchObject({ player: 'p1' });
  });
});

// ---------------------------------------------------------------- settings and round limit
describe('settings normalisation', () => {
  const mk = (settings) => createGame({ players: mkPlayers(2), seed: 1, settings }).cfg;

  it('defaults: maxRounds is 50 and undefined falls back to defaults instead of overwriting them', () => {
    expect(DEFAULT_SETTINGS.maxRounds).toBe(50);
    expect(mk(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mk({})).toEqual(DEFAULT_SETTINGS);
    expect(mk({ maxRounds: undefined, goal: undefined, startCash: undefined })).toEqual(DEFAULT_SETTINGS);
  });

  it('null maxRounds means unlimited; positive integers are kept; garbage falls back', () => {
    expect(mk({ maxRounds: null }).maxRounds).toBeNull();
    expect(mk({ maxRounds: Infinity }).maxRounds).toBeNull();
    expect(mk({ maxRounds: 30 }).maxRounds).toBe(30);
    expect(mk({ maxRounds: 12.9 }).maxRounds).toBe(12);
    expect(mk({ maxRounds: '30' }).maxRounds).toBe(30);
    for (const bad of [0, -5, NaN, 'abc', '', {}, [], true]) expect(mk({ maxRounds: bad }).maxRounds).toBe(50);
    expect(JSON.parse(JSON.stringify(mk({ maxRounds: null }))).maxRounds).toBeNull();
  });

  it('clamps goal to 10,000-1,000,000 and startCash to 5,000-100,000', () => {
    expect(mk({ goal: 5 }).goal).toBe(10000);
    expect(mk({ goal: 5e9 }).goal).toBe(1000000);
    expect(mk({ goal: 'lots' }).goal).toBe(70000);
    expect(mk({ goal: 50000 }).goal).toBe(50000);
    expect(mk({ startCash: 100 }).startCash).toBe(5000);
    expect(mk({ startCash: 1e7 }).startCash).toBe(100000);
    expect(mk({ startCash: null }).startCash).toBe(15000);
    expect(mk({ startCash: 20000 }).startCash).toBe(20000);
    const g = createGame({ players: mkPlayers(2), seed: 1, settings: { startCash: 100 } });
    expect(g.players[0].cash).toBe(5000);
  });

  it('drops unknown keys and only keeps debug when it is exactly true', () => {
    expect(mk({ hax: 1 })).not.toHaveProperty('hax');
    expect(mk({ debug: 'yes' })).not.toHaveProperty('debug');
    expect(mk({ debug: true }).debug).toBe(true);
  });
});

describe('round limit', () => {
  const lastOfRound = (maxRounds, extra = () => {}) => edit(game(3, { maxRounds }), (c) => {
    c.round = maxRounds;
    c.turn = 2;
    c.phase = 'manage';
    extra(c);
  });

  it('ends when the LAST player of round maxRounds finishes their turn (30)', () => {
    const s = lastOfRound(30, (c) => { c.players[1].cash = 22000; });
    const mid = edit(s, (c) => { c.turn = 1; });
    const midRes = doIt(mid, { type: 'END_TURN' });
    expect(midRes.state.phase).toBe('roll'); // p1 -> p2 is still round 30
    expect(midRes.state.round).toBe(30);
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state).toMatchObject({ phase: 'over', winner: 'p1', winReason: 'rounds', round: 31 });
    expect(r.events.at(-1)).toMatchObject({ type: 'win', player: 'p1', reason: 'rounds' });
  });

  it('does not end earlier than the limit (round 29 -> 30 continues)', () => {
    const s = edit(lastOfRound(30), (c) => { c.round = 29; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state).toMatchObject({ phase: 'roll', round: 30, turn: 0 });
  });

  it('unlimited (null) never triggers the round limit', () => {
    const s = lastOfRound(null, (c) => { c.round = 5000; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state).toMatchObject({ phase: 'roll', round: 5001, winner: null });
  });

  it('breaks net worth ties by cash, then by seat', () => {
    // p0: 10000 cash + Banjara (5000) = 15000; p1: 15000 cash; p2: 15000 cash. p1 wins on cash over p0, then seat over p2.
    const s = lastOfRound(30, (c) => { c.owners[27] = 'p0'; c.players[0].cash = 10000; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(netWorth(r.state, 'p0')).toBe(15000);
    expect(r.state.winner).toBe('p1');
    const flat = doIt(lastOfRound(30), { type: 'END_TURN' });
    expect(flat.state.winner).toBe('p0'); // everything equal: earliest seat
  });

  it('extra rolls from doubles never add rounds', () => {
    let s = game(3);
    s = edit(s, (c) => { for (const t of [2, 4, 6]) c.owners[t] = 'p1'; });
    let r = ok(roll(s, 1, 1)); // 0 -> 2, doubles
    expect(r.state.round).toBe(1);
    r = ok(roll(r.state, 2, 2)); // 2 -> 6, doubles again
    expect(r.state.round).toBe(1);
    expect(r.state.turn).toBe(0);
    r = ok(roll(r.state, 1, 2)); // 6 -> 9, ends the doubles chain
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    s = doIt(s, { type: 'END_TURN' }).state;
    expect(s).toMatchObject({ turn: 1, round: 1 });
  });

  it('a bankrupt last seat still closes the round', () => {
    const s = edit(game(3), (c) => { c.players[2].bankrupt = true; c.players[2].cash = 0; c.turn = 1; c.phase = 'manage'; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state).toMatchObject({ turn: 0, round: 2 });
  });
});

// ---------------------------------------------------------------- options
describe('getOptions', () => {
  it('is all false/null when it is not your moment', () => {
    const s = game(3);
    expect(getOptions(s, 'p1')).toEqual({
      roll: false, bail: false, buy: false, skipBuy: false, endTurn: false, upgrade: [], bid: null, resign: true,
      mortgage: [], unmortgage: [], sellBuilding: [], debt: null, payDebt: false, useJailCard: false,
      trade: { canOffer: false }, tradeOffer: null, tradeSent: null, sets: [],
    });
    expect(getOptions(s, 'p0')).toMatchObject({ roll: true, endTurn: false, buy: false });
    expect(getOptions(s, 'ghost').resign).toBe(false);
  });

  it('follows the phases', () => {
    let s = ok(roll(game(3), 2, 4)).state;
    expect(getOptions(s, 'p0')).toMatchObject({ roll: false, buy: true, skipBuy: true, endTurn: false });
    s = doIt(s, { type: 'BUY' }).state;
    expect(getOptions(s, 'p0')).toMatchObject({ roll: false, buy: false, endTurn: true });
    expect(getOptions(s, 'p1').endTurn).toBe(false);
  });
});

// ---------------------------------------------------------------- bots
describe('bots', () => {
  const botGame = (n = 3, bots = []) => createGame({
    players: Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `B${i}`, avatar: i, isBot: true, bot: bots[i] })),
    seed: 11,
    settings: { diceCount: 2 },
  });
  const rnd = () => 0.5;

  it('returns null when a human must act or the game is over', () => {
    const s = createGame({ players: [{ id: 'h' }, { id: 'b', isBot: true }], seed: 1 });
    expect(nextBotMove(s, rnd)).toBeNull();
    expect(chooseBotAction(s, 'h', rnd)).toMatchObject({ type: 'ROLL', playerId: 'h' }); // server auto-play helper
    expect(nextBotMove(edit(botGame(), (c) => { c.phase = 'over'; }), rnd)).toBeNull();
  });

  it('buys when it keeps the reserve (or completes a set) and skips otherwise', () => {
    let s = ok(roll(edit(botGame(), (c) => { c.cfg.debug = true; }), 2, 4)).state; // Kukatpally 700
    expect(nextBotMove(s, rnd)).toEqual({ type: 'BUY', playerId: 'p0' });
    const tight = edit(s, (c) => { c.players[0].cash = 1000; }); // 300 left < reserve 500
    expect(nextBotMove(tight, rnd)).toEqual({ type: 'SKIP_BUY', playerId: 'p0' });
    const completes = edit(tight, (c) => { c.owners[8] = 'p0'; c.owners[10] = 'p0'; });
    expect(nextBotMove(completes, rnd)).toEqual({ type: 'BUY', playerId: 'p0' });
  });

  it('upgrades while keeping its reserve, then rolls, then ends the turn', () => {
    let s = edit(botGame(), (c) => { giveAll(c, 'east', 'p0'); c.players[0].cash = 900; });
    const a = nextBotMove(s, rnd);
    expect(a).toMatchObject({ type: 'UPGRADE', playerId: 'p0' });
    s = edit(s, (c) => { c.players[0].cash = 700; }); // 700 - 350 < 500 reserve
    expect(nextBotMove(s, rnd)).toEqual({ type: 'ROLL', playerId: 'p0' });
    s = edit(s, (c) => { c.phase = 'manage'; });
    expect(nextBotMove(s, rnd)).toEqual({ type: 'END_TURN', playerId: 'p0' });
  });

  it('pays bail only when it is comfortably rich', () => {
    const jailed = edit(botGame(), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = 1; });
    expect(nextBotMove(jailed, rnd)).toEqual({ type: 'PAY_BAIL', playerId: 'p0' });
    const poor = edit(jailed, (c) => { c.players[0].cash = 1500; });
    expect(nextBotMove(poor, rnd)).toEqual({ type: 'ROLL', playerId: 'p0' });
  });

  it('bids during auctions: every bot answers, passes below the minimum, and bids stay legal', () => {
    let s = edit(botGame(3), (c) => { c.cfg.debug = true; });
    s = ok(roll(s, 3, 4)).state;
    const { minBid } = s.pending;
    let guard = 0;
    while (s.phase === 'auction' && guard++ < 5) {
      const a = nextBotMove(s, mulberry32(guard));
      expect(a.type).toBe('BID');
      expect(a.amount === 0 || (a.amount >= minBid && a.amount <= s.players.find((p) => p.id === a.playerId).cash)).toBe(true);
      s = ok(applyAction(s, a)).state;
    }
    expect(s.phase).toBe('manage');
    const poorBot = edit(botGame(3), (c) => { c.players[1].cash = 100; c.phase = 'auction'; c.pending = { type: 'auction', tile: 27, minBid: 2500, bids: { p0: 0 } }; });
    expect(nextBotMove(poorBot, () => 0.5)).toEqual({ type: 'BID', playerId: 'p1', amount: 0 });
  });

  it('plays complete games to the end without a single rejected action', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const n of [2, 3, 4]) {
        let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: ids[i], isBot: true })), seed, settings: { goal: 40000 } });
        const r = mulberry32(seed * 100 + n);
        let steps = 0;
        while (s.phase !== 'over') {
          const res = applyAction(s, nextBotMove(s, r));
          expect(res.error).toBeUndefined();
          s = res.state;
          expect(s.players.every((p) => Number.isInteger(p.cash) && p.cash >= 0)).toBe(true);
          if (++steps > 20000) throw new Error('did not finish');
        }
        expect(s.winner).toBeTruthy();
        expect(['net_worth', 'last_standing', 'rounds']).toContain(s.winReason);
      }
    }
  });
});
