// Rules v2 (CONTRACT 3c): set bonus, hotel, mortgage, debt, bankruptcy inheritance, auction on decline,
// jail card, trading, dice bookkeeping and the bots' side of all of it.
// Written against the 40-square Hyderabad board (shared/board.js): expected numbers come from the tile data
// and the board helpers, so a price / rent tweak does not break these tests.
// There is ONE die (1..6 squares per roll), so a test that needs a landing puts the player `d` squares behind the
// tile and rolls `d`. The snatch rule is off (`snatches: 0`) unless a test asks for it; shared/snatch.test.js covers it.
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, canUpgrade, previewRent, netWorth, nextBotMove, chooseBotAction, botSnatchAction,
  normalizeSettings, liquidationValue, diceCtx, landingOdds, diceOdds, KISMET, TILES, GROUP_TILES, MAX_LEVEL,
  rentFor, upgradeCost, mortgageValue, unmortgageCost, taxDue, DEFAULT_SETTINGS, DEFAULT_BOT,
  BOARD_SIZE, JAIL_TILE, START_CASH, SELL_RATIO,
} from './index.js';

// ---------------------------------------------------------------- helpers
const ids = ['p0', 'p1', 'p2', 'p3'];
const mkPlayers = (n, bots = []) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `P${i}`, avatar: i, isBot: bots.includes(i) }));
const game = (n = 3, settings = {}, bots = [], seed = 7) =>
  createGame({ players: mkPlayers(n, bots), seed, settings: { debug: true, snatches: 0, auctionOnDecline: false, ...settings } });
const edit = (s, fn) => {
  const c = structuredClone(s);
  fn(c);
  return c;
};
const me = (s) => s.players[s.turn].id;
const at = (s, pos, idx = 0) => edit(s, (c) => { c.players[idx].pos = pos; });
const roll = (s, d, pid) => applyAction(s, { type: 'ROLL', playerId: pid ?? me(s), dice: [d] });
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
const cardAmount = (cardId) => KISMET.find((c) => c.id === cardId).effect.amount;
const giveAll = (s, groupId, owner, level = 0) => {
  for (const t of GROUP_TILES[groupId]) {
    s.owners[t] = owner;
    s.levels[t] = level;
  }
};
const refundOf = (tileId) => upgradeCost(TILES[tileId]) * SELL_RATIO; // what the bank pays for one building level

// Kismet squares on the new board: Khazana 2 / 17 / 33, Farman 7 / 22 / 36 (one shared deck). 3 + 4 lands on Farman 7.

// ---------------------------------------------------------------- set bonus
describe('colour-set bonus', () => {
  it('level-0 rent: x1 for a single tile AND for 2 of 3, x2 only for the whole colour', () => {
    const one = edit(game(), (c) => { c.owners[6] = 'p1'; });
    expect(previewRent(one, 6)).toBe(rentFor(TILES[6], 0));
    const two = edit(one, (c) => { c.owners[8] = 'p1'; });
    expect(previewRent(two, 6)).toBe(rentFor(TILES[6], 0)); // no partial-set bonus any more
    expect(previewRent(two, 8)).toBe(rentFor(TILES[8], 0));
    const three = edit(two, (c) => { c.owners[9] = 'p1'; });
    expect(previewRent(three, 6)).toBe(rentFor(TILES[6], 0) * 2);
    expect(previewRent(three, 9)).toBe(Math.round(rentFor(TILES[9], 0) * 2));
  });

  it('a two-tile colour pays x2 only when both are owned', () => {
    const one = edit(game(), (c) => { c.owners[37] = 'p1'; });
    expect(previewRent(one, 37)).toBe(rentFor(TILES[37], 0));
    const both = edit(one, (c) => { c.owners[39] = 'p1'; });
    expect(previewRent(both, 37)).toBe(rentFor(TILES[37], 0) * 2);
    expect(previewRent(both, 39)).toBe(rentFor(TILES[39], 0) * 2);
  });

  it('built tiles use the plain ladder, no bonus', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p1', 1); });
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 1));
  });

  it('getOptions().sets lists the colours you hold a piece of', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[1] = 'p0'; c.owners[3] = 'p0'; });
    const sets = getOptions(s, 'p0').sets;
    expect(sets).toContainEqual({ group: 'lightblue', owned: 2, size: 3, multiplier: 1 }); // 2 of 3: no bonus yet
    expect(sets).toContainEqual({ group: 'brown', owned: 2, size: 2, multiplier: 2 });
    expect(sets).toHaveLength(2);
    expect(getOptions(s, 'p1').sets).toEqual([]);
  });

  it('emits set_complete when a purchase finishes a colour (after the own event)', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.players[0].pos = 5; });
    const landed = ok(roll(s, 4)); // 5 -> 9
    const bought = act(landed.state, 'p0', { type: 'BUY' });
    const types = bought.events.map((e) => e.type);
    expect(types).toEqual(['cash', 'own', 'set_complete']);
    expect(bought.events[2]).toEqual({ type: 'set_complete', player: 'p0', group: 'lightblue' });
  });
});

