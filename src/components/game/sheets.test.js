// Render smoke tests for the rules, auction and debt sheets on the 40-square board.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '@shared/index.js';

vi.mock('./ui/Sheet.jsx', () => ({
  default: ({ header, children, footer, title }) => createElement('div', null, title ? createElement('h2', null, title) : null, header, children, footer),
}));
vi.mock('@/components/art/index.js', () => ({
  Avatar: () => null,
  TileIcon: () => null,
  BuildingArt: () => null,
}));

const { default: RulesSheet } = await import('./RulesSheet.jsx');
const { default: AuctionSheet, auctionInstance } = await import('./AuctionSheet.jsx');
const { default: DebtSheet } = await import('./DebtSheet.jsx');

const base = () => createGame({ players: [{ id: 'me' }, { id: 'b1' }], seed: 3 });
const text = (el) => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('RulesSheet', () => {
  const out = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: base() } }));

  it('describes the 40-square clockwise game', () => {
    expect(out).toContain('40 squares');
    expect(out).toContain('clockwise');
    expect(out).toContain('Rajiv Gandhi Airport');
    expect(out).toContain('₹250 / ₹500 / ₹1,000 / ₹2,000');
    expect(out).toContain('doubled');
    expect(out).toContain('GHMC Property Tax: pay ₹2,000, or 10% of your total worth if that is less');
    expect(out).toContain('ORR Toll / Traffic Challan: pay ₹1,000');
    expect(out).toContain('Nawab ka Farman and Hyderabadi Khazana');
    expect(out).toContain('Irani Chai & Biryani Break');
    expect(out).toContain('Kirana shop');
  });

  it('has no trace of the old board', () => {
    for (const gone of ['Film City', 'Laad Bazaar', 'Charminar Chowk', 'Kismet', 'Miyapur']) expect(out).not.toContain(gone);
  });
});

describe('AuctionSheet', () => {
  it('shows the tile being auctioned with its kind and price', () => {
    const view = base();
    view.phase = 'auction';
    view.pending = { type: 'auction', tile: 5, minBid: 1000, bids: {} };
    const out = text(createElement(AuctionSheet, { session: { me: 'me', view, options: { bid: { min: 1000, max: 8000 } }, dispatch() {} } }));
    expect(out).toContain('Secunderabad Junction');
    expect(out).toContain('Station');
    expect(out).toContain('₹2,000');
    expect(out).toContain('Minimum bid');
  });
});

describe('AuctionSheet: snatch bidding', () => {
  const snatchView = (bids) => {
    const view = base();
    view.phase = 'auction';
    view.pending = { type: 'auction', tile: 6, minBid: 500, bids, snatch: true, buyer: 'b1', price: 1000, returnPhase: 'manage' };
    return view;
  };
  const render = (view, options) => text(createElement(AuctionSheet, { session: { me: 'me', view, options, dispatch() {} } }));

  it('shows only the claimants the bid form', () => {
    const out = render(snatchView({ b1: 0 }), { bid: { min: 500, max: 8000 } });
    expect(out).toContain('Snatch bidding');
    expect(out).toContain('Minimum bid');
    expect(out).toContain('Place bid');
    expect(out).toContain('already paid ₹1,000');
    expect(out).not.toContain('Snatchers are bidding');
  });

  it('shows everybody else, the buyer included, who is bidding and that the buyer keeps the tile', () => {
    const out = render(snatchView({ me: 0, b1: 0 }), { bid: null });
    expect(out).toContain('Snatchers are bidding for Koti');
    expect(out).toContain('already paid ₹1,000');
    expect(out).toContain('keeps it if nobody bids');
    expect(out).not.toContain('Place bid');
    expect(out).not.toContain('Sealed bid');
  });

  it('keeps a plain auction untouched', () => {
    const view = base();
    view.phase = 'auction';
    view.pending = { type: 'auction', tile: 6, minBid: 500, bids: {} };
    const out = render(view, { bid: { min: 500, max: 8000 } });
    expect(out).toContain('Auction');
    expect(out).not.toContain('Snatch');
  });
});

describe('RulesSheet: single die and snatch', () => {
  const out = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: { ...base(), cfg: { ...base().cfg, snatches: 2, snatchMs: 4000 } } } }));
  it('explains the snatch rules with the numbers from the settings', () => {
    expect(out).toContain('Snatch');
    expect(out).toContain('2 Snatch tokens');
    expect(out).toContain('4 seconds');
    expect(out).toContain('for free');
    expect(out).toContain('sealed bidding');
    expect(out).toContain('Auctions, trades and cards never open a snatch window');
  });
  it('is single die only: a six rolls again and leaves jail, no doubles', () => {
    expect(out).toContain('one die');
    expect(out).toContain('A six gives you another roll');
    expect(out).toContain('roll a six');
    expect(out.toLowerCase()).not.toContain('doubles');
    expect(out.toLowerCase()).not.toContain('two dice');
  });
  it('defaults to 1 token and 3 seconds', () => {
    const def = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: base() } }));
    expect(def).toContain('1 Snatch token');
    expect(def).toContain('3 seconds');
  });
});

