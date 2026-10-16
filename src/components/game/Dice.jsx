import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx.js';
import '@/styles/board.css';

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

function Die3D({ value, index, rolling, reduced }) {
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
      el.style.transition = reduced ? 'none' : 'transform 560ms cubic-bezier(0.2, 1.1, 0.34, 1)';
      el.style.transform = restTransform(value, index, seed.current);
      if (!reduced) {
        setLanding(true);
        clearTimeout(landTimer.current);
        landTimer.current = setTimeout(() => setLanding(false), 700);
      }
    } else {
      // first paint, or the value changed without a roll animation: swap the face
      el.style.transition = reduced ? 'none' : 'transform 380ms ease-out';
      el.style.transform = restTransform(value, index, seed.current);
    }
    return undefined;
  }, [rolling, value, index, reduced]);

  return (
    <span className={`hb-die3d hb-die3d--${index ? 'b' : 'a'}${rolling && !reduced ? ' is-tossing' : ''}${landing ? ' is-landing' : ''}`}>
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try {
      return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

function isTypingTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

let lastRollAt = 0;

const ASSIST_NOTE = {
  comeback: 'Comeback boost',
  mercy: 'Mercy rule',
  pity: 'Doubles were due',
};

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

/**
 * Two 3D dice. Shows `session.display.dice`; tumbles while `session.rolling` and lands exactly on the
 * values; becomes a big pulsing "Tap to roll" button while `session.options.roll`.
 * Space also rolls (not while typing, not while a dialog is open, not on a focused button).
 */
export function Dice({ session }) {
  const reduced = usePrefersReducedMotion();
  const rolling = !!session?.rolling;
  const canRoll = !!session?.options?.roll && !session?.busy && !rolling;
  const shown = session?.display?.dice || [0, 0];
  const assist = session?.display?.assist || null;

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  // "Lucky dice helped" pop: once per roll, after the dice have landed
  const rollSeq = useRef(0);
  const popShownFor = useRef(0);
  const [pop, setPop] = useState(null);
  useEffect(() => {
    if (rolling) {
      rollSeq.current += 1;
      setPop(null);
    }
  }, [rolling]);
  useEffect(() => {
    if (rolling || !assist || popShownFor.current === rollSeq.current) return undefined;
    popShownFor.current = rollSeq.current;
    setPop({ key: rollSeq.current, assist });
    const t = setTimeout(() => setPop(null), 2800);
    return () => clearTimeout(t);
  }, [rolling, assist]);

  const roll = () => {
    const s = sessionRef.current;
    if (!s?.options?.roll || s.busy || s.rolling) return;
    const now = Date.now();
    if (now - lastRollAt < 400) return; // Space + click (or two listeners) must not double-roll
    lastRollAt = now;
    try {
      sfx?.unlock?.();
    } catch {
      /* audio is optional */
    }
    s.dispatch?.({ type: 'ROLL' });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = sessionRef.current;
      if (!s?.options?.roll || s.busy || s.rolling) return;
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      // A focused button/link already activates itself with Space.
      if (e.target?.closest?.('button, a[href], summary, [role="button"], [role="menuitem"], [role="tab"], [role="switch"]')) return;
      if (document.querySelector('[role=dialog]')) return;
      e.preventDefault();
      roll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const total = (shown[0] || 0) + (shown[1] || 0);
  const doubles = shown[0] > 0 && shown[0] === shown[1];

  let hint = '';
  if (canRoll) hint = 'Tap to roll';
  else if (rolling) hint = 'Rolling…';
  else if (total > 0) hint = doubles ? `Doubles! ${total}` : `Rolled ${total}`;

  const cls = ['hb-dice'];
  if (canRoll) cls.push('is-ready');
  if (rolling) cls.push('is-rolling');
  const body = (
    <>
      <span className="hb-dice__row">
        <Die3D value={shown[0]} index={0} rolling={rolling} reduced={reduced} />
        <Die3D value={shown[1]} index={1} rolling={rolling} reduced={reduced} />
      </span>
      <span className={`hb-dice__hint${canRoll ? ' is-cta' : ''}`}>{hint || ' '}</span>
      <span className="hb-sr" aria-live="polite">
        {rolling ? 'Rolling the dice' : total > 0 ? `Dice show ${shown[0]} and ${shown[1]}` : ''}
      </span>
      {pop && (
        <span className="hb-assist" key={pop.key} title={ASSIST_NOTE[pop.assist] || undefined} aria-hidden="true">
          Lucky dice helped <span>🍀</span>
        </span>
      )}
    </>
  );

  if (canRoll) {
    return (
      <button type="button" className={cls.join(' ')} aria-label="Roll dice" onClick={roll}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls.join(' ')} role="group" aria-label="Dice">
      {body}
    </div>
  );
}

export default Dice;