// ---------------------------------------------------------------- hotel
describe('hotel', () => {
  const lightblue = (level) => edit(game(), (c) => giveAll(c, 'lightblue', 'p0', level));

  it('needs the whole colour at level 4 first, then raises one tile at a time', () => {
    expect(MAX_LEVEL).toBe(5);
    const s = edit(lightblue(4), (c) => { c.levels[9] = 3; });
    expect(canUpgrade(s, 'p0', 6).reason).toMatch(/evenly/); // 6 is at 4 but the group minimum is 3
    expect(canUpgrade(s, 'p0', 9).ok).toBe(true);
    const ready = lightblue(4);
    const r = act(ready, 'p0', { type: 'UPGRADE', tile: 6 });
    expect(r.events[1]).toEqual({ type: 'level', tile: 6, level: 5, reason: 'upgrade' });
    expect(canUpgrade(r.state, 'p0', 6).reason).toMatch(/fully built/);
    expect(canUpgrade(r.state, 'p0', 8).ok).toBe(true); // the others may follow
  });

  it('hotel rent is the last entry of the rent table and counts in net worth at its full build cost', () => {
    const s = edit(lightblue(5), (c) => { c.players[0].cash = 0; });
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 5));
    expect(previewRent(s, 6)).toBe(TILES[6].rent[MAX_LEVEL]);
    expect(previewRent(s, 6)).toBeGreaterThan(rentFor(TILES[6], 4));
    const expected = GROUP_TILES.lightblue.reduce((sum, t) => sum + TILES[t].price + MAX_LEVEL * upgradeCost(TILES[t]), 0);
    expect(netWorth(s, 'p0')).toBe(expected);
  });

  it('does not allow a fifth upgrade beyond the hotel and refuses a mortgaged colour', () => {
    expect(canUpgrade(lightblue(5), 'p0', 6).ok).toBe(false);
    const m = edit(lightblue(0), (c) => { c.mortgaged[8] = true; });
    expect(canUpgrade(m, 'p0', 6).reason).toMatch(/Unmortgage/);
  });
});

// ---------------------------------------------------------------- tax tiles
describe('tax tiles', () => {
  it('GHMC takes the lower of the flat amount and 10% of net worth', () => {
    const ghmc = TILES[4];
    const modest = game(); // net worth is just the starting cash: 10% of it is under the flat cap
    const due = taxDue(ghmc, netWorth(modest, 'p0'));
    expect(due).toBeLessThan(ghmc.taxFlat);
    const paid = ok(roll(modest, 4)); // 0 -> 4
    expect(ofType(paid.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -due, reason: 'tax' }]);
    expect(paid.state.players[0].stats.taxPaid).toBe(due);

    const rich = edit(game(), (c) => { c.players[0].cash = 40000; });
    const capped = ok(roll(rich, 4));
    expect(ofType(capped.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -ghmc.taxFlat, reason: 'tax' }]);
  });

  it('the ORR toll is a flat amount whatever you own', () => {
    const toll = taxDue(TILES[38]);
    const s = edit(game(), (c) => { c.players[0].pos = 34; c.players[0].cash = 40000; });
    const r = ok(roll(s, 4)); // 34 -> 38
    expect(ofType(r.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -toll, reason: 'tax' }]);
  });
});

