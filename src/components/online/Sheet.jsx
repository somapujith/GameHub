import { useEffect, useId, useRef } from 'react';
import '@/styles/online.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible sheet: slides up from the bottom on phones, centred card on wide screens.
 * Esc / backdrop = `onClose`, focus moves in and returns on close, Tab stays inside.
 */
export default function Sheet({ open, title, subtitle, onClose, children, footer }) {
  const titleId = useId();
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const first = boxRef.current && boxRef.current.querySelector(FOCUSABLE);
    (first || boxRef.current)?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      } else if (e.key === 'Tab' && boxRef.current) {
        const f = [...boxRef.current.querySelectorAll(FOCUSABLE)];
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ho-modal ho-sheetwrap" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="ho-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={boxRef} tabIndex={-1}>
        <span className="ho-sheet__grab" aria-hidden="true" />
        <div className="ho-sheet__head">
          <div>
            <h2 id={titleId} className="ho-modal__title">
              {title}
            </h2>
            {subtitle && <p className="ho-muted">{subtitle}</p>}
          </div>
          <button type="button" className="ho-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>
        <div className="ho-sheet__body">{children}</div>
        {footer && <div className="ho-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}
