import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, standings,
  nextBotMove, chooseBotAction, botSnatchAction, DEFAULT_SETTINGS, DEFAULT_BOT, PLAYER_COLORS, KISMET,
  BOARD_SIZE, JAIL_TILE, PARKING_TILE, GO_TO_JAIL_TILE, START_CASH, PASS_START, BAIL_FINE,
  TRANSPORT_RENT, UTILITY_MULT, taxDue, mortgageValue, unmortgageCost,
  TILES, GROUP_TILES, MAX_LEVEL, rentFor, upgradeCost, isBuyable, mulberry32, nextFloat, randInt, shuffle,
} from './index.js';

// ---------------------------------------------------------------- helpers
// ONE die (1..6 squares per roll). A test that needs a landing puts the player `d` squares behind the tile and rolls
// `d`. The snatch rule is off (`snatches: 0`) unless a test asks for it; shared/snatch.test.js covers it.
const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `Player ${i}`, avatar: i }));
// auctionOnDecline defaults to false here so the classic tests stay simple; the v2 tests switch it on.
const game = (n = 3, settings = {}, seed = 7) => createGame({ players: mkPlayers(n), seed, settings: { debug: true, snatches: 0, auctionOnDecline: false, ...settings } });
const at = (s, pos, idx = 0) => edit(s, (c) => { c.players[idx].pos = pos; });
const edit = (s, fn) => {
  const c = structuredClone(s);
  fn(c);
  return c;
};
const me = (s) => s.players[s.turn].id;
const roll = (s, d, pid) => applyAction(s, { type: 'ROLL', playerId: pid ?? me(s), dice: [d] });
// One step of an all-bot game: the snatch window is closed by the room (SNATCH_CLOSE) after the bots had their say.
const botStep = (s, rnd) => {
  if (s.phase === 'snatch') {
    for (const id of s.pending.eligible) {
      const a = botSnatchAction(s, id);
      if (a) return a;
    }
    return { type: 'SNATCH_CLOSE' };
  }
  return nextBotMove(s, rnd);
};
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
    expect(s.owners).toHaveLength(BOARD_SIZE);
    expect(s.levels).toHaveLength(BOARD_SIZE);
    expect(s.mortgaged).toHaveLength(BOARD_SIZE);
    expect(s.levels.every((l) => l === 0)).toBe(true);
    expect(s.pending).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.winReason).toBeNull();
    expect(s.turnCount).toBe(0);
    expect(s.players[0]).toMatchObject({ id: 'p0', cash: DEFAULT_SETTINGS.startCash, pos: 0, jailTurns: 0, sixes: 0, rollsSinceSix: 0, bankrupt: false });
    expect(s.players[0]).not.toHaveProperty('doubles');
    expect(s.dice).toEqual([0]); // one die, zero = not rolled yet
    expect(s.cfg).not.toHaveProperty('diceCount');
    expect(DEFAULT_SETTINGS).not.toHaveProperty('diceCount');
    expect(DEFAULT_SETTINGS).toMatchObject({ startCash: START_CASH, passStart: PASS_START, bailFine: BAIL_FINE });
    expect([START_CASH, PASS_START, BAIL_FINE]).toEqual([15000, 2000, 500]);
    expect(DEFAULT_SETTINGS).not.toHaveProperty('taxAmount'); // tax comes from the tile
    expect(DEFAULT_SETTINGS).not.toHaveProperty('filmFee');
    expect(s.players.map((p) => p.color)).toEqual(PLAYER_COLORS.slice(0, 4));
    expect(Object.keys(s.players[0].stats).sort()).toEqual(
      ['biggestRent', 'jailed', 'propertiesBought', 'rentEarned', 'rentPaid', 'taxPaid', 'upgrades'],
    );
    expect([...s.deck].sort((a, b) => a - b)).toEqual(KISMET.map((_, i) => i));
  });

  it('every player starts with the snatch tokens of cfg.snatches (public)', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ snatches: 1, snatchMs: 3000 });
    const s = createGame({ players: mkPlayers(3), seed: 1 });
    expect(s.players.map((p) => p.snatches)).toEqual([1, 1, 1]);
    expect(createGame({ players: mkPlayers(2), seed: 1, settings: { snatches: 3, snatchMs: 5000 } }).players.map((p) => p.snatches)).toEqual([3, 3]);
    expect(createGame({ players: mkPlayers(2), seed: 1, settings: { snatches: 9, snatchMs: 5 } }).cfg).toMatchObject({ snatches: 3, snatchMs: 1000 });
    expect(createGame({ players: mkPlayers(2), seed: 1, settings: { snatches: 0 } }).players.map((p) => p.snatches)).toEqual([0, 0]);
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
    expect(s.players[0].bot).toEqual({ ...DEFAULT_BOT });
    expect(DEFAULT_BOT).toEqual({ reserve: 1000, greed: 1 });
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
      const res = applyAction(s, botStep(s, rnd));
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
      const res = applyAction(s, botStep(s, rnd));
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
    const forced = applyAction(s, { type: 'ROLL', playerId: 'p0', dice: [6] });
    const plain = applyAction(s, { type: 'ROLL', playerId: 'p0' });
    expect(forced.error).toBeUndefined();
    expect(forced.state.dice).toEqual(plain.state.dice); // the action's dice were ignored
    const d = game(2);
    // exactly one die, 1..6
    for (const bad of [[0], [7], [1.5], [], [2, 3], [6, 6], 4, 'x']) {
      expect(applyAction(d, { type: 'ROLL', playerId: 'p0', dice: bad }).error, JSON.stringify(bad)).toBe('Invalid dice');
    }
    expect(applyAction(d, { type: 'ROLL', playerId: 'p0', dice: [6] }).error).toBeUndefined();
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
  it('moves by the die, emits dice/move/land events (one-element values)', () => {
    const { events, state } = ok(roll(game(), 3));
    expect(events.map((e) => e.type).slice(0, 3)).toEqual(['dice', 'move', 'land']);
    expect(ofType(events, 'dice')[0].values).toEqual([3]);
    expect(ofType(events, 'move')[0]).toMatchObject({ player: 'p0', from: 0, to: 3, path: [1, 2, 3], passedStart: false });
    expect(state.players[0].pos).toBe(3);
    expect(state.dice).toEqual([3]);
    expect(state.extraRoll).toBe(false);
  });

  it('a single step is a real outcome', () => {
    const { events, state } = ok(roll(game(), 1));
    expect(ofType(events, 'move')[0].path).toEqual([1]);
    expect(state.players[0].pos).toBe(1);
  });

  it('pays salary when wrapping past START (39 -> 0)', () => {
    const s = edit(game(), (c) => { c.players[0].pos = BOARD_SIZE - 2; });
    const { events, state } = ok(roll(s, 3)); // 38 -> 1
    expect(state.players[0].pos).toBe(1);
    expect(ofType(events, 'move')[0]).toMatchObject({ passedStart: true, path: [39, 0, 1] });
    const salary = ofType(events, 'cash').find((e) => e.reason === 'salary');
    expect(salary).toMatchObject({ player: 'p0', delta: DEFAULT_SETTINGS.passStart });
    expect(salary.delta).toBe(2000);
  });

  it('pays no salary when the move stops short of START', () => {
    const s = edit(game(), (c) => { c.players[0].pos = BOARD_SIZE - 4; });
    const { events } = ok(roll(s, 3)); // 36 -> 39
    expect(ofType(events, 'move')[0]).toMatchObject({ passedStart: false });
    expect(ofType(events, 'cash').filter((e) => e.reason === 'salary')).toHaveLength(0);
  });

  it('pays salary when landing exactly on START', () => {
    const s = edit(game(), (c) => { c.players[0].pos = BOARD_SIZE - 4; });
    const { events, state } = ok(roll(s, 4)); // 36 -> 0
    expect(state.players[0].pos).toBe(0);
    expect(ofType(events, 'cash').filter((e) => e.reason === 'salary')).toHaveLength(1);
    expect(state.phase).toBe('manage');
  });

  it('a six grants an extra roll and END_TURN is blocked until then', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p1'; });
    let r = ok(roll(s, 6)); // lands on owned Koti: pays rent, phase manage, extraRoll
    expect(r.state.phase).toBe('manage');
    expect(r.state.extraRoll).toBe(true);
    expect(applyAction(r.state, { type: 'END_TURN', playerId: 'p0' }).error).toBeTruthy();
    expect(getOptions(r.state, 'p0')).toMatchObject({ roll: true, endTurn: false });
    r = ok(roll(r.state, 4)); // 6 -> 10, just visiting (not a six)
    expect(r.state.extraRoll).toBe(false);
    expect(getOptions(r.state, 'p0').endTurn || r.state.phase === 'buy').toBe(true);
  });

  it('three sixes in a row are NOT special (docs/GAME_RULES.md section 4): the third six lands and rolls again', () => {
    let s = game();
    let r = ok(roll(s, 6)); // 0 -> 6
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    r = ok(roll(s, 6)); // 6 -> 12
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    expect(s.players[0].sixes).toBe(2);
    r = ok(roll(s, 6)); // 12 -> 18, not jail
    expect(ofType(r.events, 'move')[0]).toMatchObject({ player: 'p0', from: 12, to: 18 });
    expect(ofType(r.events, 'move')[0].teleport).toBeUndefined();
    expect(ofType(r.events, 'jail')).toHaveLength(0);
    expect(ofType(r.events, 'land')).toHaveLength(1);
    expect(r.state.players[0]).toMatchObject({ pos: 18, jailTurns: 0, sixes: 3 });
    expect(r.state.turn).toBe(0);
    expect(r.state.extraRoll).toBe(true); // a fourth roll is still granted
    // any other face ends the chain and resets the per-turn six counter
    s = r.state;
    if (s.phase === 'buy') s = doIt(s, { type: 'SKIP_BUY' }).state;
    r = ok(roll(s, 2));
    expect(r.state.players[0].sixes).toBe(0);
    expect(r.state.extraRoll).toBe(false);
  });

  it('rollsSinceSix counts rolls without a six (jail rolls included) and resets on a six', () => {
    let s = ok(roll(game(), 3)).state;
    expect(s.players[0].rollsSinceSix).toBe(1);
    const jailed = edit(game(), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 2; c.players[0].rollsSinceSix = 3; });
    expect(ok(roll(jailed, 2)).state.players[0].rollsSinceSix).toBe(4);
    s = ok(roll(edit(game(), (c) => { c.players[0].rollsSinceSix = 5; }), 6)).state;
    expect(s.players[0].rollsSinceSix).toBe(0);
    expect(s.players[0].sixes).toBe(1);
  });

  it('round increments when the turn order wraps and bankrupt players are skipped', () => {
    let s = edit(game(3), (c) => { c.players[1].bankrupt = true; c.players[1].cash = 0; });
    s = ok(roll(s, 3)).state; // lands on Malakpet: buy offer
    s = doIt(s, { type: 'SKIP_BUY' }).state;
    const r = doIt(s, { type: 'END_TURN' });
    expect(r.state.turn).toBe(2);
    expect(r.state.round).toBe(1);
    let t = ok(roll(r.state, 3)).state;
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
    const s0 = at(game(), 3);
    const r = ok(roll(s0, 3)); // Koti, 1,000
    const price = TILES[6].price;
    expect(price).toBe(1000);
    expect(r.state.phase).toBe('buy');
    expect(r.state.pending).toEqual({ type: 'buy', tile: 6, price });
    expect(getOptions(r.state, 'p0')).toMatchObject({ buy: true, skipBuy: true, roll: false, endTurn: false });
    const b = doIt(r.state, { type: 'BUY' });
    expect(b.state.owners[6]).toBe('p0');
    expect(b.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - price);
    expect(b.state.players[0].stats.propertiesBought).toBe(1);
    expect(b.state.phase).toBe('manage');
    expect(b.state.pending).toBeNull();
    expect(b.events).toEqual([
      { type: 'cash', player: 'p0', delta: -price, reason: 'buy' },
      { type: 'own', tile: 6, owner: 'p0', reason: 'buy' },
    ]);
  });

  it('SKIP_BUY leaves the tile unowned; an unaffordable tile is not offered', () => {
    const r = ok(roll(at(game(), 3), 3));
    const k = doIt(r.state, { type: 'SKIP_BUY' });
    expect(k.state.owners[6]).toBeNull();
    expect(k.state.phase).toBe('manage');
    const poor = edit(game(), (c) => { c.players[0].pos = 3; c.players[0].cash = TILES[6].price - 1; });
    const p = ok(roll(poor, 3));
    expect(p.state.phase).toBe('manage');
    expect(p.state.pending).toBeNull();
    expect(getOptions(p.state, 'p0').buy).toBe(false);
  });

  it('cannot BUY when it is not the buy phase or by another player', () => {
    const r = ok(roll(at(game(), 3), 3));
    expect(applyAction(r.state, { type: 'BUY', playerId: 'p1' }).error).toBeTruthy();
    expect(applyAction(r.state, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
  });
});