// ---------------------------------------------------------------- mortgage
describe('mortgage, unmortgage and selling buildings', () => {
  it('MORTGAGE pays the bank value, keeps net worth, and the tile collects no rent', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; });
    const before = netWorth(s, 'p0');
    const value = mortgageValue(TILES[6]);
    const r = act(s, 'p0', { type: 'MORTGAGE', tile: 6 });
    expect(r.events).toEqual([
      { type: 'mortgage', player: 'p0', tile: 6, value },
      { type: 'cash', player: 'p0', delta: value, reason: 'mortgage' },
    ]);
    expect(r.state.mortgaged[6]).toBe(true);
    expect(r.state.players[0].cash).toBe(START_CASH + value);
    expect(netWorth(r.state, 'p0')).toBe(before); // cash +value, tile counts price - value
    expect(previewRent(r.state, 6)).toBe(0);
    const visit = ok(roll(edit(r.state, (c) => { c.turn = 1; c.players[1].pos = 2; }), 4, 'p1')); // p1 lands on mortgaged 6
    expect(ofType(visit.events, 'cash')).toHaveLength(0);
  });

  it('refuses double mortgage, other players tiles, built colours and the wrong moment', () => {
    const s = edit(game(), (c) => { c.owners[6] = 'p0'; giveAll(c, 'brown', 'p0', 1); });
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 1 }).error).toMatch(/buildings/);
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p1', tile: 6 }).error).toBeTruthy();
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 8 }).error).toMatch(/do not own/);
    expect(applyAction(s, { type: 'MORTGAGE', playerId: 'p0', tile: 3 }).error).toBeTruthy();
    const done = act(s, 'p0', { type: 'MORTGAGE', tile: 6 }).state;
    expect(applyAction(done, { type: 'MORTGAGE', playerId: 'p0', tile: 6 }).error).toMatch(/Already/);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: TILES[12].price }; });
    expect(applyAction(buying, { type: 'MORTGAGE', playerId: 'p0', tile: 6 }).error).toBeTruthy();
  });

  it('UNMORTGAGE costs the value plus 10%, and the colour can be built again', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p0'); c.mortgaged[8] = true; });
    expect(canUpgrade(s, 'p0', 6).ok).toBe(false);
    const cost = unmortgageCost(TILES[8]);
    expect(cost).toBe(Math.round((mortgageValue(TILES[8]) * 1.1) / 10) * 10);
    expect(cost).toBeGreaterThan(mortgageValue(TILES[8]));
    expect(getOptions(s, 'p0').unmortgage).toEqual([{ tile: 8, cost }]);
    const r = act(s, 'p0', { type: 'UNMORTGAGE', tile: 8 });
    expect(r.events[0]).toEqual({ type: 'unmortgage', player: 'p0', tile: 8, cost });
    expect(r.state.mortgaged[8]).toBe(false);
    expect(r.state.players[0].cash).toBe(START_CASH - cost);
    expect(canUpgrade(r.state, 'p0', 6).ok).toBe(true);
    const poor = edit(s, (c) => { c.players[0].cash = cost - 10; });
    expect(applyAction(poor, { type: 'UNMORTGAGE', playerId: 'p0', tile: 8 }).error).toMatch(/Need/);
    expect(getOptions(poor, 'p0').unmortgage).toEqual([]);
  });

  it('a mortgaged tile still counts toward the colour-set bonus', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p1'); c.mortgaged[8] = true; });
    expect(previewRent(s, 6)).toBe(rentFor(TILES[6], 0) * 2);
    expect(previewRent(s, 8)).toBe(0);
  });

  it('SELL_BUILDING refunds half the build cost and follows the even-sell rule', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p0', 1); c.levels[6] = 2; });
    expect(applyAction(s, { type: 'SELL_BUILDING', playerId: 'p0', tile: 8 }).error).toMatch(/evenly/);
    expect(getOptions(s, 'p0').sellBuilding).toEqual([{ tile: 6, refund: refundOf(6) }]);
    const r = act(s, 'p0', { type: 'SELL_BUILDING', tile: 6 });
    expect(r.events).toEqual([
      { type: 'level', tile: 6, level: 1, reason: 'sell' },
      { type: 'cash', player: 'p0', delta: refundOf(6), reason: 'sell' },
    ]);
    expect(r.state.levels[6]).toBe(1);
    expect(applyAction(edit(s, (c) => { c.levels[9] = 0; c.levels[6] = 0; c.levels[8] = 0; }), { type: 'SELL_BUILDING', playerId: 'p0', tile: 6 }).error).toMatch(/Nothing built/);
  });

  it('liquidationValue adds building refunds and mortgage values', () => {
    const s = edit(game(), (c) => { giveAll(c, 'lightblue', 'p0', 2); c.owners[12] = 'p0'; c.mortgaged[12] = true; });
    const refunds = 2 * (refundOf(6) + refundOf(8) + refundOf(9));
    const mortgages = mortgageValue(TILES[6]) + mortgageValue(TILES[8]) + mortgageValue(TILES[9]); // 12 is already mortgaged
    expect(liquidationValue(s, 'p0')).toBe(refunds + mortgages);
  });
});

