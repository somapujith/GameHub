import { useId, useState } from 'react';
import HubIcon from './HubIcon.jsx';

/** "How to play" accordion from `manifest.howToPlay` ([{ title, body }]). One step open at a time; the first starts open. */
export default function HowToPlay({ steps }) {
  const uid = useId();
  const [open, setOpen] = useState(0);
  const list = (Array.isArray(steps) ? steps : []).filter((s) => s && (s.title || s.body));
  if (!list.length) return null;
  return (
    <section className="hub-panel" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="hub-section__title">
        How to play
      </h2>
      <ol className="hub-acc">
        {list.map((s, i) => {
          const on = open === i;
          return (
            <li key={i} className={`hub-acc__item${on ? ' is-open' : ''}`}>
              <h3 className="hub-acc__head">
                <button
                  type="button"
                  className="hub-acc__btn"
                  id={`${uid}-b${i}`}
                  aria-expanded={on}
                  aria-controls={`${uid}-p${i}`}
                  onClick={() => setOpen(on ? -1 : i)}
                >
                  <span className="hub-acc__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="hub-acc__title">{s.title}</span>
                  <HubIcon name="chevDown" size={20} className="hub-acc__chev" />
                </button>
              </h3>
              <div className="hub-acc__panel" id={`${uid}-p${i}`} role="region" aria-labelledby={`${uid}-b${i}`}>
                <div className="hub-acc__inner">
                  <p>{s.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
