import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, TILES } from '@shared/board.js';
import { TileIcon } from '@/components/art/index.js';
import { Board } from './Board.jsx';
import { pawnPlacement } from './Pawn.jsx';
import { Tile, softName } from './Tile.jsx';

const SHY = '­';
const CORNER = (1.4 / 11.8) * 100; // a corner track, in % of the board
const html = (tile, props = {}) => renderToString(createElement(Tile, { tile: TILES[tile], ...props }));

describe('pawn placement on the 11x11 ring', () => {
  it('keeps every pawn of every crowd size inside its own tile', () => {
    for (let pos = 0; pos < BOARD_SIZE; pos++) {
      for (let n = 1; n <= 6; n++) {
        for (let slot = 0; slot < n; slot++) {
          const { x, y, d } = pawnPlacement(pos, slot, n);
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(100);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(100);
          expect(d).toBeGreaterThan(0.2);
        }
      }
    }
  });

  it('puts the four corners in the corner tracks, START bottom-right and clockwise from there', () => {
    const at = (pos) => pawnPlacement(pos, 0, 1);
    expect(at(0).x).toBeGreaterThan(100 - CORNER);
    expect(at(0).y).toBeGreaterThan(100 - CORNER);
    expect(at(10).x).toBeLessThan(CORNER);
    expect(at(10).y).toBeGreaterThan(100 - CORNER);
    expect(at(20).x).toBeLessThan(CORNER);
    expect(at(20).y).toBeLessThan(CORNER);
    expect(at(30).x).toBeGreaterThan(100 - CORNER);
    expect(at(30).y).toBeLessThan(CORNER);
    // bottom row runs right -> left, left column bottom -> top, top row left -> right, right column top -> bottom
    for (let i = 1; i < 10; i++) expect(at(i + 1).x).toBeLessThan(at(i).x);
    for (let i = 11; i < 20; i++) expect(at(i + 1).y).toBeLessThan(at(i).y);
    for (let i = 21; i < 30; i++) expect(at(i + 1).x).toBeGreaterThan(at(i).x);
    for (let i = 31; i < BOARD_SIZE - 1; i++) expect(at(i + 1).y).toBeGreaterThan(at(i).y);
  });

  it('gives each pawn of a crowd its own spot', () => {
    for (const pos of [0, 7, 20, 33]) {
      const spots = Array.from({ length: 6 }, (_, slot) => pawnPlacement(pos, slot, 6)).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
      expect(new Set(spots).size).toBe(6);
    }
  });
});

