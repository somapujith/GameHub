import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from './ui/helpers.js';
import '@/styles/board.css';
import '@/styles/dice.css';

// pip cells on a 3x3 grid as [row, col]
const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]],
};

function PipGrid({ value }) {
  return (PIPS[value] || []).map(([r, c]) => <i className="hb-pip" key={`${r}${c}`} style={{ gridRow: r, gridColumn: c }} />);
}

/** Flat presentational die face: white rounded square with yellow pips. value 0/undefined = blank. */
export const DiceFace = memo(function DiceFace({ value = 0, className = '', style }) {
  const v = Math.round(Number(value)) || 0;
  return (
    <span className={`hb-die ${className}`.trim()} style={style} data-value={v} aria-hidden="true">
      <PipGrid value={v} />
    </span>
  );
});

// ---- 3D cube ---------------------------------------------------------------
// Faces (opposites sum to 7): 1 front, 6 back, 2 top, 5 bottom, 3 right, 4 left.
// ORIENT[v] rotates the cube so face v looks at the viewer.
const ORIENT = {
  1: 'rotateX(0deg)',
  2: 'rotateX(-90deg)',
  3: 'rotateY(-90deg)',
  4: 'rotateY(90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateY(180deg)',
};

const jitter = (n) => (Math.random() * 2 - 1) * n;
const newSeed = () => ({ tz: jitter(11), dx: jitter(5), dy: jitter(6) });

/** Resting pose: face `v` towards the viewer, tipped so top and right faces show, plus a slight random twist. */
function restTransform(v, index, seed) {
  const face = v >= 1 && v <= 6 ? v : index ? 2 : 5;
  const vx = -17 + seed.dx;
  const vy = (index ? 19 : -21) + seed.dy;
  return `rotateX(${vx.toFixed(1)}deg) rotateY(${vy.toFixed(1)}deg) rotateZ(${seed.tz.toFixed(1)}deg) ${ORIENT[face]}`;
}

function Die3D({ value, index, rolling, reduced, settleMs = 560 }) {
  const cube = useRef(null);
  const seed = useRef(null);
  if (!seed.current) seed.current = newSeed();
  const tumbling = useRef(false);
  const [landing, setLanding] = useState(false);
  const landTimer = useRef(0);
  useEffect(() => () => clearTimeout(landTimer.current), []);

  useLayoutEffect(() => {
    const el = cube.current;
    if (!el) return undefined;
    if (rolling && !reduced) {
      if (!tumbling.current) {
        tumbling.current = true;
        // start the free tumble from the pose the die is in right now (no jump)
        const cur = getComputedStyle(el).transform;
        el.style.transition = 'none';
        el.style.setProperty('--from', cur && cur !== 'none' ? cur : 'rotateX(0deg)');
        el.classList.add('is-tumbling');
        setLanding(false);
      }
      return undefined;
    }
    if (tumbling.current) {
      // settle: freeze the tumble where it is, then ease onto the exact face
      tumbling.current = false;
      seed.current = newSeed();
      const cur = getComputedStyle(el).transform;
      el.classList.remove('is-tumbling');
      if (cur && cur !== 'none') el.style.transform = cur;
      void el.offsetWidth; // flush so the transition starts from the frozen pose
      el.style.transition = reduced ? 'none' : `transform ${settleMs}ms cubic-bezier(0.2, 1.1, 0.34, 1)`;
      el.style.transform = restTransform(value, index, seed.current);
      if (!reduced) {
        setLanding(true);
        clearTimeout(landTimer.current);
        landTimer.current = setTimeout(() => setLanding(false), settleMs);
      }
    } else {
      // first paint, or the value changed without a roll animation: swap the face
      el.style.transition = reduced ? 'none' : 'transform 380ms ease-out';
      el.style.transform = restTransform(value, index, seed.current);
    }
    return undefined;
  }, [rolling, value, index, reduced, settleMs]);

  return (
    <span className={`hb-die3d hb-die3d--${index ? 'b' : 'a'}${rolling && !reduced ? ' is-tossing' : ''}${landing ? ' is-landing' : ''}`} style={{ '--hb-die-settle': `${settleMs}ms` }}>
      <span className="hb-die3d__shadow" />
      <span className="hb-die3d__air">
        <span className="hb-cube" ref={cube}>
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <span className={`hb-face hb-face--${f}`} key={f} data-face={f}>
              <PipGrid value={f} />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

const ASSIST_NOTE = { comeback: 'Comeback boost', mercy: 'Mercy rule', pity: 'A bonus roll was due' };

/** Small "Lucky dice 🍀" badge, shown when the game uses lucky dice (`view.cfg.dice === 'lucky'`). */
export function LuckyBadge({ session }) {
  const mode = session?.view?.cfg?.dice ?? session?.display?.cfg?.dice;
  if (mode !== 'lucky') return null;
  return (
    <span className="hb-lucky" title="Lucky dice: a small, bounded nudge that helps players who are behind">
      Lucky dice <span aria-hidden="true">🍀</span>
    </span>
  );
}

/** A single presentational die. The roll control lives between the players. */
export function Dice({ session }) {
  const reduced = useReducedMotion();
  const rolling = !!session?.rolling;
  const shown = session?.display?.dice || session?.view?.dice || [0];
  const value = shown[0] || 3;
  const legacy = shown.length > 1 && Number.isInteger(shown[1]);
  const assist = session?.display?.assist || null;
  const total = shown.reduce((sum, n) => sum + (Number(n) || 0), 0);
  const hint = rolling ? 'Rolling…' : total === 0 ? 'Ready to roll' : legacy ? `Moved ${total} spaces` : value === 6 ? 'Six! Kya baat hai.' : `Rolled ${value}`;

  return (
    <div className={`hb-dice hb-dice--single${rolling ? ' is-rolling' : ''}${reduced ? ' is-reduced' : ''}`} role="group" aria-label="Single die" aria-busy={rolling}>
      <span className="hb-dice__row" aria-hidden="true">
        <Die3D value={value} index={0} rolling={rolling} reduced={reduced} settleMs={session?.display?.diceSettleMs ?? 560} />
      </span>
      <span className="hb-dice__hint" aria-hidden="true">{hint}</span>
      <span className="hb-sr" role="status" aria-live="polite" aria-atomic="true">
        {rolling ? 'Rolling the die' : total === 0 ? 'Die ready. Use the roll button between the players.' : legacy ? `Previous game roll: ${shown.join(' and ')}. Move ${total} spaces.` : `Die shows ${value}. Move ${value} ${value === 1 ? 'space' : 'spaces'}.`}
      </span>
      {assist && !rolling ? <span className="hb-dice__assist" title={ASSIST_NOTE[assist] || 'Lucky help'}>Lucky help <span aria-hidden="true">✦</span></span> : null}
    </div>
  );
}

export default Dice;
