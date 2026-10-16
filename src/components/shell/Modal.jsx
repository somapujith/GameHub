import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: portal, focus trap, Esc / backdrop to close, scroll lock, focus restore.
 * Bottom sheet on phones, centred card on desktop.
 */
export default function Modal({ open, onClose, title, children, actions, tone = 'default', dismissible = true, className = '' }) {
  const titleId = useId();
  const panel = useRef(null);
  const last = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    last.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector(FOCUSABLE);
    (first || panel.current)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const a = nodes[0];
      const z = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      last.current?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;
  return createPortal(
    <div className="hh-modal" onMouseDown={(e) => e.target === e.currentTarget && dismissible && onClose?.()}>
      <div ref={panel} className={`hh-modal__panel hh-modal__panel--${tone} ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="hh-modal__grip" aria-hidden="true" />
        {dismissible && (
          <button type="button" className="hh-iconbtn hh-modal__close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        )}
        <h2 id={titleId} className="hh-modal__title">
          {title}
        </h2>
        <div className="hh-modal__body">{children}</div>
        {actions && <div className="hh-modal__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
