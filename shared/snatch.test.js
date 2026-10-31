// Snatch (docs/GAME_RULES.md section 9): after a landing BUY every other player holding a Snatch token gets a short window
// to press Snatch. One presser takes the tile for free (the buyer is NOT refunded); several pressers go to a sealed
// bidding among themselves; nobody pressing leaves the tile with the buyer. This file is the engine side of matrix 9.12.
// (sanitizeAction / redact / deadlines live in the worker adapter and are covered by the worker tests.)
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, nextBotMove, chooseBotAction, botSnatchAction, SNATCH_MIN_PRICE,
  normalizeSettings, DEFAULT_SETTINGS, TILES, START_CASH, mulberry32,
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
  players: mkPlayers(n), seed, settings: { debug: true, auctionOnDecline: false, snatches: 1, ...settings },
});
const ok = (res) => {
  expect(res.error).toBeUndefined();
  return res;
};
const act = (s, playerId, action) => ok(applyAction(s, { playerId, ...action }));
const close = (s) => ok(applyAction(s, { type: 'SNATCH_CLOSE' }));
const ofType = (events, type) => events.filter((e) => e.type === type);

const KOTI = 6; // price 1,000
const MIN_BID = 100; // a tenth of Koti's price

/** p0 stands on 3 and rolls 3 onto Koti: phase 'buy'. */
const onKoti = (n = 3, settings = {}, mutate = () => {}) => {
  const s = edit(game(n, settings), (c) => { c.players[0].pos = 3; mutate(c); });
  return ok(applyAction(s, { type: 'ROLL', playerId: 'p0', dice: [3] })).state;
};
/** The BUY result: the snatch window is open (or not, when nobody can snatch). */
const bought = (n = 3, settings = {}, mutate = () => {}) => act(onKoti(n, settings, mutate), 'p0', { type: 'BUY' });
/** An open window; `pressers` have pressed. */
const windowWith = (pressers = [], n = 3, settings = {}, mutate = () => {}) => {
  let s = bought(n, settings, mutate).state;
  expect(s.phase).toBe('snatch');
  for (const id of pressers) s = act(s, id, { type: 'SNATCH' }).state;
  return s;
};
const bid = (s, pid, amount) => act(s, pid, { type: 'BID', amount });
const totalCash = (s) => s.players.reduce((a, p) => a + p.cash, 0);

