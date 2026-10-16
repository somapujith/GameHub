import { useCallback, useEffect, useId, useRef, useState } from 'react';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { useReducedMotion } from '@/components/shell/hooks.js';
import GameCard from './GameCard.jsx';
import { CatIcon } from './GameArt.jsx';

/** One category: a heading and a horizontal snap-scroll row (`.hub-row`) of game cards, with arrows on pointer devices. */
export default function CategoryRow({ cat, games }) {
  const id = useId();
  const rail = useRef(null);
  const reduced = useReducedMotion();
  const [edge, setEdge] = useState({ over: false, start: true, end: true });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const over = el.scrollWidth - el.clientWidth > 6;
    const next = { over, start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 };
    setEdge((cur) => (cur.over === next.over && cur.start === next.start && cur.end === next.end ? cur : next));
  }, []);

  useEffect(() => {
    measure();
    const el = rail.current;
    if (!el) return undefined;
    el.addEventListener('scroll', measure, { passive: true });
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }
    return () => {
      el.removeEventListener('scroll', measure);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, [measure, games.length]);

  const go = (dir) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section className="hub-section hh2-catrow" aria-labelledby={id} data-count={games.length}>
      <div className="hub-section__head">
        <h3 id={id} className="hub-section__title hh2-catrow__title">
          <CatIcon cat={cat} size={22} />
          {cat.label}
          <span className="hub-pill" aria-label={`${games.length} game${games.length === 1 ? '' : 's'}`}>
            {games.length}
          </span>
        </h3>
        <div className="hh2-arrows" data-over={edge.over ? 'true' : 'false'}>
          <button type="button" className="hh2-arrow" onClick={() => go(-1)} disabled={edge.start} aria-label={`Scroll ${cat.label} games left`}>
            <HubIcon name="chevL" size={18} />
          </button>
          <button type="button" className="hh2-arrow" onClick={() => go(1)} disabled={edge.end} aria-label={`Scroll ${cat.label} games right`}>
            <HubIcon name="chevR" size={18} />
          </button>
        </div>
      </div>
      <ul className="hub-row hh2-rail" ref={rail} aria-label={`${cat.label} games`}>
        {games.map((g) => (
          <li key={g.id}>
            <GameCard game={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}
