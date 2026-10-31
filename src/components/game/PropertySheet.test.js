// Render smoke test: every one of the 40 tiles opens as a title deed / rule card without throwing.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GROUP_TILES, TILES, TRANSPORT_RENT, rentFor } from '@shared/board.js';
import { createGame } from '@shared/index.js';
import { formatINR } from '@shared/format.js';

// The sheet portals into document.body and the art pulls in SVG-heavy modules: render the content inline.
const captured = vi.hoisted(() => ({ footer: null }));
vi.mock('./ui/Sheet.jsx', () => ({
  default: ({ header, children, footer }) => {
    captured.footer = footer;
    return createElement('div', null, header, children, footer);
  },
}));
vi.mock('@/components/art/index.js', () => ({
  Avatar: () => null,
  TileIcon: () => null,
  BuildingArt: () => null,
}));

const { default: PropertySheet } = await import('./PropertySheet.jsx');

const sessionFor = (patch = {}) => {
  const view = createGame({ players: [{ id: 'me' }, { id: 'b1' }], seed: 7 });
  return { me: 'me', view, display: null, options: {}, busy: false, dispatch() {}, ...patch };
};
const html = (session, tileId) => renderToStaticMarkup(createElement(PropertySheet, { session, tileId, onClose() {} }));
const text = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('PropertySheet title deeds', () => {
  it('renders all 40 tiles', () => {
    expect(TILES).toHaveLength(40);
    for (const t of TILES) {
      const out = text(html(sessionFor(), t.id));
      expect(out, t.name).toContain(t.name);
    }
  });

  it('prints the whole rent table of a property and the full-set note', () => {
    const koti = TILES.find((t) => t.name === 'Koti');
    const out = text(html(sessionFor(), koti.id));
    expect(out).toContain('Title deed');
    for (let i = 0; i <= 5; i++) expect(out).toContain(formatINR(rentFor(koti, i)));
    expect(out).toContain('With 4 houses (Tower)');
    expect(out).toContain('With HOTEL');
    expect(out).toContain(`Mortgage value ${formatINR(koti.mortgage)}`);
    expect(out).toContain(`Houses cost ${formatINR(koti.houseCost)} each`);
    expect(out).toContain('doubled');
  });

  it('highlights the current building level and the stations owned', () => {
    const s = sessionFor();
    const [a, b] = GROUP_TILES.pink;
    s.view.owners[a] = 'me';
    s.view.owners[b] = 'me';
    s.view.levels[a] = 2;
    const deed = html(s, a);
    expect(deed.match(/class="is-current"/g)).toHaveLength(1);
    expect(deed).toMatch(/is-current"><th[^>]*>With 2 houses/);

    const stations = TILES.filter((t) => t.type === 'transport');
    stations.slice(0, 3).forEach((t) => { s.view.owners[t.id] = 'me'; });
    const st = html(s, stations[0].id);
    expect(st).toMatch(/is-current"><th[^>]*>If 3 stations are owned/);
    TRANSPORT_RENT.slice(1).forEach((r) => expect(text(st)).toContain(formatINR(r)));
  });

  it('shows the mortgaged face instead of the rent table', () => {
    const s = sessionFor();
    const t = TILES[1];
    s.view.owners[1] = 'me';
    s.view.mortgaged[1] = true;
    const out = text(html(s, 1));
    expect(out).toContain('Mortgaged');
    expect(out).toContain(`for ${formatINR(t.mortgage)}`);
    expect(out).not.toContain('With 1 house');
  });

  it('explains the rule of the special squares', () => {
    const s = sessionFor();
    expect(text(html(s, 0))).toContain('Collect');
    expect(text(html(s, 4))).toContain('10% of your total worth');
    expect(text(html(s, 38))).toContain('Pay ₹1,000');
    expect(text(html(s, 2))).toContain('Hyderabadi Khazana card');
    expect(text(html(s, 7))).toContain('Nawab ka Farman card');
    expect(text(html(s, 10))).toContain('bail');
    expect(text(html(s, 20))).toContain('Rest stop');
    expect(text(html(s, 30))).toContain('Chanchalguda Jail');
  });

  it('keeps the buy and skip actions for a pending purchase', () => {
    const s = sessionFor({ options: { buy: true, skipBuy: true } });
    s.view.pending = { type: 'buy', tile: 6, price: 1000 };
    const out = text(html(s, 6));
    expect(out).toContain('Buy for ₹1,000');
    expect(out).toContain('Skip');
  });
});

describe('PropertySheet trap action', () => {
  const findClick = (node, cls) => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const n of node) { const f = findClick(n, cls); if (f) return f; }
      return null;
    }
    const props = node.props || {};
    if (typeof props.className === 'string' && props.className.includes(cls) && props.onClick) return props.onClick;
    return findClick(props.children, cls);
  };

  it('offers Set trap here with its one-line explanation while options.trap is on', () => {
    const out = text(html(sessionFor({ options: { trap: true, roll: true } }), 6));
    expect(out).toContain('Set trap here');
    expect(out).toContain('Hidden. The first rival to land here is thrown in jail.');
  });

  it('dispatches PLACE_TRAP for that tile and closes the sheet', () => {
    const dispatch = vi.fn();
    const onClose = vi.fn();
    renderToStaticMarkup(createElement(PropertySheet, { session: sessionFor({ options: { trap: true }, dispatch }), tileId: 6, onClose }));
    const click = findClick(captured.footer, 'hg-trap-btn');
    expect(click).toBeTypeOf('function');
    click();
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_TRAP', tile: 6 });
    expect(onClose).toHaveBeenCalled();
  });

  it('works on non-property squares but never on Go to Jail', () => {
    const s = sessionFor({ options: { trap: true } });
    for (const id of [0, 2, 4, 10, 20]) expect(text(html(s, id))).toContain('Set trap here');
    expect(text(html(s, 30))).not.toContain('Set trap here');
  });

  it('hides the button when placing is not possible', () => {
    expect(text(html(sessionFor({ options: {} }), 6))).not.toContain('Set trap here');
    expect(text(html(sessionFor(), 6))).not.toContain('Hidden. The first rival');
  });

  it('says the trap is set instead of offering another one on the same tile', () => {
    const s = sessionFor({ options: { trap: true } });
    s.view.traps = [{ tile: 6, owner: 'me' }];
    const here = text(html(s, 6));
    expect(here).toContain('Your trap is set here');
    expect(here).not.toContain('Set trap here');
    expect(text(html(s, 8))).toContain('Set trap here');
    expect(text(html(s, 8))).not.toContain('Your trap is set here');
    // someone else's trap is never shown
    s.view.traps = [{ tile: 6, owner: 'b1' }];
    expect(text(html(s, 6))).not.toContain('Your trap is set here');
  });
});
