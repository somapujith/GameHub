// Form controls for the menu: Switch (role=switch) and Segmented (radio group).
import { useId } from 'react';
import Icon from './Icon.jsx';

export function Switch({ checked, onChange, label, hint, icon, disabled = false }) {
  const id = useId();
  return (
    <div className={`hg-row-ctl${disabled ? ' is-disabled' : ''}`}>
      {icon ? <span className="hg-row-ico"><Icon name={icon} size={20} /></span> : null}
      <span className="hg-row-txt">
        <label htmlFor={id}>{label}</label>
        {hint ? <small>{hint}</small> : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        className={`hg-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange?.(!checked)}
      >
        <span className="hg-switch-knob" />
      </button>
    </div>
  );
}

export function Segmented({ value, options, onChange, label, icon }) {
  const id = useId();
  return (
    <div className="hg-seg-wrap">
      <div className="hg-row-ctl hg-row-ctl--head">
        {icon ? <span className="hg-row-ico"><Icon name={icon} size={20} /></span> : null}
        <span className="hg-row-txt"><span id={id}>{label}</span></span>
      </div>
      <div className="hg-seg" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`hg-seg-opt${value === o.value ? ' is-on' : ''}`}
            onClick={() => onChange?.(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
