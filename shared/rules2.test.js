// Rules v2 (CONTRACT 3c): set bonus, hotel, mortgage, debt, bankruptcy inheritance, auction on decline,
// jail card, trading, dice bookkeeping and the bots' side of all of it.
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, nextBotMove, chooseBotAction,
  normalizeSettings, liquidationValue, diceCtx, landingOdds, diceOdds, KISMET, TILES, GROUP_TILES, MAX_LEVEL,
  rentFor, upgradeCost, mortgageValue, unmortgageCost, DEFAULT_SETTINGS,
} from './index.js';

// ---------------------------------------------------------------- helpers
const ids = ['p0', 'p1', 'p2', 'p3'];
const mkPlayers = (n, bots = []) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `P${i}`, avatar: i, isBot: bots.includes(i) }));
const game = (n = 3, settings = {}, bots = [], seed = 7) =>
  createGame({ players: mkPlayers(n, bots), seed, settings: { debug: true, diceCount: 2, auctionOnDecline: false, ...settings } });
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
const act = (s, playerId, action) => ok(applyAction(s, { playerId, ...action }));
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

// ---------------------------------------------------------------- set bonus
describe('colour-set bonus', () => {
  it('level-0 rent: x1 for a single tile, x1.5 for 2 of 3, x2 for the whole colour', () => {
    const one = edit(game(), (c) => { c.owners[6] = 'p1'; });
    expect(previewRent(one, 6)).toBe(60);
    const two = edit(one, (c) => { c.owners[8] = 'p1'; });
    expect(previewRent(two, 6)).toBe(90);
    expect(previewRent(two, 8)).toBe(90);
    const three = edit(two, (c) => { c.owners[10] = 'p1'; });
    expect(previewRent(three, 6)).toBe(120);
    expect(previewRent(three, 10)).toBe(Math.round(rentFor(TILES[10], 0) * 2));
  });

  it('a two-tile colour pays x2 only when both are owned', () => {
    const one = edit(game(), (c) => { c.owners[12] = 'p1'; });
    expect(previewRent(one, 12)).toBe(rentFor(TILES[12], 0));
    const both = edit(one, (c) => { c.owners[13] = 'p1'; });
    expect(previewRent(both, 12)).toBe(rentFor(TILES[12], 0) * 2);
  });

  it('built tiles use the plain ladder, no bonus', () => {
    const s = edit(game(), (c) => { giveAll(c, 'east', 'p1', 1); });
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 1));
  });

  it('getOptions().sets lists the colours you hold a piece of', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[12] = 'p0'; c.owners[13] = 'p0'; });
    const sets = getOptions(s, 'p0').sets;
    expect(sets).toContainEqual({ group: 'east', owned: 2, size: 3, multiplier: 1.5 });
    expect(sets).toContainEqual({ group: 'core', owned: 2, size: 2, multiplier: 2 });
    expect(sets).toHaveLength(2);
    expect(getOptions(s, 'p1').sets).toEqual([]);
  });

  it('emits set_complete when a purchase finishes a colour (after the own event)', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.players[0].pos = 4; });
    const landed = ok(roll(s, 2, 4)); // 4 -> 10
    const bought = act(landed.state, 'p0', { type: 'BUY' });
    const types = bought.events.map((e) => e.type);
    expect(types).toEqual(['cash', 'own', 'set_complete']);
    expect(bought.events[2]).toEqual({ type: 'set_complete', player: 'p0', group: 'east' });
  });
});

// ---------------------------------------------------------------- hotel
describe('hotel', () => {
  const east = (level) => edit(game(), (c) => giveAll(c, 'east', 'p0', level));

  it('needs the whole colour at level 4 first, then raises one tile at a time', () => {
    expect(MAX_LEVEL).toBe(5);
    const s = edit(east(4), (c) => { c.levels[10] = 3; });
    expect(canUpgrade(s, 'p0', 6).reason).toMatch(/evenly/); // 6 is at 4 but the group minimum is 3
    expect(canUpgrade(s, 'p0', 10).ok).toBe(true);
    const ready = east(4);
    const r = act(ready, 'p0', { type: 'UPGRADE', tile: 6 });
    expect(r.events[1]).toEqual({ type: 'level', tile: 6, level: 5, reason: 'upgrade' });
    expect(canUpgrade(r.state, 'p0', 6).reason).toMatch(/fully built/);
    expect(canUpgrade(r.state, 'p0', 8).ok).toBe(true); // the others may follow
  });

  it('hotel rent is 1.5x the price and counts in net worth at its full build cost', () => {
    const s = edit(east(5), (c) => { c.players[0].cash = 0; });
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 5));
    expect(previewRent(s, 6)).toBe(1050);
    const expected = 700 + 700 + 800 + 5 * (350 + 350 + 400);
    expect(netWorth(s, 'p0')).toBe(expected);
  });

  it('does not allow a fifth upgrade beyond the hotel and refuses a mortgaged colour', () => {
    expect(canUpgrade(east(5), 'p0', 6).ok).toBe(false);
    const m = edit(east(0), (c) => { c.mortgaged[8] = true; });
    expect(canUpgrade(m, 'p0', 6).reason).toMatch(/Unmortgage/);
  });
});

