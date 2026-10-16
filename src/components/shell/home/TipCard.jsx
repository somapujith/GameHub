import { useEffect, useState } from 'react';
import { TIPS } from '@/data/story.js';
import { Icon } from '../icons.jsx';

const FALLBACK = ['Own every property of one colour to double its rent and unlock upgrades.'];

/** Rotating gameplay tip (auto-advances every 9 s; tap the button for the next one). */
export default function TipCard() {
  const tips = Array.isArray(TIPS) && TIPS.length ? TIPS : FALLBACK;
  const [i, setI] = useState(() => Math.floor(Math.random() * tips.length));

  useEffect(() => {
    if (tips.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % tips.length), 9000);
    return () => clearInterval(t);
  }, [tips.length, i]);

  return (
    <aside className="hh-card hh-tip" aria-label="Tip">
      <span className="hh-tip__icon" aria-hidden="true">
        <Icon name="sparkle" size={20} />
      </span>
      <p className="hh-tip__text" key={i}>
        <b>Tip · </b>
        {tips[i % tips.length]}
      </p>
      {tips.length > 1 && (
        <button type="button" className="hh-iconbtn hh-tip__next" onClick={() => setI((n) => (n + 1) % tips.length)} aria-label="Next tip">
          <Icon name="refresh" size={18} />
        </button>
      )}
    </aside>
  );
}
