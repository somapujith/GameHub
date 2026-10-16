import { useId, useRef, useState } from 'react';
import { ROOM_CODE_LENGTH, normalizeRoomCode } from './codes.js';
import '@/styles/online.css';

/**
 * Six-box room-code entry. One real <input> sits over the boxes, so typing, backspace, paste, autofill and
 * screen readers all behave natively. Everything is normalised (uppercase, unambiguous alphabet, links pasted
 * whole are reduced to their code).
 * `state`: 'idle' | 'checking' | 'ok' | 'error'
 */
export default function CodeInput({ value, onChange, state = 'idle', disabled = false, autoFocus = false, label = 'Room code', describedBy }) {
  const id = useId();
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const toEnd = (el) => {
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* some input types do not support selection */
    }
  };

  return (
    <div
      className={`ho-code ho-code--${state}${focused ? ' is-focused' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={() => {
        ref.current?.focus();
        if (ref.current) toEnd(ref.current);
      }}
    >
      <label htmlFor={id} className="ho-sr">
        {label}, {ROOM_CODE_LENGTH} characters
      </label>
      <input
        id={id}
        ref={ref}
        className="ho-code__input"
        type="text"
        inputMode="text"
        enterKeyHint="go"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        aria-invalid={state === 'error' || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          onChange(normalizeRoomCode(e.clipboardData.getData('text')));
        }}
        onFocus={(e) => {
          setFocused(true);
          toEnd(e.target);
        }}
        onBlur={() => setFocused(false)}
      />
      <div className="ho-code__boxes" aria-hidden="true">
        {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
          <span key={i} className={`ho-code__box${value[i] ? ' has-char' : ''}${focused && i === Math.min(value.length, ROOM_CODE_LENGTH - 1) ? ' is-active' : ''}`}>
            {value[i] || ''}
          </span>
        ))}
      </div>
    </div>
  );
}