// ---------------------------------------------------------------- rent
describe('rent', () => {
  const landOn = (s, from, d) => ok(roll(edit(s, (c) => { c.players[0].pos = from; }), d));

  it('charges base property rent with a cash event per side', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p1'; });
    const r = landOn(s, 3, 3);
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
    const full = edit(game(), (c) => giveAll(c, 'lightblue', 'p1'));
    const base = rentFor(TILES[6], 0);
    expect(landOn(full, 3, 3).state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + 2 * base);
    expect(previewRent(full, 6)).toBe(120);
    const built = edit(full, (c) => { c.levels[6] = 2; });
    expect(previewRent(built, 6)).toBe(rentFor(TILES[6], 2)); // 900 from the table, no doubling
    expect(previewRent(built, 6)).toBe(900);
    const partial = edit(game(), (c) => { c.owners[6] = 'p1'; c.owners[8] = 'p1'; });
    expect(previewRent(partial, 6)).toBe(base); // 2 of 3 in a colour: still x1
    const pair = edit(game(), (c) => giveAll(c, 'brown', 'p1')); // a 2-tile colour doubles when both are held
    expect(previewRent(pair, 1)).toBe(2 * rentFor(TILES[1], 0));
    expect(previewRent(pair, 3)).toBe(2 * rentFor(TILES[3], 0));
  });

  it('hotel rent comes straight from the rent table (no multiplier)', () => {
    const hotel = edit(game(), (c) => giveAll(c, 'darkblue', 'p1', MAX_LEVEL));
    expect(previewRent(hotel, 39)).toBe(20000);
    expect(previewRent(hotel, 37)).toBe(15000);
    expect(previewRent(hotel, 39)).toBe(TILES[39].rent[MAX_LEVEL]);
    const rich = edit(hotel, (c) => { c.players[0].cash = 30000; });
    const r = landOn(rich, 34, 5); // 34 -> 39
    expect(r.state.players[0].cash).toBe(10000);
    expect(r.state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + 20000);
    expect(r.state.players[1].stats.biggestRent).toBe(20000);
  });

  it('station rent scales with the number of stations owned (250 / 500 / 1,000 / 2,000)', () => {
    expect(TRANSPORT_RENT).toEqual([0, 250, 500, 1000, 2000]);
    const owned = (n) => edit(game(), (c) => { [5, 15, 25, 35].slice(0, n).forEach((t) => { c.owners[t] = 'p1'; }); });
    expect(landOn(owned(1), 0, 5).state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 250); // 0 -> 5
    expect(previewRent(owned(2), 5)).toBe(500);
    expect(previewRent(owned(3), 5)).toBe(1000);
    expect(previewRent(owned(4), 5)).toBe(2000);
    expect(previewRent(owned(4), 35)).toBe(2000); // any station of the set asks the same
    const four = landOn(owned(4), 0, 5);
    expect(four.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 2000);
    expect(four.state.players[1].cash).toBe(DEFAULT_SETTINGS.startCash + 2000);
  });

  it('utility rent is the die value times the multiplier for the count owned (40x, then 100x)', () => {
    expect(UTILITY_MULT).toEqual([0, 40, 100]);
    const one = edit(game(), (c) => { c.owners[12] = 'p1'; });
    const r1 = landOn(one, 8, 4); // 8 -> 12, the die shows 4
    expect(r1.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 4 * 40);
    const both = edit(one, (c) => { c.owners[28] = 'p1'; });
    const r2 = landOn(both, 8, 4);
    expect(r2.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 4 * 100);
    expect(previewRent(both, 12, 5)).toBe(500);
    const water = landOn(both, 23, 5); // 23 -> 28, the other utility asks the same
    expect(water.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 5 * 100);
  });

  it('a mortgaged tile asks no rent', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p1'; c.mortgaged[6] = true; });
    expect(previewRent(s, 6)).toBe(0);
    expect(ofType(landOn(s, 3, 3).events, 'cash')).toHaveLength(0);
  });

  it('own tiles and unowned tiles cost nothing; previewRent is 0 for those', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; });
    const r = landOn(s, 3, 3);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
    expect(previewRent(s, 8)).toBe(0);
    expect(previewRent(s, 4)).toBe(0); // tax tile
  });

  it('GHMC property tax is the LOWER of 2,000 and 10% of net worth', () => {
    expect(taxDue(TILES[4], 15000)).toBe(1500);
    // at the start: 15,000 net worth -> 1,500
    const poor = landOn(game(), 0, 4); // 0 -> 4
    expect(ofType(poor.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -1500, reason: 'tax' }]);
    expect(poor.state.players[0].stats.taxPaid).toBe(1500);
    // rich: 10% would be 3,000, so the 2,000 cap applies
    const rich = edit(game(), (c) => { c.players[0].cash = 30000; });
    const capped = landOn(rich, 0, 4);
    expect(ofType(capped.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -2000, reason: 'tax' }]);
    expect(capped.state.players[0].cash).toBe(28000);
    // property is part of the worth: 10,000 cash + Financial District (4,000) = 14,000 -> 1,400
    const landlord = edit(game(), (c) => { c.players[0].cash = 10000; c.owners[39] = 'p0'; });
    expect(ofType(landOn(landlord, 0, 4).events, 'cash')[0].delta).toBe(-1400);
  });

  it('the ORR toll is a flat 1,000 whatever you are worth', () => {
    expect(TILES[38].taxFlat).toBe(1000);
    const t = landOn(game(), 34, 4); // 34 -> 38
    expect(ofType(t.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -1000, reason: 'tax' }]);
    expect(t.state.players[0].stats.taxPaid).toBe(1000);
    const rich = edit(game(), (c) => { c.players[0].cash = 90000; });
    expect(ofType(landOn(rich, 34, 4).events, 'cash')[0].delta).toBe(-1000);
  });

  it('the Irani Chai & Biryani Break corner is a free stop: only a land event', () => {
    const r = landOn(game(), 15, 5); // 15 -> 20
    expect(r.state.players[0].pos).toBe(PARKING_TILE);
    expect(ofType(r.events, 'land')).toEqual([{ type: 'land', player: 'p0', tile: PARKING_TILE }]);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
  });

  it('Go to Jail (tile 30) sends you to Chanchalguda with no salary and ends the turn', () => {
    const r = landOn(game(), 25, 5); // 25 -> 30
    expect(ofType(r.events, 'land')[0]).toEqual({ type: 'land', player: 'p0', tile: GO_TO_JAIL_TILE });
    expect(ofType(r.events, 'move')[1]).toMatchObject({ from: GO_TO_JAIL_TILE, to: JAIL_TILE, teleport: true, passedStart: false });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ player: 'p0', jailed: true, reason: 'gotojail' });
    expect(ofType(r.events, 'cash')).toHaveLength(0); // no salary for the trip back past START
    expect(r.state.players[0]).toMatchObject({ pos: JAIL_TILE, jailTurns: DEFAULT_SETTINGS.jailTurns, cash: DEFAULT_SETTINGS.startCash });
    expect(r.state.players[0].stats.jailed).toBe(1);
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('roll');
    // a six onto the square does not grant the extra roll either
    const d = landOn(game(), 24, 6); // 24 -> 30
    expect(d.state.players[0].pos).toBe(JAIL_TILE);
    expect(d.state.extraRoll).toBe(false);
    expect(d.state.turn).toBe(1);
  });
});