describe('tiles', () => {
  it('draws a colour band on the inner edge and houses in it', () => {
    const out = html(1, { ownerColor: '#ff4d6d', ownerName: 'Asha', level: 3 });
    expect(out).toContain('hb-side--bottom');
    expect(out).toContain('hb-tile__band');
    expect(out.match(/<i><\/i>/g)).toHaveLength(3);
    expect(out).toContain('hb-tile__own'); // owner bar on the outer edge
    expect(out).toContain('owned by Asha');
    expect(out).toContain('₹600');
  });

  it('rings a contested tile with a lightning badge', () => {
    const out = html(5, { ownerColor: '#ff4d6d', ownerName: 'Asha', snatch: true });
    expect(out).toContain('is-snatch');
    expect(out).toContain('hb-tile__snatch');
    expect(out).toContain('hb-tile__own');
    expect(out).toContain('snatch window open');
    expect(html(5)).not.toContain('is-snatch');
    expect(html(5)).not.toContain('hb-tile__snatch');
  });

  it('shows one hotel at the top of the ladder', () => {
    const out = html(21, { ownerColor: '#3ddc97', level: 5 });
    expect(out).toContain('hb-pips is-hotel');
    expect(out).toContain('is-hotel');
    expect(out.match(/<i><\/i>/g)).toHaveLength(1);
  });

  it('glows only for a full set and never while mortgaged', () => {
    expect(html(11, { ownerColor: '#fff', setState: 'full' })).toContain('is-set');
    expect(html(11, { ownerColor: '#fff', setState: 'none' })).not.toContain('is-set');
    const m = html(11, { ownerColor: '#fff', setState: 'full', mortgaged: true });
    expect(m).not.toContain('is-set');
    expect(m).toContain('is-mortgaged');
    expect(m).toContain('hb-tile__m');
  });

  it('puts every side of the board on the right edge', () => {
    expect(html(5)).toContain('hb-side--bottom');
    expect(html(15)).toContain('hb-side--left');
    expect(html(25)).toContain('hb-side--top');
    expect(html(35)).toContain('hb-side--right');
  });

  it('labels stations, utilities, tax and the two card decks', () => {
    expect(html(5)).toContain('₹2,000');
    expect(html(12)).toContain('₹1,500');
    const ghmc = html(4);
    expect(ghmc).toContain('₹2,000');
    expect(ghmc).toContain('or 10%');
    const orr = html(38);
    expect(orr).toContain('₹1,000');
    expect(orr).not.toContain('hb-tile__or');
    expect(html(7)).toContain('hb-tile--chance');
    expect(html(7)).toContain('Farman');
    expect(html(2)).toContain('hb-tile--chest');
    expect(html(2)).toContain('Khazana');
  });

  it('gives the corners their own icon tiles', () => {
    expect(html(0)).toContain('Collect ₹2,000');
    expect(html(0)).toContain('hb-tile--br');
    expect(html(10)).toContain('Just visiting');
    expect(html(20)).toContain('Chai Break');
    expect(html(30)).toContain('Go to Jail');
    for (const id of [0, 10, 20, 30]) expect(html(id)).toContain('hb-tile--corner');
  });

  it('adds soft hyphens only to long names', () => {
    expect(softName('Koti')).toBe('Koti');
    expect(softName('Dilsukhnagar')).toBe(`Dilsukh${SHY}nagar`);
    expect(softName('Fin. District')).toBe(`Fin. Dis${SHY}trict`);
    expect(softName('Tank Bund')).toBe('Tank Bund');
  });
});

describe('tile art', () => {
  it('has art for every art key on the board', () => {
    const keys = new Set(TILES.map((t) => t.art));
    expect(keys).toEqual(new Set(['property', 'metro', 'bulb', 'water', 'tax', 'kismet', 'jail', 'plane', 'parking', 'gotojail']));
    const seen = new Map();
    for (const t of TILES) {
      const svg = renderToString(createElement(TileIcon, { tile: t, size: 40 }));
      expect(svg).toContain('<svg');
      if (!seen.has(`${t.art}:${t.deck || ''}`)) seen.set(`${t.art}:${t.deck || ''}`, svg);
    }
    // the two card decks, parking and go-to-jail are all drawn differently
    const art = (k) => seen.get(k);
    expect(art('kismet:chance')).not.toBe(art('kismet:chest'));
    expect(art('parking:')).not.toBe(art('gotojail:'));
    expect(art('parking:')).not.toBe(art('property:'));
  });
});

