import { memo, useState } from 'react';
import { GRID, tilePosition, tileSide } from '@shared/board.js';
import '@/styles/board.css';

// Offsets (as a fraction of the tile's own width/height, from its centre) so up to 6 pawns fan out
// without overlapping.
const FAN = {
  1: [[0, 0.02]],
  2: [[-0.22, 0.04], [0.22, 0.04]],
  3: [[-0.2, -0.15], [0.2, -0.15], [0, 0.2]],
  4: [[-0.21, -0.19], [0.21, -0.19], [-0.21, 0.2], [0.21, 0.2]],
  5: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.14, 0.2], [0.14, 0.2]],
  6: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.27, 0.2], [0, 0.2], [0.27, 0.2]],
};
// Pawn diameter in edge-tile units (--hb-u) by crowd size.
const DIAMETER = { 1: 0.46, 2: 0.38, 3: 0.33, 4: 0.3, 5: 0.25, 6: 0.25 };

// Corner tiles keep their icon + label pill in the lower third, so the fan sits in the upper ~60%
// of the tile. A corner is 1.4 edge tiles wide, so its pawns are larger in absolute terms.
const CORNERS = new Set([0, 10, 20, 30]);
const CORNER_FAN = {
  1: [[0, -0.12]],
  2: [[-0.2, -0.14], [0.2, -0.14]],
  3: [[-0.2, -0.24], [0.2, -0.24], [0, -0.03]],
  4: [[-0.2, -0.25], [0.2, -0.25], [-0.2, 0], [0.2, 0]],
  5: [[-0.3, -0.27], [0, -0.27], [0.3, -0.27], [-0.15, -0.02], [0.15, -0.02]],
  6: [[-0.3, -0.27], [0, -0.27], [0.3, -0.27], [-0.3, -0.02], [0, -0.02], [0.3, -0.02]],
};
const CORNER_DIAMETER = { 1: 0.6, 2: 0.48, 3: 0.42, 4: 0.38, 5: 0.32, 6: 0.32 };

// Track geometry in edge-tile units, mirroring `.hb-grid` in board.css: the two corner tracks are
// CORNER_W wide, the nine between them are 1.
const CORNER_W = 1.4;
const TOTAL = CORNER_W * 2 + (GRID - 2);
const trackSize = (i) => (i === 0 || i === GRID - 1 ? CORNER_W : 1);
const trackStart = (i) => (i === 0 ? 0 : CORNER_W + (i - 1));

// Edge tiles keep their colour band / icon on the inner side, so the pawn rests a little towards the outer edge.
const OUTWARD = 0.08;
const PUSH = { bottom: [0, 1], top: [0, -1], left: [-1, 0], right: [1, 0] };

/** Where a pawn sits: percentage coordinates inside the 11x11 grid overlay, and its diameter in edge-tile units. */
export function pawnPlacement(pos, slot = 0, count = 1) {
  const { col, row } = tilePosition(pos);
  const n = Math.min(6, Math.max(1, count));
  const corner = CORNERS.has(pos);
  const fan = corner ? CORNER_FAN : FAN;
  let [ox, oy] = (fan[n] || fan[1])[Math.min(slot, n - 1)];
  if (!corner) {
    const [px, py] = PUSH[tileSide(pos)];
    ox += px * OUTWARD;
    oy += py * OUTWARD;
  }
  return {
    x: ((trackStart(col) + trackSize(col) * (0.5 + ox)) / TOTAL) * 100,
    y: ((trackStart(row) + trackSize(row) * (0.5 + oy)) / TOTAL) * 100,
    d: (corner ? CORNER_DIAMETER : DIAMETER)[n],
  };
}

/**
 * A single player disc. `pos` is the tile id (the presenter steps it one tile at a time),
 * `slot`/`count` say how many pawns share the tile. Hidden when bankrupt.
 */
function PawnImpl({ name = '', color = '#ffd23f', pos = 0, slot = 0, count = 1, isTurn = false, jailed = false, bankrupt = false, tileName = '' }) {
  // Re-key the hop and shadow whenever the pawn moves, so the lift-carry-set-down replays per step.
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
        {/* The shadow stays on the board while the pawn is lifted, then tightens as it is set down. */}
        <span className={`hb-pawn__shadow${steps ? ' is-step' : ''}`} key={`s${steps}`} />
        <span className={`hb-pawn__hop${steps ? ' is-step' : ''}`} key={steps}>
          <span className="hb-pawn__disc">
            <span className="hb-pawn__dot" />
          </span>
          {isTurn && <span className="hb-pawn__marker" />}
        </span>
      </span>
    </div>
  );
}

export const Pawn = memo(PawnImpl);
export default Pawn;
