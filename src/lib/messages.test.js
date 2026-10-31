import { describe, it, expect } from 'vitest';
import { describeEvent } from './messages.js';

const ctx = {
  me: 'me',
  players: [{ id: 'me', name: 'Nithin' }, { id: 'b1', name: 'Chai Uncle' }],
  owners: Array(40).fill(null),
  round: 3,
  maxRounds: 30,
};

describe('describeEvent', () => {
  it('announces one die and a six, with no doubles wording anywhere', () => {
    expect(describeEvent({ type: 'dice', player: 'me', values: [1] }, ctx).text).toBe('You rolled 1');
    expect(describeEvent({ type: 'dice', player: 'me', values: [6] }, ctx).text).toBe('You rolled 6: six!');
    expect(describeEvent({ type: 'jail', player: 'me', jailed: false, reason: 'six' }, ctx).text).toBe('You rolled a six and broke out of jail');
  });
  it('describes the die for me and for others', () => {
    const d = describeEvent({ type: 'dice', player: 'b1', values: [2] }, ctx);
    expect(d.text).toBe('Chai Uncle rolled 2');
    expect(d.tone).toBe('info');
    expect(d.icon).toBe('🎲');
    expect(describeEvent({ type: 'dice', player: 'b1', values: [6] }, ctx).text).toBe('Chai Uncle rolled 6: six!');
  });

  it('describes rent once (paying half only) with INR formatting', () => {
    const pay = describeEvent({ type: 'cash', player: 'me', delta: -1200, reason: 'rent', other: 'b1' }, ctx);
    expect(pay.text).toBe('You paid ₹1,200 rent to Chai Uncle');
    expect(pay.tone).toBe('bad');
    expect(describeEvent({ type: 'cash', player: 'b1', delta: 1200, reason: 'rent', other: 'me' }, ctx)).toBeNull();
    const otherPaysMe = describeEvent({ type: 'cash', player: 'b1', delta: -800, reason: 'rent', other: 'me' }, ctx);
    expect(otherPaysMe.text).toBe('Chai Uncle paid ₹800 rent to You');
    expect(otherPaysMe.tone).toBe('good');
  });

  it('covers salary, bail and the silent buy payment', () => {
    expect(describeEvent({ type: 'cash', player: 'me', delta: 2000, reason: 'salary' }, ctx).text).toContain('₹2,000 salary');
    expect(describeEvent({ type: 'cash', player: 'me', delta: -500, reason: 'bail' }, ctx).text).toContain('bail');
    expect(describeEvent({ type: 'cash', player: 'me', delta: -500, reason: 'buy' }, ctx)).toBeNull();
  });

  it('names the tax from the event tile or from the square being played', () => {
    const ghmc = describeEvent({ type: 'cash', player: 'me', delta: -1400, reason: 'tax', tile: 4 }, ctx);
    expect(ghmc.text).toBe('You paid ₹1,400 GHMC property tax');
    expect(ghmc).toMatchObject({ tone: 'bad', tile: 4 });
    expect(describeEvent({ type: 'cash', player: 'b1', delta: -1000, reason: 'tax' }, { ...ctx, tile: 38 }).text).toBe(
      'Chai Uncle paid ₹1,000 for the ORR Toll / Traffic Challan',
    );
    expect(describeEvent({ type: 'cash', player: 'me', delta: -1000, reason: 'tax' }, ctx).text).toBe('You paid ₹1,000 tax');
  });

  it('describes landing on the corners and on stations and utilities', () => {
    expect(describeEvent({ type: 'land', player: 'me', tile: 10 }, ctx).text).toBe('You are just visiting Chanchalguda Jail');
    expect(describeEvent({ type: 'land', player: 'b1', tile: 20 }, ctx).text).toBe('Chai Uncle stopped for an Irani chai and biryani. Nothing happens');
    expect(describeEvent({ type: 'land', player: 'b1', tile: 30 }, ctx).text).toBe('Chai Uncle landed on Go to Jail');
    expect(describeEvent({ type: 'land', player: 'me', tile: 5 }, ctx).text).toBe('You landed on Secunderabad Junction');
    const owners = Array(40).fill(null);
    owners[12] = 'me';
    expect(describeEvent({ type: 'land', player: 'me', tile: 12 }, { ...ctx, owners }).text).toBe('You are back on your own TGSPDCL (Electricity)');
  });

  it('describes station and utility rent like any other rent', () => {
    expect(describeEvent({ type: 'cash', player: 'me', delta: -500, reason: 'rent', other: 'b1' }, ctx).text).toBe('You paid ₹500 rent to Chai Uncle');
    expect(describeEvent({ type: 'cash', player: 'b1', delta: -280, reason: 'rent', other: 'me' }, ctx).tone).toBe('good');
  });

  it('sends a player to jail from the Go to Jail corner without a separate zip line', () => {
    expect(describeEvent({ type: 'move', player: 'me', from: 30, to: 10, path: [10], teleport: true }, ctx)).toBeNull();
    const j = describeEvent({ type: 'jail', player: 'me', jailed: true, reason: 'gotojail' }, ctx);
    expect(j.text).toBe('Caught at a signal without a helmet! You are in jail for 1 round');
    expect(j.tile).toBe(10);
    expect(describeEvent({ type: 'move', player: 'me', from: 3, to: 21, path: [21], teleport: true }, ctx).text).toBe('You zipped to Charminar');
  });

  it('describes buying, liquidation and upgrades with tile names', () => {
    expect(describeEvent({ type: 'own', tile: 32, owner: 'me', reason: 'buy' }, ctx).text).toBe('You bought Banjara Hills for ₹3,000');
    expect(describeEvent({ type: 'own', tile: 15, owner: 'b1', reason: 'buy' }, ctx).text).toBe('Chai Uncle bought Kacheguda Station for ₹2,000');
    const owners = Array(40).fill(null);
    owners[11] = 'b1';
    const liq = describeEvent({ type: 'own', tile: 11, owner: null, reason: 'liquidate' }, { ...ctx, owners });
    expect(liq.text).toBe('Chai Uncle sold Ameerpet to pay a debt');
    owners[1] = 'me';
    const up = describeEvent({ type: 'level', tile: 1, level: 1, reason: 'upgrade' }, { ...ctx, owners });
    expect(up.text).toBe('You upgraded Dilsukhnagar to a Kirana shop');
    expect(describeEvent({ type: 'level', tile: 1, level: 4, reason: 'upgrade' }, { ...ctx, owners }).text).toBe('You upgraded Dilsukhnagar to a Tower');
    const hotel = describeEvent({ type: 'level', tile: 1, level: 5, reason: 'upgrade' }, { ...ctx, owners });
    expect(hotel.text).toBe('You built a Hotel on Dilsukhnagar!');
    expect(hotel.tone).toBe('cheer');
    expect(describeEvent({ type: 'level', tile: 1, level: 2, reason: 'upgrade' }, { ...ctx, owners }).text).toBe('You upgraded Dilsukhnagar to Apartments');
    const sell = describeEvent({ type: 'level', tile: 1, level: 3, reason: 'sell' }, { ...ctx, owners });
    expect(sell.text).toBe('You sold a Tower on Dilsukhnagar (now a Mall)');
    expect(sell.tone).toBe('warn');
  });

  it('describes mortgages, set completion, debt and the jail card', () => {
    expect(describeEvent({ type: 'mortgage', player: 'me', tile: 32, value: 1500 }, ctx).text).toBe('You mortgaged Banjara Hills for ₹1,500');
    expect(describeEvent({ type: 'unmortgage', player: 'b1', tile: 32, cost: 1650 }, ctx).text).toBe('Chai Uncle paid ₹1,650 to unmortgage Banjara Hills');
    expect(describeEvent({ type: 'set_complete', player: 'me', group: 'green' }, ctx)).toMatchObject({ text: 'You completed the Elite set!', tone: 'cheer' });
    expect(describeEvent({ type: 'set_complete', player: 'b1', group: 'lightblue' }, ctx).text).toBe('Chai Uncle completed the Light Blue set!');
    expect(describeEvent({ type: 'debt', player: 'me', amount: 3000, creditor: 'b1' }, ctx).text).toBe('You owe ₹3,000 to Chai Uncle. Raise cash or resign!');
    expect(describeEvent({ type: 'debt', player: 'b1', amount: 900, creditor: null }, ctx).text).toBe('Chai Uncle is in debt: owes ₹900 to the bank');
    expect(describeEvent({ type: 'jail', player: 'me', jailed: false, reason: 'card_used' }, ctx).text).toBe('You used a Get Out of Jail Free card');
    expect(describeEvent({ type: 'cash', player: 'me', delta: 2500, reason: 'mortgage' }, ctx)).toBeNull();
  });

  it('describes trades', () => {
    const give = { cash: 0, tiles: [11] };
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
    const mine = describeEvent({ type: 'dice', player: 'me', values: [3], assist: 'comeback' }, ctx);
    expect(mine.text).toBe('You rolled 3');
    expect(mine.extra.text).toBe('Lucky dice gave you a little help 🍀');
    expect(describeEvent({ type: 'dice', player: 'b1', values: [3], assist: 'comeback' }, ctx).extra).toBeUndefined();
    expect(describeEvent({ type: 'dice', player: 'me', values: [3], assist: null }, ctx).extra).toBeUndefined();
  });

  it('describes jail, cards, auctions and bankruptcy', () => {
    expect(describeEvent({ type: 'jail', player: 'me', jailed: true, reason: 'card' }, { ...ctx, jailTurns: 1 }).text).toBe(
      'The card says go to jail! You are in jail for 1 round',
    );
    expect(describeEvent({ type: 'jail_stay', player: 'me', left: 2 }, ctx)).toMatchObject({ text: 'You are in jail for 2 more rounds', tile: 10 });
    const card = describeEvent({ type: 'card', player: 'me', kind: 'good', title: 'IT Hike!', text: 'Collect ₹1,000.' }, ctx);
    expect(card.tone).toBe('good');
    expect(card.text).toContain('IT Hike!');
    expect(describeEvent({ type: 'card', player: 'b1', deck: 'chance', kind: 'bad', title: 'Paytm Karo!', text: 't' }, ctx).text).toBe(
      'Chai Uncle drew a Farman card: "Paytm Karo!"',
    );
    expect(describeEvent({ type: 'card', player: 'b1', deck: 'chest', kind: 'good', title: 'Haleem Season', text: 't' }, ctx).text).toContain('a Khazana card');
    expect(describeEvent({ type: 'auction_end', tile: 8, winner: 'b1', amount: 400, bids: {} }, ctx).text).toBe(
      'Chai Uncle won Abids at auction for ₹400',
    );
    expect(describeEvent({ type: 'bankrupt', player: 'me' }, ctx).text).toBe('You went bankrupt!');
  });

  describe('snatch', () => {
    const open = { type: 'snatch_open', tile: 6, buyer: 'b1', price: 1000, eligible: ['me'], ms: 3000 };

    it('opens the window with the buyer, the tile and the price', () => {
      const d = describeEvent(open, ctx);
      expect(d.text).toBe('Chai Uncle bought Koti for ₹1,000. Snatch window open (3s)!');
      expect(d).toMatchObject({ tone: 'warn', tile: 6, bubble: 'Snatch it!' });
      expect(describeEvent({ ...open, buyer: 'me', eligible: ['b1'] }, ctx).text).toBe('You bought Koti for ₹1,000. Snatch window open (3s)!');
      expect(describeEvent({ ...open, eligible: ['b2'] }, ctx).tone).toBe('info');
      expect(describeEvent({ ...open, price: undefined }, ctx).text).toContain('for ₹1,000.');
    });

    it('says nobody snatched', () => {
      expect(describeEvent({ type: 'snatch_end', tile: 6, buyer: 'b1', outcome: 'none' }, ctx).text).toBe('Nobody snatched. Koti stays with Chai Uncle.');
      expect(describeEvent({ type: 'snatch_end', tile: 6, buyer: 'me', outcome: 'none' }, ctx).text).toBe('Nobody snatched. Koti stays with you.');
    });

    it('tells a snatch, including the price the buyer still paid', () => {
      const ev = { type: 'snatch_end', tile: 6, buyer: 'b1', outcome: 'snatched', winner: 'me', claimants: ['me'] };
      const won = describeEvent(ev, ctx);
      expect(won.text).toBe('You SNATCHED Koti from Chai Uncle for free! (Chai Uncle still paid ₹1,000)');
      expect(won.tone).toBe('cheer');
      const robbed = describeEvent({ ...ev, buyer: 'me', winner: 'b1' }, ctx);
      expect(robbed.text).toBe('Chai Uncle SNATCHED Koti from you for free! (You still paid ₹1,000)');
      expect(robbed.tone).toBe('bad');
      expect(describeEvent({ ...ev, buyer: 'b1', winner: 'b2' }, { ...ctx, players: [...ctx.players, { id: 'b2', name: 'Biryani Bhai' }] }).tone).toBe('info');
    });

    it('announces sealed bidding between two or more snatchers', () => {
      const two = describeEvent({ type: 'snatch_end', tile: 6, buyer: 'b1', outcome: 'bidding', claimants: ['me', 'b2'] }, {
        ...ctx, players: [...ctx.players, { id: 'b2', name: 'Biryani Bhai' }],
      });
      expect(two.text).toBe('You and Biryani Bhai both snatched! Sealed bidding for Koti.');
      expect(two.tone).toBe('warn');
      const three = describeEvent({ type: 'snatch_end', tile: 6, buyer: 'b1', outcome: 'bidding', claimants: ['b2', 'b3', 'me'] }, {
        ...ctx, players: [...ctx.players, { id: 'b2', name: 'Biryani Bhai' }, { id: 'b3', name: 'Irani Uncle' }],
      });
      expect(three.text).toBe('Biryani Bhai, Irani Uncle and You all snatched! Sealed bidding for Koti.');
    });

    it('ends snatch bidding with a winner or with nobody bidding', () => {
      const owners = Array(40).fill(null);
      owners[6] = 'b1';
      expect(describeEvent({ type: 'auction_end', tile: 6, reason: 'snatch', winner: null, amount: 0, bids: {} }, { ...ctx, owners }).text).toBe(
        'Nobody bid. Koti stays with Chai Uncle.',
      );
      expect(describeEvent({ type: 'auction_end', tile: 6, reason: 'snatch', buyer: 'me', winner: null }, ctx).text).toBe('Nobody bid. Koti stays with you.');
      expect(describeEvent({ type: 'auction_end', tile: 6, reason: 'snatch', winner: 'me', amount: 700 }, ctx).text).toBe(
        'You won Koti in the snatch bidding for ₹700',
      );
      expect(describeEvent({ type: 'auction_end', tile: 6, winner: null }, ctx).text).toBe('No bids. Koti stays with the bank');
    });

    it('keeps the follow-up events quiet (snatch_end already told the story)', () => {
      expect(describeEvent({ type: 'own', tile: 6, owner: 'me', reason: 'snatch' }, ctx)).toBeNull();
      expect(describeEvent({ type: 'snatch_token', player: 'me', snatches: 0 }, ctx)).toBeNull();
      expect(describeEvent({ type: 'auction_start', tile: 6, minBid: 500, reason: 'snatch', eligible: ['me'] }, ctx)).toBeNull();
      expect(describeEvent({ type: 'auction_start', tile: 6, minBid: 500 }, ctx).text).toContain('Auction!');
    });
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

  describe('tokens and city events', () => {
    it('logs a shield for you and for others', () => {
      expect(describeEvent({ type: 'shield', player: 'me', tile: 6 }, ctx).text).toBe('You shielded Koti: no snatching!');
      expect(describeEvent({ type: 'shield', player: 'b1', tile: 6 }, ctx)).toMatchObject({ text: 'Chai Uncle shielded Koti: no snatching!', tile: 6 });
    });
    it('logs earned tokens with the reason', () => {
      expect(describeEvent({ type: 'token_earned', player: 'me', reason: 'lap', snatches: 2 }, ctx).text).toBe('You earned a Snatch token (lap bonus)');
      expect(describeEvent({ type: 'token_earned', player: 'b1', reason: 'chai', snatches: 2 }, ctx).text).toBe('Chai Uncle earned a Snatch token (Chai break)');
    });
    it('logs a city event as title + text and the festival gift', () => {
      const d = describeEvent({ type: 'city_event', id: 'monsoon', title: 'Monsoon!', text: 'Pink rents are halved.', kind: 'rent', group: 'pink', mult: 0.5, round: 5 }, ctx);
      expect(d.text).toBe('Monsoon! Pink rents are halved.');
      expect(d.bubble).toBe('Monsoon!');
      expect(describeEvent({ type: 'cash', player: 'me', delta: 500, reason: 'event' }, ctx).text).toBe('Festival gift: You received ₹500');
      expect(describeEvent({ type: 'cash', player: 'b1', delta: 500, reason: 'event' }, ctx).text).toBe('Festival gift: Chai Uncle received ₹500');
    });
  });

  describe('traps', () => {
    it('keeps a placement secret and names the tile when it springs', () => {
      expect(describeEvent({ type: 'trap_placed', player: 'me' }, ctx).text).toBe('You set a trap. Shhh.');
      expect(describeEvent({ type: 'trap_placed', player: 'b1' }, ctx).text).toBe('Chai Uncle set a trap somewhere...');
      expect(describeEvent({ type: 'trap_sprung', tile: 6, owner: 'b1', victim: 'me' }, ctx).text).toBe("You walked into Chai Uncle's trap on Koti and were thrown in jail!");
      expect(describeEvent({ type: 'trap_sprung', tile: 6, owner: 'me', victim: 'b1' }, ctx).text).toBe('Chai Uncle walked into your trap on Koti and was thrown in jail!');
    });
  });

  it('never throws on junk', () => {
    expect(describeEvent(null, ctx)).toBeNull();
    expect(describeEvent({ type: 'nope' }, ctx)).toBeNull();
    expect(() => describeEvent({ type: 'land', player: 'x', tile: 999 }, null)).not.toThrow();
  });
});