// ---------------------------------------------------------------- opening the window
describe('snatch: when a window opens', () => {
  it('opens after a landing BUY when another player holds a token: state, pending shape and event', () => {
    const r = bought();
    expect(r.state.phase).toBe('snatch');
    expect(r.state.owners[KOTI]).toBe('p0'); // the buyer already owns it during the window
    expect(r.state.players[0].cash).toBe(START_CASH - TILES[KOTI].price);
    expect(r.state.pending).toEqual({
      type: 'snatch', tile: KOTI, buyer: 'p0', price: 1000, eligible: ['p1', 'p2'], claims: [], ms: 3000, returnPhase: 'manage',
    });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -1000, reason: 'buy' },
      { type: 'own', tile: KOTI, owner: 'p0', reason: 'buy' },
      { type: 'snatch_open', tile: KOTI, buyer: 'p0', price: 1000, eligible: ['p1', 'p2'], ms: 3000 },
    ]);
    expect(r.state.turn).toBe(0); // the buyer stays the turn player
  });

  it('uses cfg.snatchMs for the window length', () => {
    const r = bought(3, { snatchMs: 5000 });
    expect(r.state.pending.ms).toBe(5000);
    expect(ofType(r.events, 'snatch_open')[0].ms).toBe(5000);
  });

  it('no eligible player -> no window: snatches 0 switches the feature off', () => {
    expect(DEFAULT_SETTINGS.snatches).toBe(1);
    const r = bought(3, { snatches: 0 });
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
    expect(ofType(r.events, 'snatch_open')).toHaveLength(0);
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -1000, reason: 'buy' },
      { type: 'own', tile: KOTI, owner: 'p0', reason: 'buy' },
    ]);
    expect(r.state.players.map((p) => p.snatches)).toEqual([0, 0, 0]);
  });

  it('no eligible player -> no window: everybody else is out of tokens', () => {
    const r = bought(3, {}, (c) => { c.players[1].snatches = 0; c.players[2].snatches = 0; });
    expect(r.state.phase).toBe('manage');
    expect(ofType(r.events, 'snatch_open')).toHaveLength(0);
  });

  it('the buyer\'s own tokens do not count: a buyer with tokens and nobody else with tokens opens nothing', () => {
    const r = bought(3, {}, (c) => { c.players[0].snatches = 3; c.players[1].snatches = 0; c.players[2].snatches = 0; });
    expect(r.state.phase).toBe('manage');
  });

  it('only players with a token are eligible', () => {
    const r = bought(4, {}, (c) => { c.players[2].snatches = 0; });
    expect(r.state.pending.eligible).toEqual(['p1', 'p3']);
    expect(ofType(r.events, 'snatch_open')[0].eligible).toEqual(['p1', 'p3']);
  });

  it('bankrupt players are never eligible', () => {
    const r = bought(4, {}, (c) => { c.players[1].bankrupt = true; c.players[1].cash = 0; });
    expect(r.state.pending.eligible).toEqual(['p2', 'p3']);
    // and a bankrupt player cannot press
    expect(applyAction(r.state, { type: 'SNATCH', playerId: 'p1' }).error).toBe('You are out of the game');
    // only bankrupt players with tokens left besides the buyer -> no window at all
    const none = bought(3, {}, (c) => { c.players[1].bankrupt = true; c.players[1].cash = 0; c.players[2].snatches = 0; });
    expect(none.state.phase).toBe('manage');
  });

  it('works for stations and utilities as well as properties', () => {
    for (const [tile, from, d] of [[5, 0, 5], [12, 8, 4]]) {
      const s = edit(game(3), (c) => { c.players[0].pos = from; });
      const landed = ok(applyAction(s, { type: 'ROLL', playerId: 'p0', dice: [d] })).state;
      expect(landed.pending).toMatchObject({ type: 'buy', tile });
      const b = act(landed, 'p0', { type: 'BUY' });
      expect(b.state.phase).toBe('snatch');
      expect(b.state.pending).toMatchObject({ tile, price: TILES[tile].price });
    }
  });

  it('does NOT open for auction wins, trades, or a declined tile', () => {
    // auction win after SKIP_BUY
    const landed = onKoti(3, { auctionOnDecline: true });
    let a = act(landed, 'p0', { type: 'SKIP_BUY' }).state;
    expect(a.phase).toBe('auction');
    a = bid(a, 'p0', 0).state;
    a = bid(a, 'p1', MIN_BID + 50).state;
    const done = bid(a, 'p2', 0);
    expect(done.state.phase).toBe('manage');
    expect(done.state.owners[KOTI]).toBe('p1');
    expect(ofType(done.events, 'snatch_open')).toHaveLength(0);
    // skip without auction
    const skipped = act(onKoti(), 'p0', { type: 'SKIP_BUY' });
    expect(skipped.state.phase).toBe('manage');
    expect(ofType(skipped.events, 'snatch_open')).toHaveLength(0);
    // trade
    const t = edit(game(3), (c) => { c.owners[8] = 'p1'; });
    const offered = act(t, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 900, tiles: [] }, get: { cash: 0, tiles: [8] } });
    const traded = act(offered.state, 'p1', { type: 'TRADE_ACCEPT' });
    expect(traded.state.phase).toBe('roll');
    expect(ofType(traded.events, 'snatch_open')).toHaveLength(0);
    // building / mortgaging
    const m = edit(game(3), (c) => { c.owners[8] = 'p0'; });
    expect(act(m, 'p0', { type: 'MORTGAGE', tile: 8 }).state.phase).toBe('roll');
  });

  it('a card that moves you onto a free tile leaves a normal buy phase, and BUY then opens the window', () => {
    // jump straight to the buy phase a card (e.g. "advance to Charminar") would leave behind
    const buying = edit(game(3), (c) => { c.players[0].pos = 21; c.phase = 'buy'; c.pending = { type: 'buy', tile: 21, price: TILES[21].price }; });
    const b = act(buying, 'p0', { type: 'BUY' });
    expect(b.state.phase).toBe('snatch');
  });
});

