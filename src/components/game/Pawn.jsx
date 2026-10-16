import { memo, useState } from 'react';
import { tilePosition } from '@shared/board.js';
import '@/styles/board.css';

// Offsets (in tile units, from the tile centre) so up to 6 pawns fan out without overlapping.
const FAN = {
  1: [[0, 0.02]],
  2: [[-0.22, 0.04], [0.22, 0.04]],
  3: [[-0.2, -0.15], [0.2, -0.15], [0, 0.2]],
  4: [[-0.21, -0.19], [0.21, -0.19], [-0.21, 0.2], [0.21, 0.2]],
  5: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.14, 0.2], [0.14, 0.2]],
  6: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.27, 0.2], [0, 0.2], [0.27, 0.2]],
};
// Pawn diameter in tile units by crowd size.
const DIAMETER = { 1: 0.54, 2: 0.42, 3: 0.36, 4: 0.34, 5: 0.27, 6: 0.27 };

// Corner tiles keep their icon + label pill (START / AUCTION / JAIL / KISMET) in the lower third,
// so the fan sits in the upper ~60% of the tile and the pawns are a little smaller.
const CORNERS = new Set([0, 7, 14, 21]);
const CORNER_FAN = {
  1: [[0, -0.12]],
  2: [[-0.2, -0.14], [0.2, -0.14]],
  3: [[-0.2, -0.24], [0.2, -0.24], [0, -0.03]],
  4: [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0], [0.2, 0]],
  5: [[-0.3, -0.27], [0, -0.27], [0.3, -0.27], [-0.15, -0.02], [0.15, -0.02]],
  6: [[-0.3, -0.27], [0, -0.27], [0.3, -0.27], [-0.3, -0.02], [0, -0.02], [0.3, -0.02]],
};
const CORNER_DIAMETER = { 1: 0.42, 2: 0.34, 3: 0.3, 4: 0.27, 5: 0.23, 6: 0.23 };

/** Where a pawn sits: percentage coordinates inside the 8x8 grid overlay. */
export function pawnPlacement(pos, slot = 0, count = 1) {
  const { col, row } = tilePosition(pos);
  const n = Math.min(6, Math.max(1, count));
  const corner = CORNERS.has(pos);
  const fan = corner ? CORNER_FAN : FAN;
  const [ox, oy] = (fan[n] || fan[1])[Math.min(slot, n - 1)];
  return {
    x: ((col + 0.5 + ox) / 8) * 100,
    y: ((row + 0.5 + oy) / 8) * 100,
    d: (corner ? CORNER_DIAMETER : DIAMETER)[n],
  };
}

/**
 * A single player disc. `pos` is the tile id (the presenter steps it one tile at a time),
 * `slot`/`count` say how many pawns share the tile. Hidden when bankrupt.
 */
function PawnImpl({ name = '', color = '#ffd23f', pos = 0, slot = 0, count = 1, isTurn = false, jailed = false, bankrupt = false, tileName = '' }) {
  // Re-key the hop element whenever the pawn moves, so the little hop replays per step.
  const [seen, setSeen] = useState(pos);
  const [steps, setSteps] = useState(0);
  if (seen !== pos) {
    setSeen(pos);
    setSteps(steps + 1);
  }
  if (bankrupt) return null;

  const { x, y, d } = pawnPlacement(pos, slot, count);
  const style = {
    '--x': `${x}%`,
    '--y': `${y}%`,
    '--pd': d,
    '--c': color,
    zIndex: isTurn ? 20 : 10 + slot,
  };
  const cls = ['hb-pawn'];
  if (isTurn) cls.push('is-turn');
  if (jailed) cls.push('is-jailed');

  return (
    <div className={cls.join(' ')} style={style} role="img" aria-label={`${name}${tileName ? ` on ${tileName}` : ''}${isTurn ? ', current turn' : ''}`}>
      <span className="hb-pawn__body">
        <span className="hb-pawn__shadow" />
        <span className={`hb-pawn__hop${steps ? ' is-step' : ''}`} key={steps}>
          <span className="hb-pawn__disc">
            <span className="hb-pawn__dot" />
          </span>
        </span>
        {isTurn && <span className="hb-pawn__marker" />}
      </span>
    </div>
  );
}

export const Pawn = memo(PawnImpl);
export default Pawn;
