import { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/online.css';

/**
 * Tiny toast system for the online pages.
 *   const { push, node } = useToasts();   push('Copied', 'good');   return <>…{node}</>;
 * tone: 'info' | 'good' | 'bad'
 */
export function useToasts() {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const timers = useRef(new Set());

  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach((t) => clearTimeout(t));
      set.clear();
    };
  }, []);

  const dismiss = useCallback((id) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (text, tone = 'info') => {
      if (!text) return;
      seq.current += 1;
      const id = seq.current;
      setItems((cur) => [...cur.slice(-2), { id, text: String(text), tone }]);
      const t = setTimeout(
        () => {
          timers.current.delete(t);
          dismiss(id);
        },
        tone === 'bad' ? 5200 : 3000,
      );
      timers.current.add(t);
    },
    [dismiss],
  );

  const node = <ToastHost items={items} onDismiss={dismiss} />;
  return { push, node };
}

export function ToastHost({ items, onDismiss }) {
  return (
    <div className="ho-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <button key={t.id} type="button" className={`ho-toast ho-toast--${t.tone}`} onClick={() => onDismiss(t.id)} aria-label={`${t.text} (tap to dismiss)`}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

export default useToasts;