// ---------------------------------------------------------------- options (the UI contract)
describe('snatch: getOptions', () => {
  it('eligible players see options.snatch; everybody else sees nothing to do', () => {
    const s = windowWith([], 4, {}, (c) => { c.players[3].snatches = 0; });
    expect(getOptions(s, 'p1').snatch).toEqual({ tile: KOTI, ms: 3000 });
    expect(getOptions(s, 'p2').snatch).toEqual({ tile: KOTI, ms: 3000 });
    expect(getOptions(s, 'p1').snatched).toBeUndefined();
    for (const id of ['p0', 'p3']) {
      const o = getOptions(s, id);
      expect(o.snatch).toBeNull();
      expect(o.snatched).toBeUndefined();
    }
    for (const id of ids) {
      const o = getOptions(s, id);
      expect(o).toMatchObject({ roll: false, buy: false, skipBuy: false, endTurn: false, bid: null, payDebt: false, upgrade: [], mortgage: [] });
      expect(o.resign).toBe(true); // RESIGN is always allowed
    }
  });

  it('after pressing the player gets options.snatched instead (locked in); the others still see the button', () => {
    const s = windowWith(['p1']);
    expect(getOptions(s, 'p1').snatch).toBeNull();
    expect(getOptions(s, 'p1').snatched).toBe(true);
    expect(getOptions(s, 'p2').snatch).toEqual({ tile: KOTI, ms: 3000 });
    expect(getOptions(s, 'p2').snatched).toBeUndefined(); // another player's press is not visible through options
  });

  it('the roll / end-turn options of the buyer are closed until the window resolves', () => {
    const s = windowWith();
    expect(getOptions(s, 'p0')).toMatchObject({ roll: false, endTurn: false });
    const after = close(s).state;
    expect(getOptions(after, 'p0')).toMatchObject({ roll: false, endTurn: true });
    expect(getOptions(after, 'p1').snatch).toBeNull();
  });

  it('snatch tokens are public on the player objects', () => {
    const s = createGame({ players: mkPlayers(3), seed: 1 });
    expect(s.players.map((p) => p.snatches)).toEqual([1, 1, 1]);
    const w = windowWith(['p1']);
    expect(w.players.map((p) => p.snatches)).toEqual([1, 1, 1]); // pressing costs nothing until the window resolves
  });
});

// ---------------------------------------------------------------- one claimant
describe('snatch: a single presser takes the tile for free', () => {
  it('SNATCH is sealed (no event); with everyone eligible pressed the window resolves at once', () => {
    let s = windowWith([], 3, {}, (c) => { c.players[2].snatches = 0; }); // only p1 is eligible
    const r = act(s, 'p1', { type: 'SNATCH' });
    // early close: all eligible players have pressed
    expect(r.state.phase).toBe('manage');
    expect(r.events.map((e) => e.type)).toEqual(['snatch_end', 'own', 'snatch_token']);
    s = windowWith(); // two eligible: pressing alone changes nothing visible
    const press = act(s, 'p1', { type: 'SNATCH' });
    expect(press.events).toEqual([]);
    expect(press.state.phase).toBe('snatch');
    expect(press.state.pending.claims).toEqual(['p1']);
  });

  it('SNATCH_CLOSE transfers the tile, spends 1 token, and does NOT refund the buyer', () => {
    const s = windowWith(['p1']);
    const before = s.players.map((p) => p.cash);
    const r = close(s);
    expect(r.events).toEqual([
      { type: 'snatch_end', tile: KOTI, buyer: 'p0', outcome: 'snatched', winner: 'p1', claimants: ['p1'] },
      { type: 'own', tile: KOTI, owner: 'p1', reason: 'snatch' },
      { type: 'snatch_token', player: 'p1', snatches: 0 },
    ]);
    expect(r.state.owners[KOTI]).toBe('p1');
    expect(r.state.players.map((p) => p.cash)).toEqual(before); // nobody's cash moved: free for the taker, not refunded to the buyer
    expect(r.state.players[0].cash).toBe(START_CASH - 1000);
    expect(r.state.players[1].cash).toBe(START_CASH);
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 0, 1]);
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
    expect(r.state.turn).toBe(0);
    expect(r.state.players[1].stats.propertiesBought).toBe(1);
    expect(totalCash(r.state)).toBe(totalCash(s));
  });

  it('a spent token cannot be used again: the next purchase opens no window for that player', () => {
    let s = close(windowWith(['p1'])).state; // p1 spent its token; p2 still has one
    s = act(s, 'p0', { type: 'END_TURN' }).state;
    // p1's turn ... p0 buys next round: only p2 can snatch
    const again = edit(s, (c) => { c.phase = 'buy'; c.turn = 0; c.pending = { type: 'buy', tile: 8, price: 1000 }; c.players[0].pos = 8; });
    const r = act(again, 'p0', { type: 'BUY' });
    expect(r.state.pending.eligible).toEqual(['p2']);
  });

  it('the taker completing a colour gets set_complete at the close, the buyer does not', () => {
    const r = close(windowWith(['p1'], 3, {}, (c) => { c.owners[8] = 'p1'; c.owners[9] = 'p1'; }));
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p1', group: 'lightblue' }]);
    expect(r.events.at(-1)).toEqual({ type: 'set_complete', player: 'p1', group: 'lightblue' });
  });
});

