import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from './ui/helpers.js';
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
  return (PIPS[value] || []).map(([r, c]) => <i className="cp-pip" key={`${r}${c}`} style={{ gridRow: r, gridColumn: c }} />);
}

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
function restTransform(v, seed) {
  const face = v >= 1 && v <= 6 ? v : 5;
  const vx = -17 + seed.dx;
  const vy = -21 + seed.dy;
  return `rotateX(${vx.toFixed(1)}deg) rotateY(${vy.toFixed(1)}deg) rotateZ(${seed.tz.toFixed(1)}deg) ${ORIENT[face]}`;
}

function Die3D({ value, rolling, reduced, settleMs = 560 }) {
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
      el.style.transform = restTransform(value, seed.current);
      if (!reduced) {
        setLanding(true);
        clearTimeout(landTimer.current);
        landTimer.current = setTimeout(() => setLanding(false), settleMs);
      }
    } else {
      // first paint, or the value changed without a roll animation: swap the face
      el.style.transition = reduced ? 'none' : 'transform 380ms ease-out';
      el.style.transform = restTransform(value, seed.current);
    }
    return undefined;
  }, [rolling, value, reduced, settleMs]);

  return (
    <span className={`cp-die3d${rolling && !reduced ? ' is-tossing' : ''}${landing ? ' is-landing' : ''}`} style={{ '--cp-die-settle': `${settleMs}ms` }}>
      <span className="cp-die3d__shadow" />
      <span className="cp-die3d__air">
        <span className="cp-cube" ref={cube}>
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <span className={`cp-face cp-face--${f}`} key={f} data-face={f}>
              <PipGrid value={f} />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

const ASSIST_NOTE = { comeback: 'Comeback boost', mercy: 'Mercy rule', pity: 'A bonus roll was due', antibust: 'Anti-bust' };

/** Small "Lucky dice" badge, shown when the game uses lucky dice (`view.cfg.dice === 'lucky'`). */
export function LuckyBadge({ session }) {
  const mode = session?.view?.cfg?.dice ?? session?.display?.cfg?.dice;
  if (mode !== 'lucky') return null;
  return (
    <span className="cp-lucky" title="Lucky dice: a small, bounded nudge that helps players who are behind">
      Lucky dice <span aria-hidden="true">🍀</span>
    </span>
  );
}

/** The die as the last roll left it (0 = not rolled yet). */
const shownDie = (session) => Math.round(Number((session?.display?.dice || session?.view?.dice || [0])[0])) || 0;

/** The number to feed rent previews (utilities pay a multiple of the die): the last roll, else a typical 4. */
export const dieValue = (session) => shownDie(session) || 4;

/** The one presentational die. Rolling is done by the primary button of the control panel. */
export function Dice({ session }) {
  const reduced = useReducedMotion();
  const rolling = !!session?.rolling;
  const value = shownDie(session);
  const assist = session?.display?.assist || null;
  const settleMs = session?.display?.diceSettleMs ?? 560;

  let hint;
  let announce;
  if (rolling) {
    hint = 'Rolling…';
    announce = 'Rolling the die';
  } else if (value === 0) {
    hint = 'Ready to roll';
    announce = 'Die ready. Use the roll button.';
  } else {
    hint = value === 6 ? 'Six! Roll again' : `Rolled ${value}`;
    announce = `Die shows ${value}. Move ${value} ${value === 1 ? 'space' : 'spaces'}.`;
  }

  return (
    <div className={`cp-dice${rolling ? ' is-rolling' : ''}${reduced ? ' is-reduced' : ''}`} role="group" aria-label="Die" aria-busy={rolling}>
      <span className="cp-dice__row" aria-hidden="true">
        <Die3D value={value} rolling={rolling} reduced={reduced} settleMs={settleMs} />
      </span>
      <span className="cp-dice__hint" aria-hidden="true">{hint}</span>
      <span className="cp-sr" role="status" aria-live="polite" aria-atomic="true">{announce}</span>
      {assist && !rolling ? <span className="cp-dice__assist" title={ASSIST_NOTE[assist] || 'Lucky help'}>Lucky help <span aria-hidden="true">✦</span></span> : null}
    </div>
  );
}

export default Dice;