// ---------------------------------------------------------------- upgrades
describe('upgrades', () => {
  const blueSet = () => edit(game(), (c) => giveAll(c, 'lightblue', 'p0'));
  const cost = upgradeCost(TILES[6]);

  it('requires the full set, enforces even building, and reports reasons', () => {
    const partial = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; });
    expect(canUpgrade(partial, 'p0', 6)).toMatchObject({ ok: false });
    expect(canUpgrade(partial, 'p0', 6).reason).toMatch(/Own all/);
    expect(canUpgrade(game(), 'p0', 6).reason).toMatch(/do not own/);
    expect(canUpgrade(game(), 'p0', 5).reason).toMatch(/properties/); // a station

    let s = blueSet();
    expect(canUpgrade(s, 'p0', 6)).toEqual({ ok: true, cost: 500 });
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(s.levels[6]).toBe(1);
    expect(canUpgrade(s, 'p0', 6).reason).toMatch(/evenly/);
    expect(canUpgrade(s, 'p0', 8).ok).toBe(true);
    expect(applyAction(s, { type: 'UPGRADE', playerId: 'p0', tile: 6 }).error).toMatch(/evenly/);
  });

  it('charges the build cost, emits cash+level events and tracks stats', () => {
    const r = doIt(blueSet(), { type: 'UPGRADE', tile: 8 });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -upgradeCost(TILES[8]), reason: 'upgrade' },
      { type: 'level', tile: 8, level: 1, reason: 'upgrade' },
    ]);
    expect(r.state.players[0].stats.upgrades).toBe(1);
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - cost);
    expect(r.state.phase).toBe('roll'); // upgrading does not consume the roll
    expect(netWorth(r.state, 'p0')).toBe(netWorth(blueSet(), 'p0')); // building keeps net worth constant
  });

  it('costs the tile house cost: 500 / 1,000 / 1,500 / 2,000 by colour band', () => {
    expect([TILES[1], TILES[6], TILES[11], TILES[16], TILES[21], TILES[26], TILES[31], TILES[37]].map(upgradeCost))
      .toEqual([500, 500, 1000, 1000, 1500, 1500, 2000, 2000]);
    const red = edit(game(), (c) => giveAll(c, 'red', 'p0'));
    expect(doIt(red, { type: 'UPGRADE', tile: 21 }).state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 1500);
  });

  it('stops at MAX_LEVEL, needs cash, the turn player and the right phase', () => {
    const maxed = edit(blueSet(), (c) => { for (const t of GROUP_TILES.lightblue) c.levels[t] = MAX_LEVEL; });
    expect(canUpgrade(maxed, 'p0', 6).reason).toMatch(/fully built/);
    const poor = edit(blueSet(), (c) => { c.players[0].cash = 100; });
    expect(canUpgrade(poor, 'p0', 6)).toMatchObject({ ok: false, cost });
    expect(canUpgrade(poor, 'p0', 6).reason).toMatch(/Need/);
    const s = blueSet();
    expect(canUpgrade(s, 'p1', 6).ok).toBe(false);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: 1500 }; });
    expect(canUpgrade(buying, 'p0', 6).ok).toBe(false);
    expect(applyAction(buying, { type: 'UPGRADE', playerId: 'p0', tile: 6 }).error).toBeTruthy();
  });

  it('getOptions lists only upgradable tiles at the lowest level', () => {
    let s = blueSet();
    expect(getOptions(s, 'p0').upgrade.map((u) => u.tile).sort((a, b) => a - b)).toEqual([6, 8, 9]);
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(getOptions(s, 'p0').upgrade.map((u) => u.tile).sort((a, b) => a - b)).toEqual([8, 9]);
    expect(getOptions(s, 'p0').upgrade[0]).toHaveProperty('cost');
    expect(getOptions(s, 'p1').upgrade).toEqual([]);
  });

  it('raises rent with the level, straight from the table', () => {
    let s = blueSet();
    s = doIt(s, { type: 'UPGRADE', tile: 6 }).state;
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 1));
    expect(previewRent(s, 6)).toBe(300);
  });
});

