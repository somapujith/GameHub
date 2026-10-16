import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, AUCTION_TILE, JAIL_TILE, KISMET_CORNER, START_TILE, tilePosition } from './board.js';

const cells = Array.from({ length: BOARD_SIZE }, (_, i) => tilePosition(i));

describe('board layout', () => {
  it('puts START bottom-left and the other corners where the clockwise loop needs them', () => {
    expect(cells[START_TILE]).toEqual({ col: 0, row: 7 });
    expect(cells[AUCTION_TILE]).toEqual({ col: 0, row: 0 }); // top-left
    expect(cells[JAIL_TILE]).toEqual({ col: 7, row: 0 }); // top-right
    expect(cells[KISMET_CORNER]).toEqual({ col: 7, row: 7 }); // bottom-right
  });

  it('covers the 28 border cells exactly once, one step apart, and closes the loop', () => {
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(BOARD_SIZE);
    for (const { col, row } of cells) {
      expect(col === 0 || col === 7 || row === 0 || row === 7).toBe(true);
    }
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = cells[i];
      const b = cells[(i + 1) % BOARD_SIZE];
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });

  it('runs clockwise: up the left side, then right along the top, down the right, left along the bottom', () => {
    // Grid rows grow downwards, so "up" is a falling row.
    expect(cells[1].row).toBeLessThan(cells[0].row); // first move goes up the left column
    expect(cells[8].col).toBeGreaterThan(cells[7].col); // along the top, rightwards
    expect(cells[15].row).toBeGreaterThan(cells[14].row); // down the right column
    expect(cells[22].col).toBeLessThan(cells[21].col); // along the bottom, leftwards

    // Signed area of the loop (screen coordinates, y down): positive means clockwise.
    let area = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = cells[i];
      const b = cells[(i + 1) % BOARD_SIZE];
      area += a.col * b.row - b.col * a.row;
    }
    expect(area).toBeGreaterThan(0);
  });
});
