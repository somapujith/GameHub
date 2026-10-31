import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE, GRID, JAIL_TILE, PARKING_TILE, GO_TO_JAIL_TILE, START_TILE, TILES, GROUPS, GROUP_TILES,
  TRANSPORT_RENT, UTILITY_MULT, MAX_LEVEL, tilePosition, tileSide, rentFor, upgradeCost, mortgageValue,
  unmortgageCost, setMultiplier, taxDue, isBuyable,
} from './board.js';

const cells = Array.from({ length: BOARD_SIZE }, (_, i) => tilePosition(i));
const LAST = GRID - 1;

describe('board layout', () => {
  it('puts START bottom-right and the other corners where the clockwise loop needs them', () => {
    expect(BOARD_SIZE).toBe(40);
    expect(cells[START_TILE]).toEqual({ col: LAST, row: LAST }); // bottom-right
    expect(cells[JAIL_TILE]).toEqual({ col: 0, row: LAST }); // bottom-left
    expect(cells[PARKING_TILE]).toEqual({ col: 0, row: 0 }); // top-left
    expect(cells[GO_TO_JAIL_TILE]).toEqual({ col: LAST, row: 0 }); // top-right
    for (const i of [START_TILE, JAIL_TILE, PARKING_TILE, GO_TO_JAIL_TILE]) expect(TILES[i].corner).toBe(true);
  });

  it('covers the 40 border cells exactly once, one step apart, and closes the loop', () => {
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(BOARD_SIZE);
    for (const { col, row } of cells) {
      expect(col === 0 || col === LAST || row === 0 || row === LAST).toBe(true);
    }
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = cells[i];
      const b = cells[(i + 1) % BOARD_SIZE];
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });

  it('runs clockwise: left along the bottom, up the left side, right along the top, down the right', () => {
    // Grid rows grow downwards, so "up" is a falling row.
    expect(cells[1].col).toBeLessThan(cells[0].col); // first move goes left along the bottom row
    expect(cells[11].row).toBeLessThan(cells[10].row); // up the left column
    expect(cells[21].col).toBeGreaterThan(cells[20].col); // along the top, rightwards
    expect(cells[31].row).toBeGreaterThan(cells[30].row); // down the right column

    // Signed area of the loop (screen coordinates, y down): positive means clockwise.
    let area = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = cells[i];
      const b = cells[(i + 1) % BOARD_SIZE];
      area += a.col * b.row - b.col * a.row;
    }
    expect(area).toBeGreaterThan(0);
  });

  it('tileSide names the side of every tile', () => {
    expect([0, 5, 10].map(tileSide)).toEqual(['bottom', 'bottom', 'bottom']);
    expect([11, 15, 20].map(tileSide)).toEqual(['left', 'left', 'left']);
    expect([21, 25, 30].map(tileSide)).toEqual(['top', 'top', 'top']);
    expect([31, 35, 39].map(tileSide)).toEqual(['right', 'right', 'right']);
  });
});

describe('board data', () => {
  it('has 40 tiles with their index as id and the square types of the spec', () => {
    expect(TILES).toHaveLength(BOARD_SIZE);
    TILES.forEach((t, i) => expect(t.id).toBe(i));
    expect(TILES.filter((t) => t.type === 'transport').map((t) => t.id)).toEqual([5, 15, 25, 35]);
    expect(TILES.filter((t) => t.type === 'utility').map((t) => t.id)).toEqual([12, 28]);
    expect(TILES.filter((t) => t.type === 'kismet').map((t) => `${t.id}:${t.deck}`)).toEqual([
      '2:chest', '7:chance', '17:chest', '22:chance', '33:chest', '36:chance',
    ]);
    expect(TILES.filter((t) => t.type === 'tax').map((t) => t.id)).toEqual([4, 38]);
    expect(TILES[JAIL_TILE].type).toBe('jail');
    expect(TILES[PARKING_TILE].type).toBe('parking');
    expect(TILES[GO_TO_JAIL_TILE].type).toBe('gotojail');
  });

  it('splits the 22 properties into the eight colour groups', () => {
    expect(Object.keys(GROUPS)).toEqual(['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue']);
    expect(GROUP_TILES).toEqual({
      brown: [1, 3], lightblue: [6, 8, 9], pink: [11, 13, 14], orange: [16, 18, 19],
      red: [21, 23, 24], yellow: [26, 27, 29], green: [31, 32, 34], darkblue: [37, 39],
    });
    expect(TILES.filter((t) => t.type === 'property')).toHaveLength(22);
  });

  it('every buyable tile has a price and a mortgage; properties have a 6-step rent table and a house cost', () => {
    for (const t of TILES.filter(isBuyable)) {
      expect(t.price).toBeGreaterThan(0);
      expect(mortgageValue(t)).toBeGreaterThan(0);
      expect(unmortgageCost(t)).toBeGreaterThan(mortgageValue(t));
    }
    for (const t of TILES.filter((x) => x.type === 'property')) {
      expect(t.rent).toHaveLength(MAX_LEVEL + 1);
      expect([...t.rent].sort((a, b) => a - b)).toEqual(t.rent); // rent only rises with buildings
      expect(upgradeCost(t)).toBeGreaterThan(0);
      expect(rentFor(t, MAX_LEVEL)).toBe(t.rent[MAX_LEVEL]);
      expect(rentFor(t, 99)).toBe(t.rent[MAX_LEVEL]); // clamped to the hotel
    }
  });

  it('matches the spec tables for a few sample squares', () => {
    expect(TILES[1]).toMatchObject({ name: 'Dilsukhnagar', price: 600, rent: [20, 100, 300, 900, 1600, 2500], houseCost: 500, mortgage: 300 });
    expect(TILES[39]).toMatchObject({ name: 'Financial District', price: 4000, rent: [500, 2000, 6000, 14000, 17000, 20000], houseCost: 2000, mortgage: 2000 });
    expect(TILES[5]).toMatchObject({ price: 2000, mortgage: 1000 });
    expect(TILES[12]).toMatchObject({ price: 1500, mortgage: 750 });
    expect(TRANSPORT_RENT).toEqual([0, 250, 500, 1000, 2000]);
    expect(UTILITY_MULT).toEqual([0, 40, 100]);
  });

  it('only a FULL colour set doubles the base rent', () => {
    expect(setMultiplier(1, 3)).toBe(1);
    expect(setMultiplier(2, 3)).toBe(1);
    expect(setMultiplier(3, 3)).toBe(2);
    expect(setMultiplier(1, 2)).toBe(1);
    expect(setMultiplier(2, 2)).toBe(2);
  });

  it('GHMC tax is the lower of 2,000 and 10% of worth; the ORR toll is a flat 1,000', () => {
    const ghmc = TILES[4];
    expect(taxDue(ghmc, 15000)).toBe(1500);
    expect(taxDue(ghmc, 20000)).toBe(2000);
    expect(taxDue(ghmc, 80000)).toBe(2000);
    expect(taxDue(ghmc, 0)).toBe(0);
    expect(taxDue(TILES[38], 0)).toBe(1000);
    expect(taxDue(TILES[38], 90000)).toBe(1000);
  });
});
