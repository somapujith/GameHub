// Tokens and city events (docs/GAME_RULES.md sections 10 and 11): Shield, earning Snatch tokens, and the
// city event drawn every EVENT_EVERY-th round.
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, previewRent, TILES, GROUPS, START_CASH,
  TOKEN_CAP, LAPS_PER_TOKEN, CITY_EVENTS, EVENT_EVERY, PARKING_TILE,
} from './index.js';

// ---------------------------------------------------------------- helpers
const ids = ['p0', 'p1', 'p2', 'p3'];
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `P${i}`, avatar: i }));
const edit = (s, fn) => {
  const c = structuredClone(s);
  fn(c);
  return c;
};
const game = (n = 3, settings = {}, seed = 7) => createGame({
  players: mkPlayers(n), seed, settings: { debug: true, auctionOnDecline: false, ...settings },
});
const ok = (res) => {
  expect(res.error).toBeUndefined();
  return res;
};
const act = (s, playerId, action) => ok(applyAction(s, { playerId, ...action }));
const ofType = (events, type) => events.filter((e) => e.type === type);

const KOTI = 6; // lightblue, price 1,000, base rent 60
const SECUNDERABAD = 5; // station
const GHMC = 4;
const ORR = 38;

/** p0 stands on `from` and rolls `die`. */
const rollFrom = (s, from, die, mutate = () => {}) => act(edit(s, (c) => { c.players[0].pos = from; mutate(c); }), 'p0', { type: 'ROLL', dice: [die] });
const onKoti = (n = 3, settings = {}, mutate = () => {}) => rollFrom(game(n, settings), 3, 3, mutate).state;

