// Money that counts up/down (~400ms) and optionally flashes +/- deltas.
import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@shared/format.js';
import { useReducedMotion } from './helpers.js';

let popId = 0;

export function useCountUp(value, ms = 400) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const cur = useRef(value);

  useEffect(() => {
    if (reduced || ms <= 0) {
      cur.current = value;
      setShown(value);
      return undefined;
    }
    const from = cur.current;
    const to = value;
    if (from === to) return undefined;
    let raf = 0;
    let t0 = null;
    const step = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      const v = p >= 1 ? to : Math.round(from + (to - from) * eased);
      cur.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduced]);

  return shown;
}

export default function Money({ value, flash = false, className = '', ms = 400 }) {
  const shown = useCountUp(Number(value) || 0, ms);
  const prev = useRef(value);
  const toneTimer = useRef(0);
  const [pops, setPops] = useState([]);
  const [tone, setTone] = useState('');

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (!flash) return;
    const d = (Number(value) || 0) - (Number(before) || 0);
    if (!d) return;
    const id = ++popId;
    setPops((p) => [...p.slice(-2), { id, d }]);
    setTone(d > 0 ? 'up' : 'down');
    clearTimeout(toneTimer.current);
    toneTimer.current = setTimeout(() => setTone(''), 900);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1400);
  }, [value, flash]);

  useEffect(() => () => clearTimeout(toneTimer.current), []);

  return (
    <span className={`hg-money${tone ? ` is-${tone}` : ''} ${className}`}>
      {formatINR(shown)}
      {pops.map((p) => (
        <span key={p.id} className={`hg-delta ${p.d > 0 ? 'is-up' : 'is-down'}`} aria-hidden="true">
          {p.d > 0 ? '+' : '−'}
          {formatINR(Math.abs(p.d))}
        </span>
      ))}
    </span>
  );
}