// ---------------------------------------------------------------- mortgage
describe('mortgage, unmortgage and selling buildings', () => {
  it('MORTGAGE pays the bank value, keeps net worth, and the tile collects no rent', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; });
    const before = netWorth(s, 'p0');
    const r = act(s, 'p0', { type: 'MORTGAGE', tile: 6 });
    expect(r.events).toEqual([
      { type: 'mortgage', player: 'p0', tile: 6, value: 350 },
      { type: 'cash', player: 'p0', delta: 350, reason: 'mortgage' },
    ]);
    expect(r.state.mortgaged[6]).toBe(true);
    expect(r.state.players[0].cash).toBe(15350);
    expect(netWorth(r.state, 'p0')).toBe(before); // cash +350, tile counts price - 350
    expect(previewRent(r.state, 6)).toBe(0);
    const visit = ok(roll(edit(r.state, (c) => { c.turn = 1; }), 2, 4, 'p1')); // p1 lands on mortgaged 6
    expect(ofType(visit.events, 'cash')).toHaveLength(0);
  });

  it('refuses double mortgage, other players tiles, built colours and the wrong moment', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; giveAll(c, 'west', 'p0', 1); });
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 1 }).error).toMatch(/buildings/);
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p1', tile: 6 }).error).toBeTruthy();
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 8 }).error).toMatch(/do not own/);
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 3 }).error).toBeTruthy();
    const done = act(s, 'p0', { type: 'MORTGAGE', tile: 6 }).state;
    expect(applyAction(done, { type: 'MORTGAGE', playerId: 'p0', tile: 6 }).error).toMatch(/Already/);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: 1200 }; });
    expect(applyAction(buying, { type: 'MORTGAGE', playerId: 'p0', tile: 6 }).error).toBeTruthy();
  });

  it('UNMORTGAGE costs the value plus 10%, and the colour can be built again', () => {
    const s = edit(game(), (c) => { giveAll(c, 'east', 'p0'); c.mortgaged[8] = true; });
    expect(canUpgrade(s, 'p0', 6).ok).toBe(false);
    const cost = unmortgageCost(TILES[8]);
    expect(cost).toBe(390);
    expect(getOptions(s, 'p0').unmortgage).toEqual([{ tile: 8, cost }]);
    const r = act(s, 'p0', { type: 'UNMORTGAGE', tile: 8 });
    expect(r.events[0]).toEqual({ type: 'unmortgage', player: 'p0', tile: 8, cost });
    expect(r.state.mortgaged[8]).toBe(false);
    expect(r.state.players[0].cash).toBe(15000 - cost);
    expect(canUpgrade(r.state, 'p0', 6).ok).toBe(true);
    const poor = edit(s, (c) => { c.players[0].cash = cost - 10; });
    expect(applyAction(poor, { type: 'UNMORTGAGE', playerId: 'p0', tile: 8 }).error).toMatch(/Need/);
    expect(getOptions(poor, 'p0').unmortgage).toEqual([]);
  });

  it('a mortgaged tile still counts toward the colour-set bonus', () => {
    const s = edit(game(), (c) => { giveAll(c, 'east', 'p1'); c.mortgaged[8] = true; });
    expect(previewRent(s, 6)).toBe(120);
    expect(previewRent(s, 8)).toBe(0);
  });

  it('SELL_BUILDING refunds half the build cost and follows the even-sell rule', () => {
    const s = edit(game(), (c) => { giveAll(c, 'east', 'p0', 1); c.levels[6] = 2; });
    expect(applyAction(s, { type: 'SELL_BUILDING', playerId: 'p0', tile: 8 }).error).toMatch(/evenly/);
    expect(getOptions(s, 'p0').sellBuilding).toEqual([{ tile: 6, refund: 175 }]);
    const r = act(s, 'p0', { type: 'SELL_BUILDING', tile: 6 });
    expect(r.events).toEqual([
      { type: 'level', tile: 6, level: 1, reason: 'sell' },
      { type: 'cash', player: 'p0', delta: 175, reason: 'sell' },
    ]);
    expect(r.state.levels[6]).toBe(1);
    expect(applyAction(edit(s, (c) => { c.levels[10] = 0; c.levels[6] = 0; c.levels[8] = 0; }), { type: 'SELL_BUILDING', playerId: 'p0', tile: 6 }).error).toMatch(/Nothing built/);
  });

  it('liquidationValue adds building refunds and mortgage values', () => {
    const s = edit(game(), (c) => { giveAll(c, 'west', 'p0', 2); c.owners[12] = 'p0'; c.mortgaged[12] = true; });
    const refunds = 2 * (125 + 125 + 150);
    const mortgages = 250 + 250 + 300; // 12 is already mortgaged
    expect(liquidationValue(s, 'p0')).toBe(refunds + mortgages);
  });
});