// ---------------------------------------------------------------- debt
describe('debt phase', () => {
  // p1 owns Koti (6) at level 1; p0 (cash 100, owns TGSPDCL 12, mortgageable for its bank value) stands on 3 and rolls 3 onto it.
  const RENT = rentFor(TILES[6], 1);
  const MORT = mortgageValue(TILES[12]);
  const owing = (extra = () => {}) => edit(game(), (c) => {
    c.owners[6] = 'p1';
    c.levels[6] = 1;
    c.players[0].cash = 100;
    c.players[0].pos = 3;
    c.owners[12] = 'p0';
    extra(c);
  });

  it('opens when cash + liquidation value can cover the payment, instead of selling silently', () => {
    expect(100).toBeLessThan(RENT); // cash alone cannot pay...
    expect(100 + MORT).toBeGreaterThanOrEqual(RENT); // ...but the mortgage can
    const r = ok(roll(owing(), 3));
    expect(r.state.phase).toBe('debt');
    expect(r.state.debt).toMatchObject({ player: 'p0', amount: RENT, creditor: 'p1', reason: 'rent' });
    expect(ofType(r.events, 'debt')).toEqual([{ type: 'debt', player: 'p0', amount: RENT, creditor: 'p1' }]);
    expect(r.state.owners[12]).toBe('p0'); // nothing was sold
    expect(r.state.players[0].cash).toBe(100);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
  });

  it('getOptions: only the debtor can act, with mortgage / sellBuilding / payDebt', () => {
    const s = ok(roll(owing(), 3)).state;
    const o = getOptions(s, 'p0');
    expect(o).toMatchObject({ roll: false, endTurn: false, buy: false, payDebt: false, resign: true });
    expect(o.debt).toEqual({ amount: RENT, creditor: 'p1', shortfall: RENT - 100 });
    expect(o.mortgage).toEqual([{ tile: 12, value: MORT }]);
    const other = getOptions(s, 'p1');
    expect(other).toMatchObject({ roll: false, debt: null, payDebt: false, mortgage: [] });
    expect(applyAction(s, { type: 'ROLL', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(s, { type: 'END_TURN', playerId: 'p0' }).error).toBeTruthy();
    expect(applyAction(s, { type: 'PAY_DEBT', playerId: 'p1' }).error).toBeTruthy();
  });

  it('PAY_DEBT is only valid once cash covers it; then the turn carries on', () => {
    let s = ok(roll(owing(), 3)).state;
    expect(applyAction(s, { type: 'PAY_DEBT', playerId: 'p0' }).error).toMatch(/Raise/);
    s = act(s, 'p0', { type: 'MORTGAGE', tile: 12 }).state;
    expect(s.phase).toBe('debt');
    expect(getOptions(s, 'p0').payDebt).toBe(true);
    const r = act(s, 'p0', { type: 'PAY_DEBT' });
    expect(r.events).toEqual([
      { type: 'cash', player: 'p0', delta: -RENT, reason: 'rent', other: 'p1' },
      { type: 'cash', player: 'p1', delta: RENT, reason: 'rent', other: 'p0' },
    ]);
    expect(r.state.phase).toBe('manage');
    expect(r.state.debt).toBeNull();
    expect(r.state.players[0].cash).toBe(100 + MORT - RENT);
    expect(r.state.players[0].stats.rentPaid).toBe(RENT);
    expect(getOptions(r.state, 'p0').endTurn).toBe(true);
  });

  it('keeps the extra roll when the debt came from a six', () => {
    const s = edit(owing(), (c) => { c.players[0].pos = 0; });
    let r = ok(roll(s, 6)); // 0 -> 6 on a six
    expect(r.state.phase).toBe('debt');
    r = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p0', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.extraRoll).toBe(true);
    expect(getOptions(r.state, 'p0').roll).toBe(true);
  });

  it('tax debts go to the bank (no creditor)', () => {
    const toll = taxDue(TILES[38]); // ORR toll: a flat amount
    const s = edit(game(), (c) => { c.players[0].cash = 0; c.players[0].pos = 34; c.owners[12] = 'p0'; c.owners[13] = 'p0'; });
    const r = ok(roll(s, 4)); // 34 -> 38, ORR toll
    expect(r.state.debt).toMatchObject({ amount: toll, creditor: null, reason: 'tax' });
    let t = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 }).state;
    t = act(t, 'p0', { type: 'MORTGAGE', tile: 13 }).state; // both together cover the toll
    const done = act(t, 'p0', { type: 'PAY_DEBT' });
    expect(ofType(done.events, 'cash')).toEqual([{ type: 'cash', player: 'p0', delta: -toll, reason: 'tax' }]);
    expect(done.state.players[0].stats.taxPaid).toBe(toll);
  });

  it('a payment that even full liquidation cannot cover bankrupts the debtor to the creditor', () => {
    const s = edit(game(), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 4;
      c.players[0].pos = 3;
      c.players[0].cash = 100;
      c.owners[1] = 'p0'; // 100 + its mortgage value is still well short of the rent
      c.mortgaged[1] = false;
    });
    expect(100 + mortgageValue(TILES[1])).toBeLessThan(rentFor(TILES[6], 4));
    const r = ok(roll(s, 3));
    expect(r.state.players[0]).toMatchObject({ bankrupt: true, cash: 0 });
    expect(r.state.owners[1]).toBe('p1'); // the creditor inherits the property
    expect(r.state.players[1].cash).toBe(START_CASH + 100);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 1, owner: 'p1', reason: 'bankrupt' }]);
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'turn')[0]).toMatchObject({ player: 'p1' });
    expect(r.events.map((e) => e.type)).toContain('bankrupt');
  });

  it('bankruptcy sells buildings to the bank first, hands cash and every property to the creditor, mortgages stay', () => {
    const s = edit(game(), (c) => {
      c.owners[27] = 'p1';
      c.levels[27] = 4; // far more rent than p0 can raise
      giveAll(c, 'brown', 'p0', 1);
      c.owners[5] = 'p0'; // a station that is already mortgaged
      c.mortgaged[5] = true;
      c.players[0].cash = 0;
      c.players[0].pos = 23;
    });
    const r = ok(roll(s, 4)); // 23 -> 27
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(ofType(r.events, 'level').map((e) => [e.tile, e.level, e.reason]).sort()).toEqual([[1, 0, 'bankrupt'], [3, 0, 'bankrupt']]);
    expect(r.state.players[1].cash).toBe(START_CASH + refundOf(1) + refundOf(3)); // the building refunds
    expect([1, 3, 5].every((t) => r.state.owners[t] === 'p1')).toBe(true);
    expect(r.state.mortgaged[5]).toBe(true);
    expect(r.state.levels.every((l, i) => i === 27 || l === 0)).toBe(true);
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p1', group: 'brown' }]);
  });

  it('bankruptcy to the bank (tax, cards) returns everything unowned and unmortgaged', () => {
    const s = edit(game(), (c) => {
      c.players[0].cash = 0;
      c.players[0].pos = 34;
      c.owners[1] = 'p0';
      c.mortgaged[1] = true;
    });
    const r = ok(roll(s, 4)); // 34 -> 38 ORR toll, and the only tile is already mortgaged: nothing to liquidate
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(r.state.owners[1]).toBeNull();
    expect(r.state.mortgaged[1]).toBe(false);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 1, owner: null, reason: 'bankrupt' }]);
  });

  it('resigning during a debt is bankruptcy to the creditor', () => {
    const s = ok(roll(owing(), 3)).state;
    const r = act(s, 'p0', { type: 'RESIGN' });
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(r.state.owners[12]).toBe('p1');
    expect(r.state.debt).toBeNull();
    expect(r.state.phase).toBe('roll');
    expect(r.state.turn).toBe(1);
  });

  it('the Biryani Delay (pay everyone) pauses on the first debt and resumes with the rest', () => {
    const owed = cardAmount('biryani_late');
    const s = edit(game(), (c) => { rig(c, 'biryani_late'); c.players[0].cash = 300; c.owners[12] = 'p0'; });
    expect(300).toBeLessThan(owed); // cannot pay the first player from cash...
    expect(300 + MORT).toBeGreaterThanOrEqual(2 * owed); // ...but one mortgage settles both payments
    let r = ok(roll(at(s, 3), 4)); // 3 -> 7 (Farman), draws the card
    expect(r.state.phase).toBe('debt');
    expect(r.state.debt).toMatchObject({ player: 'p0', amount: owed, creditor: 'p1', reason: 'card' });
    expect(r.state.debt.rest).toEqual([{ from: 'p0', to: 'p2', amount: owed, reason: 'card' }]);
    r = act(r.state, 'p0', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p0', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.players.map((p) => p.cash)).toEqual([300 + MORT - 2 * owed, START_CASH + owed, START_CASH + owed]);
  });

  it('a poor payer in a Birthday card can settle a debt even though it is not their turn', () => {
    const each = cardAmount('birthday');
    const s = edit(game(), (c) => { rig(c, 'birthday'); c.players[1].cash = 0; c.owners[12] = 'p1'; });
    let r = ok(roll(at(s, 3), 4)); // 3 -> 7 (Farman)
    expect(r.state.debt).toMatchObject({ player: 'p1', amount: each, creditor: 'p0' });
    expect(getOptions(r.state, 'p1').mortgage).toEqual([{ tile: 12, value: MORT }]);
    expect(getOptions(r.state, 'p0').roll).toBe(false);
    r = act(r.state, 'p1', { type: 'MORTGAGE', tile: 12 });
    r = act(r.state, 'p1', { type: 'PAY_DEBT' });
    expect(r.state.phase).toBe('manage');
    expect(r.state.turn).toBe(0);
    expect(r.state.players.map((p) => p.cash)).toEqual([START_CASH + 2 * each, MORT - each, START_CASH - each]);
  });
});