// ---------------------------------------------------------------- nobody pressed
describe('snatch: nobody presses', () => {
  it('the buyer keeps the tile; no token is spent; the set celebration is delayed until the close', () => {
    const buy = bought(3, {}, (c) => { c.owners[8] = 'p0'; c.owners[9] = 'p0'; });
    expect(ofType(buy.events, 'set_complete')).toHaveLength(0); // waits for the window
    const r = close(buy.state);
    expect(r.events).toEqual([
      { type: 'snatch_end', tile: KOTI, buyer: 'p0', outcome: 'none' },
      { type: 'set_complete', player: 'p0', group: 'lightblue' },
    ]);
    expect(r.state.owners[KOTI]).toBe('p0');
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 1]);
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
  });

  it('SNATCH_CLOSE needs no playerId; a stale or stray close is refused', () => {
    const w = windowWith();
    expect(close(w).state.phase).toBe('manage');
    expect(applyAction(w, { type: 'SNATCH_CLOSE', playerId: 'p0' }).error).toBeUndefined(); // an id is ignored, not required
    // not in a window
    for (const s of [onKoti(), game(), close(w).state, close(windowWith(['p1'])).state]) {
      const res = applyAction(s, { type: 'SNATCH_CLOSE' });
      expect(res.error).toBe('There is nothing to snatch');
      expect(res.state).toBe(s);
      expect(res.events).toEqual([]);
    }
    // in the sealed bidding that follows a double press
    const bidding = windowWith(['p1', 'p2']);
    expect(bidding.phase).toBe('auction');
    expect(applyAction(bidding, { type: 'SNATCH_CLOSE' }).error).toBeTruthy();
    // and after the game is over
    expect(applyAction(edit(w, (c) => { c.phase = 'over'; }), { type: 'SNATCH_CLOSE' }).error).toBeTruthy();
  });
});

// ---------------------------------------------------------------- errors
describe('snatch: who may press, and when', () => {
  it('pressing twice errors', () => {
    const s = windowWith(['p1']);
    const res = applyAction(s, { type: 'SNATCH', playerId: 'p1' });
    expect(res.error).toBe('You already pressed Snatch');
    expect(res.state).toBe(s);
  });

  it('the buyer cannot snatch their own purchase', () => {
    const s = windowWith();
    expect(applyAction(s, { type: 'SNATCH', playerId: 'p0' }).error).toBe('You cannot snatch this one');
  });

  it('a player without a token cannot snatch', () => {
    const s = windowWith([], 3, {}, (c) => { c.players[2].snatches = 0; });
    expect(applyAction(s, { type: 'SNATCH', playerId: 'p2' }).error).toBe('You cannot snatch this one');
    expect(applyAction(s, { type: 'SNATCH', playerId: 'ghost' }).error).toBe('Unknown player');
  });

  it('SNATCH outside a window errors', () => {
    for (const s of [game(), onKoti(), close(windowWith()).state, bought(3, { snatches: 0 }).state]) {
      expect(applyAction(s, { type: 'SNATCH', playerId: 'p1' }).error).toBe('There is nothing to snatch');
    }
  });

  it('every other action is refused with "Wait for the snatch window" (RESIGN excepted)', () => {
    const s = windowWith(['p1']);
    const actions = [
      { type: 'ROLL' }, { type: 'END_TURN' }, { type: 'BUY' }, { type: 'SKIP_BUY' }, { type: 'BID', amount: 100 },
      { type: 'UPGRADE', tile: 8 }, { type: 'MORTGAGE', tile: KOTI }, { type: 'UNMORTGAGE', tile: KOTI }, { type: 'SELL_BUILDING', tile: KOTI },
      { type: 'PAY_BAIL' }, { type: 'USE_JAIL_CARD' }, { type: 'PAY_DEBT' },
      { type: 'TRADE_OFFER', to: 'p1', give: { cash: 10, tiles: [] }, get: { cash: 0, tiles: [] } },
      { type: 'TRADE_ACCEPT' }, { type: 'TRADE_REJECT' }, { type: 'TRADE_CANCEL' },
    ];
    for (const who of ids.slice(0, 3)) {
      for (const a of actions) {
        const res = applyAction(s, { ...a, playerId: who });
        expect(res.error, `${who} ${a.type}`).toBe('Wait for the snatch window');
        expect(res.state).toBe(s);
        expect(res.events).toEqual([]);
      }
    }
    expect(applyAction(s, { type: 'RESIGN', playerId: 'p2' }).error).toBeUndefined();
  });
});