// ---------------------------------------------------------------- debt
describe('debt phase', () => {
  // p1 owns Kukatpally (6) at level 4 -> rent 700; p0 (cash 100, owns Ameerpet 12 worth 600 mortgaged) rolls 2+4.
  const owing = (extra = () => {}) => edit(game(), (c) => {
    c.owners[6] = 'p1';
    c.levels[6] = 4;
    c.players[0].cash = 100;
    c.owners[12] = 'p0';
    extra(c);
  });

  it('opens when cash + liquidation value can cover the payment, instead of selling silently', () => {
    const r = ok(roll(owing(), 2, 4));
    expect(r.state.phase).toBe('debt');
    expect(r.state.debt).toMatchObject({ player: 'p0', amount: 700, creditor: 'p1', reason: 'rent' });
    expect(ofType(r.events, 'debt')).toEqual([{ type: 'debt', player: 'p0', amount: 700, creditor: 'p1' }]);
    expect(r.state.owners[12]).toBe('p0'); // nothing was sold
    expect(r.state.players[0].cash).toBe(100);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
  });

  it('getOptions: only the debtor can act, with mortgage / sellBuilding / payDebt', () => {
    const s = ok(roll(owing(), 2, 4)).state;
    const o = getOptions(s, 'p0');
    expect(o).toMatchObject({ roll: false, endTurn: false, buy: false, payDebt: false, resign: true });
    expect(o.debt).toEqual({ amount: 700, creditor: 'p1', shortfall: 600 });
    expect(o.mortgage).toEqual([{ tile: 12, value: 600 }]);
    const other = getOptions(s, 'p1');
    expect(other).toMatchObject({ roll: false, debt: null, payDebt: false, mortgage: [] });
    expect(applyAction(s, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(s, { type: 'END_TURN', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(s, { type: 'PAY_DEBT', playerId: 'p1' }).error).toBeTruthy();
  });

  it('PAY_DEBT is only valid once cash covers it; then the turn carries on', () => {
    let s = ok(roll(owing(), 2, 4)).state;
    expect(applyAction(s, { type: 'PAY_DEBT', playerId: 'p0' }).error).toMatch(/Raise/);
    s = act(s, 'p0', { type: 'MORTGAGE', tile: 12 }).state;
    expect(s.phase).toBe('debt');
    expect(getOptions(s, 'p0').payDebt).toBe(true);
    const r = act(s, 'p0', { type: 'PAY_DEBT' });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -700, reason: 'rent', other: 'p1' },
      { type: 'cash', player: 'p1', delta: 700, reason: 'rent', other: 'p0' },
    ]);
    expect(r.state.phase).toBe('manage');
    expect(r.state.debt).toBeNull();
    expect(r.state.players[0].cash).toBe(0);
    expect(r.state.players[0].stats.rentPaid).toBe(700);
    expect(getOptions(r.state, 'p0').endTurn).toBe(true);
  });

  it('keeps the extra roll when the debt came from a doubles roll', () => {
    const s = edit(owing(), (c) => { c.players[0].pos = 0; });
    let r = ok(roll(s, 3, 3)); // 0 -> 6 on doubles
    expect(r.state.phase).toBe('debt');
    r = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p0', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.extraRoll).toBe(true);
    expect(getOptions(r.state, 'p0').roll).toBe(true);
  });

  it('tax debts go to the bank (no creditor)', () => {
    const s = edit(game(3, { taxAmount: 1000 }), (c) => { c.players[0].cash = 0; c.players[0].pos = 10; c.owners[12] = 'p0'; c.owners[13] = 'p0'; });
    const r = ok(roll(s, 2, 4)); // 10 -> 16, tax 1000
    expect(r.state.debt).toMatchObject({ amount: 1000, creditor: null, reason: 'tax' });
    let t = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 }).state;
    t = act(t, 'p0', { type: 'MORTGAGE', tile: 13 }).state; // 600 + 750 = 1350
    const done = act(t, 'p0', { type: 'PAY_DEBT' });
    expect(ofType(done.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -1000, reason: 'tax' }]);
    expect(done.state.players[0].stats.taxPaid).toBe(1000);
  });

  it('a payment that even full liquidation cannot cover bankrupts the debtor to the creditor', () => {
    const s = edit(game(), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 4;
      c.players[0].cash = 100;
      c.owners[1] = 'p0'; // mortgage value 250 -> 350 < 700
      c.mortgaged[1] = false;
    });
    const r = ok(roll(s, 2, 4));
    expect(r.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(r.state.owners[1]).toBe('p1'); // the creditor inherits the property
    expect(r.state.players[1].cash).toBe(15100);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 1, owner: 'p1', reason: 'bankrupt' }]);
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'turn')[0]).toMatchObject({ player: 'p1' });
    expect(r.events.map((e) => e.type)).toContain('bankrupt');
  });

  it('bankruptcy sells buildings to the bank first, hands cash and every property to the creditor, mortgages stay', () => {
    const s = edit(game(), (c) => {
      c.owners[27] = 'p1';
      c.levels[27] = 4; // rent 5000
      giveAll(c, 'west', 'p0', 1);
      c.mortgaged[4] = false;
      c.owners[3] = 'p0';
      c.mortgaged[3] = true;
      c.players[0].cash = 0;
      c.players[0].pos = 21;
    });
    const r = ok(roll(s, 2, 4)); // 21 -> 27
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(ofType(r.events, 'level').map((e) => [e.tile, e.level, e.reason]).sort()).toEqual([[1, 0, 'bankrupt'], [2, 0, 'bankrupt'], [4, 0, 'bankrupt']]);
    expect(r.state.players[1].cash).toBe(15000 + 400); // 125 + 125 + 150 of building refunds
    expect([1, 2, 3, 4].every((t) => r.state.owners[t] === 'p1')).toBe(true);
    expect(r.state.mortgaged[3]).toBe(true);
    expect(r.state.levels.every((l, i) => i === 27 || l === 0)).toBe(true);
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p1', group: 'west' }]);
  });

  it('bankruptcy to the bank (tax, cards) returns everything unowned and unmortgaged', () => {
    const s = edit(game(), (c) => {
      c.players[0].cash = 0;
      c.players[0].pos = 10;
      c.owners[1] = 'p0';
      c.mortgaged[1] = true;
    });
    const r = ok(roll(s, 2, 4)); // tax, and the only tile is already mortgaged: nothing to liquidate
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(r.state.owners[1]).toBeNull();
    expect(r.state.mortgaged[1]).toBe(false);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 1, owner: null, reason: 'bankrupt' }]);
  });

  it('resigning during a debt is bankruptcy to the creditor', () => {
    const s = ok(roll(owing(), 2, 4)).state;
    const r = act(s, 'p0', { type: 'RESIGN' });
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(r.state.owners[12]).toBe('p1');
    expect(r.state.debt).toBeNull();
    expect(r.state.phase).toBe('roll');
    expect(r.state.turn).toBe(1);
  });

  it('the Biryani Promise (pay everyone) pauses on the first debt and resumes with the rest', () => {
    const s = edit(game(), (c) => { rig(c, 'biryani_promise'); c.players[0].cash = 100; c.owners[12] = 'p0'; });
    let r = ok(roll(s, 2, 3)); // 0 -> 5, draws the card
    expect(r.state.phase).toBe('debt');
    expect(r.state.debt).toMatchObject({ player: 'p0', amount: 150, creditor: 'p1', reason: 'card' });
    expect(r.state.debt.rest).toEqual([{ from: 'p0', to: 'p2', amount: 150, reason: 'card' }]);
    r = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p0', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.players.map((p) => p.cash)).toEqual([400, 15150, 15150]);
  });

  it('a poor payer in a Birthday card can settle a debt even though it is not their turn', () => {
    const s = edit(game(), (c) => { rig(c, 'birthday'); c.players[1].cash = 0; c.owners[12] = 'p1'; });
    let r = ok(roll(s, 2, 3));
    expect(r.state.debt).toMatchObject({ player: 'p1', amount: 200, creditor: 'p0' });
    expect(getOptions(r.state, 'p1').mortgage).toEqual([{ tile: 12, value: 600 }]);
    expect(getOptions(r.state, 'p0').roll).toBe(false);
    r = act(r.state, 'p1', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p1', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.turn).toBe(0);
    expect(r.state.players.map((p) => p.cash)).toEqual([15400, 400, 14800]);
  });
});

