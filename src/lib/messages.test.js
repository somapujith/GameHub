import { describe, it, expect } from 'vitest';
import { describeEvent } from './messages.js';

const ctx = {
  me: 'me',
  players: [{ id: 'me', name: 'Nithin' }, { id: 'b1', name: 'Chai Uncle' }],
  owners: Array(28).fill(null),
  round: 3,
  maxRounds: 30,
};

describe('describeEvent', () => {
  it('describes dice for me and for others', () => {
    expect(describeEvent({ type: 'dice', player: 'me', values: [4, 3] }, ctx).text).toBe('You rolled 4 + 3');
    const d = describeEvent({ type: 'dice', player: 'b1', values: [2, 2] }, ctx);
    expect(d.text).toBe('Chai Uncle rolled 2 + 2: doubles!');
    expect(d.icon).toBe('🎲');
  });

  it('describes rent once (paying half only) with INR formatting', () => {
    const pay = describeEvent({ type: 'cash', player: 'me', delta: -1200, reason: 'rent', other: 'b1' }, ctx);
    expect(pay.text).toBe('You paid ₹1,200 rent to Chai Uncle');
    expect(pay.tone).toBe('bad');
    expect(describeEvent({ type: 'cash', player: 'b1', delta: 1200, reason: 'rent', other: 'me' }, ctx)).toBeNull();
    const botPaysMe = describeEvent({ type: 'cash', player: 'b1', delta: -800, reason: 'rent', other: 'me' }, ctx);
    expect(botPaysMe.text).toBe('Chai Uncle paid ₹800 rent to You');
    expect(botPaysMe.tone).toBe('good');
  });

  it('covers salary, tax, film, bail, bazaar', () => {
    expect(describeEvent({ type: 'cash', player: 'me', delta: 1500, reason: 'salary' }, ctx).text).toContain('₹1,500 salary');
    expect(describeEvent({ type: 'cash', player: 'me', delta: -1000, reason: 'tax' }, ctx).text).toContain('property tax');
    expect(describeEvent({ type: 'cash', player: 'me', delta: 800, reason: 'film' }, ctx).tone).toBe('good');
    expect(describeEvent({ type: 'cash', player: 'me', delta: -500, reason: 'bail' }, ctx).text).toContain('bail');
    expect(describeEvent({ type: 'cash', player: 'me', delta: 500, reason: 'bazaar' }, ctx).text).toContain('bonus');
    expect(describeEvent({ type: 'cash', player: 'me', delta: -500, reason: 'buy' }, ctx)).toBeNull();
  });

  it('describes buying, liquidation and upgrades with tile names', () => {
    expect(describeEvent({ type: 'own', tile: 27, owner: 'me', reason: 'buy' }, ctx).text).toBe('You bought Banjara Hills for ₹5,000');
    const owners = Array(28).fill(null);
    owners[12] = 'b1';
    const liq = describeEvent({ type: 'own', tile: 12, owner: null, reason: 'liquidate' }, { ...ctx, owners });
    expect(liq.text).toBe('Chai Uncle sold Ameerpet to pay a debt');
    owners[1] = 'me';
    const up = describeEvent({ type: 'level', tile: 1, level: 1, reason: 'upgrade' }, { ...ctx, owners });
    expect(up.text).toBe('You upgraded Miyapur to a Kirana shop');
    expect(describeEvent({ type: 'level', tile: 1, level: 4, reason: 'upgrade' }, { ...ctx, owners }).text).toBe('You upgraded Miyapur to a Tower');
    const hotel = describeEvent({ type: 'level', tile: 1, level: 5, reason: 'upgrade' }, { ...ctx, owners });
    expect(hotel.text).toBe('You built a Hotel on Miyapur!');
    expect(hotel.tone).toBe('cheer');
    expect(describeEvent({ type: 'level', tile: 1, level: 2, reason: 'upgrade' }, { ...ctx, owners }).text).toBe('You upgraded Miyapur to Apartments');
    const sell = describeEvent({ type: 'level', tile: 1, level: 3, reason: 'sell' }, { ...ctx, owners });
    expect(sell.text).toBe('You sold a Tower on Miyapur (now a Mall)');
    expect(sell.tone).toBe('warn');
  });

  it('describes mortgages, set completion, debt and the jail card', () => {
    expect(describeEvent({ type: 'mortgage', player: 'me', tile: 27, value: 2500 }, ctx).text).toBe('You mortgaged Banjara Hills for ₹2,500');
    expect(describeEvent({ type: 'unmortgage', player: 'b1', tile: 27, cost: 2750 }, ctx).text).toBe('Chai Uncle paid ₹2,750 to unmortgage Banjara Hills');
    expect(describeEvent({ type: 'set_complete', player: 'me', group: 'elite' }, ctx)).toMatchObject({ text: 'You completed the Elite Hills set!', tone: 'cheer' });
    expect(describeEvent({ type: 'debt', player: 'me', amount: 3000, creditor: 'b1' }, ctx).text).toBe('You owe ₹3,000 to Chai Uncle. Raise cash or resign!');
    expect(describeEvent({ type: 'debt', player: 'b1', amount: 900, creditor: null }, ctx).text).toBe('Chai Uncle is in debt: owes ₹900 to the bank');
    expect(describeEvent({ type: 'jail', player: 'me', jailed: false, reason: 'card_used' }, ctx).text).toBe('You used a Get Out of Jail Free card');
    expect(describeEvent({ type: 'cash', player: 'me', delta: 2500, reason: 'mortgage' }, ctx)).toBeNull();
  });

  it('describes trades', () => {
    const give = { cash: 0, tiles: [12] };
    const get = { cash: 800, tiles: [] };
    const offer = describeEvent({ type: 'trade_offer', id: 1, from: 'b1', to: 'me', give, get }, ctx);
    expect(offer.text).toBe('Chai Uncle offered you a trade: Ameerpet for ₹800');
    expect(offer.tone).toBe('warn');
    expect(describeEvent({ type: 'trade_done', id: 1, from: 'me', to: 'b1', give, get }, ctx).text).toBe(
      'Trade done! You gave Ameerpet to Chai Uncle for ₹800',
    );
    expect(describeEvent({ type: 'trade_rejected', id: 1, from: 'me', to: 'b1', reason: 'declined' }, ctx).text).toBe("Chai Uncle turned down your trade offer");
    expect(describeEvent({ type: 'trade_rejected', id: 1, from: 'b1', to: 'me', reason: 'timeout' }, ctx).text).toContain('timed out');
    expect(describeEvent({ type: 'trade_offer', id: 2, from: 'me', to: 'b1', give: { cash: 0, tiles: [] }, get: { cash: 0, tiles: [] } }, ctx).text).toContain('nothing for nothing');
  });

  it('adds a log-only lucky dice line for the local player', () => {
    const mine = describeEvent({ type: 'dice', player: 'me', values: [3, 4], assist: 'comeback' }, ctx);
    expect(mine.text).toBe('You rolled 3 + 4');
    expect(mine.extra.text).toBe('Lucky dice gave you a little help 🍀');
    expect(describeEvent({ type: 'dice', player: 'b1', values: [3, 4], assist: 'comeback' }, ctx).extra).toBeUndefined();
    expect(describeEvent({ type: 'dice', player: 'me', values: [3, 4], assist: null }, ctx).extra).toBeUndefined();
  });

  it('describes jail, cards, auctions and bankruptcy', () => {
    expect(describeEvent({ type: 'jail', player: 'me', jailed: true, reason: 'three_doubles' }, { ...ctx, jailTurns: 1 }).text).toBe(
      'Three doubles in a row! You are in jail for 1 round',
    );
    expect(describeEvent({ type: 'jail_stay', player: 'me', left: 2 }, ctx).text).toBe('You are in jail for 2 more rounds');
    const card = describeEvent({ type: 'card', player: 'me', kind: 'good', title: 'IT Hike!', text: 'Collect ₹1,000.' }, ctx);
    expect(card.tone).toBe('good');
    expect(card.text).toContain('IT Hike!');
    expect(describeEvent({ type: 'auction_end', tile: 8, winner: 'b1', amount: 400, bids: {} }, ctx).text).toBe(
      'Chai Uncle won Dilsukhnagar at auction for ₹400',
    );
    expect(describeEvent({ type: 'bankrupt', player: 'me' }, ctx).text).toBe('You went bankrupt!');
  });

  it('keeps per-turn lines quiet and announces rounds', () => {
    expect(describeEvent({ type: 'turn', player: 'b1', round: 3 }, ctx)).toBeNull();
    expect(describeEvent({ type: 'move', player: 'me', from: 0, to: 4, path: [1, 2, 3, 4] }, ctx)).toBeNull();
    const r = describeEvent({ type: 'turn', player: 'me', round: 4 }, ctx);
    expect(r.text).toBe('Round 4 begins');
    expect(r.bubble).toBe('Round 4');
    const f = describeEvent({ type: 'turn', player: 'me', round: 30 }, { ...ctx, round: 29 });
    expect(f.bubble).toBe('Final round!');
    expect(f.text).toContain('Round 30 begins');
  });

  it('describes wins, including the round limit', () => {
    const rounds = describeEvent({ type: 'win', player: 'b1', reason: 'rounds', worth: 41200 }, ctx);
    expect(rounds.text).toBe('Round limit reached! Chai Uncle is the richest with ₹41,200');
    expect(rounds.tone).toBe('cheer');
    expect(describeEvent({ type: 'win', player: 'me', reason: 'rounds', worth: 41200 }, ctx).text).toBe(
      'Round limit reached! You are the richest with ₹41,200',
    );
    expect(describeEvent({ type: 'win', player: 'me', reason: 'net_worth', worth: 70000 }, ctx).text).toContain('You reached');
  });

  it('never throws on junk', () => {
    expect(describeEvent(null, ctx)).toBeNull();
    expect(describeEvent({ type: 'nope' }, ctx)).toBeNull();
    expect(() => describeEvent({ type: 'land', player: 'x', tile: 999 }, null)).not.toThrow();
  });
});
