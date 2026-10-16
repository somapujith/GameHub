import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import { BRAND } from '@/platform/brand.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { useReducedMotion } from '@/components/shell/hooks.js';
import { categoryLabel, featured, liveList } from './catalog.js';
import { GameCover } from './GameArt.jsx';
import { playersLabel, themeVars } from './gameTheme.js';

const INTERVAL_MS = 7000;
const SWIPE_PX = 50;

function Slide({ game, active, index, total }) {
  const live = game.status === 'live';
  const players = playersLabel(game.players);
  const feats = Array.isArray(game.features) ? game.features.slice(0, 3) : [];
  return (
    <article
      className={`hh2-hero__slide ${active ? 'is-active' : ''}`}
      style={themeVars(game)}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}: ${game.name}`}
      aria-hidden={active ? undefined : true}
      inert={!active}
    >
      <GameCover game={game} className="hh2-hero__art" />
      <div className="hh2-hero__body">
        <p className="hub-eyebrow hh2-hero__eyebrow">
          <span className="hh2-eyebrow__dot" aria-hidden="true" />
          Featured{game.category ? ` · ${categoryLabel(game.category)}` : ''}
        </p>
        <h2 className="hh2-hero__title">{game.name}</h2>
        {game.tagline && <p className="hh2-hero__tag">{game.tagline}</p>}
        <ul className="hh2-hero__meta" aria-label="Game details">
          {players && (
            <li className="hub-pill hh2-glass">
              <HubIcon name="users" size={14} /> {players}
            </li>
          )}
          {game.duration && (
            <li className="hub-pill hh2-glass">
              <HubIcon name="clock" size={14} /> {game.duration}
            </li>
          )}
          {feats.map((f) => (
            <li key={f} className="hub-pill hh2-glass hh2-hero__feat">
              {f}
            </li>
          ))}
        </ul>
        <div className="hh2-hero__cta">
          {live ? (
            <>
              <Link to={paths.game(game.id)} className="hub-btn hub-btn--accent hub-btn--lg">
                <HubIcon name="play" size={18} /> Play now
              </Link>
              <Link to={paths.game(game.id)} className="hub-btn hub-btn--soft hub-btn--lg">
                <HubIcon name="users" size={18} /> With friends
              </Link>
            </>
          ) : (
            <Link to={paths.game(game.id)} className="hub-btn hub-btn--soft hub-btn--lg">
              <HubIcon name="bell" size={18} /> Coming soon
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Featured-game hero. Rotates through the live games (pauses on hover / focus / touch, with a pause button). */
export default function Hero() {
  const reduced = useReducedMotion();
  const slides = useMemo(() => {
    const out = [];
    const f = featured();
    if (f) out.push(f);
    liveList().forEach((g) => {
      if (!out.some((x) => x.id === g.id)) out.push(g);
    });
    return out;
  }, []);
  const total = slides.length;
  const many = total > 1;

  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const touchX = useRef(null);

  const running = many && !reduced && !held && !paused && !tabHidden;

  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(() => setIndex((n) => (n + 1) % total), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [running, index, total]);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const go = useCallback((n) => setIndex(((n % total) + total) % total), [total]);

  if (!total) {
    return (
      <section className="hh2-hero hh2-hero--empty" aria-label="Featured game">
        <h2 className="hh2-hero__title">{BRAND.name}</h2>
        <p className="hh2-hero__tag">{BRAND.tagline}</p>
      </section>
    );
  }

  return (
    <section
      className="hh2-hero"
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label="Featured games"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        touchX.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (!many || x0 == null || x1 == null || Math.abs(x1 - x0) < SWIPE_PX) return;
        go(index + (x1 < x0 ? 1 : -1));
      }}
    >
      <div className="hh2-hero__stage" aria-live={running ? 'off' : 'polite'}>
        {slides.map((g, i) => (
          <Slide key={g.id} game={g} index={i} total={total} active={i === index} />
        ))}
      </div>

      {many && (
        <div className="hh2-hero__nav">
          <div className="hh2-dots" role="group" aria-label="Choose a featured game">
            {slides.map((g, i) => (
              <button
                key={g.id}
                type="button"
                className={`hh2-dot ${i === index ? 'is-on' : ''}`}
                aria-label={`Show ${g.name}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <i />
              </button>
            ))}
          </div>
          {!reduced && (
            <button
              type="button"
              className="hh2-dotpause"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              aria-label={paused ? 'Resume rotation' : 'Pause rotation'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" fill="currentColor">
                {paused ? <path d="M3 1.8v10.4L12 7z" /> : <path d="M3 1.5h2.6v11H3zM8.4 1.5H11v11H8.4z" />}
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
