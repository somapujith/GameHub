// Full-screen cinematic intro, one slide at a time. Rendered by the hub at paths.extra(GAME_ID, 'story');
// it covers the hub chrome while it plays and returns to the game page when finished or skipped.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scene } from '@/components/art/index.js';
import { STORY_SLIDES } from '@/data/story.js';
import { Icon } from '@/components/shell/icons.jsx';
import { useProfile, useSettings } from '@/components/shell/stores.js';
import { useReducedMotion } from '@/components/shell/hooks.js';
import { onVoiceLine, pickLine, speak, stopSpeaking, unlockAudio, playSfx } from '@/components/shell/audio.js';
import { paths } from '@/platform/paths.js';
import { GAME_ID } from './constants.js';
import './tycoon.css';

const FALLBACK = [
  {
    id: 'welcome',
    title: 'Welcome to Hyderabad',
    body: 'Buy Miyapur to Banjara Hills, collect the rent and become the biggest tycoon in the City of Pearls.',
    scene: 'charminar',
  },
];

const SWIPE_MIN = 48;

export default function Story() {
  const navigate = useNavigate();
  const [, updateProfile] = useProfile();
  const [settings] = useSettings();
  const reduced = useReducedMotion();
  const slides = useMemo(() => (Array.isArray(STORY_SLIDES) && STORY_SLIDES.length ? STORY_SLIDES : FALLBACK), []);
  const last = slides.length - 1;

  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(null);
  const [typed, setTyped] = useState(0);
  const [caption, setCaption] = useState(null);
  const slide = slides[i];
  const body = String(slide.body || '');
  const spoke = useRef(false);
  const touch = useRef(null);
  const nextBtn = useRef(null);

  const finish = useCallback(() => {
    stopSpeaking();
    updateProfile({ seenStory: true });
    navigate(paths.game(GAME_ID), { replace: true, state: { fromStory: true } });
  }, [navigate, updateProfile]);

  const go = useCallback(
    (to) => {
      const n = Math.max(0, Math.min(last, to));
      if (n === i) return;
      setPrev(slides[i]);
      setI(n);
    },
    [i, last, slides],
  );

  const next = useCallback(() => (i >= last ? finish() : go(i + 1)), [i, last, finish, go]);
  const back = useCallback(() => go(i - 1), [i, go]);

  // Typewriter for the body text (instant with reduced motion; tap the text to finish it).
  useEffect(() => {
    if (reduced) {
      setTyped(body.length);
      return undefined;
    }
    setTyped(0);
    const t = setInterval(() => setTyped((n) => (n >= body.length ? n : n + 2)), 28);
    return () => clearInterval(t);
  }, [body, reduced]);

  // Drop the previous scene layer once the cross-fade is over.
  useEffect(() => {
    if (!prev) return undefined;
    const t = setTimeout(() => setPrev(null), 900);
    return () => clearTimeout(t);
  }, [prev]);

  // Keyboard: arrows move, Esc skips. (Enter/Space activate the focused button natively.)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, finish]);

  // Keep keyboard focus on the main button after each step (not on first paint, to avoid a stray ring).
  useEffect(() => {
    if (i > 0) nextBtn.current?.focus({ preventScroll: true });
  }, [i]);

  // First interaction unlocks audio and (optionally) speaks the game_start line with a caption.
  useEffect(() => {
    const off = onVoiceLine(({ line, actor, phase }) => {
      if (phase === 'start') setCaption({ line, actor });
      else setCaption(null);
    });
    const first = () => {
      if (spoke.current) return;
      spoke.current = true;
      unlockAudio();
      const line = pickLine('game_start');
      if (line) speak(line, { priority: 2 });
    };
    window.addEventListener('pointerdown', first, { once: true });
    window.addEventListener('keydown', first, { once: true });
    return () => {
      off();
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
      stopSpeaking();
    };
  }, []);

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
      playSfx('click');
      if (dx < 0) next();
      else back();
    }
  };

  const shown = body.slice(0, typed);
  const done = typed >= body.length;
  const sub = caption?.line ? caption.line[settings.subtitles] || caption.line.en || caption.line.te : null;

  return (
    <div className="hh-story tyc-story" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (touch.current = null)}>
      <div className="hh-story__stage" aria-hidden="true">
        {prev && (
          <div key={`p-${prev.id}`} className="hh-story__layer is-leaving">
            <Scene name={prev.scene} />
          </div>
        )}
        <div key={slide.id} className="hh-story__layer is-entering">
          <Scene name={slide.scene} />
        </div>
        <div className="hh-story__vignette" />
        <div className="hh-story__bar hh-story__bar--top" />
        <div className="hh-story__bar hh-story__bar--bottom" />
        <div className="hh-story__sparks">
          {Array.from({ length: 14 }, (_, k) => (
            <i key={k} style={{ '--x': `${(k * 53) % 100}%`, '--d': `${(k % 7) * 1.1}s`, '--s': `${6 + (k % 5)}s` }} />
          ))}
        </div>
      </div>

      <header className="hh-story__top">
        <button type="button" className="hh-story__icon" onClick={back} disabled={i === 0} aria-label="Previous slide">
          <Icon name="chevL" size={22} />
        </button>
        <p className="hh-story__count" aria-live="polite">
          {i + 1} <span>/ {slides.length}</span>
        </p>
        <button type="button" className="hh-story__skip" onClick={finish}>
          Skip <Icon name="chevR" size={16} />
        </button>
      </header>

      <div className="hh-story__content">
        <div className="hh-story__panel" key={slide.id}>
          <p className="hh-story__eyebrow">Chapter {i + 1}</p>
          <h1 className="hh-story__title">{slide.title}</h1>
          <p className="hh-story__body" onClick={() => setTyped(body.length)}>
            <span className="sr-only">{body}</span>
            {/* the invisible full text reserves the final height, so typing never shifts the layout */}
            <span className="hh-story__ghost" aria-hidden="true">
              {body}
            </span>
            <span className="hh-story__typed" aria-hidden="true">
              {shown}
              {!done && <span className="hh-story__caret" />}
            </span>
          </p>

          {sub && (
            <p className="hh-story__caption" role="status">
              <Icon name="mic" size={14} /> {sub}
            </p>
          )}

          <div className="hh-story__nav">
            <ol className="hh-story__dots" aria-label="Story progress">
              {slides.map((s, k) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`hh-story__dot ${k === i ? 'is-on' : ''} ${k < i ? 'is-past' : ''}`}
                    aria-label={`Go to slide ${k + 1}`}
                    aria-current={k === i ? 'step' : undefined}
                    onClick={() => go(k)}
                  />
                </li>
              ))}
            </ol>
            <button ref={nextBtn} type="button" className="btn btn--primary btn--lg hh-story__next" onClick={next}>
              {i >= last ? (
                <>
                  Start playing <Icon name="play" size={16} />
                </>
              ) : (
                <>
                  Next <Icon name="chevR" size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