// ---------------------------------------------------------------- auction on decline
describe('auction on decline', () => {
  const declined = (settings = {}) => {
    const s = game(3, { auctionOnDecline: true, ...settings });
    const landed = ok(roll(s, 2, 4)); // Kukatpally, 700
    return act(landed.state, 'p0', { type: 'SKIP_BUY' });
  };

  it('SKIP_BUY opens a sealed auction for the same tile at 10% of the price', () => {
    const r = declined();
    expect(r.state.phase).toBe('auction');
    expect(r.state.pending).toEqual({ type: 'auction', tile: 6, minBid: 70, bids: {} });
    expect(r.events).toEqual([{ type: 'auction_start', tile: 6, minBid: 70 }]);
    expect(getOptions(r.state, 'p0').bid).toEqual({ tile: 6, min: 70, max: 15000 }); // the decliner may bid too
  });

  it('the highest bidder buys it; if everyone passes it stays unowned', () => {
    let r = declined();
    r = act(r.state, 'p0', { type: 'BID', amount: 0 });
    r = act(r.state, 'p1', { type: 'BID', amount: 100 });
    r = act(r.state, 'p2', { type: 'BID', amount: 90 });
    expect(r.events.find((e) => e.type === 'auction_end')).toMatchObject({ tile: 6, winner: 'p1', amount: 100 });
    expect(r.state.owners[6]).toBe('p1');
    expect(r.state.phase).toBe('manage');
    let none = declined();
    for (const id of ['p0', 'p1', 'p2']) none = act(none.state, id, { type: 'BID', amount: 0 });
    expect(none.state.owners[6]).toBeNull();
    expect(none.events.find((e) => e.type === 'auction_end').winner).toBeNull();
  });

  it('the minimum bid is at least 10 and tracks the price', () => {
    const t = edit(game(3, { auctionOnDecline: true }), (c) => { c.players[0].pos = 21; });
    const k = act(ok(roll(t, 2, 4)).state, 'p0', { type: 'SKIP_BUY' }); // Banjara 5000
    expect(k.state.pending.minBid).toBe(500);
  });

  it('can be switched off with cfg.auctionOnDecline = false', () => {
    const s = game(3, { auctionOnDecline: false });
    const r = act(ok(roll(s, 2, 4)).state, 'p0', { type: 'SKIP_BUY' });
    expect(r.state.phase).toBe('manage');
    expect(r.events).toEqual([]);
  });

  it('keeps the doubles extra roll after the auction', () => {
    const s = edit(game(3, { auctionOnDecline: true }), (c) => { c.players[0].pos = 4; });
    let r = ok(roll(s, 1, 1)); // 4 -> 6 on doubles
    r = act(r.state, 'p0', { type: 'SKIP_BUY' });
    for (const id of ['p0', 'p1', 'p2']) r = act(r.state, id, { type: 'BID', amount: 0 });
    expect(r.state.phase).toBe('manage');
    expect(r.state.extraRoll).toBe(true);
  });
});

