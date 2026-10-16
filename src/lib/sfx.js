// Pure WebAudio sound effects (no asset files). Everything is synthesised from oscillators and
// filtered noise with quick envelopes.
//
//   sfx.unlock()        resume the AudioContext (called automatically on the first user gesture)
//   sfx.play(name)      click dice step coin pay buy upgrade hotel mortgage trade lucky jail card win lose cheer error
//   sfx.setEnabled(b)   sfx.setVolume(v 0..1)   (also follows storage settings automatically)
//
// Silent (and never throws) when AudioContext is unavailable, e.g. SSR or old browsers.

import { loadSettings, subscribeSettings } from './storage.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;
let volume = 0.8;
let gestureInstalled = false;

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0));
const rand = (a, b) => a + Math.random() * (b - a);
const level = () => clamp01(volume) * 0.7;

function syncFromSettings() {
  try {
    const s = loadSettings();
    enabled = s.sfx !== false;
    volume = clamp01(s.volume);
    if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
  } catch {
    /* keep defaults */
  }
}

function getCtx() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = level();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

function getNoise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

// ---------------------------------------------------------------------------------------------
// Synthesis primitives. `t` is an absolute AudioContext time in seconds.
// ---------------------------------------------------------------------------------------------

/** One oscillator note with an attack/decay envelope and an optional pitch glide to `f2`. */
function tone(c, out, { f, f2, type = 'sine', t, a = 0.004, d = 0.15, v = 0.3 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + a + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
}

/** A burst of filtered white noise (rattles, swishes, claps, crowd). */
function noise(c, out, { t, d = 0.05, v = 0.2, type = 'bandpass', f = 2000, f2, q = 1, a = 0.003 }) {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = true;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(f, t);
  if (f2) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + d);
  filt.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  src.connect(filt);
  filt.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 0.4);
  src.stop(t + a + d + 0.05);
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568 };

// ---------------------------------------------------------------------------------------------
// The sounds
// ---------------------------------------------------------------------------------------------