// ---------------------------------------------------------------- sealed bidding
describe('snatch: two or more pressers go to sealed bidding among themselves', () => {
  it('two pressers (all eligible pressed): the window closes at once and bidding opens', () => {
    const s = windowWith(['p1'], 3);
    const r = act(s, 'p2', { type: 'SNATCH' }); // the last eligible press resolves
    expect(r.state.phase).toBe('auction');
    expect(r.state.pending).toEqual({
      type: 'auction', tile: KOTI, minBid: MIN_BID, bids: { p0: 0 }, snatch: true, buyer: 'p0', claimants: ['p1', 'p2'], returnPhase: 'manage',
    });
    expect(r.events).toEqual([
      { type: 'snatch_end', tile: KOTI, buyer: 'p0', outcome: 'bidding', claimants: ['p1', 'p2'] },
      { type: 'auction_start', tile: KOTI, minBid: MIN_BID, reason: 'snatch', eligible: ['p1', 'p2'] },
    ]);
    expect(r.state.owners[KOTI]).toBe('p0'); // still the buyer's until the bidding ends
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 1]); // tokens are spent only by the winner
    expect(getOptions(r.state, 'p0').bid).toBeNull(); // the buyer never takes part
    expect(getOptions(r.state, 'p1').bid).toEqual({ tile: KOTI, min: MIN_BID, max: START_CASH });
    expect(getOptions(r.state, 'p2').bid).toEqual({ tile: KOTI, min: MIN_BID, max: START_CASH });
  });

  it('only the claimants bid: non-claimants (and the buyer) are auto-passed and cannot bid', () => {
    let s = windowWith(['p1', 'p2'], 4); // p3 has a token but never pressed
    expect(s.phase).toBe('snatch'); // p3 is still eligible, so the window stays open
    s = close(s).state;
    expect(s.phase).toBe('auction');
    expect(s.pending.bids).toEqual({ p0: 0, p3: 0 });
    expect(s.pending.claimants).toEqual(['p1', 'p2']);
    expect(getOptions(s, 'p3').bid).toBeNull();
    expect(applyAction(s, { type: 'BID', playerId: 'p3', amount: 200 }).error).toMatch(/already/);
    expect(applyAction(s, { type: 'BID', playerId: 'p0', amount: 200 }).error).toMatch(/already/);
    expect(applyAction(s, { type: 'BID', playerId: 'p1', amount: MIN_BID - 10 }).error).toMatch(/minimum/);
    expect(applyAction(s, { type: 'BID', playerId: 'p1', amount: START_CASH + 10 }).error).toMatch(/cash/);
  });

  it('the highest bid wins: pays the bank, gets the tile, spends 1 token; the loser keeps its token; the buyer is not refunded', () => {
    let s = windowWith(['p1', 'p2']);
    const total = totalCash(s);
    s = bid(s, 'p1', 150).state;
    expect(s.phase).toBe('auction'); // sealed: waits for p2
    const r = bid(s, 'p2', 400);
    expect(r.events).toEqual([
      { type: 'auction_end', tile: KOTI, winner: 'p2', amount: 400, bids: { p0: 0, p1: 150, p2: 400 }, reason: 'snatch', buyer: 'p0' },
      { type: 'cash', player: 'p2', delta: -400, reason: 'auction' },
      { type: 'own', tile: KOTI, owner: 'p2', reason: 'auction' },
      { type: 'snatch_token', player: 'p2', snatches: 0 },
    ]);
    expect(r.state.owners[KOTI]).toBe('p2');
    expect(r.state.players.map((p) => p.cash)).toEqual([START_CASH - 1000, START_CASH, START_CASH - 400]);
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 0]); // the loser p1 keeps its token
    expect(totalCash(r.state)).toBe(total - 400); // the bid goes to the bank
    expect(r.state.phase).toBe('manage');
    expect(r.state.pending).toBeNull();
    expect(r.state.turn).toBe(0);
  });

  it('three claimants: bidding among exactly those three; a claimant who passes with 0 is still recognised via pending.claimants', () => {
    let s = windowWith(['p1', 'p2', 'p3'], 4);
    expect(s.phase).toBe('auction');
    expect(s.pending.claimants).toEqual(['p1', 'p2', 'p3']);
    expect(s.pending.bids).toEqual({ p0: 0 });
    s = bid(s, 'p2', 0).state; // passes
    expect(s.pending.claimants).toContain('p2');
    s = bid(s, 'p1', 700).state;
    const r = bid(s, 'p3', 650);
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ winner: 'p1', amount: 700, reason: 'snatch', buyer: 'p0' });
    expect(r.state.owners[KOTI]).toBe('p1');
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 0, 1, 1]); // only the winner pays a token
    expect(r.state.players[1].cash).toBe(START_CASH - 700);
    expect(r.state.players[3].cash).toBe(START_CASH);
  });

  it('ties go to the earliest seat counted from the turn player', () => {
    let s = windowWith(['p1', 'p2', 'p3'], 4);
    s = bid(s, 'p3', 300).state;
    s = bid(s, 'p2', 300).state;
    const r = bid(s, 'p1', 300);
    expect(ofType(r.events, 'auction_end')[0].winner).toBe('p1');
  });

  it('nobody bids -> the tile stays with the buyer, no token is spent', () => {
    const buy = bought(3, {}, (c) => { c.owners[8] = 'p0'; c.owners[9] = 'p0'; });
    let s = buy.state;
    s = act(s, 'p1', { type: 'SNATCH' }).state;
    s = act(s, 'p2', { type: 'SNATCH' }).state;
    expect(s.phase).toBe('auction');
    s = bid(s, 'p1', 0).state;
    const r = bid(s, 'p2', 0);
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ winner: null, amount: 0, reason: 'snatch', buyer: 'p0' });
    expect(ofType(r.events, 'snatch_token')).toHaveLength(0);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
    expect(r.state.owners[KOTI]).toBe('p0');
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 1]);
    expect(r.state.players[0].cash).toBe(START_CASH - 1000);
    expect(r.state.phase).toBe('manage');
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p0', group: 'lightblue' }]); // the buyer finally gets it
  });

  it('a claimant who cannot afford the opening bid is auto-passed; the other one wins by bidding the minimum', () => {
    let s = windowWith(['p1'], 3, {}, (c) => { c.players[1].cash = MIN_BID - 10; });
    s = act(s, 'p2', { type: 'SNATCH' }).state;
    expect(s.phase).toBe('auction');
    expect(s.pending.bids).toEqual({ p0: 0, p1: 0 });
    const r = bid(s, 'p2', MIN_BID);
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ winner: 'p2', amount: MIN_BID });
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 0]);
  });

  it('if no claimant can afford the opening bid the tile just stays with the buyer', () => {
    let s = windowWith(['p1'], 3, {}, (c) => { c.players[1].cash = 0; c.players[2].cash = 0; });
    const r = act(s, 'p2', { type: 'SNATCH' });
    expect(ofType(r.events, 'auction_end')[0]).toMatchObject({ winner: null });
    expect(r.state.owners[KOTI]).toBe('p0');
    expect(r.state.players.map((p) => p.snatches)).toEqual([1, 1, 1]);
    expect(r.state.phase).toBe('manage');
  });

  it('the winner of a snatch bidding completes their colour: set_complete after the own event', () => {
    let s = windowWith(['p1', 'p2'], 3, {}, (c) => { c.owners[8] = 'p2'; c.owners[9] = 'p2'; });
    s = bid(s, 'p1', 0).state;
    const r = bid(s, 'p2', 200);
    expect(r.events.map((e) => e.type)).toEqual(['auction_end', 'cash', 'own', 'snatch_token', 'set_complete']);
    expect(r.events.at(-1)).toEqual({ type: 'set_complete', player: 'p2', group: 'lightblue' });
  });
});

