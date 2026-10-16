// Voice lines: plays a recorded clip from /voices/manifest.json when there is one, otherwise the
// browser's Telugu text-to-speech (lang te-IN). If the device has no Telugu voice the line is still
// emitted (so the subtitle toast shows for ~3.5 s) and the promise resolves afterwards.
//
//   voice.init()                      warm up the manifest and the TTS voice list (optional, idempotent)
//   voice.speak(line, { priority })   -> Promise<void>, resolves when the line is over or was dropped
//                                        'high'   interrupts whatever is playing
//                                        'normal' plays only if nothing is playing   (default)
//                                        'low'    like normal, and not within 1.5 s after the last line
//   voice.stop()                      stop the current line
//   voice.onLine(cb) -> unsubscribe   cb({ line, actor, phase: 'start' | 'end' })  (feeds VoiceToast)
//   voice.ttsAvailable()              true when a Telugu TTS voice is installed
//   voice.isSpeaking() / voice.whenIdle()   helpers for the presenter ("never talk over yourself")
//
// Honours settings.voice / tts / volume / actors. Never throws. Safe to import during SSR.

import * as ACTOR_DATA from '@/data/actors.js';
import { loadSettings } from './storage.js';

const TOAST_MS = 3500; // how long a line stays up when nothing is spoken
const MIN_SHOW_MS = 1400; // an audio line that ends faster than this keeps its toast a little longer
const LOW_GAP_MS = 1500;
const MAX_MS = 15000; // safety net if the browser never reports the end of speech
const MANIFEST_URL = '/voices/manifest.json';

const listeners = new Set();
let cur = null; // the line being presented: { line, actor, priority, token, done, ... }
let lastEnd = 0;
let seq = 0;
let inited = false;

let manifest = null; // { lineId: 'actor/lineId.mp3' }
let manifestPromise = null;

let synthVoice = null; // chosen Telugu SpeechSynthesisVoice
let voicesPromise = null;
let keepAlive = null; // keep a reference to the live utterance (Chrome GC bug)

const hasWindow = () => typeof window !== 'undefined';
const getSynth = () => {
  try {
    return hasWindow() && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null;
  } catch {
    return null;
  }
};

function settings() {
  try {
    return loadSettings();
  } catch {
    return {};
  }
}

function actorOf(id) {
  try {
    const list = ACTOR_DATA.ACTORS || [];
    const found = list.find((a) => a.id === id);
    if (found) return found;
    const fn = ACTOR_DATA.actorById;
    const viaLookup = typeof fn === 'function' ? fn(id) : fn && fn[id];
    if (viaLookup) return viaLookup;
  } catch {
    /* fall through */
  }
  return { id, name: String(id || ''), short: String(id || ''), color: '#ffd23f', accent: '#1b1530', initials: String(id || '?').slice(0, 2).toUpperCase(), tts: { pitch: 1, rate: 1 } };
}

function emit(p, phase) {
  const payload = { line: p.line, actor: p.actor, phase };
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch {
      /* a broken subscriber must not break speech */
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Manifest and TTS voices
// ---------------------------------------------------------------------------------------------

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      if (typeof fetch !== 'function' || !hasWindow()) return {};
      const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) return {};
      const data = await res.json();
      manifest = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      manifest = {};
    }
    return manifest || {};
  })();
  return manifestPromise;
}

function clipUrl(m, lineId) {
  const f = m && m[lineId];
  if (!f || typeof f !== 'string') return null;
  return /^(https?:)?\/\//.test(f) || f.startsWith('/') ? f : `/voices/${f}`;
}

function pickTeluguVoice() {
  const synth = getSynth();
  if (!synth) return null;
  try {
    const voices = synth.getVoices ? synth.getVoices() : [];
    const te = voices.filter((v) => /^te([-_]|$)/i.test(v.lang || ''));
    return te.find((v) => /^te[-_]IN$/i.test(v.lang)) || te[0] || null;
  } catch {
    return null;
  }
}

/** Resolves once the voice list is known (immediately when it is already there). */
function loadVoices() {
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const synth = getSynth();
    if (!synth) return resolve(null);
    const listLen = () => {
      try {
        return synth.getVoices().length;
      } catch {
        return 0;
      }
    };
    synthVoice = pickTeluguVoice();
    if (synthVoice || listLen() > 0) return resolve(synthVoice);
    // Chrome fills the list asynchronously; wait for `voiceschanged` (but not forever).
    let finished = false;
    let timer = null;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      synthVoice = pickTeluguVoice();
      resolve(synthVoice);
    };
    timer = setTimeout(done, 1500);
    try {
      synth.addEventListener('voiceschanged', done, { once: true });
    } catch {
      /* old browsers: the timeout resolves */
    }
    return undefined;
  });
  return voicesPromise;
}