// ---------------------------------------------------------------- constants
describe('constants', () => {
  it('has the documented values', () => {
    expect(TOKEN_CAP).toBe(3);
    expect(LAPS_PER_TOKEN).toBe(3);
    expect(EVENT_EVERY).toBe(5);
    expect(PARKING_TILE).toBe(20);
    expect(CITY_EVENTS.map((e) => e.id)).toEqual(['monsoon', 'ipl', 'metro_strike', 'tax_holiday', 'bonalu']);
  });
  it('new games start with 0 laps and no event', () => {
    const s = game();
    expect(s.event).toBeNull();
    expect(s.players.every((p) => p.laps === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------- Shield
describe('Shield (10.1)', () => {
  it('buys, spends exactly one token, opens no window, and the buyer pays', () => {
    const before = onKoti();
    expect(getOptions(before, 'p0').shield).toBe(true);
    const r = act(before, 'p0', { type: 'BUY', shield: true });
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
    expect(r.state.owners[KOTI]).toBe('p0');
    expect(r.state.players[0].cash).toBe(START_CASH - TILES[KOTI].price);
    expect(r.state.players.map((p) => p.snatches)).toEqual([0, 1, 1]);
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -1000, reason: 'buy' },
      { type: 'own', tile: KOTI, owner: 'p0', reason: 'buy' },
      { type: 'shield', player: 'p0', tile: KOTI },
      { type: 'snatch_token', player: 'p0', snatches: 0 },
    ]);
  });

  it('fires the set celebration at once', () => {
    const before = onKoti(3, {}, (c) => { c.owners[8] = 'p0'; c.owners[9] = 'p0'; });
    const r = act(before, 'p0', { type: 'BUY', shield: true });
    expect(r.events.map((e) => e.type)).toEqual(['cash', 'own', 'shield', 'snatch_token', 'set_complete']);
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p0', group: 'lightblue' }]);
  });

  it('a plain BUY (or shield:false) still opens the window', () => {
    const before = onKoti();
    expect(act(before, 'p0', { type: 'BUY' }).state.phase).toBe('snatch');
    expect(act(before, 'p0', { type: 'BUY', shield: false }).state.phase).toBe('snatch');
  });

  it('is rejected without a token of your own', () => {
    const before = onKoti(3, {}, (c) => { c.players[0].snatches = 0; });
    expect(getOptions(before, 'p0').shield).toBeFalsy();
    expect(applyAction(before, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('You have no Snatch token to shield with');
  });

  it('is rejected when nobody else holds a token (a plain buy just completes)', () => {
    const before = onKoti(3, {}, (c) => { c.players[1].snatches = 0; c.players[2].snatches = 0; });
    expect(getOptions(before, 'p0').shield).toBeFalsy();
    expect(applyAction(before, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('Nobody could snatch it, no need to shield');
    expect(act(before, 'p0', { type: 'BUY' }).state.phase).toBe('manage');
  });

  it('a bankrupt player holding a token does not count as a snatcher', () => {
    const before = onKoti(3, {}, (c) => { c.players[1].snatches = 0; c.players[2].snatches = 1; c.players[2].bankrupt = true; });
    expect(applyAction(before, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('Nobody could snatch it, no need to shield');
  });

  it('reports the no-token error first when both conditions fail', () => {
    const before = onKoti(3, {}, (c) => { for (const p of c.players) p.snatches = 0; });
    expect(applyAction(before, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('You have no Snatch token to shield with');
  });

  it('is off when snatches is 0', () => {
    const before = onKoti(3, { snatches: 0 });
    expect(getOptions(before, 'p0').shield).toBeFalsy();
    expect(applyAction(before, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('You have no Snatch token to shield with');
  });

  it('options.shield belongs to the buyer in the buy phase only', () => {
    const before = onKoti();
    expect(getOptions(before, 'p1').shield).toBeFalsy();
    expect(getOptions(game(), 'p0').shield).toBeFalsy();
  });

  it('cannot shield a purchase you cannot afford', () => {
    const poor = edit(onKoti(), (c) => { c.players[0].cash = 10; });
    expect(applyAction(poor, { type: 'BUY', shield: true, playerId: 'p0' }).error).toBe('Not enough cash');
    expect(getOptions(poor, 'p0').shield).toBeFalsy();
  });
});

// ---------------------------------------------------------------- earning tokens
describe('earning tokens (10.2)', () => {
  const lapGame = (laps, extra = {}, mutate = () => {}) => rollFrom(game(3, extra), 36, 5, (c) => { c.players[0].laps = laps; mutate(c); }); // 36 + 5 passes START

  it('counts laps and pays +1 on every 3rd pass only', () => {
    const r1 = lapGame(0);
    expect(r1.state.players[0].laps).toBe(1);
    expect(r1.state.players[0].snatches).toBe(1);
    expect(ofType(r1.events, 'token_earned')).toHaveLength(0);
    expect(lapGame(1).state.players[0].snatches).toBe(1);
    const r3 = lapGame(2);
    expect(r3.state.players[0].laps).toBe(3);
    expect(r3.state.players[0].snatches).toBe(2);
    expect(ofType(r3.events, 'token_earned')).toEqual([{ type: 'token_earned', player: 'p0', reason: 'lap', snatches: 2 }]);
    expect(ofType(lapGame(5).events, 'token_earned')).toHaveLength(1); // the 6th pass too
  });

  it('landing exactly on START counts as a pass', () => {
    const r = rollFrom(game(), 36, 4, (c) => { c.players[0].laps = 2; });
    expect(r.state.players[0].pos).toBe(0);
    expect(ofType(r.events, 'token_earned')).toHaveLength(1);
  });

  it('a card that moves you past START counts too', () => {
    // 34 + 2 = 36 (Nawab ka Farman), card 12 = Catch the Flight (moves to START and collects)
    const r = rollFrom(game(), 34, 2, (c) => { c.players[0].laps = 2; c.deck = [12, ...c.deck.filter((x) => x !== 12)]; c.deckPos = 0; });
    expect(ofType(r.events, 'card')).toHaveLength(1);
    expect(r.state.players[0].laps).toBe(3);
    expect(ofType(r.events, 'token_earned')).toEqual([{ type: 'token_earned', player: 'p0', reason: 'lap', snatches: 2 }]);
  });

  it('a move that does not reach START leaves the lap count alone', () => {
    const r = rollFrom(game(), 3, 3, (c) => { c.players[0].laps = 2; });
    expect(r.state.players[0].laps).toBe(2);
  });

  it('chai break (tile 20) earns +1', () => {
    const r = rollFrom(game(), 17, 3);
    expect(r.state.players[0].pos).toBe(PARKING_TILE);
    expect(ofType(r.events, 'token_earned')).toEqual([{ type: 'token_earned', player: 'p0', reason: 'chai', snatches: 2 }]);
    expect(r.state.players[0].snatches).toBe(2);
  });

  it('never goes above TOKEN_CAP and stays silent at the cap', () => {
    const chai = rollFrom(game(), 17, 3, (c) => { c.players[0].snatches = TOKEN_CAP; });
    expect(chai.state.players[0].snatches).toBe(TOKEN_CAP);
    expect(ofType(chai.events, 'token_earned')).toHaveLength(0);
    const lap = lapGame(2, {}, (c) => { c.players[0].snatches = TOKEN_CAP; });
    expect(lap.state.players[0].snatches).toBe(TOKEN_CAP);
    expect(ofType(lap.events, 'token_earned')).toHaveLength(0);
    const near = rollFrom(game(), 17, 3, (c) => { c.players[0].snatches = TOKEN_CAP - 1; });
    expect(near.state.players[0].snatches).toBe(TOKEN_CAP);
  });

  it('snatches: 0 turns earning off', () => {
    const lap = lapGame(2, { snatches: 0 });
    expect(lap.state.players[0].snatches).toBe(0);
    expect(ofType(lap.events, 'token_earned')).toHaveLength(0);
    const chai = rollFrom(game(3, { snatches: 0 }), 17, 3);
    expect(chai.state.players[0].snatches).toBe(0);
    expect(ofType(chai.events, 'token_earned')).toHaveLength(0);
  });

  it('a saved game from before laps existed does not crash', () => {
    const r = rollFrom(game(), 36, 5, (c) => { for (const p of c.players) delete p.laps; delete c.event; });
    expect(r.state.players[0].laps).toBe(1);
  });
});

// ---------------------------------------------------------------- city events
/** The state after the last seat ends its turn in round `round - 1`: a new round begins. Searches seeds for event `id`. */
const newRound = (id, { n = 3, round = 5, mutate = () => {}, seeds = 400 } = {}) => {
  for (let seed = 1; seed <= seeds; seed++) {
    const before = edit(game(n, {}, seed), (c) => { c.round = round - 1; c.turn = n - 1; c.phase = 'manage'; mutate(c); });
    const r = applyAction(before, { type: 'END_TURN', playerId: ids[n - 1] });
    if (!id || (r.state.event && r.state.event.id === id)) return { ...r, before, seed };
  }
  throw new Error(`no seed produced ${id}`);
};
/** Everybody ends their turn once: the round counter rises by one. */
const endRound = (s) => {
  let cur = s;
  const events = [];
  for (let i = 0; i < s.players.length; i++) {
    const r = act(edit(cur, (c) => { c.phase = 'manage'; c.extraRoll = false; c.pending = null; }), cur.players[cur.turn].id, { type: 'END_TURN' });
    events.push(...r.events);
    cur = r.state;
    if (cur.turn === 0) break;
  }
  return { state: cur, events };
};

describe('city events: timing (11)', () => {
  it('only rounds 5, 10, 15 ... draw an event; it is cleared when the next round begins', () => {
    let s = game(3, {}, 21);
    const seen = [];
    let guard = 0;
    while (s.round < 12 && guard++ < 100) {
      const before = s.round;
      const r = endRound(s);
      s = r.state;
      const ce = ofType(r.events, 'city_event');
      if (s.round !== before && s.round % EVENT_EVERY === 0) {
        expect(ce).toHaveLength(1);
        expect(s.event).toMatchObject({ round: s.round });
        seen.push(s.round);
      } else {
        expect(ce).toHaveLength(0);
        expect(s.event).toBeNull();
      }
    }
    expect(seen).toEqual([5, 10]);
  });

  it('the city_event is emitted before the first turn event of that round and mirrors state.event', () => {
    const r = newRound(null);
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('city_event')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('city_event')).toBeLessThan(types.indexOf('turn'));
    const { type, ...rest } = ofType(r.events, 'city_event')[0];
    expect(type).toBe('city_event');
    expect(rest).toEqual(r.state.event);
    expect(r.state.event.round).toBe(5);
    expect(r.state.round).toBe(5);
  });

  it('ending a turn inside the round neither draws nor clears anything', () => {
    const r = newRound(null);
    const mid = act(edit(r.state, (c) => { c.phase = 'manage'; }), 'p0', { type: 'END_TURN' });
    expect(mid.state.round).toBe(5);
    expect(mid.state.event).toEqual(r.state.event);
    expect(ofType(mid.events, 'city_event')).toHaveLength(0);
  });

  it('is deterministic: same seed + same actions = same event', () => {
    const a = newRound(null, { seeds: 1 });
    const b = newRound(null, { seeds: 1 });
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('draws every kind of event over enough seeds, with the documented fields', () => {
    const got = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const before = edit(game(3, {}, seed), (c) => { c.round = 4; c.turn = 2; c.phase = 'manage'; });
      const e = applyAction(before, { type: 'END_TURN', playerId: 'p2' }).state.event;
      got.add(e.id);
      const def = CITY_EVENTS.find((d) => d.id === e.id);
      expect(e).toMatchObject({ id: def.id, title: def.title, text: def.text, kind: def.kind, round: 5 });
      if (def.group) expect(Object.keys(GROUPS)).toContain(e.group);
      else expect(e.group).toBeUndefined();
    }
    expect([...got].sort()).toEqual(CITY_EVENTS.map((d) => d.id).sort());
  });
});

describe('city events: monsoon and IPL (group rent)', () => {
  it('monsoon halves rent of one group, chosen among groups somebody owns', () => {
    const r = newRound('monsoon', { mutate: (c) => { c.owners[KOTI] = 'p1'; } });
    expect(r.state.event).toMatchObject({ id: 'monsoon', group: 'lightblue', mult: 0.5 });
    expect(previewRent(r.state, KOTI)).toBe(30);
    expect(previewRent(r.before, KOTI)).toBe(60);
    const landed = rollFrom(r.state, 3, 3); // p0 lands on Koti and pays the reduced rent
    expect(landed.state.players[0].cash).toBe(START_CASH - 30);
    expect(landed.state.players[1].cash).toBe(START_CASH + 30);
  });

  it('IPL doubles rent of one group, built tiles and full sets included', () => {
    const r = newRound('ipl', { mutate: (c) => { c.owners[KOTI] = 'p1'; } });
    expect(r.state.event).toMatchObject({ id: 'ipl', group: 'lightblue', mult: 2 });
    expect(previewRent(r.state, KOTI)).toBe(120);
    const built = newRound('ipl', { mutate: (c) => { for (const t of [6, 8, 9]) c.owners[t] = 'p1'; c.levels[6] = 2; c.levels[8] = 2; c.levels[9] = 2; } });
    expect(built.state.event.group).toBe('lightblue');
    expect(previewRent(built.state, 6)).toBe(2 * TILES[6].rent[2]);
  });

  it('other groups and stations are unaffected', () => {
    const r = newRound('monsoon', { mutate: (c) => { c.owners[KOTI] = 'p1'; c.owners[1] = 'p1'; c.owners[SECUNDERABAD] = 'p1'; } });
    const other = r.state.event.group === 'lightblue' ? 1 : KOTI; // the pool is lightblue + brown
    expect(previewRent(r.state, other)).toBe(TILES[other].rent[0]);
    expect(previewRent(r.state, SECUNDERABAD)).toBe(250);
  });

  it('the group is only ever one somebody owns (many seeds)', () => {
    const groups = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const before = edit(game(3, {}, seed), (c) => { c.round = 4; c.turn = 2; c.phase = 'manage'; c.owners[KOTI] = 'p1'; c.owners[21] = 'p0'; });
      const e = applyAction(before, { type: 'END_TURN', playerId: 'p2' }).state.event;
      if (e.group) groups.add(e.group);
    }
    expect([...groups].sort()).toEqual(['lightblue', 'red']);
  });

  it('falls back to any group when nothing is owned', () => {
    const groups = new Set();
    for (let seed = 1; seed <= 300; seed++) {
      const before = edit(game(3, {}, seed), (c) => { c.round = 4; c.turn = 2; c.phase = 'manage'; });
      const e = applyAction(before, { type: 'END_TURN', playerId: 'p2' }).state.event;
      if (e.group) groups.add(e.group);
    }
    expect(groups.size).toBeGreaterThan(3);
    for (const g of groups) expect(GROUPS[g]).toBeDefined();
  });

  it('a mortgaged tile still pays 0', () => {
    const r = newRound('ipl', { mutate: (c) => { c.owners[KOTI] = 'p1'; c.mortgaged[KOTI] = true; } });
    expect(previewRent(r.state, KOTI)).toBe(0);
  });

  it('the effect ends when the next round begins', () => {
    const r = newRound('ipl', { mutate: (c) => { c.owners[KOTI] = 'p1'; } });
    expect(previewRent(r.state, KOTI)).toBe(120);
    const next = endRound(r.state);
    expect(next.state.round).toBe(6);
    expect(next.state.event).toBeNull();
    expect(previewRent(next.state, KOTI)).toBe(60);
  });
});

describe('city events: metro strike, tax holiday, Bonalu', () => {
  it('metro strike: stations pay no rent, other tiles unchanged, normal again next round', () => {
    const r = newRound('metro_strike', { mutate: (c) => { c.owners[SECUNDERABAD] = 'p1'; c.owners[KOTI] = 'p1'; } });
    expect(previewRent(r.state, SECUNDERABAD)).toBe(0);
    expect(previewRent(r.state, KOTI)).toBe(60);
    const landed = rollFrom(r.state, 3, 2); // station 5
    expect(landed.state.players[0].cash).toBe(START_CASH);
    expect(ofType(landed.events, 'cash')).toHaveLength(0);
    expect(previewRent(endRound(r.state).state, SECUNDERABAD)).toBe(250);
  });

  it('tax holiday: GHMC and ORR cost nothing, then cost again', () => {
    const r = newRound('tax_holiday');
    const ghmc = rollFrom(r.state, 1, 3);
    expect(ghmc.state.players[0].pos).toBe(GHMC);
    expect(ghmc.state.players[0].cash).toBe(START_CASH);
    expect(ghmc.state.players[0].stats.taxPaid).toBe(0);
    const orr = rollFrom(r.state, 35, 3);
    expect(orr.state.players[0].pos).toBe(ORR);
    expect(orr.state.players[0].cash).toBe(START_CASH);
    const back = rollFrom(endRound(r.state).state, 35, 3);
    expect(back.state.players[0].cash).toBe(START_CASH - 1000);
  });

  it('bonalu: every active player gets 500 once (reason event); bankrupt players get nothing', () => {
    const r = newRound('bonalu', { n: 4, mutate: (c) => { c.players[1].bankrupt = true; } });
    expect(r.state.event).toMatchObject({ id: 'bonalu', amount: 500 });
    const gifts = ofType(r.events, 'cash');
    expect(gifts.map((g) => g.player).sort()).toEqual(['p0', 'p2', 'p3']);
    for (const g of gifts) expect(g).toMatchObject({ delta: 500, reason: 'event' });
    expect(r.state.players.map((p) => p.cash)).toEqual([START_CASH + 500, START_CASH, START_CASH + 500, START_CASH + 500]);
    const mid = act(edit(r.state, (c) => { c.phase = 'manage'; }), 'p0', { type: 'END_TURN' });
    expect(ofType(mid.events, 'cash')).toHaveLength(0); // once per round
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('city_event')).toBeLessThan(types.indexOf('cash'));
    expect(types.indexOf('cash')).toBeLessThan(types.indexOf('turn'));
  });
});

describe('older saved games', () => {
  it('a state without event/laps still plays and previews rent', () => {
    const s = edit(game(), (c) => { delete c.event; for (const p of c.players) delete p.laps; c.owners[KOTI] = 'p1'; });
    expect(previewRent(s, KOTI)).toBe(60);
    const r = rollFrom(s, 3, 3); // lands on p1's Koti and pays
    expect(r.state.players[0].cash).toBe(START_CASH - 60);
    const t = endRound(edit(s, (c) => { c.round = 4; c.turn = 2; c.phase = 'manage'; }));
    expect(t.state.round).toBe(5);
  });
});
