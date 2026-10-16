import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

const ToastCtx = createContext(null);
const NOOP = () => {};

const ICONS = { good: 'check', bad: 'close', info: 'info', gold: 'sparkle' };

/** Provides `useToast()` -> toast(message, { tone: 'info'|'good'|'bad'|'gold', icon, duration }). */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((l) => l.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { id, message, tone: opts.tone || 'info', icon: opts.icon }]);
      timers.current.set(id, setTimeout(() => dismiss(id), opts.duration ?? 3400));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="hh-toasts" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <button key={t.id} type="button" className={`hh-toast hh-toast--${t.tone}`} onClick={() => dismiss(t.id)} data-nosfx>
            <Icon name={t.icon || ICONS[t.tone] || 'info'} size={18} />
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || NOOP;
}