const SOUNDS = {
  click(c, o, t) {
    tone(c, o, { f: 1150, f2: 720, type: 'triangle', t, d: 0.04, v: 0.22 });
  },

  // Dice rattling in a cup for ~0.9 s, then a thud as they land.
  dice(c, o, t) {
    const N = 18;
    for (let i = 0; i < N; i++) {
      const ti = t + i * 0.044 + rand(0, 0.02);
      const fade = 1 - (i / N) * 0.55;
      noise(c, o, { t: ti, d: 0.025, v: 0.2 * fade, f: rand(2200, 4800), q: 2.2 });
      tone(c, o, { f: rand(650, 1500), type: 'square', t: ti, d: 0.018, v: 0.035 * fade });
    }
    tone(c, o, { f: 170, f2: 62, t: t + 0.84, d: 0.2, v: 0.35 });
    noise(c, o, { t: t + 0.84, d: 0.12, v: 0.22, type: 'lowpass', f: 480 });
  },

  // Soft wooden tick for a pawn hop.
  step(c, o, t) {
    tone(c, o, { f: rand(310, 360), f2: 170, t, d: 0.05, v: 0.26 });
    noise(c, o, { t, d: 0.02, v: 0.1, f: 2200, q: 1.5 });
  },

  // Two-tone ping.
  coin(c, o, t) {
    tone(c, o, { f: 1318.5, t, d: 0.09, v: 0.24 });
    tone(c, o, { f: 1760, t: t + 0.07, d: 0.3, v: 0.28 });
    tone(c, o, { f: 3520, type: 'triangle', t: t + 0.07, d: 0.16, v: 0.05 });
  },

  // Descending, a little sad.
  pay(c, o, t) {
    tone(c, o, { f: 784, type: 'triangle', t, d: 0.1, v: 0.25 });
    tone(c, o, { f: 587, type: 'triangle', t: t + 0.09, d: 0.12, v: 0.24 });
    tone(c, o, { f: 392, f2: 330, type: 'triangle', t: t + 0.18, d: 0.26, v: 0.24 });
  },

  // Cash register ka-ching.
  buy(c, o, t) {
    noise(c, o, { t, d: 0.05, v: 0.2, type: 'highpass', f: 3200 });
    noise(c, o, { t: t + 0.01, d: 0.07, v: 0.14, f: 1800, q: 1.2 });
    tone(c, o, { f: 2093, t: t + 0.06, d: 0.55, v: 0.2 });
    tone(c, o, { f: 2637, t: t + 0.06, d: 0.5, v: 0.14 });
    tone(c, o, { f: 3136, t: t + 0.1, d: 0.42, v: 0.09 });
    tone(c, o, { f: 4186, type: 'triangle', t: t + 0.1, d: 0.3, v: 0.04 });
  },

  // Rising arpeggio with hammer knocks.
  upgrade(c, o, t) {
    noise(c, o, { t, d: 0.06, v: 0.35, type: 'lowpass', f: 900 });
    tone(c, o, { f: 130, f2: 60, t, d: 0.09, v: 0.3 });
    noise(c, o, { t: t + 0.14, d: 0.06, v: 0.3, type: 'lowpass', f: 900 });
    tone(c, o, { f: 130, f2: 60, t: t + 0.14, d: 0.09, v: 0.25 });
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
      tone(c, o, { f, type: 'triangle', t: t + 0.26 + i * 0.07, d: 0.2, v: 0.2 });
    });
  },

  // Grand chime with a big bell: a Hotel is built.
  hotel(c, o, t) {
    noise(c, o, { t, d: 0.05, v: 0.2, type: 'lowpass', f: 800 });
    tone(c, o, { f: 130, f2: 70, t, d: 0.12, v: 0.28 });
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((f, i) => {
      tone(c, o, { f, type: 'triangle', t: t + 0.16 + i * 0.075, d: 0.28, v: 0.17 });
    });
    // bell: inharmonic partials with a long ring
    [1, 2.0, 2.76, 5.4].forEach((r, i) => {
      tone(c, o, { f: 523.25 * r, t: t + 0.56, d: 1.3 - i * 0.2, v: 0.2 / (i + 1) });
    });
    [NOTE.G6, NOTE.C6].forEach((f, i) => {
      tone(c, o, { f, t: t + 0.7 + i * 0.12, d: 0.4, v: 0.07 });
    });
  },

  // Heavy rubber-stamp thud: a property is mortgaged.
  mortgage(c, o, t) {
    tone(c, o, { f: 150, f2: 48, t, d: 0.2, v: 0.4 });
    noise(c, o, { t, d: 0.09, v: 0.3, type: 'lowpass', f: 600 });
    noise(c, o, { t: t + 0.02, d: 0.03, v: 0.14, f: 2400, q: 1.5 });
    tone(c, o, { f: 90, f2: 55, type: 'triangle', t: t + 0.12, d: 0.16, v: 0.2 });
  },

  // Two coins swapping places.
  trade(c, o, t) {
    tone(c, o, { f: 1480, t, d: 0.07, v: 0.2 });
    tone(c, o, { f: 1976, t: t + 0.05, d: 0.2, v: 0.2 });
    tone(c, o, { f: 1976, t: t + 0.22, d: 0.07, v: 0.2 });
    tone(c, o, { f: 1480, t: t + 0.27, d: 0.24, v: 0.22 });
    noise(c, o, { t: t + 0.16, d: 0.05, v: 0.06, f: 3500, q: 1.2 });
  },

  // Soft sparkle: the lucky dice helped.
  lucky(c, o, t) {
    [2093, 2637, 3136, 2637, 3520].forEach((f, i) => {
      tone(c, o, { f, t: t + i * 0.055, d: 0.22, v: 0.07 });
    });
    noise(c, o, { t, d: 0.3, v: 0.03, type: 'highpass', f: 6000, a: 0.05 });
  },

  // Iron cell door clang.
  jail(c, o, t) {
    noise(c, o, { t, d: 0.07, v: 0.3, f: 3000, q: 0.8 });
    [1, 2.76, 5.4, 8.93].forEach((r, i) => {
      tone(c, o, { f: 196 * r, t, d: 1.0 - i * 0.15, v: 0.22 / (i + 1) });
    });
    noise(c, o, { t: t + 0.24, d: 0.05, v: 0.15, f: 2600, q: 0.8 });
    [1, 2.76, 5.4].forEach((r, i) => {
      tone(c, o, { f: 196 * r * 1.04, t: t + 0.24, d: 0.6 - i * 0.12, v: 0.12 / (i + 1) });
    });
  },

  // Card flip swish.
  card(c, o, t) {
    noise(c, o, { t, d: 0.17, v: 0.22, f: 1200, f2: 5200, q: 0.8, a: 0.02 });
    tone(c, o, { f: 900, f2: 1300, type: 'triangle', t: t + 0.13, d: 0.04, v: 0.08 });
  },

  // Fanfare arpeggio and a held major chord.
  win(c, o, t) {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => {
      tone(c, o, { f, type: 'square', t: t + i * 0.12, d: 0.16, v: 0.07 });
      tone(c, o, { f, type: 'triangle', t: t + i * 0.12, d: 0.2, v: 0.2 });
    });
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((f) => {
      tone(c, o, { f, type: 'triangle', t: t + 0.5, d: 1.0, v: 0.13, a: 0.01 });
    });
    [NOTE.G6, NOTE.E6, NOTE.G6].forEach((f, i) => {
      tone(c, o, { f, t: t + 0.7 + i * 0.09, d: 0.25, v: 0.07 });
    });
  },

  // Sad trombone slide.
  lose(c, o, t) {
    [392, 370, 349].forEach((f, i) => {
      tone(c, o, { f, type: 'sawtooth', t: t + i * 0.22, d: 0.24, v: 0.08 });
      tone(c, o, { f, type: 'triangle', t: t + i * 0.22, d: 0.26, v: 0.2 });
    });
    tone(c, o, { f: 330, f2: 120, type: 'sawtooth', t: t + 0.66, d: 0.7, v: 0.09 });
    tone(c, o, { f: 330, f2: 120, type: 'triangle', t: t + 0.66, d: 0.7, v: 0.22 });
  },

  // Crowd swell with claps.
  cheer(c, o, t) {
    noise(c, o, { t, a: 0.5, d: 1.1, v: 0.28, f: 900, f2: 2100, q: 0.7 });
    noise(c, o, { t: t + 0.1, a: 0.45, d: 1.0, v: 0.12, type: 'highpass', f: 1800 });
    for (let i = 0; i < 16; i++) {
      noise(c, o, { t: t + rand(0.2, 1.5), d: 0.03, v: rand(0.08, 0.16), f: rand(1400, 2400), q: 1.4 });
    }
    tone(c, o, { f: 480, f2: 880, t: t + 0.1, a: 0.1, d: 0.6, v: 0.04 });
  },

  // Double buzz.
  error(c, o, t) {
    [0, 0.16].forEach((dt) => {
      tone(c, o, { f: 140, type: 'square', t: t + dt, d: 0.12, v: 0.13 });
      tone(c, o, { f: 147, type: 'sawtooth', t: t + dt, d: 0.12, v: 0.09 });
    });
  },
};

export const SFX_NAMES = Object.keys(SOUNDS);

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

function unlock() {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      const p = c.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    // iOS Safari: a silent one-sample buffer fully unlocks output.
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}

function installGestureUnlock() {
  if (gestureInstalled || typeof document === 'undefined') return;
  gestureInstalled = true;
  const events = ['pointerdown', 'touchend', 'keydown'];
  const handler = () => {
    unlock();
    events.forEach((e) => document.removeEventListener(e, handler, true));
  };
  events.forEach((e) => document.addEventListener(e, handler, { capture: true, passive: true }));
}

function play(name) {
  if (!enabled || volume <= 0) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended' && typeof c.resume === 'function') {
      const p = c.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    fn(c, master, c.currentTime + 0.01);
  } catch {
    /* never let a sound crash the game */
  }
}

function setEnabled(b) {
  enabled = !!b;
}

function setVolume(v) {
  volume = clamp01(v);
  try {
    if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
  } catch {
    /* ignore */
  }
}

export const sfx = { unlock, play, setEnabled, setVolume };

syncFromSettings();
try {
  subscribeSettings(syncFromSettings);
} catch {
  /* ignore */
}
installGestureUnlock();

export default sfx;