function init() {
  if (inited || !hasWindow()) return;
  inited = true;
  loadManifest();
  const synth = getSynth();
  if (synth) {
    loadVoices();
    try {
      // Voices may arrive late or change (OS language packs): keep the selection fresh.
      synth.addEventListener('voiceschanged', () => {
        synthVoice = pickTeluguVoice();
      });
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------------------------

function clearTimers(p) {
  if (p.timer) clearTimeout(p.timer);
  if (p.minTimer) clearTimeout(p.minTimer);
  p.timer = null;
  p.minTimer = null;
}

/** End a line: stop its audio, tell subscribers and resolve its promise. Idempotent. */
function finish(p) {
  if (!p || p.done) return;
  p.done = true;
  clearTimers(p);
  if (p.audio) {
    try {
      p.audio.onended = null;
      p.audio.onerror = null;
      p.audio.pause();
      p.audio.removeAttribute('src');
      p.audio.load();
    } catch {
      /* ignore */
    }
    p.audio = null;
  }
  if (p.utter) {
    try {
      p.utter.onend = null;
      p.utter.onerror = null;
      const synth = getSynth();
      if (synth) synth.cancel();
    } catch {
      /* ignore */
    }
    p.utter = null;
    keepAlive = null;
  }
  if (cur === p) cur = null;
  lastEnd = Date.now();
  emit(p, 'end');
  p.resolve();
}

/** Natural end of audio/speech: keep the toast up for a minimum time. */
function finishSoon(p) {
  if (!p || p.done) return;
  const left = MIN_SHOW_MS - (Date.now() - p.startedAt);
  if (left > 30) {
    clearTimers(p);
    p.minTimer = setTimeout(() => finish(p), left);
  } else finish(p);
}

function toastOnly(p, ms = TOAST_MS) {
  if (p.done) return;
  clearTimers(p);
  p.timer = setTimeout(() => finish(p), ms);
}

function startClip(p, url, s) {
  try {
    const a = new Audio(url);
    a.volume = Math.min(1, Math.max(0, Number(s.volume ?? 0.8)));
    p.audio = a;
    a.onended = () => finishSoon(p);
    a.onerror = () => fallbackToTts(p, s);
    const pr = a.play();
    if (pr && typeof pr.catch === 'function') pr.catch(() => fallbackToTts(p, s));
    clearTimers(p);
    p.timer = setTimeout(() => finish(p), MAX_MS);
    return true;
  } catch {
    return false;
  }
}

function startTts(p, s) {
  const synth = getSynth();
  if (!synth || !synthVoice) return false;
  try {
    const u = new window.SpeechSynthesisUtterance(p.line.te || p.line.tn || p.line.en || '');
    const t = (p.actor && p.actor.tts) || {};
    u.voice = synthVoice;
    u.lang = synthVoice.lang || 'te-IN';
    u.pitch = Math.min(2, Math.max(0, Number(t.pitch) || 1));
    u.rate = Math.min(2, Math.max(0.1, Number(t.rate) || 1));
    u.volume = Math.min(1, Math.max(0, Number(s.volume ?? 0.8)));
    u.onend = () => finishSoon(p);
    u.onerror = () => finishSoon(p);
    p.utter = u;
    keepAlive = u;
    clearTimers(p);
    p.timer = setTimeout(() => finish(p), Math.max(6000, (p.line.te || '').length * 220));
    const go = () => {
      if (p.done || p.utter !== u) return;
      try {
        synth.cancel(); // clear anything stuck in the browser's queue
        synth.speak(u);
      } catch {
        finishSoon(p);
      }
    };
    // Some browsers drop a speak() issued right after cancel(): give them a tick.
    setTimeout(go, 40);
    return true;
  } catch {
    return false;
  }
}

/** Clip failed to load/play, or there is no clip: try TTS, else just show the toast. */
function fallbackToTts(p, s) {
  if (p.done || p.fellBack) return;
  p.fellBack = true;
  if (p.audio) {
    try {
      p.audio.onended = null;
      p.audio.onerror = null;
      p.audio.pause();
    } catch {
      /* ignore */
    }
    p.audio = null;
  }
  clearTimers(p);
  if (s.tts !== false && getSynth()) {
    loadVoices().then(() => {
      if (p.done) return;
      if (!synthVoice) synthVoice = pickTeluguVoice();
      if (!startTts(p, s)) toastOnly(p);
    });
    return;
  }
  toastOnly(p);
}

async function run(p, s) {
  let m = manifest;
  if (!m) {
    try {
      m = await loadManifest();
    } catch {
      m = {};
    }
  }
  if (p.done) return;
  const url = clipUrl(m, p.line.id);
  if (url && startClip(p, url, s)) return;
  fallbackToTts(p, s);
}

function speak(line, opts) {
  try {
    if (!line || !hasWindow()) return Promise.resolve();
    const priority = (opts && opts.priority) || 'normal';
    const s = settings();
    if (s.voice === false) return Promise.resolve();
    if (s.actors && s.actors[line.actor] === false) return Promise.resolve();
    init();

    if (cur) {
      if (priority !== 'high') return Promise.resolve(); // never talk over yourself
      finish(cur);
    } else if (priority === 'low' && Date.now() - lastEnd < LOW_GAP_MS) {
      return Promise.resolve();
    }

    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    const p = {
      line,
      actor: actorOf(line.actor),
      priority,
      token: ++seq,
      done: false,
      startedAt: Date.now(),
      resolve,
      promise,
      timer: null,
      minTimer: null,
      audio: null,
      utter: null,
      fellBack: false,
    };
    cur = p;
    emit(p, 'start');
    run(p, s).catch(() => toastOnly(p));
    return promise;
  } catch {
    return Promise.resolve();
  }
}

function stop() {
  try {
    if (cur) finish(cur);
    const synth = getSynth();
    if (synth) synth.cancel();
  } catch {
    /* ignore */
  }
}

function onLine(cb) {
  if (typeof cb !== 'function') return () => {};
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function ttsAvailable() {
  try {
    if (!getSynth()) return false;
    if (!synthVoice) synthVoice = pickTeluguVoice();
    return !!synthVoice;
  } catch {
    return false;
  }
}

const isSpeaking = () => !!cur;
const whenIdle = () => (cur ? cur.promise : Promise.resolve());

export const voice = { init, speak, stop, onLine, ttsAvailable, isSpeaking, whenIdle };
export default voice;
