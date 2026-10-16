import { useEffect, useRef } from 'react';
import { formatINR } from '@shared/format.js';
import { Icon } from './icons.jsx';
import { GOAL_MAX, GOAL_STEP } from './gameSettings.js';

/** Move to the next multiple of `step` in direction `dir`, clamped to [min, max]. */
function stepValue(v, dir, min, max) {
  const next = dir > 0 ? (Math.floor(v / GOAL_STEP) + 1) * GOAL_STEP : (Math.ceil(v / GOAL_STEP) - 1) * GOAL_STEP;
  return Math.max(min, Math.min(max, next));
}

/**
 * Custom net-worth target stepper (₹5,000 steps). Tap to step, press and hold to repeat,
 * Enter/Space on a focused button also steps. Home/End jump to the limits on the value.
 */
export default function GoalStepper({ value, onChange, min, max = GOAL_MAX, label = 'Custom target' }) {
  const hold = useRef({ t: null, i: null });
  const latest = useRef(value);
  latest.current = value;

  const stop = () => {
    clearTimeout(hold.current.t);
    clearInterval(hold.current.i);
  };
  useEffect(() => stop, []);

  const bump = (dir) => {
    const next = stepValue(latest.current, dir, min, max);
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
    }
  };

  const start = (dir) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    stop();
    bump(dir);
    hold.current.t = setTimeout(() => {
      hold.current.i = setInterval(() => bump(dir), 70);
    }, 420);
  };

  // Keyboard activation arrives as a click with detail === 0 (pointer clicks were handled on pointerdown).
  const key = (dir) => (e) => {
    if (e.detail === 0) bump(dir);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className="hh-stepper" role="group" aria-label={label}>
      <span className="hh-stepper__label" aria-hidden="true">
        {label}
      </span>
      <div className="hh-stepper__ctl">
        <button
          type="button"
          className="hh-stepper__btn"
          disabled={atMin}
          aria-label={`Decrease target by ${formatINR(GOAL_STEP)}`}
          onPointerDown={start(-1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={key(-1)}
        >
          <Icon name="minus" size={20} strokeWidth={2.8} />
        </button>
        <output
          className="hh-stepper__value"
          tabIndex={0}
          aria-live="polite"
          aria-label={`Winning target ${formatINR(value)}`}
          onKeyDown={(e) => {
            const act = {
              ArrowUp: () => bump(1),
              ArrowRight: () => bump(1),
              ArrowDown: () => bump(-1),
              ArrowLeft: () => bump(-1),
              Home: () => onChange(min),
              End: () => onChange(max),
            }[e.key];
            if (act) {
              e.preventDefault();
              act();
            }
          }}
        >
          {formatINR(value)}
        </output>
        <button
          type="button"
          className="hh-stepper__btn"
          disabled={atMax}
          aria-label={`Increase target by ${formatINR(GOAL_STEP)}`}
          onPointerDown={start(1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onClick={key(1)}
        >
          <Icon name="plus" size={20} strokeWidth={2.8} />
        </button>
      </div>
    </div>
  );
}