// ---------------------------------------------------------------- jail card
describe('Get Out of Jail Free', () => {
  it('is drawn from the deck and kept by the player', () => {
    const s = edit(game(), (c) => rig(c, 'jail_free'));
    const r = ok(roll(s, 2, 3));
    expect(ofType(r.events, 'card')[0]).toMatchObject({ cardId: 'jail_free', kind: 'good' });
    expect(r.state.players[0].jailCards).toBe(1);
    expect(r.state.phase).toBe('manage');
  });

  it('USE_JAIL_CARD frees you before rolling and returns the card to the deck', () => {
    const idx = KISMET.findIndex((c) => c.id === 'jail_free');
    const s = edit(game(), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = 1; c.players[0].jailCards = 1; });
    expect(getOptions(s, 'p0')).toMatchObject({ useJailCard: true, roll: true });
    const r = act(s, 'p0', { type: 'USE_JAIL_CARD' });
    expect(r.events).toEqual([{ type: 'jail', player: 'p0', jailed: false, reason: 'card_used' }]);
    expect(r.state.players[0]).toMatchObject({ jailTurns: 0, jailCards: 0 });
    expect(r.state.deck.at(-1)).toBe(idx);
    expect(r.state.phase).toBe('roll');
    expect(ok(roll(r.state, 2, 3)).state.players[0].pos).toBe(19);
  });

  it('is refused without a card or when not jailed', () => {
    const jailedNoCard = edit(game(), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = 1; });
    expect(applyAction(jailedNoCard, { type: 'USE_JAIL_CARD', playerId: 'p0' }).error).toMatch(/no Get Out/);
    expect(getOptions(jailedNoCard, 'p0').useJailCard).toBe(false);
    const free = edit(game(), (c) => { c.players[0].jailCards = 1; });
    expect(applyAction(free, { type: 'USE_JAIL_CARD', playerId: 'p0' }).error).toMatch(/not in jail/);
  });

  it('a held card is left out of the reshuffle and a bankrupt player returns it', () => {
    const idx = KISMET.findIndex((c) => c.id === 'jail_free');
    const held = edit(game(), (c) => { c.deckPos = c.deck.length; c.players[1].jailCards = 1; });
    const r = ok(roll(held, 2, 3));
    expect(r.state.deck).toHaveLength(KISMET.length - 1);
    expect(r.state.deck.includes(idx)).toBe(false);
    const resign = act(edit(game(), (c) => { c.players[1].jailCards = 1; }), 'p1', { type: 'RESIGN' });
    expect(resign.state.players[1].jailCards).toBe(0);
    expect(resign.state.deck.at(-1)).toBe(idx);
  });
});