describe('RulesSheet: tokens, Shield and city events', () => {
  const out = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: base() } }));
  it('explains Shield, earning tokens, the cap and the events', () => {
    expect(out).toContain('Tokens, Shield and city events');
    expect(out).toContain('Buy + Shield');
    expect(out).toContain('after every 3 laps');
    expect(out).toContain('at most 3');
    expect(out).toContain('Every 5 rounds');
    expect(out).toContain('Monsoon');
    expect(out).toContain('Bonalu');
  });
  it('drops the token paragraphs when tokens are off', () => {
    const off = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: { ...base(), cfg: { ...base().cfg, snatches: 0 } } } }));
    expect(off).not.toContain('Buy + Shield');
    expect(off).toContain('city event');
  });
});

describe('RulesSheet: traps', () => {
  it('explains the trap rule', () => {
    const o = text(createElement(RulesSheet, { open: true, onClose() {}, session: { view: base() } }));
    expect(o).toContain('Set trap here');
    expect(o).toContain('1 trap');
    expect(o).toContain('straight to jail');
    expect(o).toContain('immune');
  });
});

describe('PlayerSheet: lap progress', () => {
  it('shows N/3 laps to a token next to the token chip', async () => {
    const { default: PlayerSheet } = await import('./PlayerSheet.jsx');
    const view = base();
    view.players[0].laps = 4;
    const o = text(createElement(PlayerSheet, { session: { me: 'me', view, display: null }, playerId: 'me', onClose() {}, onOpenTile() {} }));
    expect(o).toContain('1/3 laps to a token');
  });
  it('shows Trap ready only while the trap is in hand', async () => {
    const { default: PlayerSheet } = await import('./PlayerSheet.jsx');
    const render = (traps) => {
      const view = base();
      if (traps === undefined) delete view.players[0].traps;
      else view.players[0].traps = traps;
      return renderToStaticMarkup(createElement(PlayerSheet, { session: { me: 'me', view, display: null }, playerId: 'me', onClose() {}, onOpenTile() {} }));
    };
    expect(render(1)).toContain('Trap ready');
    expect(render(0)).not.toContain('Trap ready');
    expect(render(undefined)).not.toContain('Trap ready');
  });
});

describe('Snatch tokens come from the live view, not the lagging display', () => {
  const sessionWith = (viewTokens, displayTokens) => {
    const view = base();
    view.players[0].snatches = viewTokens;
    const display = structuredClone(view);
    display.players[0].snatches = displayTokens;
    return { me: 'me', view, display };
  };
  it('PlayerSheet shows x0 when view says 0 and display still says 1', async () => {
    const { default: PlayerSheet } = await import('./PlayerSheet.jsx');
    const out = renderToStaticMarkup(createElement(PlayerSheet, { session: sessionWith(0, 1), playerId: 'me', onClose() {}, onOpenTile() {} }));
    expect(out).toContain('Snatch tokens: 0');
    expect(out).not.toContain('Snatch tokens: 1');
  });
  it('MoneyBar shows x0 when view says 0 and display still says 1', async () => {
    const { default: MoneyBar } = await import('./MoneyBar.jsx');
    const out = renderToStaticMarkup(createElement(MoneyBar, { session: sessionWith(0, 1) }));
    const mine = out.split('</li>')[0];
    expect(mine).toContain('Snatch tokens: 0');
    expect(mine).not.toContain('Snatch tokens: 1');
  });
});

describe('DebtSheet', () => {
  it('names the payment and offers the mortgage of a station', () => {
    const view = base();
    view.phase = 'debt';
    view.owners[5] = 'me';
    view.debt = { player: 'me', amount: 3000, creditor: null, reason: 'tax' };
    const out = text(createElement(DebtSheet, {
      session: { me: 'me', view, display: null, busy: false, options: { debt: true, mortgage: [{ tile: 5, value: 1000 }], sellBuilding: [] }, dispatch() {} },
    }));
    expect(out).toContain('Tax due');
    expect(out).toContain('You owe ₹3,000');
    expect(out).toContain('Secunderabad Junction');
    expect(out).toContain('Mortgage +₹1,000');
  });
});

describe('auctionInstance', () => {
  it('is different for the same tile auctioned again later, and for snatch bidding on it', () => {
    const a = { tile: 15, snatch: false };
    const first = auctionInstance({ round: 5, turnCount: 17 }, a);
    expect(auctionInstance({ round: 9, turnCount: 33 }, a)).not.toBe(first);
    expect(auctionInstance({ round: 5, turnCount: 17 }, { tile: 15, snatch: true })).not.toBe(first);
    expect(auctionInstance({ round: 5, turnCount: 17 }, a)).toBe(first);
    expect(auctionInstance({ round: 5, turnCount: 17 }, null)).toBeNull();
  });
});