// ---------------------------------------------------------------- resigning during the window
describe('snatch: resigning during the window', () => {
  it('a resigning presser is removed from the claims; the window keeps running', () => {
    let s = windowWith(['p1', 'p2'], 4); // p3 is still undecided
    const r = act(s, 'p1', { type: 'RESIGN' });
    expect(r.state.phase).toBe('snatch');
    expect(r.state.pending.claims).toEqual(['p2']);
    const end = close(r.state);
    expect(ofType(end.events, 'snatch_end')[0]).toMatchObject({ outcome: 'snatched', winner: 'p2' });
    expect(end.state.owners[KOTI]).toBe('p2');
    expect(end.state.players[2].snatches).toBe(0);
  });

  it('if the remaining eligible players have all pressed, a resignation closes the window', () => {
    const s = windowWith(['p1']); // p2 undecided
    const r = act(s, 'p2', { type: 'RESIGN' }); // the only player who had not pressed leaves
    expect(r.state.phase).toBe('manage');
    expect(ofType(r.events, 'snatch_end')[0]).toMatchObject({ outcome: 'snatched', winner: 'p1' });
  });

  it('a resigning bystander with no claim leaves the others\' window open', () => {
    const s = windowWith(['p1'], 4);
    const r = act(s, 'p3', { type: 'RESIGN' });
    expect(r.state.phase).toBe('snatch');
    expect(r.state.pending.eligible).toEqual(['p1', 'p2', 'p3']); // eligible is fixed when the window opens
  });

  it('a resigning buyer: the window runs on, nobody pressing leaves the tile with the bank and play moves on', () => {
    const s = windowWith();
    let r = act(s, 'p0', { type: 'RESIGN' });
    expect(r.state.phase).toBe('snatch');
    expect(r.state.owners[KOTI]).toBeNull(); // bankruptcy to the bank released it
    r = close(r.state);
    expect(ofType(r.events, 'snatch_end')[0]).toMatchObject({ outcome: 'none' });
    expect(r.state.owners[KOTI]).toBeNull();
    expect(r.state.turn).toBe(1); // the turn passed on once the window resolved
    expect(r.state.phase).toBe('roll');
  });

  it('a resigning buyer: a presser can still pick the tile up for free', () => {
    let r = act(windowWith(['p1']), 'p0', { type: 'RESIGN' });
    r = close(r.state);
    expect(ofType(r.events, 'snatch_end')[0]).toMatchObject({ outcome: 'snatched', winner: 'p1' });
    expect(r.state.owners[KOTI]).toBe('p1');
    expect(r.state.players[1].snatches).toBe(0);
    expect(r.state.turn).toBe(1);
  });
});