// ---------------------------------------------------------------- trading
describe('trading', () => {
  const offer = (s, extra = {}) => applyAction(s, {
    type: 'TRADE_OFFER', playerId: 'p0', to: 'p1', give: { cash: 0, tiles: [] }, get: { cash: 0, tiles: [] }, ...extra,
  });
  // p0 owns Miyapur (1) and Bachupally (2); p1 owns Nizampet (4) and Kukatpally (6).
  const base = () => edit(game(), (c) => { c.owners[1] = 'p0'; c.owners[2] = 'p0'; c.owners[4] = 'p1'; c.owners[6] = 'p1'; });
  const swap = { give: { cash: 100, tiles: [] }, get: { cash: 0, tiles: [4] } };

  it('a valid offer opens one pending trade and blocks every other action but the answers', () => {
    const r = ok(offer(base(), swap));
    expect(r.state.trade).toEqual({ id: 1, from: 'p0', to: 'p1', give: swap.give, get: swap.get });
    expect(r.events).toEqual([{ type: 'trade_offer', id: 1, from: 'p0', to: 'p1', give: swap.give, get: swap.get }]);
    expect(getOptions(r.state, 'p1').tradeOffer).toEqual({ id: 1, from: 'p0', give: swap.give, get: swap.get });
    expect(getOptions(r.state, 'p0').tradeSent).toEqual({ id: 1, to: 'p1', give: swap.give, get: swap.get });
    expect(getOptions(r.state, 'p0')).toMatchObject({ roll: false, endTurn: false, upgrade: [], mortgage: [] });
    expect(applyAction(r.state, { type: 'ROLL', playerId: 'p0' }).error).toMatch(/trade/);
    expect(applyAction(r.state, { type: 'MORTGAGE', playerId: 'p0', tile: 1 }).error).toMatch(/trade/);
    expect(offer(r.state, swap).error).toMatch(/trade/);
    expect(applyAction(r.state, { type: 'TRADE_ACCEPT', playerId: 'p0' }).error).toBeTruthy(); // only `to` answers
    expect(applyAction(r.state, { type: 'TRADE_CANCEL', playerId: 'p1' }).error).toBeTruthy(); // only `from` cancels
  });

  it('validates the offer', () => {
    const s = base();
    expect(offer(s).error).toMatch(/empty/);
    expect(offer(s, { to: 'p0' }).error).toBeTruthy();
    expect(offer(s, { to: 'ghost', give: { cash: 5, tiles: [] } }).error).toBeTruthy();
    expect(offer(s, { give: { cash: 99999, tiles: [] } }).error).toMatch(/cash/);
    expect(offer(s, { get: { cash: 99999, tiles: [] } }).error).toMatch(/cash/);
    expect(offer(s, { give: { cash: 0, tiles: [4] } }).error).toMatch(/do not own/);
    expect(offer(s, { get: { cash: 0, tiles: [1] } }).error).toMatch(/does not own/);
    expect(offer(s, { give: { cash: 0, tiles: [0] } }).error).toBeTruthy(); // START is not tradeable
    expect(offer(s, { give: { cash: -5, tiles: [] } }).error).toBeTruthy();
    expect(offer(s, { give: { cash: 1.5, tiles: [] } }).error).toBeTruthy();
    expect(offer(s, { give: { cash: 0, tiles: [1, 1] } }).error).toBeTruthy();
    expect(applyAction(s, { type: 'TRADE_OFFER', playerId: 'p1', to: 'p0', give: { cash: 5 }, get: {} }).error).toMatch(/Not your turn/);
    const built = edit(s, (c) => { giveAll(c, 'west', 'p0', 1); });
    expect(offer(built, { give: { cash: 0, tiles: [1] } }).error).toMatch(/buildings/);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: 1200 }; });
    expect(offer(buying, swap).error).toBeTruthy();
    const mid = edit(s, (c) => { c.phase = 'manage'; });
    expect(offer(mid, swap).error).toBeUndefined();
  });

  it('TRADE_ACCEPT swaps cash and tiles, emits trade_done + cash + own + set_complete', () => {
    const open = ok(offer(base(), { give: { cash: 300, tiles: [] }, get: { cash: 50, tiles: [4] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    expect(r.events[0]).toMatchObject({ type: 'trade_done', id: 1, from: 'p0', to: 'p1' });
    expect(ofType(r.events, 'cash')).toEqual([
      { type: 'cash', player: 'p0', delta: -300, reason: 'trade', other: 'p1' },
      { type: 'cash', player: 'p1', delta: 300, reason: 'trade', other: 'p0' },
      { type: 'cash', player: 'p1', delta: -50, reason: 'trade', other: 'p0' },
      { type: 'cash', player: 'p0', delta: 50, reason: 'trade', other: 'p1' },
    ]);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 4, owner: 'p0', reason: 'trade' }]);
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p0', group: 'west' }]);
    expect(r.state.owners[4]).toBe('p0');
    expect(r.state.trade).toBeNull();
    expect(r.state.players[0].cash).toBe(15000 - 250);
    expect(r.state.players[1].cash).toBe(15000 + 250);
    expect(getOptions(r.state, 'p0').roll).toBe(true); // back to the turn
  });

  it('tiles given away keep their mortgage, and tile-for-tile swaps work', () => {
    const s = edit(base(), (c) => { c.mortgaged[1] = true; });
    const open = ok(offer(s, { give: { cash: 0, tiles: [1] }, get: { cash: 0, tiles: [6] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    expect(r.state.owners[1]).toBe('p1');
    expect(r.state.owners[6]).toBe('p0');
    expect(r.state.mortgaged[1]).toBe(true);
    expect(netWorth(r.state, 'p1')).toBe(15000 + 600 + (500 - 250)); // Nizampet + the mortgaged Miyapur at price - mortgage value
  });

  it('TRADE_REJECT and TRADE_CANCEL close it with a reason; ids increase', () => {
    const open = ok(offer(base(), swap)).state;
    const rej = act(open, 'p1', { type: 'TRADE_REJECT' });
    expect(rej.events).toEqual([{ type: 'trade_rejected', id: 1, from: 'p0', to: 'p1', reason: 'rejected' }]);
    expect(rej.state.trade).toBeNull();
    const again = ok(offer(rej.state, swap)).state;
    expect(again.trade.id).toBe(2);
    const can = act(again, 'p0', { type: 'TRADE_CANCEL' });
    expect(can.events).toEqual([{ type: 'trade_rejected', id: 2, from: 'p0', to: 'p1', reason: 'cancelled' }]);
    expect(can.state.phase).toBe('roll');
  });

  it('either party resigning cancels the pending trade', () => {
    const open = ok(offer(base(), swap)).state;
    const r = act(open, 'p1', { type: 'RESIGN' });
    expect(ofType(r.events, 'trade_rejected')).toEqual([{ type: 'trade_rejected', id: 1, from: 'p0', to: 'p1', reason: 'bankrupt' }]);
    expect(r.state.trade).toBeNull();
  });

  it('a trade can hand over the colour that finishes a set: both sides get set_complete when it applies', () => {
    const s = edit(game(), (c) => { c.owners[1] = 'p0'; c.owners[4] = 'p0'; c.owners[2] = 'p1'; c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[10] = 'p1'; });
    const open = ok(offer(s, { give: { cash: 0, tiles: [6, 8] }, get: { cash: 0, tiles: [2] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    const sets = ofType(r.events, 'set_complete');
    expect(sets).toContainEqual({ type: 'set_complete', player: 'p0', group: 'west' });
    expect(sets).toContainEqual({ type: 'set_complete', player: 'p1', group: 'east' });
  });
});

// ---------------------------------------------------------------- bots and the new rules
describe('bots (rules v2)', () => {
  const rnd = () => 0.1;

  it('bot answers a trade offer that completes its colour with ACCEPT', () => {
    const s = edit(game(3, {}, [1]), (c) => { c.owners[1] = 'p1'; c.owners[2] = 'p1'; c.owners[4] = 'p0'; });
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 0, tiles: [4] }, get: { cash: 0, tiles: [] } }).state;
    expect(nextBotMove(open, rnd)).toEqual({ type: 'TRADE_ACCEPT', playerId: 'p1' });
  });

  it('bot never breaks a colour it owns in full, and rejects bad prices', () => {
    const s = edit(game(3, {}, [1]), (c) => { giveAll(c, 'east', 'p1'); c.owners[4] = 'p0'; });
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 5000, tiles: [] }, get: { cash: 0, tiles: [6] } }).state;
    expect(nextBotMove(open, rnd)).toEqual({ type: 'TRADE_REJECT', playerId: 'p1' });
    const lowball = edit(game(3, {}, [1]), (c) => { c.owners[12] = 'p1'; c.owners[4] = 'p0'; });
    const o2 = act(lowball, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 10, tiles: [] }, get: { cash: 0, tiles: [12] } }).state;
    expect(nextBotMove(o2, rnd)).toEqual({ type: 'TRADE_REJECT', playerId: 'p1' });
  });

  it('nextBotMove waits for a human to answer a bot offer', () => {
    const s = edit(game(3, {}, [0]), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[10] = 'p1'; });
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 1200, tiles: [] }, get: { cash: 0, tiles: [10] } }).state;
    expect(nextBotMove(open, rnd)).toBeNull();
    expect(chooseBotAction(open, 'p1', rnd)).toMatchObject({ type: 'TRADE_REJECT' }); // a human proxy / auto-player still answers
  });

  it('a bot offers a human a fair-plus price for the tile that completes its colour (rarely, with a cooldown)', () => {
    const s = edit(game(3, {}, [0]), (c) => {
      c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[10] = 'p1';
      c.phase = 'manage';
      c.turnCount = 40;
    });
    const a = nextBotMove(s, rnd);
    expect(a).toEqual({ type: 'TRADE_OFFER', playerId: 'p0', to: 'p1', give: { cash: 1200, tiles: [] }, get: { cash: 0, tiles: [10] } });
    expect(ok(applyAction(s, a)).state.trade.id).toBe(1);
    expect(nextBotMove(s, () => 0.9)).toMatchObject({ type: 'END_TURN' });
    const cooling = edit(s, (c) => { c.players[0].lastOfferTurn = 38; });
    expect(nextBotMove(cooling, rnd)).toMatchObject({ type: 'END_TURN' });
    const toBot = edit(s, (c) => { c.players[1].isBot = true; });
    expect(nextBotMove(toBot, rnd)).toMatchObject({ type: 'END_TURN' }); // bots only court humans
  });

  it('a bot in debt mortgages the cheapest tile first, then pays', () => {
    const s = edit(game(3, {}, [0]), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 4;
      c.players[0].cash = 100;
      c.owners[1] = 'p0';
      c.owners[12] = 'p0';
      c.owners[27] = 'p0';
    });
    let st = ok(roll(s, 2, 4)).state; // owes 700; liquidation 250 + 600 + 2500
    expect(st.phase).toBe('debt');
    const first = nextBotMove(st, rnd);
    expect(first).toEqual({ type: 'MORTGAGE', playerId: 'p0', tile: 1 });
    st = ok(applyAction(st, first)).state;
    const second = nextBotMove(st, rnd);
    expect(second).toEqual({ type: 'MORTGAGE', playerId: 'p0', tile: 12 });
    st = ok(applyAction(st, second)).state;
    expect(nextBotMove(st, rnd)).toEqual({ type: 'PAY_DEBT', playerId: 'p0' });
  });

  it('a bot sells buildings only after nothing else can be mortgaged', () => {
    const s = edit(game(3, {}, [0]), (c) => {
      c.owners[27] = 'p1';
      c.levels[27] = 4;
      giveAll(c, 'west', 'p0', 1);
      c.players[0].cash = 0;
      c.players[0].pos = 21;
      for (const t of [3, 9]) c.owners[t] = 'p0';
    });
    // rent 5000 on Banjara; liquidation = levels 400 + mortgages (250+250+300+750+600) = 2550 < 5000 -> bankrupt, so lower it
    const small = edit(s, (c) => { c.levels[27] = 1; }); // rent 1000
    const st = ok(roll(small, 2, 4)).state;
    expect(st.phase).toBe('debt');
    const a = nextBotMove(st, rnd);
    expect(a.type).toBe('MORTGAGE');
    expect([3, 9]).toContain(a.tile); // the unbuilt colours first
  });

  it('a bot with a Get Out of Jail Free card uses it before paying bail; it lifts mortgages when rich', () => {
    const jailed = edit(game(3, {}, [0]), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = 1; c.players[0].jailCards = 1; });
    expect(nextBotMove(jailed, rnd)).toEqual({ type: 'USE_JAIL_CARD', playerId: 'p0' });
    const rich = edit(game(3, {}, [0]), (c) => { c.owners[6] = 'p0'; c.mortgaged[6] = true; });
    expect(nextBotMove(rich, rnd)).toEqual({ type: 'UNMORTGAGE', playerId: 'p0', tile: 6 });
    const poor = edit(rich, (c) => { c.players[0].cash = 900; });
    expect(nextBotMove(poor, rnd)).toMatchObject({ type: 'ROLL' });
  });

  it('whole bot games with a human proxy that accepts every offer stay legal', () => {
    for (const seed of [11, 12, 13, 14]) {
      let s = createGame({
        players: [{ id: 'h', isBot: false }, { id: 'b1', isBot: true }, { id: 'b2', isBot: true }],
        seed,
        settings: { goal: 40000, passStart: 2500 },
      });
      let steps = 0;
      while (s.phase !== 'over') {
        let a = nextBotMove(s, () => 0.3);
        if (!a) {
          const who = s.phase === 'debt' ? s.debt.player : s.trade ? s.trade.to : s.phase === 'auction' ? s.players.find((p) => !(p.id in s.pending.bids)).id : s.players[s.turn].id;
          a = s.trade && s.trade.to === 'h' ? { type: 'TRADE_ACCEPT', playerId: 'h' } : chooseBotAction(s, who, () => 0.3);
        }
        const res = applyAction(s, a);
        expect(res.error).toBeUndefined();
        s = res.state;
        if (++steps > 30000) throw new Error('did not finish');
      }
      expect(s.winner).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------- dice bookkeeping
describe('dice integration', () => {
  it('the dice event carries `assist`, and fair dice never assist', () => {
    const lucky = ok(roll(game(), 2, 3));
    expect(ofType(lucky.events, 'dice')[0]).toEqual({ type: 'dice', player: 'p0', values: [2, 3], assist: null });
    const real = ok(applyAction(createGame({ players: mkPlayers(3), seed: 5 }), { type: 'ROLL', playerId: 'p0' }));
    const ev = ofType(real.events, 'dice')[0];
    expect('assist' in ev).toBe(true);
    expect([null, 'comeback', 'mercy', 'pity', 'antibust']).toContain(ev.assist);
    const fair = createGame({ players: mkPlayers(3), seed: 5, settings: { dice: 'fair' } });
    expect(fair.cfg.dice).toBe('fair');
    for (let i = 0; i < 20; i++) {
      const r = applyAction(edit(fair, (c) => { c.rng = i * 977 + 1; }), { type: 'ROLL', playerId: 'p0' });
      expect(ofType(r.events, 'dice')[0].assist).toBeNull();
    }
  });

  it('rollsSinceDouble counts non-doubles (jail rolls included) and resets on a double', () => {
    let s = game(2, { jailTurns: 3 });
    s = ok(roll(s, 1, 2)).state; // lands on Metro: buy offer
    expect(s.players[0].rollsSinceDouble).toBe(1);
    const jailed = edit(game(2), (c) => { c.players[0].pos = 14; c.players[0].jailTurns = 1; c.players[0].rollsSinceDouble = 3; });
    expect(ok(roll(jailed, 1, 2)).state.players[0].rollsSinceDouble).toBe(4);
    const reset = ok(roll(edit(game(2), (c) => { c.players[0].rollsSinceDouble = 5; }), 2, 2)).state;
    expect(reset.players[0].rollsSinceDouble).toBe(0);
    expect(reset.players[0].doubles).toBe(1);
  });

  it('rentStreak counts consecutive turns with at least 1,000 rent paid, and resets otherwise', () => {
    // p1 owns Banjara at level 4 (rent 5000); p0 stands on 21 and rolls 2+4.
    const s = edit(game(), (c) => { c.owners[27] = 'p1'; c.levels[27] = 4; c.players[0].pos = 21; });
    const landed = ok(roll(s, 2, 4)).state;
    expect(landed.players[0].rentThisTurn).toBe(5000);
    const next = act(landed, 'p0', { type: 'END_TURN' }).state;
    expect(next.players[0].rentStreak).toBe(1);
    expect(next.players[0].rentThisTurn).toBe(0);
    const landedQuiet = ok(roll(edit(next, (c) => { c.turn = 0; c.phase = 'roll'; c.players[0].pos = 0; }), 2, 4)).state; // Kukatpally: unowned
    const quiet = act(landedQuiet, 'p0', { type: 'SKIP_BUY' }).state;
    const after = act(quiet, 'p0', { type: 'END_TURN' }).state;
    expect(after.players[0].rentStreak).toBe(0);
  });

  it('a lucky roll that used mercy clears rentStreak (one-roll effect)', () => {
    const s = edit(createGame({ players: mkPlayers(3), seed: 21 }), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 5; // rent 1050 on a roll of 6
      c.players[0].rentStreak = 2;
    });
    const r = ok(applyAction(s, { type: 'ROLL', playerId: 'p0' }));
    expect(r.state.players[0].rentStreak).toBe(0);
  });

  it('landingOdds / diceOdds accept the engine ctx and describe the same distribution', () => {
    const s = game();
    const odds = landingOdds(s, 'p0', diceCtx);
    expect(odds).toHaveLength(28);
    expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    const d = diceOdds(s, 'p0', diceCtx);
    expect(Object.values(d.totals).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});

// ---------------------------------------------------------------- settings
describe('settings (v2)', () => {
  it('normalises dice and auctionOnDecline', () => {
    expect(normalizeSettings({}).dice).toBe('lucky');
    expect(normalizeSettings({ dice: 'fair' }).dice).toBe('fair');
    expect(normalizeSettings({ dice: 'loaded' }).dice).toBe('lucky');
    expect(normalizeSettings({ dice: undefined }).dice).toBe('lucky');
    expect(normalizeSettings({}).auctionOnDecline).toBe(true);
    expect(normalizeSettings({ auctionOnDecline: false }).auctionOnDecline).toBe(false);
    expect(normalizeSettings({ auctionOnDecline: 'no' }).auctionOnDecline).toBe(true);
    expect(DEFAULT_SETTINGS.dice).toBe('lucky');
    expect(DEFAULT_SETTINGS.auctionOnDecline).toBe(true);
  });

  it('state has the v2 fields', () => {
    const s = createGame({ players: mkPlayers(2), seed: 1 });
    expect(s.mortgaged).toEqual(Array(28).fill(false));
    expect(s.trade).toBeNull();
    expect(s.debt).toBeNull();
    expect(s.players[0]).toMatchObject({ jailCards: 0, rollsSinceDouble: 0, rentStreak: 0 });
    expect(s.deck).toHaveLength(18);
  });
});
