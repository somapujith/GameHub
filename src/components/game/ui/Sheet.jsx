// Bottom sheet (mobile) / side drawer or centred modal (desktop) / centred dialog (always).
// Focus trap, Esc, backdrop tap, swipe-down to dismiss on touch layouts, exit animation.
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useReducedMotion } from './helpers.js';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const stack = []; // open dialog elements, topmost last
const visible = (el) => el.getClientRects().length > 0;

const listeners = new Set();
const notify = () => listeners.forEach((cb) => cb());
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

/** True while any game sheet/dialog is open (keyboard shortcuts stand down). */
export const hasOpenSheet = () => stack.length > 0;

/** Reactive version: lets the voice toast tuck itself away while a sheet's scrim is up. */
export const useSheetOpen = () => useSyncExternalStore(subscribe, hasOpenSheet, () => false);

/**
 * variant: 'sheet' (bottom sheet; on desktop it becomes `desktop`: 'drawer' | 'modal') | 'dialog' (centred everywhere)
 * Add `data-autofocus` to an element inside to receive initial focus (default: the dialog itself).
 */
export default function Sheet({
  open, onClose, title, ariaLabel, header, children, footer, dismissible = true,
  variant = 'sheet', desktop = 'drawer', className = '', behind = null,
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(!!open);
  const [shown, setShown] = useState(false);
  const dialogRef = useRef(null);
  const drag = useRef(null);
  const titleId = useId();

  /* mount -> next frames -> show; hide -> wait for the exit transition -> unmount */
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShown(true));
      });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), reduced ? 0 : 280);
    return () => clearTimeout(t);
  }, [open, reduced]);

  /* focus management + trap */
  useEffect(() => {
    if (!mounted) return undefined;
    const el = dialogRef.current;
    if (!el) return undefined;
    const prev = document.activeElement;
    // give focus back only to keyboard users (a tapped tile button must not swallow the next Space press)
    let restore = false;
    try { restore = !!prev && prev !== document.body && prev.matches(':focus-visible'); } catch { restore = false; }
    stack.push(el);
    notify();
    (el.querySelector('[data-autofocus]') || el).focus({ preventScroll: true });
    const onFocusIn = (e) => {
      if (stack[stack.length - 1] !== el || el.contains(e.target)) return;
      (el.querySelector('[data-autofocus]') || el).focus({ preventScroll: true });
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      const i = stack.indexOf(el);
      if (i >= 0) stack.splice(i, 1);
      notify();
      if (restore && prev.isConnected && prev.focus) prev.focus({ preventScroll: true });
      else if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur?.();
    };
  }, [mounted]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (dismissible) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    const list = [...el.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!list.length) {
      e.preventDefault();
      el.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const a = document.activeElement;
    if (e.shiftKey && (a === first || a === el)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && a === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* swipe down on the grab zone / header to dismiss (touch layouts only) */
  const onPointerDown = (e) => {
    if (!dismissible || variant === 'dialog') return;
    if (e.pointerType === 'mouse' || !e.target.closest('[data-drag]') || e.target.closest('button,a,input')) return;
    if (window.matchMedia?.('(min-width: 900px)').matches) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dialogRef.current.style.transition = 'none';
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    dialogRef.current.style.transform = `translate3d(0, ${d.dy}px, 0)`;
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = dialogRef.current;
    const dt = Math.max(1, performance.now() - d.t);
    el.style.transition = '';
    el.style.transform = '';
    if (d.dy > 110 || (d.dy > 40 && d.dy / dt > 0.6)) onClose?.();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`hg-sheet-root${shown ? ' is-open' : ''}`}
      data-variant={variant}
      data-desktop={desktop}
      data-rm={reduced ? '' : undefined}
    >
      <div className="hg-backdrop" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      {behind}
      <div
        ref={dialogRef}
        className={`hg-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="hg-sheet-grab" data-drag="">
          <span className="hg-grabber" aria-hidden="true" />
        </div>
        {header || (title ? (
          <div className="hg-sheet-head" data-drag="">
            <h2 id={titleId}>{title}</h2>
          </div>
        ) : null)}
        {dismissible && (
          <button type="button" className="hg-sheet-x" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        )}
        <div className="hg-sheet-body">{children}</div>
        {footer ? <div className="hg-sheet-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