// ---------------------------------------------------------------- turn flow
describe('snatch: the turn carries on afterwards', () => {
  it('a six that bought a property keeps its extra roll after the window (snatched, bidding or untouched)', () => {
    const sixBuy = () => {
      const landed = ok(applyAction(game(3), { type: 'ROLL', playerId: 'p0', dice: [6] })).state; // 0 -> 6, a six
      expect(landed.extraRoll).toBe(true);
      return act(landed, 'p0', { type: 'BUY' }).state;
    };
    const w = sixBuy();
    expect(w.phase).toBe('snatch');
    expect(w.extraRoll).toBe(true);

    const untouched = close(w).state;
    expect(untouched.phase).toBe('manage');
    expect(untouched.extraRoll).toBe(true);
    expect(getOptions(untouched, 'p0')).toMatchObject({ roll: true, endTurn: false });

    const snatched = close(act(w, 'p1', { type: 'SNATCH' }).state).state;
    expect(snatched.phase).toBe('manage');
    expect(snatched.extraRoll).toBe(true);
    expect(getOptions(snatched, 'p0').roll).toBe(true);
    expect(snatched.turn).toBe(0);

    let bidding = act(act(w, 'p1', { type: 'SNATCH' }).state, 'p2', { type: 'SNATCH' }).state;
    bidding = bid(bid(bidding, 'p1', 0).state, 'p2', 0).state;
    expect(bidding.phase).toBe('manage');
    expect(bidding.extraRoll).toBe(true);
    expect(getOptions(bidding, 'p0').roll).toBe(true);
    // ... and the extra roll really can be played
    const again = ok(applyAction(bidding, { type: 'ROLL', playerId: 'p0', dice: [2] }));
    expect(again.state.players[0].pos).toBe(8);
  });

  it('after a plain (non-six) buy the buyer ends the turn as usual once the window is over', () => {
    let s = close(windowWith(['p1'])).state;
    s = act(s, 'p0', { type: 'END_TURN' }).state;
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
  });

  it('the snatched tile can be built on by its new owner, and rent now goes to them', () => {
    const s = close(windowWith(['p1'], 3, {}, (c) => { c.owners[8] = 'p1'; c.owners[9] = 'p1'; })).state;
    const mid = act(s, 'p0', { type: 'END_TURN' }).state; // p1 to move
    expect(getOptions(mid, 'p1').upgrade.map((u) => u.tile).sort((a, b) => a - b)).toEqual([6, 8, 9]);
    const visitor = edit(mid, (c) => { c.turn = 2; c.players[2].pos = 3; });
    const hit = ok(applyAction(visitor, { type: 'ROLL', playerId: 'p2', dice: [3] }));
    expect(ofType(hit.events, 'cash').map((e) => [e.player, e.reason])).toEqual([['p2', 'rent'], ['p1', 'rent']]);
  });
});