describe('board', () => {
  const session = {
    display: {
      players: [
        { id: 'a', name: 'Asha', color: '#ff4d6d', pos: 0 },
        { id: 'b', name: 'Bala', color: '#3ddc97', pos: 0 },
      ],
      owners: Object.assign(Array(BOARD_SIZE).fill(null), { 1: 'a', 3: 'a', 6: 'b' }),
      levels: Array(BOARD_SIZE).fill(0),
      mortgaged: Array(BOARD_SIZE).fill(false),
      turn: 0,
      phase: 'roll',
    },
  };
  const out = renderToString(createElement(Board, { session, highlightTile: 7, center: createElement('i', { id: 'panel' }) }));

  it('renders 40 tiles, two pawns and the centre slot', () => {
    expect(out.match(/data-tile="/g)).toHaveLength(BOARD_SIZE);
    expect(out.match(/hb-pawn is-turn|class="hb-pawn"/g)).toHaveLength(2);
    expect(out).toMatch(/<div class="hb-center"><i id="panel"><\/i><\/div>/);
  });

  it('marks the brown set as full for its owner and highlights the asked tile', () => {
    expect(out.match(/is-set/g)).toHaveLength(2); // tiles 1 and 3
    expect(out.match(/is-hl/g)).toHaveLength(1);
  });

  it('falls back to the brand banner without a control panel', () => {
    expect(renderToString(createElement(Board, { session }))).toContain('hb-center__banner');
  });
});

describe('snatch window on the board', () => {
  const players = [
    { id: 'a', name: 'Asha', color: '#ff4d6d', pos: 5 },
    { id: 'b', name: 'Bala', color: '#3ddc97', pos: 0 },
  ];
  const blank = () => ({ owners: Array(BOARD_SIZE).fill(null), levels: Array(BOARD_SIZE).fill(0), mortgaged: Array(BOARD_SIZE).fill(false) });
  // `display` is the presenter's delayed picture (the buy has not been animated yet); `view` is the live state.
  const live = { ...blank(), players, turn: 0, phase: 'snatch', pending: { type: 'snatch', tile: 5, buyer: 'a', price: 2000, eligible: ['b'], claims: [], ms: 3000 } };
  const delayed = { ...blank(), players, turn: 0, phase: 'roll' };
  const tileHtml = (out, id) => out.split('<button').find((chunk) => chunk.includes(`data-tile="${id}"`));

  it('rings the contested tile and shows the buyer, from the live view rather than the delayed display', () => {
    const out = renderToString(createElement(Board, { session: { view: live, display: delayed } }));
    expect(out.match(/is-snatch/g)).toHaveLength(1);
    const tile = tileHtml(out, 5);
    expect(tile).toContain('is-snatch');
    expect(tile).toContain('hb-tile__snatch');
    expect(tile).toContain('hb-tile__own'); // the buyer's bar, although display still has no owner for it
    expect(tile).toContain('owned by Asha');
    expect(tile).toContain('--o:#ff4d6d');
    expect(tileHtml(out, 6)).not.toContain('is-snatch');
  });

  it('is off outside the window', () => {
    const closed = { ...live, phase: 'manage', pending: null };
    expect(renderToString(createElement(Board, { session: { view: closed, display: delayed } }))).not.toContain('is-snatch');
    expect(renderToString(createElement(Board, { session: { display: delayed } }))).not.toContain('is-snatch');
    // another kind of pending decision is not a snatch
    const auction = { ...live, phase: 'auction', pending: { type: 'auction', tile: 5 } };
    expect(renderToString(createElement(Board, { session: { view: auction, display: delayed } }))).not.toContain('is-snatch');
  });
});

describe('city events on the board', () => {
  const players = [
    { id: 'a', name: 'Asha', color: '#ff4d6d', pos: 0 },
    { id: 'b', name: 'Bala', color: '#3ddc97', pos: 0 },
  ];
  const view = (event) => ({
    players,
    owners: Array(BOARD_SIZE).fill(null),
    levels: Array(BOARD_SIZE).fill(0),
    mortgaged: Array(BOARD_SIZE).fill(false),
    turn: 0,
    phase: 'roll',
    event,
  });
  const ev = (id, extra = {}) => ({ id, title: id, text: '', kind: id, round: 5, ...extra });
  const tileHtml = (out, id) => out.split('<button').find((chunk) => chunk.includes(`data-tile="${id}"`));
  const marked = (event) => {
    const out = renderToString(createElement(Board, { session: { view: view(event), display: view(null) } }));
    return TILES.filter((t) => tileHtml(out, t.id).includes('is-event')).map((t) => t.id);
  };
  const board = (event) => renderToString(createElement(Board, { session: { view: view(event) } }));

  it('rings every tile of the monsoon group with a rain badge and the halved rent', () => {
    expect(marked(ev('monsoon', { group: 'lightblue', mult: 0.5 }))).toEqual([6, 8, 9]);
    const out = board(ev('monsoon', { group: 'lightblue', mult: 0.5 }));
    const t = tileHtml(out, 8);
    expect(t).toContain('is-ev--rain');
    expect(t).toContain('hb-tile__ev');
    expect(t).toContain('x0.5');
    expect(t).toContain('rent halved this round');
    expect(tileHtml(out, 1)).not.toContain('hb-tile__ev');
    expect(tileHtml(out, 1)).not.toContain('rent halved');
  });

  it('rings every tile of the ipl group with a gold badge and the doubled rent', () => {
    expect(marked(ev('ipl', { group: 'brown', mult: 2 }))).toEqual([1, 3]);
    const t = tileHtml(board(ev('ipl', { group: 'darkblue', mult: 2 })), 39);
    expect(t).toContain('is-ev--star');
    expect(t).toContain('x2');
    expect(t).toContain('rent doubled this round');
  });

  it('stripes the four stations during a metro strike', () => {
    expect(marked(ev('metro_strike'))).toEqual([5, 15, 25, 35]);
    const t = tileHtml(board(ev('metro_strike')), 15);
    expect(t).toContain('is-ev--closed');
    expect(t).toContain('hb-tile__evx');
    expect(t).toContain('closed');
    expect(t).toContain('pays no rent this round');
  });

  it('marks the two tax squares free during a tax holiday', () => {
    expect(marked(ev('tax_holiday'))).toEqual([4, 38]);
    const t = tileHtml(board(ev('tax_holiday')), 4);
    expect(t).toContain('is-ev--free');
    expect(t).toContain('>free<');
    expect(t).toContain('tax free this round');
  });

  it('marks nothing without an event, for bonalu, or for a group event with no group', () => {
    expect(marked(null)).toEqual([]);
    expect(marked(undefined)).toEqual([]);
    expect(marked(ev('bonalu', { amount: 500 }))).toEqual([]);
    expect(marked(ev('monsoon'))).toEqual([]);
    expect(board(ev('bonalu', { amount: 500 }))).not.toContain('hb-tile__ev');
  });

  it('reads the live view, not the delayed display', () => {
    const delayed = view(null);
    const out = renderToString(createElement(Board, { session: { view: view(ev('metro_strike')), display: delayed } }));
    expect(out.match(/is-event/g)).toHaveLength(4);
    expect(renderToString(createElement(Board, { session: { display: view(ev('metro_strike')) } }))).not.toContain('is-event');
  });
});

describe('own traps on the board', () => {
  const players = [
    { id: 'a', name: 'Asha', color: '#ff4d6d', pos: 0 },
    { id: 'b', name: 'Bala', color: '#3ddc97', pos: 0 },
  ];
  const view = (traps) => ({
    players,
    owners: Array(BOARD_SIZE).fill(null),
    levels: Array(BOARD_SIZE).fill(0),
    mortgaged: Array(BOARD_SIZE).fill(false),
    turn: 0,
    phase: 'roll',
    traps,
  });
  const tileHtml = (out, id) => out.split('<button').find((chunk) => chunk.includes(`data-tile="${id}"`));

  it('badges only the viewer\'s own trap and says so in the label', () => {
    const traps = [{ tile: 7, owner: 'a' }, { tile: 12, owner: 'b' }];
    const out = renderToString(createElement(Board, { session: { me: 'a', view: view(traps) } }));
    expect(out.match(/hb-tile__trap/g)).toHaveLength(1);
    const t = tileHtml(out, 7);
    expect(t).toContain('has-trap');
    expect(t).toContain('your trap');
    expect(tileHtml(out, 12)).not.toContain('your trap');
  });

  it('shows nothing without traps, as a spectator, or from the delayed display', () => {
    expect(renderToString(createElement(Board, { session: { me: 'a', view: view([]) } }))).not.toContain('hb-tile__trap');
    expect(renderToString(createElement(Board, { session: { me: 'a', view: view(undefined) } }))).not.toContain('hb-tile__trap');
    expect(renderToString(createElement(Board, { session: { view: view([{ tile: 7, owner: 'a' }]) } }))).not.toContain('hb-tile__trap');
    expect(renderToString(createElement(Board, { session: { me: 'a', display: view([{ tile: 7, owner: 'a' }]) } }))).not.toContain('hb-tile__trap');
  });

  it('badges a tile through Tile directly', () => {
    const out = html(7, { trap: true });
    expect(out).toContain('hb-tile__trap');
    expect(out).toContain('your trap');
    expect(html(7)).not.toContain('hb-tile__trap');
  });
});
