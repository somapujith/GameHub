// Subtitle toast for voice lines: actor monogram + Telugu line (big) + Tenglish + English.
// Never blocks taps (pointer-events: none) except its tiny dismiss button.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { voice } from '@/lib/voice.js';
import { useSettings } from '@/lib/storage.js';
import { actorById } from '@/data/actors.js';
import Icon from './ui/Icon.jsx';
import { useSheetOpen } from './ui/Sheet.jsx';

// Telugu glyphs are tall. The headline is measured in an off-screen twin: the largest size that needs at most
// two lines wins; if even the smallest size needs a third line the text itself is cut with an ellipsis, so a
// third line never exists to peek through (or get half-clipped).
const FIT_SIZES = [20, 18, 16, 15, 14];
const FIT_LINE_HEIGHT = 1.5;

export function fitHeadline(host, text, lang) {
  const m = document.createElement('span');
  m.className = 'hg-toast-big is-measure';
  m.setAttribute('aria-hidden', 'true');
  if (lang) m.lang = lang;
  host.appendChild(m);
  const lines = (px, t) => {
    m.style.fontSize = `${px}px`;
    m.textContent = t;
    return Math.round(m.clientHeight / (px * FIT_LINE_HEIGHT));
  };
  let size = FIT_SIZES.find((px) => lines(px, text) <= 2);
  let out = text;
  if (!size) {
    size = FIT_SIZES[FIT_SIZES.length - 1];
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lines(size, `${text.slice(0, mid).trimEnd()}…`) <= 2) lo = mid; else hi = mid - 1;
    }
    out = `${text.slice(0, lo).trimEnd()}…`;
  }
  host.removeChild(m);
  return { size, text: out };
}

const END_HIDE_MS = 600;
const EXIT_MS = 320;
const SAFETY_MS = 12000;
let uid = 0;

function resolveActor(actor, line) {
  const a = typeof actor === 'string' ? actorById(actor) : actor;
  return a || actorById(line?.actor) || { name: 'Voice', initials: '?', color: '#ffc857', accent: '#1b1340' };
}

export default function VoiceToast() {
  const [settings] = useSettings();
  const [cur, setCur] = useState(null); // { key, line, actor, speaking }
  const [shown, setShown] = useState(false);
  const sheetOpen = useSheetOpen();
  const curId = useRef(null);
  const bigRef = useRef(null);
  const [fit, setFit] = useState(null); // { key, size, text }
  const timers = useRef({ hide: 0, clear: 0, safety: 0 });

  useEffect(() => {
    const t = timers.current;
    const clearAll = () => { clearTimeout(t.hide); clearTimeout(t.clear); clearTimeout(t.safety); };
    const hideSoon = (ms) => {
      clearTimeout(t.hide);
      clearTimeout(t.clear);
      t.hide = setTimeout(() => {
        setShown(false);
        t.clear = setTimeout(() => { setCur(null); curId.current = null; }, EXIT_MS);
      }, ms);
    };
    if (!voice || typeof voice.onLine !== 'function') return undefined;
    const off = voice.onLine(({ line, actor, phase } = {}) => {
      if (!line) return;
      if (phase === 'start') {
        clearAll();
        curId.current = line.id;
        setCur({ key: ++uid, line, actor: resolveActor(actor, line), speaking: true });
        requestAnimationFrame(() => setShown(true));
        t.safety = setTimeout(() => hideSoon(0), SAFETY_MS);
      } else if (phase === 'end') {
        if (curId.current !== line.id) return; // a newer line already took over
        clearTimeout(t.safety);
        setCur((c) => (c ? { ...c, speaking: false } : c));
        hideSoon(END_HIDE_MS);
      }
    });
    return () => {
      clearAll();
      if (typeof off === 'function') off();
    };
  }, []);

  const mode = settings?.subtitles || 'te';
  const dismiss = () => {
    const t = timers.current;
    clearTimeout(t.safety);
    clearTimeout(t.hide);
    setShown(false);
    t.clear = setTimeout(() => { setCur(null); curId.current = null; }, EXIT_MS);
  };

  let big = null;
  let mid = null;
  let small = null;
  if (cur) {
    const { line } = cur;
    if (mode === 'te') { big = line.te || line.tn || line.en; mid = line.te ? line.tn : null; small = line.en; }
    else if (mode === 'tn') { big = line.tn || line.en; small = line.en && line.tn ? line.en : null; }
    else if (mode === 'en') { big = line.en || line.tn; }
  }

  /* fit the headline (largest size that needs <= 2 lines, else trim); re-fit when the width changes */
  const curKey = cur ? cur.key : null;
  useLayoutEffect(() => {
    const el = bigRef.current;
    if (!el || !big) return undefined;
    const host = el.parentElement;
    const run = () => setFit((prev) => {
      const next = fitHeadline(host, big, mode === 'te' ? 'te' : undefined);
      const width = host.clientWidth;
      return prev && prev.key === curKey && prev.width === width && prev.src === big ? prev : { key: curKey, width, src: big, ...next };
    });
    run();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(run);
    ro.observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run).catch(() => {});
    return () => ro.disconnect();
  }, [curKey, big, mode]);

  return (
    <div className="hg-toast-wrap" role="status" aria-live="polite" aria-atomic="true">
      {cur && mode !== 'off' && big ? (
        <div key={cur.key} className={`hg-toast${shown && !sheetOpen ? ' is-in' : ''}${cur.speaking ? ' is-speaking' : ''}`}>
          <span className="hg-toast-who" style={{ '--ac': cur.actor.color, '--ai': cur.actor.accent }} title={cur.actor.name}>
            <span className="hg-toast-badge">
              <b>{cur.actor.initials}</b>
              <span className="hg-eq" aria-hidden="true"><i /><i /><i /><i /></span>
            </span>
            <small className="hg-toast-actor">{cur.actor.short || cur.actor.name}</small>
          </span>
          <span className="hg-toast-text">
            <span
              className="hg-toast-big"
              ref={bigRef}
              lang={mode === 'te' ? 'te' : undefined}
              style={fit && fit.key === curKey ? { fontSize: fit.size } : undefined}
            >
              {fit && fit.key === curKey && fit.src === big ? fit.text : big}
            </span>
            {mid ? <span className="hg-toast-mid">{mid}</span> : null}
            {small ? <span className="hg-toast-small">{small}</span> : null}
          </span>
          <button type="button" className="hg-toast-x" aria-label="Dismiss subtitle" onClick={dismiss}>
            <Icon name="close" size={14} strokeWidth={2.4} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
