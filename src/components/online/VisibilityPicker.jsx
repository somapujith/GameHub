import { useEffect, useState } from 'react';
import { VISIBILITY_HELP } from './settings.js';
import '@/styles/online.css';

const OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
];

/**
 * Host-only Public/Private switch. `onPick(visibility)` should send `{t:'visibility', visibility}`.
 * Optimistic: shows the pick at once, then follows the server's `visibility` (and rolls back if it never changes).
 */
export default function VisibilityPicker({ visibility, onPick, disabled, errorId }) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    setPending(null);
  }, [visibility, errorId]);
  useEffect(() => {
    if (!pending) return undefined;
    const t = setTimeout(() => setPending(null), 4000);
    return () => clearTimeout(t);
  }, [pending]);

  const current = pending || (visibility === 'public' ? 'public' : 'private');
  return (
    <section className="ho-card ho-visibility" aria-label="Who can join">
      <div className="ho-card__head">
        <h2 className="ho-h2">Who can join</h2>
      </div>
      <div role="radiogroup" aria-label="Room visibility" className="ho-seg">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={current === o.value}
            className={`ho-seg__opt${current === o.value ? ' is-on' : ''}`}
            disabled={disabled}
            onClick={() => {
              if (o.value === current) return;
              setPending(o.value);
              onPick(o.value);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="ho-help" aria-live="polite">
        {VISIBILITY_HELP[current]}
      </p>
    </section>
  );
}