// ---------------------------------------------------------------- auction on decline
describe('auction on decline', () => {
  const minBidFor = (tileId) => Math.max(10, Math.round((TILES[tileId].price * 0.1) / 10) * 10); // 10% of the price
  const declined = (settings = {}) => {
    const s = game(3, { auctionOnDecline: true, ...settings });
    const landed = ok(roll(at(s, 3), 3)); // 3 -> Koti (6)
    return act(landed.state, 'p0', { type: 'SKIP_BUY' });
  };

  it('SKIP_BUY opens a sealed auction for the same tile at 10% of the price', () => {
    const min = minBidFor(6);
    const r = declined();
    expect(r.state.phase).toBe('auction');
    expect(r.state.pending).toEqual({ type: 'auction', tile: 6, minBid: min, bids: {} });
    expect(r.events).toEqual([{ type: 'auction_start', tile: 6, minBid: min }]);
    expect(getOptions(r.state, 'p0').bid).toEqual({ tile: 6, min, max: START_CASH }); // the decliner may bid too
  });

  it('the highest bidder buys it; if everyone passes it stays unowned', () => {
    const min = minBidFor(6);
    let r = declined();
    r = act(r.state, 'p0', { type: 'BID', amount: 0 });
    r = act(r.state, 'p1', { type: 'BID', amount: min + 50 });
    r = act(r.state, 'p2', { type: 'BID', amount: min + 40 });
    expect(r.events.find((e) => e.type === 'auction_end')).toMatchObject({ tile: 6, winner: 'p1', amount: min + 50 });
    expect(r.state.owners[6]).toBe('p1');
    expect(r.state.phase).toBe('manage');
    let none = declined();
    for (const id of ['p0', 'p1', 'p2']) none = act(none.state, id, { type: 'BID', amount: 0 });
    expect(none.state.owners[6]).toBeNull();
    expect(none.events.find((e) => e.type === 'auction_end').winner).toBeNull();
  });

  it('the minimum bid is at least 10 and tracks the price', () => {
    const t = edit(game(3, { auctionOnDecline: true }), (c) => { c.players[0].pos = 34; });
    const k = act(ok(roll(t, 5)).state, 'p0', { type: 'SKIP_BUY' }); // Financial District, the dearest tile
    expect(k.state.pending.tile).toBe(39);
    expect(k.state.pending.minBid).toBe(minBidFor(39));
    expect(k.state.pending.minBid).toBeGreaterThan(minBidFor(6));
    expect(k.state.pending.minBid).toBeGreaterThanOrEqual(10);
  });

  it('can be switched off with cfg.auctionOnDecline = false', () => {
    const s = game(3, { auctionOnDecline: false });
    const r = act(ok(roll(at(s, 3), 3)).state, 'p0', { type: 'SKIP_BUY' });
    expect(r.state.phase).toBe('manage');
    expect(r.events).toEqual([]);
  });

  it('keeps the six extra roll after the auction', () => {
    const s = game(3, { auctionOnDecline: true });
    let r = ok(roll(s, 6)); // 0 -> 6 on a six
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
    const r = ok(roll(at(s, 3), 4)); // 3 -> 7 (Farman)
    expect(ofType(r.events, 'card')[0]).toMatchObject({ cardId: 'jail_free', kind: 'good' });
    expect(r.state.players[0].jailCards).toBe(1);
    expect(r.state.phase).toBe('manage');
  });

  it('USE_JAIL_CARD frees you before rolling and returns the card to the deck', () => {
    const idx = KISMET.findIndex((c) => c.id === 'jail_free');
    const s = edit(game(), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; c.players[0].jailCards = 1; });
    expect(getOptions(s, 'p0')).toMatchObject({ useJailCard: true, roll: true });
    const r = act(s, 'p0', { type: 'USE_JAIL_CARD' });
    expect(r.events).toEqual([{ type: 'jail', player: 'p0', jailed: false, reason: 'card_used' }]);
    expect(r.state.players[0]).toMatchObject({ jailTurns: 0, jailCards: 0 });
    expect(r.state.deck.at(-1)).toBe(idx);
    expect(r.state.phase).toBe('roll');
    expect(ok(roll(r.state, 5)).state.players[0].pos).toBe(JAIL_TILE + 5);
  });

  it('is refused without a card or when not jailed', () => {
    const jailedNoCard = edit(game(), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; });
    expect(applyAction(jailedNoCard, { type: 'USE_JAIL_CARD', playerId: 'p0' }).error).toMatch(/no Get Out/);
    expect(getOptions(jailedNoCard, 'p0').useJailCard).toBe(false);
    const free = edit(game(), (c) => { c.players[0].jailCards = 1; });
    expect(applyAction(free, { type: 'USE_JAIL_CARD', playerId: 'p0' }).error).toMatch(/not in jail/);
  });

  it('a held card is left out of the reshuffle and a bankrupt player returns it', () => {
    const idx = KISMET.findIndex((c) => c.id === 'jail_free');
    const held = edit(game(), (c) => { c.deckPos = c.deck.length; c.players[1].jailCards = 1; });
    const r = ok(roll(at(held, 3), 4)); // 3 -> 7 (Farman): the exhausted deck reshuffles without the held card
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
  // p0 owns Dilsukhnagar (1) and Abids (8); p1 owns Malakpet (3) and Koti (6).
  const base = () => edit(game(), (c) => { c.owners[1] = 'p0'; c.owners[8] = 'p0'; c.owners[3] = 'p1'; c.owners[6] = 'p1'; });
  const swap = { give: { cash: 100, tiles: [] }, get: { cash: 0, tiles: [3] } };

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
    expect(offer(s, { give: { cash: 0, tiles: [3] } }).error).toMatch(/do not own/);
    expect(offer(s, { get: { cash: 0, tiles: [1] } }).error).toMatch(/does not own/);
    expect(offer(s, { give: { cash: 0, tiles: [0] } }).error).toBeTruthy(); // START is not tradeable
    expect(offer(s, { give: { cash: 0, tiles: [4] } }).error).toBeTruthy(); // neither is a tax square
    expect(offer(s, { give: { cash: -5, tiles: [] } }).error).toBeTruthy();
    expect(offer(s, { give: { cash: 1.5, tiles: [] } }).error).toBeTruthy();
    expect(offer(s, { give: { cash: 0, tiles: [1, 1] } }).error).toBeTruthy();
    expect(applyAction(s, { type: 'TRADE_OFFER', playerId: 'p1', to: 'p0', give: { cash: 5 }, get: {} }).error).toMatch(/Not your turn/);
    const built = edit(s, (c) => { giveAll(c, 'brown', 'p0', 1); });
    expect(offer(built, { give: { cash: 0, tiles: [1] } }).error).toMatch(/buildings/);
    const buying = edit(s, (c) => { c.phase = 'buy'; c.pending = { type: 'buy', tile: 12, price: TILES[12].price }; });
    expect(offer(buying, swap).error).toBeTruthy();
    const mid = edit(s, (c) => { c.phase = 'manage'; });
    expect(offer(mid, swap).error).toBeUndefined();
  });

  it('TRADE_ACCEPT swaps cash and tiles, emits trade_done + cash + own + set_complete', () => {
    const open = ok(offer(base(), { give: { cash: 300, tiles: [] }, get: { cash: 50, tiles: [3] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    expect(r.events[0]).toMatchObject({ type: 'trade_done', id: 1, from: 'p0', to: 'p1' });
    expect(ofType(r.events, 'cash')).toEqual([
      { type: 'cash', player: 'p0', delta: -300, reason: 'trade', other: 'p1' },
      { type: 'cash', player: 'p1', delta: 300, reason: 'trade', other: 'p0' },
      { type: 'cash', player: 'p1', delta: -50, reason: 'trade', other: 'p0' },
      { type: 'cash', player: 'p0', delta: 50, reason: 'trade', other: 'p1' },
    ]);
    expect(ofType(r.events, 'own')).toEqual([{ type: 'own', tile: 3, owner: 'p0', reason: 'trade' }]);
    expect(ofType(r.events, 'set_complete')).toEqual([{ type: 'set_complete', player: 'p0', group: 'brown' }]);
    expect(r.state.owners[3]).toBe('p0');
    expect(r.state.trade).toBeNull();
    expect(r.state.players[0].cash).toBe(START_CASH - 250);
    expect(r.state.players[1].cash).toBe(START_CASH + 250);
    expect(getOptions(r.state, 'p0').roll).toBe(true); // back to the turn
  });

  it('tiles given away keep their mortgage, and tile-for-tile swaps work', () => {
    const s = edit(base(), (c) => { c.mortgaged[1] = true; });
    const open = ok(offer(s, { give: { cash: 0, tiles: [1] }, get: { cash: 0, tiles: [6] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    expect(r.state.owners[1]).toBe('p1');
    expect(r.state.owners[6]).toBe('p0');
    expect(r.state.mortgaged[1]).toBe(true);
    // Malakpet + the mortgaged Dilsukhnagar at price - mortgage value
    expect(netWorth(r.state, 'p1')).toBe(START_CASH + TILES[3].price + (TILES[1].price - mortgageValue(TILES[1])));
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
    const s = edit(game(), (c) => { c.owners[1] = 'p0'; c.owners[3] = 'p1'; c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[9] = 'p1'; });
    const open = ok(offer(s, { give: { cash: 0, tiles: [6, 8] }, get: { cash: 0, tiles: [3] } })).state;
    const r = act(open, 'p1', { type: 'TRADE_ACCEPT' });
    const sets = ofType(r.events, 'set_complete');
    expect(sets).toContainEqual({ type: 'set_complete', player: 'p0', group: 'brown' });
    expect(sets).toContainEqual({ type: 'set_complete', player: 'p1', group: 'lightblue' });
  });
});

// ---------------------------------------------------------------- bots and the new rules
describe('bots (rules v2)', () => {
  const rnd = () => 0.1;

  it('bot answers a trade offer that completes its colour with ACCEPT', () => {
    const s = edit(game(3, {}, [1]), (c) => { c.owners[1] = 'p1'; c.owners[3] = 'p0'; });
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 0, tiles: [3] }, get: { cash: 0, tiles: [] } }).state;
    expect(nextBotMove(open, rnd)).toEqual({ type: 'TRADE_ACCEPT', playerId: 'p1' });
  });

  it('bot never breaks a colour it owns in full, and rejects bad prices', () => {
    const s = edit(game(3, {}, [1]), (c) => { giveAll(c, 'lightblue', 'p1'); c.owners[3] = 'p0'; });
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 5000, tiles: [] }, get: { cash: 0, tiles: [6] } }).state;
    expect(nextBotMove(open, rnd)).toEqual({ type: 'TRADE_REJECT', playerId: 'p1' });
    const lowball = edit(game(3, {}, [1]), (c) => { c.owners[12] = 'p1'; c.owners[3] = 'p0'; });
    const o2 = act(lowball, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: 10, tiles: [] }, get: { cash: 0, tiles: [12] } }).state;
    expect(nextBotMove(o2, rnd)).toEqual({ type: 'TRADE_REJECT', playerId: 'p1' });
  });

  it('nextBotMove waits for a human to answer a bot offer', () => {
    const s = edit(game(3, {}, [0]), (c) => { c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[9] = 'p1'; });
    const offerCash = Math.round((TILES[9].price * 1.5) / 10) * 10;
    const open = act(s, 'p0', { type: 'TRADE_OFFER', to: 'p1', give: { cash: offerCash, tiles: [] }, get: { cash: 0, tiles: [9] } }).state;
    expect(nextBotMove(open, rnd)).toBeNull();
    expect(chooseBotAction(open, 'p1', rnd)).toMatchObject({ type: 'TRADE_REJECT' }); // a human proxy / auto-player still answers
  });

  it('a bot offers a human a fair-plus price for the tile that completes its colour (rarely, with a cooldown)', () => {
    const s = edit(game(3, {}, [0]), (c) => {
      c.owners[6] = 'p0'; c.owners[8] = 'p0'; c.owners[9] = 'p1';
      c.phase = 'manage';
      c.turnCount = 40;
    });
    const a = nextBotMove(s, rnd);
    expect(a).toMatchObject({ type: 'TRADE_OFFER', playerId: 'p0', to: 'p1', give: { tiles: [] }, get: { cash: 0, tiles: [9] } });
    expect(a.give.cash).toBeGreaterThan(TILES[9].price); // fair-plus: above face value
    expect(ok(applyAction(s, a)).state.trade.id).toBe(1);
    expect(nextBotMove(s, () => 0.9)).toMatchObject({ type: 'END_TURN' });
    const cooling = edit(s, (c) => { c.players[0].lastOfferTurn = 38; });
    expect(nextBotMove(cooling, rnd)).toMatchObject({ type: 'END_TURN' });
    const toBot = edit(s, (c) => { c.players[1].isBot = true; });
    expect(nextBotMove(toBot, rnd)).toMatchObject({ type: 'END_TURN' }); // bots only court humans
  });

  it('a bot in debt mortgages the cheapest tile first, then pays', () => {
    const rent = rentFor(TILES[6], 2);
    const s = edit(game(3, {}, [0]), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 2;
      c.players[0].cash = 100;
      c.owners[1] = 'p0';
      c.owners[12] = 'p0';
      c.owners[39] = 'p0';
    });
    // the two cheapest mortgages (1, then 12) cover the rent; the dear tile 39 is left alone
    expect(100 + mortgageValue(TILES[1])).toBeLessThan(rent);
    expect(100 + mortgageValue(TILES[1]) + mortgageValue(TILES[12])).toBeGreaterThanOrEqual(rent);
    let st = ok(roll(at(s, 3), 3)).state;
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
      giveAll(c, 'brown', 'p0', 1);
      c.players[0].cash = 0;
      c.players[0].pos = 23;
      for (const t of [5, 11]) c.owners[t] = 'p0';
    });
    // a level-4 Gachibowli is more than p0 can raise (bankrupt), so lower it to a level-1 rent that the liquidation covers
    const small = edit(s, (c) => { c.levels[27] = 1; });
    const st = ok(roll(small, 4)).state;
    expect(st.phase).toBe('debt');
    const a = nextBotMove(st, rnd);
    expect(a.type).toBe('MORTGAGE');
    expect([5, 11]).toContain(a.tile); // the unbuilt colours first
  });

  it('a bot with a Get Out of Jail Free card uses it before paying bail; it lifts mortgages when rich', () => {
    const jailed = edit(game(3, {}, [0]), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; c.players[0].jailCards = 1; });
    expect(nextBotMove(jailed, rnd)).toEqual({ type: 'USE_JAIL_CARD', playerId: 'p0' });
    const rich = edit(game(3, {}, [0]), (c) => { c.owners[6] = 'p0'; c.mortgaged[6] = true; });
    expect(nextBotMove(rich, rnd)).toEqual({ type: 'UNMORTGAGE', playerId: 'p0', tile: 6 });
    // can afford the lift but would drop below twice the bot's reserve
    const poor = edit(rich, (c) => { c.players[0].cash = unmortgageCost(TILES[6]) + DEFAULT_BOT.reserve; });
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
        let a = s.phase === 'snatch'
          ? (s.pending.eligible.map((id) => botSnatchAction(s, id)).find(Boolean) || { type: 'SNATCH_CLOSE' })
          : nextBotMove(s, () => 0.3);
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
    const lucky = ok(roll(game(), 3));
    expect(ofType(lucky.events, 'dice')[0]).toEqual({ type: 'dice', player: 'p0', values: [3], assist: null });
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

  it('rollsSinceSix counts rolls without a six (jail rolls included) and resets on a six', () => {
    let s = game(2, { jailTurns: 3 });
    s = ok(roll(s, 3)).state; // lands on Malakpet: buy offer
    expect(s.players[0].rollsSinceSix).toBe(1);
    const jailed = edit(game(2), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; c.players[0].rollsSinceSix = 3; });
    expect(ok(roll(jailed, 2)).state.players[0].rollsSinceSix).toBe(4);
    const reset = ok(roll(edit(game(2), (c) => { c.players[0].rollsSinceSix = 5; }), 6)).state;
    expect(reset.players[0].rollsSinceSix).toBe(0);
    expect(reset.players[0].sixes).toBe(1);
  });

  it('rentStreak counts consecutive turns with at least 1,000 rent paid, and resets otherwise', () => {
    // p1 owns Gachibowli (27) at level 4; p0 stands on 23 and rolls 4.
    const rent = rentFor(TILES[27], 4);
    expect(rent).toBeGreaterThanOrEqual(1000);
    const s = edit(game(), (c) => { c.owners[27] = 'p1'; c.levels[27] = 4; c.players[0].pos = 23; });
    const landed = ok(roll(s, 4)).state;
    expect(landed.players[0].rentThisTurn).toBe(rent);
    const next = act(landed, 'p0', { type: 'END_TURN' }).state;
    expect(next.players[0].rentStreak).toBe(1);
    expect(next.players[0].rentThisTurn).toBe(0);
    const landedQuiet = ok(roll(edit(next, (c) => { c.turn = 0; c.phase = 'roll'; c.players[0].pos = 3; }), 3)).state; // Koti: unowned
    const quiet = act(landedQuiet, 'p0', { type: 'SKIP_BUY' }).state;
    const after = act(quiet, 'p0', { type: 'END_TURN' }).state;
    expect(after.players[0].rentStreak).toBe(0);
  });

  it('a lucky roll that used mercy clears rentStreak (one-roll effect)', () => {
    const s = edit(createGame({ players: mkPlayers(3), seed: 21 }), (c) => {
      c.owners[6] = 'p1';
      c.levels[6] = 5; // hotel rent on a roll of 6, well above the mercy threshold
      c.players[0].rentStreak = 2;
    });
    const r = ok(applyAction(s, { type: 'ROLL', playerId: 'p0' }));
    expect(r.state.players[0].rentStreak).toBe(0);
  });

  it('landingOdds / diceOdds accept the engine ctx and describe the same distribution', () => {
    const s = game();
    const odds = landingOdds(s, 'p0', diceCtx);
    expect(odds).toHaveLength(BOARD_SIZE);
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
    expect(s.mortgaged).toEqual(Array(BOARD_SIZE).fill(false));
    expect(s.trade).toBeNull();
    expect(s.debt).toBeNull();
    expect(s.players[0]).toMatchObject({ jailCards: 0, rollsSinceSix: 0, sixes: 0, snatches: 1, rentStreak: 0 });
    expect(s.dice).toEqual([0]);
    expect(s.deck).toHaveLength(KISMET.length);
  });
});