// ---------------------------------------------------------------- settings
describe('snatch: settings', () => {
  it('snatches 0..3 and snatchMs 1000..10000 are clamped; the defaults are 1 and 3000', () => {
    expect(normalizeSettings({})).toMatchObject({ snatches: 1, snatchMs: 3000 });
    expect(normalizeSettings({ snatches: -2 }).snatches).toBe(0);
    expect(normalizeSettings({ snatches: 7 }).snatches).toBe(3);
    expect(normalizeSettings({ snatches: 2 }).snatches).toBe(2);
    expect(normalizeSettings({ snatches: 'x' }).snatches).toBe(1);
    expect(normalizeSettings({ snatchMs: 10 }).snatchMs).toBe(1000);
    expect(normalizeSettings({ snatchMs: 99999 }).snatchMs).toBe(10000);
    expect(normalizeSettings({ snatchMs: 4500 }).snatchMs).toBe(4500);
    expect(createGame({ players: mkPlayers(2), seed: 1, settings: { snatches: 3 } }).players.map((p) => p.snatches)).toEqual([3, 3]);
  });

  it('with several tokens a player can snatch more than once', () => {
    let s = close(windowWith(['p1'], 3, { snatches: 2 })).state;
    expect(s.players[1].snatches).toBe(1);
    s = act(s, 'p0', { type: 'END_TURN' }).state;
    const buying = edit(s, (c) => { c.turn = 0; c.phase = 'buy'; c.pending = { type: 'buy', tile: 8, price: 1000 }; c.players[0].pos = 8; });
    const w = act(buying, 'p0', { type: 'BUY' }).state;
    expect(w.pending.eligible).toEqual(['p1', 'p2']);
    const r = close(act(w, 'p1', { type: 'SNATCH' }).state);
    expect(r.state.owners[8]).toBe('p1');
    expect(r.state.players[1].snatches).toBe(0);
  });
});

// ---------------------------------------------------------------- bots / auto-play
describe('snatch: bots and auto-play', () => {
  it('auto-play and nextBotMove never act inside the window', () => {
    const s = edit(windowWith(), (c) => { for (const p of c.players) p.isBot = true; });
    for (const id of ids.slice(0, 3)) expect(chooseBotAction(s, id, () => 0.5)).toBeNull();
    expect(nextBotMove(s, () => 0.5)).toBeNull();
  });

  it('botSnatchAction (simulator policy): snatch when it completes the colour or costs >= 1,500; otherwise not', () => {
    expect(SNATCH_MIN_PRICE).toBe(1500);
    const cheap = windowWith(); // Koti, 1,000
    expect(botSnatchAction(cheap, 'p1')).toBeNull();
    const completes = windowWith([], 3, {}, (c) => { c.owners[8] = 'p1'; c.owners[9] = 'p1'; });
    expect(botSnatchAction(completes, 'p1')).toEqual({ type: 'SNATCH', playerId: 'p1' });
    expect(botSnatchAction(completes, 'p2')).toBeNull();
    const dear = edit(windowWith(), (c) => { c.pending.price = 1500; });
    expect(botSnatchAction(dear, 'p1')).toEqual({ type: 'SNATCH', playerId: 'p1' });
    expect(botSnatchAction(act(dear, 'p1', { type: 'SNATCH' }).state, 'p1')).toBeNull(); // already pressed
    expect(botSnatchAction(dear, 'p0')).toBeNull(); // the buyer
    expect(botSnatchAction(game(), 'p1')).toBeNull(); // no window
  });
});

// ---------------------------------------------------------------- determinism
describe('snatch: determinism', () => {
  const script = (seed) => {
    const rnd = mulberry32(seed);
    let s = createGame({ players: mkPlayers(4), seed, settings: { snatches: 2, goal: 400000 } });
    const log = [];
    for (let i = 0; i < 1500 && s.phase !== 'over'; i++) {
      let a;
      if (s.phase === 'snatch') {
        const live = s.players.filter((p) => getOptions(s, p.id).snatch);
        a = live.length && rnd() < 0.7 ? { type: 'SNATCH', playerId: live[Math.floor(rnd() * live.length)].id } : { type: 'SNATCH_CLOSE' };
      } else {
        a = nextBotMove(edit(s, (c) => { for (const p of c.players) p.isBot = true; }), rnd);
      }
      const res = applyAction(s, a);
      expect(res.error).toBeUndefined();
      log.push(a, res.events);
      s = res.state;
    }
    return { s, log };
  };

  it('same seed + same actions = same state and events, windows and bidding included', () => {
    const a = script(31);
    const b = script(31);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
    const types = new Set(a.log.flat().map((e) => e.type));
    expect(types.has('snatch_open')).toBe(true);
    expect(types.has('snatch_end')).toBe(true);
    expect(JSON.stringify(script(32).log)).not.toBe(JSON.stringify(a.log));
  });

  it('applyAction never mutates the state it was given', () => {
    const s = windowWith(['p1']);
    const snapshot = JSON.stringify(s);
    close(s);
    applyAction(s, { type: 'SNATCH', playerId: 'p2' });
    applyAction(s, { type: 'ROLL', playerId: 'p0' });
    applyAction(s, { type: 'RESIGN', playerId: 'p1' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
