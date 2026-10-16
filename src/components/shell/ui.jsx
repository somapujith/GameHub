import { useId } from 'react';
import { Avatar } from '@/components/art/index.js';
import { CoinIcon, Icon } from './icons.jsx';

const nf = new Intl.NumberFormat('en-IN');
export const fmtNum = (n) => nf.format(Math.round(Number(n) || 0));

/** Avatar inside a gold/indigo ring with an optional presence dot ('on' | 'off' | undefined). */
export function AvatarRing({ preset = 0, size = 48, tone = 'gold', dot, className = '' }) {
  return (
    <span className={`hh-avring hh-avring--${tone} ${className}`.trim()} style={{ '--sz': `${size}px` }}>
      <Avatar preset={Number(preset) || 0} size={size} />
      {dot && <i className={`hh-avring__dot hh-avring__dot--${dot}`} />}
    </span>
  );
}

/** Coins with the little gold coin glyph. */
export function Coins({ value, className = '', size = 18 }) {
  return (
    <span className={`hh-coins ${className}`.trim()}>
      <CoinIcon size={size} />
      <b>{fmtNum(value)}</b>
    </span>
  );
}

/** Level + XP progress bar. */
export function XpBar({ level, into, need, pct, compact = false }) {
  return (
    <div className={`hh-xp ${compact ? 'hh-xp--compact' : ''}`}>
      <div className="hh-xp__top">
        <span className="hh-xp__lvl">
          <Icon name="bolt" size={14} /> Level {level}
        </span>
        <span className="hh-xp__nums">
          {fmtNum(into)} / {fmtNum(need)} XP
        </span>
      </div>
      <div
        className="hh-xp__track"
        role="progressbar"
        aria-label="Experience"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Accessible on/off switch row. */
export function Toggle({ checked, onChange, label, hint, disabled, icon, id }) {
  const auto = useId();
  const uid = id || auto;
  return (
    <div className={`hh-toggle ${disabled ? 'is-disabled' : ''}`}>
      {icon && <span className="hh-toggle__icon">{icon}</span>}
      <label className="hh-toggle__text" htmlFor={uid}>
        <span className="hh-toggle__label">{label}</span>
        {hint && <span className="hh-toggle__hint">{hint}</span>}
      </label>
      <button
        id={uid}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        className="hh-switch"
        onClick={() => onChange?.(!checked)}
      >
        <i />
      </button>
    </div>
  );
}

/**
 * Arrow-key navigation for a role="radiogroup" container (WAI-ARIA radio pattern):
 * Arrow keys / Home / End move focus to the next enabled radio and select it.
 * Pass as the container's onKeyDown; it ignores keys that did not come from a radio.
 */
export function radioKeyNav(e) {
  if (e.target?.getAttribute?.('role') !== 'radio') return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step && e.key !== 'Home' && e.key !== 'End') return;
  const radios = [...e.currentTarget.querySelectorAll('[role="radio"]:not(:disabled)')];
  const cur = radios.indexOf(e.target);
  if (!radios.length || cur < 0) return;
  let next = cur;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = radios.length - 1;
  else next = (cur + step + radios.length) % radios.length;
  e.preventDefault();
  radios[next].focus();
  radios[next].click();
}

/** Segmented control (radio-group semantics). options: [{value,label,sub?}] */
export function Segmented({ value, onChange, options, label, className = '', size = 'md' }) {
  return (
    <div className={`hh-seg hh-seg--${size} ${className}`.trim()} role="radiogroup" aria-label={label} onKeyDown={radioKeyNav}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            className={`hh-seg__opt ${on ? 'is-on' : ''}`}
            onClick={() => !o.disabled && onChange?.(o.value)}
          >
            <span>{o.label}</span>
            {o.sub && <small>{o.sub}</small>}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ w, h = 16, r = 8, className = '' }) {
  return <span className={`hh-skel ${className}`.trim()} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

/** Friendly empty / error block. */
export function EmptyState({ icon = 'sparkle', title, children, action }) {
  return (
    <div className="hh-empty">
      <span className="hh-empty__icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="hh-empty__title">{title}</p>
      {children && <p className="hh-empty__text">{children}</p>}
      {action && <div className="hh-empty__action">{action}</div>}
    </div>
  );
}

const MEDALS = ['#ffd24d', '#d9deea', '#e09a5b'];

/** Round rank badge; top 3 get gold / silver / bronze medals. */
export function RankMedal({ rank, size = 34 }) {
  const i = rank - 1;
  if (i >= 0 && i < 3) {
    return (
      <span className="hh-medal" style={{ '--sz': `${size}px`, '--mc': MEDALS[i] }} aria-label={`Rank ${rank}`}>
        <b>{rank}</b>
      </span>
    );
  }
  return (
    <span className="hh-medal hh-medal--plain" style={{ '--sz': `${size}px` }} aria-label={`Rank ${rank}`}>
      <b>{rank}</b>
    </span>
  );
}