// ---------------------------------------------------------------- jail
describe('jail', () => {
  const jailed = (settings) => edit(game(3, settings), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = c.cfg.jailTurns; });

  it('a failed roll (anything but a six) serves the time and ends the turn', () => {
    const r = ok(roll(jailed(), 2));
    expect(ofType(r.events, 'jail_stay')[0]).toEqual({ type: 'jail_stay', player: 'p0', left: 0 });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: false, reason: 'served' });
    expect(r.state.players[0]).toMatchObject({ jailTurns: 0, pos: JAIL_TILE });
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'move')).toHaveLength(0);
  });

  it('longer sentences count down', () => {
    let r = ok(roll(jailed({ jailTurns: 2 }), 2));
    expect(ofType(r.events, 'jail_stay')[0].left).toBe(1);
    expect(ofType(r.events, 'jail')).toHaveLength(0);
    expect(r.state.players[0].jailTurns).toBe(1);
  });

  it('a six frees you and you move six squares without an extra roll', () => {
    const r = ok(roll(jailed(), 6));
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: false, reason: 'six' });
    expect(ofType(r.events, 'move')[0]).toMatchObject({ from: JAIL_TILE, to: 16 });
    expect(r.state.players[0]).toMatchObject({ pos: 16, jailTurns: 0 });
    expect(r.state.extraRoll).toBe(false);
  });

  it('PAY_BAIL charges the 500 bail to the bank and lets you roll normally', () => {
    const s = jailed();
    expect(getOptions(s, 'p0')).toMatchObject({ roll: true, bail: true });
    const r = doIt(s, { type: 'PAY_BAIL' });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -DEFAULT_SETTINGS.bailFine, reason: 'bail' },
      { type: 'jail', player: 'p0', jailed: false, reason: 'bail' },
    ]);
    expect(DEFAULT_SETTINGS.bailFine).toBe(500);
    expect(r.state.players[0].cash).toBe(DEFAULT_SETTINGS.startCash - 500);
    expect(r.state.phase).toBe('roll');
    expect(r.state.players[0].jailTurns).toBe(0);
    const moved = ok(roll(r.state, 5));
    expect(moved.state.players[0].pos).toBe(15);
    const poor = edit(s, (c) => { c.players[0].cash = 499; });
    expect(applyAction(poor, { type: 'PAY_BAIL', playerId: 'p0' }).error).toBeTruthy();
    expect(getOptions(poor, 'p0').bail).toBe(false);
  });
});

