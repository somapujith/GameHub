import { useEffect, useId, useRef } from 'react';
import '@/styles/online.css';

/** Small accessible confirm modal: Esc / backdrop = cancel, focus starts on Cancel, Tab stays inside. */
export default function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel }) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel?.();
      } else if (e.key === 'Tab' && boxRef.current) {
        const f = [...boxRef.current.querySelectorAll('button:not([disabled])')];
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="ho-modal" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="ho-modal__box" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined} ref={boxRef}>
        <h2 id={titleId} className="ho-modal__title">
          {title}
        </h2>
        {body && (
          <p id={bodyId} className="ho-modal__body">
            {body}
          </p>
        )}
        <div className="ho-modal__actions">
          <button type="button" className="ho-btn ho-btn--ghost" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`ho-btn ${danger ? 'ho-btn--danger' : 'ho-btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