// ---------------------------------------------------------------- kismet cards
describe('kismet cards', () => {
  // By default the turn player stands on tile 3 and rolls 4 so they land on Nawab ka Farman (tile 7).
  const draw = (cardId, mutate = () => {}, n = 3, from = 3, d = 4) => {
    const s = edit(game(n), (c) => { rig(c, cardId); c.players[0].pos = from; mutate(c); });
    return ok(roll(s, d));
  };
  const cashOf = (r, i = 0) => r.state.players[i].cash;

  it('has 24 well-formed cards that never target a kismet tile', () => {
    expect(KISMET).toHaveLength(24);
    expect(new Set(KISMET.map((c) => c.id)).size).toBe(24);
    for (const c of KISMET) {
      expect(['good', 'bad', 'neutral']).toContain(c.kind);
      expect(c.title && c.text).toBeTruthy();
      if (c.effect.type === 'moveTo') {
        expect(c.effect.tile).toBeGreaterThanOrEqual(0);
        expect(c.effect.tile).toBeLessThan(BOARD_SIZE);
        expect(TILES[c.effect.tile].type).not.toBe('kismet');
        expect(TILES[c.effect.tile].type).not.toBe('gotojail');
      }
    }
    expect(KISMET.filter((c) => c.effect.type === 'jailCard')).toHaveLength(1);
  });

  it('carries the Nawab ka Farman + Hyderabadi Khazana ideas from the spec', () => {
    const fx = (id) => KISMET.find((c) => c.id === id)?.effect;
    expect(fx('charminar_trip')).toEqual({ type: 'moveTo', tile: 21, collect: true }); // Charminar
    expect(fx('biryani_late')).toEqual({ type: 'payAll', amount: 500 });
    expect(fx('metro_smooth')).toEqual({ type: 'moveBy', n: 3 });
    expect(fx('gachibowli_jam')).toEqual({ type: 'moveBy', n: -3 });
    expect(fx('naka_bandi')).toEqual({ type: 'jail' });
    expect(fx('cricket_bet')).toEqual({ type: 'cash', amount: 1500 });
    expect(fx('haleem_profit')).toEqual({ type: 'cash', amount: 2000 });
    expect(fx('pearl_market')).toEqual({ type: 'cash', amount: -1000 });
    expect(fx('jail_free')).toEqual({ type: 'jailCard' });
    expect(fx('rich_uncle')).toEqual({ type: 'moveTo', tile: 32, collect: true }); // Banjara Hills
    expect(fx('film_audition')).toEqual({ type: 'moveTo', tile: 34, collect: true }); // Film Nagar
    expect(fx('airport_dash')).toEqual({ type: 'moveTo', tile: 0, collect: true }); // START
  });

  it('emits a card event (with the deck of the square) and applies cash effects', () => {
    const good = draw('it_hike');
    expect(ofType(good.events, 'card')[0]).toMatchObject({ player: 'p0', cardId: 'it_hike', kind: 'good', deck: 'chance', title: 'IT Hike!' });
    expect(ofType(good.events, 'cash')[0]).toEqual({ type: 'cash', player: 'p0', delta: 1500, reason: 'card' });
    const bad = draw('orr_challan');
    expect(cashOf(bad)).toBe(DEFAULT_SETTINGS.startCash - 500);
    expect(ofType(bad.events, 'cash')[0]).toMatchObject({ delta: -500, reason: 'card' });
  });

  it('both card squares draw from the one shared deck', () => {
    const farman = draw('cricket_bet'); // tile 7, Nawab ka Farman
    expect(ofType(farman.events, 'card')[0]).toMatchObject({ cardId: 'cricket_bet', deck: 'chance' });
    const khazana = draw('cricket_bet', () => {}, 3, 0, 2); // tile 2, Hyderabadi Khazana
    expect(ofType(khazana.events, 'card')[0]).toMatchObject({ cardId: 'cricket_bet', deck: 'chest' });
    expect(cashOf(khazana)).toBe(cashOf(farman)); // the same card, whichever square it came from
    const second = edit(farman.state, (c) => { c.players[0].pos = 18; c.phase = 'roll'; c.turn = 0; c.extraRoll = false; });
    const r = ok(roll(second, 4)); // 18 -> 22, another Farman square: the next card of the same deck
    expect(r.state.deckPos).toBe(2);
  });

  it('every cash card pays or charges exactly its amount', () => {
    for (const card of KISMET.filter((c) => c.effect.type === 'cash')) {
      const r = draw(card.id);
      expect(cashOf(r), card.id).toBe(DEFAULT_SETTINGS.startCash + card.effect.amount);
    }
  });

  it('airport dash: moves to START and collects the 2,000 salary', () => {
    const r = draw('airport_dash');
    expect(r.state.players[0].pos).toBe(0);
    expect(ofType(r.events, 'move')[1]).toMatchObject({ from: 7, to: 0, passedStart: true });
    expect(cashOf(r)).toBe(DEFAULT_SETTINGS.startCash + DEFAULT_SETTINGS.passStart);
    expect(ofType(r.events, 'land').map((e) => e.tile)).toEqual([7, 0]);
  });

  it('all aboard: advancing to Secunderabad Junction wraps past START (salary) and re-resolves the landing', () => {
    const r = draw('ride_metro');
    expect(r.state.players[0].pos).toBe(5);
    expect(cashOf(r)).toBe(DEFAULT_SETTINGS.startCash + DEFAULT_SETTINGS.passStart);
    expect(r.state.phase).toBe('buy');
    expect(r.state.pending.tile).toBe(5);
  });

  it('Charminar trip pays the salary only when it passes START', () => {
    const near = draw('charminar_trip'); // 7 -> 21, no wrap
    expect(near.state.players[0].pos).toBe(21);
    expect(cashOf(near)).toBe(DEFAULT_SETTINGS.startCash);
    expect(near.state.pending).toMatchObject({ tile: 21, price: 2200 });
    const wrap = draw('charminar_trip', () => {}, 3, 32, 4); // 32 -> 36 -> 21 passes START
    expect(wrap.state.players[0].pos).toBe(21);
    expect(cashOf(wrap)).toBe(DEFAULT_SETTINGS.startCash + DEFAULT_SETTINGS.passStart);
  });

  it('rich uncle sends you to Banjara Hills (salary only if you pass START); Gachibowli jam goes back 3 with no salary', () => {
    const u = draw('rich_uncle');
    expect(u.state.players[0].pos).toBe(32);
    expect(cashOf(u)).toBe(DEFAULT_SETTINGS.startCash);
    expect(u.state.pending).toMatchObject({ tile: 32, price: 3000 });
    const j = draw('gachibowli_jam', () => {}, 3, 18, 4); // 18 -> 22 -> back to 19 (Lumbini Park)
    expect(j.state.players[0].pos).toBe(19);
    expect(ofType(j.events, 'move')[1]).toMatchObject({ path: [21, 20, 19], passedStart: false });
    expect(cashOf(j)).toBe(DEFAULT_SETTINGS.startCash);
    expect(j.state.pending).toMatchObject({ tile: 19 });
    const rent = draw('gachibowli_jam', (c) => { c.owners[19] = 'p1'; }, 3, 18, 4); // landing again charges rent
    expect(cashOf(rent)).toBe(DEFAULT_SETTINGS.startCash - rentFor(TILES[19], 0));
  });

  it('metro runs smooth: 3 forward, and the new square resolves', () => {
    const r = draw('metro_smooth'); // 7 -> 10, just visiting
    expect(r.state.players[0].pos).toBe(JAIL_TILE);
    expect(ofType(r.events, 'move')[1]).toMatchObject({ path: [8, 9, 10], passedStart: false });
    expect(r.state.players[0].jailTurns).toBe(0);
    const buy = draw('metro_smooth', () => {}, 3, 18, 4); // 22 -> 25 Nampally
    expect(buy.state.pending).toMatchObject({ tile: 25 });
  });

  it('a card that drops you on Go to Jail (back 3 from Khazana 33) jails you without salary', () => {
    const r = draw('gachibowli_jam', () => {}, 3, 29, 4); // 29 -> 33, card, back to 30
    expect(ofType(r.events, 'land').map((e) => e.tile)).toEqual([33, 30]);
    expect(r.state.players[0]).toMatchObject({ pos: JAIL_TILE, jailTurns: DEFAULT_SETTINGS.jailTurns });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: true, reason: 'gotojail' });
    expect(cashOf(r)).toBe(DEFAULT_SETTINGS.startCash);
    expect(r.state.turn).toBe(1);
  });

  it('naka-bandi sends you to jail and ends the turn', () => {
    const r = draw('naka_bandi');
    expect(r.state.players[0]).toMatchObject({ pos: JAIL_TILE, jailTurns: 1 });
    expect(ofType(r.events, 'jail')[0]).toMatchObject({ jailed: true, reason: 'card' });
    expect(ofType(r.events, 'move')[1]).toMatchObject({ to: JAIL_TILE, teleport: true });
    expect(r.state.turn).toBe(1);
    expect(r.state.phase).toBe('roll');
  });

  it('birthday collects from everyone; biryani delay pays everyone 500', () => {
    const b = draw('birthday');
    expect(b.state.players.map((p) => p.cash)).toEqual([15600, 14700, 14700]);
    expect(ofType(b.events, 'cash').filter((e) => e.reason === 'card' && e.player === 'p1')[0]).toMatchObject({ delta: -300, other: 'p0' });
    const p = draw('biryani_late');
    expect(p.state.players.map((c) => c.cash)).toEqual([14000, 15500, 15500]);
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
    const s = edit(game(), (c) => { c.deckPos = c.deck.length; c.players[0].pos = 3; });
    const r = ok(roll(s, 4));
    expect(r.state.deckPos).toBe(1);
    expect(ofType(r.events, 'card')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- auction of a declined property
describe('auction (sealed bids)', () => {
  // p0 lands on Koti (1,000) and declines it: a sealed auction opens for the same tile at 10% of the price.
  const toAuction = (mutate = () => {}, n = 3) => {
    const s = edit(game(n, { auctionOnDecline: true }), (c) => { c.players[0].pos = 3; mutate(c); });
    const landed = ok(roll(s, 3)); // 3 -> 6
    return doIt(landed.state, { type: 'SKIP_BUY' });
  };
  const bid = (s, pid, amount) => ok(applyAction(s, { type: 'BID', playerId: pid, amount }));

  it('opens for the declined tile at a tenth of its price', () => {
    const r = toAuction();
    const start = ofType(r.events, 'auction_start')[0];
    expect(r.state.phase).toBe('auction');
    expect(start).toEqual({ type: 'auction_start', tile: 6, minBid: 100 });
    expect(r.state.pending).toMatchObject({ type: 'auction', tile: 6, minBid: 100, bids: {} });
    expect(r.state.owners[6]).toBeNull();
    expect(getOptions(r.state, 'p2').bid).toEqual({ tile: 6, min: 100, max: 15000 });
  });

  it('does not open when auctionOnDecline is off', () => {
    const s = ok(roll(at(game(3, { auctionOnDecline: false }), 3), 3)).state;
    const r = doIt(s, { type: 'SKIP_BUY' });
    expect(r.state.phase).toBe('manage');
    expect(ofType(r.events, 'auction_start')).toHaveLength(0);
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
    const onP1 = (extra = () => {}) => {
      const s = edit(game(3, { auctionOnDecline: true }), (c) => { c.turn = 1; c.players[1].pos = 3; extra(c); });
      return doIt(ok(roll(s, 3, 'p1')).state, { type: 'SKIP_BUY' });
    };
    const m = onP1().state.pending.minBid;
    let a = onP1().state;
    a = bid(a, 'p0', m).state;
    a = bid(a, 'p2', m).state;
    const resA = bid(a, 'p1', m);
    expect(ofType(resA.events, 'auction_end')[0].winner).toBe('p1');
    // p2 vs p0 tie with p1 on turn: order p1, p2, p0 -> p2 wins
    let b = onP1().state;
    b = bid(b, 'p0', m).state;
    b = bid(b, 'p1', 0).state;
    const resB = bid(b, 'p2', m);
    expect(ofType(resB.events, 'auction_end')[0].winner).toBe('p2');
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
    const none = toAuction((c) => { c.players[1].cash = 0; c.players[2].cash = 0; });
    expect(none.state.pending.bids).toEqual({ p1: 0, p2: 0 });
    const end = bid(none.state, 'p0', 0);
    expect(ofType(end.events, 'auction_end')[0]).toMatchObject({ winner: null, amount: 0 });
    expect(end.state.phase).toBe('manage');
    let r = toAuction();
    r = bid(r.state, 'p0', 0);
    r = bid(r.state, 'p1', 0);
    r = bid(r.state, 'p2', 0);
    expect(ofType(r.events, 'auction_end')[0].winner).toBeNull();
    expect(r.state.owners.filter(Boolean)).toHaveLength(0);
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

  it('a six onto a declined tile still grants the extra roll afterwards', () => {
    const s = game(3, { auctionOnDecline: true });
    let r = ok(roll(s, 6)); // 0 -> 6 with a six
    expect(r.state.extraRoll).toBe(true);
    r = doIt(r.state, { type: 'SKIP_BUY' });
    for (const pid of ['p0', 'p1', 'p2']) r = bid(r.state, pid, 0);
    expect(r.state.phase).toBe('manage');
    expect(getOptions(r.state, 'p0').roll).toBe(true);
  });
});

// ---------------------------------------------------------------- winning and resigning
describe('winning', () => {
  it('wins by net worth after an action; highest worth wins when several qualify', () => {
    const s = edit(game(), (c) => { c.players[0].cash = DEFAULT_SETTINGS.goal; });
    const r = ok(roll(s, 2));
    expect(r.state).toMatchObject({ phase: 'over', winner: 'p0', winReason: 'net_worth' });
    expect(r.events.at(-1)).toMatchObject({ type: 'win', player: 'p0', reason: 'net_worth' });
    expect(r.events.at(-1).worth).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.goal);
    expect(r.state.pending).toBeNull();
    const both = edit(game(), (c) => { c.players[0].cash = 71000; c.players[1].cash = 90000; });
    expect(ok(roll(both, 2)).state.winner).toBe('p1');
  });

  it('counts property and buildings in net worth and ranks standings', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p0', 2); c.players[0].cash = 1000; c.players[1].cash = 20000; });
    const expected = 1000 + (1000 + 1000 + 1200) + 2 * (500 + 500 + 500);
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
    const s = edit(game(3), (c) => { giveAll(c, 'lightblue', 'p0', 1); c.owners[5] = 'p0'; });
    const r = doIt(s, { type: 'RESIGN' });
    expect(r.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(r.state.owners.includes('p0')).toBe(false);
    expect(r.state.levels.every((l) => l === 0)).toBe(true);
    expect(r.events.filter((e) => e.type === 'own' && e.reason === 'bankrupt').map((e) => e.tile).sort((a, b) => a - b)).toEqual([5, 6, 8, 9]);
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

  // p0 lands on Koti and declines it: a sealed auction opens for it
  const declined = () => {
    const landed = ok(roll(at(game(3, { auctionOnDecline: true }), 3), 3));
    return doIt(landed.state, { type: 'SKIP_BUY' });
  };

  it('resigning during an auction passes the bid and resolves it', () => {
    let r = declined();
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
    let r = declined();
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
    // p0: 12000 cash + Banjara (3000) = 15000; p1: 15000 cash; p2: 15000 cash. p1 wins on cash over p0, then seat over p2.
    const s = lastOfRound(30, (c) => { c.owners[32] = 'p0'; c.players[0].cash = 12000; });
    const r = doIt(s, { type: 'END_TURN' });
    expect(netWorth(r.state, 'p0')).toBe(15000);
    expect(r.state.winner).toBe('p1');
    const flat = doIt(lastOfRound(30), { type: 'END_TURN' });
    expect(flat.state.winner).toBe('p0'); // everything equal: earliest seat
  });

  it('extra rolls from sixes never add rounds', () => {
    let s = game(3);
    s = edit(s, (c) => { for (const t of [6, 12]) c.owners[t] = 'p1'; });
    let r = ok(roll(s, 6)); // 0 -> 6, a six
    expect(r.state.round).toBe(1);
    r = ok(roll(r.state, 6)); // 6 -> 12, another six
    expect(r.state.round).toBe(1);
    expect(r.state.turn).toBe(0);
    r = ok(roll(r.state, 3)); // 12 -> 15, ends the chain
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
      trade: { canOffer: false }, tradeOffer: null, tradeSent: null, sets: [], snatch: null,
    });
    expect(getOptions(s, 'p0')).toMatchObject({ roll: true, endTurn: false, buy: false });
    expect(getOptions(s, 'ghost').resign).toBe(false);
  });

  it('follows the phases', () => {
    let s = ok(roll(at(game(3), 3), 3)).state;
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
    settings: { snatches: 0 },
  });
  const rnd = () => 0.5;

  it('returns null when a human must act or the game is over', () => {
    const s = createGame({ players: [{ id: 'h' }, { id: 'b', isBot: true }], seed: 1 });
    expect(nextBotMove(s, rnd)).toBeNull();
    expect(chooseBotAction(s, 'h', rnd)).toMatchObject({ type: 'ROLL', playerId: 'h' }); // server auto-play helper
    expect(nextBotMove(edit(botGame(), (c) => { c.phase = 'over'; }), rnd)).toBeNull();
  });

  it('buys when it keeps the reserve (or completes a set) and skips otherwise', () => {
    const s = ok(roll(edit(botGame(), (c) => { c.cfg.debug = true; c.players[0].pos = 3; }), 3)).state; // Koti 1,000
    expect(nextBotMove(s, rnd)).toEqual({ type: 'BUY', playerId: 'p0' });
    const tight = edit(s, (c) => { c.players[0].cash = TILES[6].price + DEFAULT_BOT.reserve - 100; }); // 900 left < reserve 1,000
    expect(nextBotMove(tight, rnd)).toEqual({ type: 'SKIP_BUY', playerId: 'p0' });
    const completes = edit(tight, (c) => { c.owners[8] = 'p0'; c.owners[9] = 'p0'; });
    expect(nextBotMove(completes, rnd)).toEqual({ type: 'BUY', playerId: 'p0' });
  });

  it('upgrades while keeping its reserve, then rolls, then ends the turn', () => {
    const cost = upgradeCost(TILES[6]);
    let s = edit(botGame(), (c) => { giveAll(c, 'lightblue', 'p0'); c.players[0].cash = cost + DEFAULT_BOT.reserve + 100; });
    const a = nextBotMove(s, rnd);
    expect(a).toMatchObject({ type: 'UPGRADE', playerId: 'p0' });
    s = edit(s, (c) => { c.players[0].cash = cost + DEFAULT_BOT.reserve - 100; }); // would dip below the reserve
    expect(nextBotMove(s, rnd)).toEqual({ type: 'ROLL', playerId: 'p0' });
    s = edit(s, (c) => { c.phase = 'manage'; });
    expect(nextBotMove(s, rnd)).toEqual({ type: 'END_TURN', playerId: 'p0' });
  });

  it('pays bail only when it is comfortably rich', () => {
    const jailed = edit(botGame(), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; });
    expect(nextBotMove(jailed, rnd)).toEqual({ type: 'PAY_BAIL', playerId: 'p0' });
    const poor = edit(jailed, (c) => { c.players[0].cash = 1500; });
    expect(nextBotMove(poor, rnd)).toEqual({ type: 'ROLL', playerId: 'p0' });
  });

  it('bids during auctions: every bot answers, passes below the minimum, and bids stay legal', () => {
    // p0 lands on Koti with too little left over, so its bot declines and a sealed auction opens
    let s = edit(botGame(3), (c) => { c.cfg.debug = true; c.cfg.auctionOnDecline = true; c.players[0].pos = 3; c.players[0].cash = TILES[6].price + 900; });
    s = ok(roll(s, 3)).state;
    s = ok(applyAction(s, nextBotMove(s, rnd))).state; // SKIP_BUY
    expect(s.phase).toBe('auction');
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

  it('chooseBotAction (the server auto-play) never snatches; nextBotMove waits during the window', () => {
    const s = edit(createGame({ players: mkPlayers(3), seed: 3 }), (c) => {
      c.phase = 'snatch';
      c.pending = { type: 'snatch', tile: 6, buyer: 'p0', price: 1000, eligible: ['p1', 'p2'], claims: [], ms: 3000, returnPhase: 'manage' };
      c.owners[6] = 'p0';
      for (const p of c.players) p.isBot = true;
    });
    for (const id of ids.slice(0, 3)) expect(chooseBotAction(s, id, () => 0.5)).toBeNull();
    expect(nextBotMove(s, () => 0.5)).toBeNull();
  });

  it('plays complete games to the end without a single rejected action', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const n of [2, 3, 4]) {
        let s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: ids[i], isBot: true })), seed, settings: { goal: 40000 } });
        const r = mulberry32(seed * 100 + n);
        let steps = 0;
        while (s.phase !== 'over') {
          const res = applyAction(s, botStep(s, r));
          expect(res.error).toBeUndefined();
          s = res.state;
          expect(s.players.every((p) => Number.isInteger(p.cash) && p.cash >= 0 && p.snatches >= 0)).toBe(true);
          if (++steps > 20000) throw new Error('did not finish');
        }
        expect(s.winner).toBeTruthy();
        expect(['net_worth', 'last_standing', 'rounds']).toContain(s.winReason);
      }
    }
  });
});
