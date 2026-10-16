// Shared palette + colour helpers for the flat/isometric illustration style.
// Shadows are hue-shifted toward indigo (never grey) so everything stays colourful.

const SHADE = '#2a1f6e';

const hex2rgb = (h) => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

export const mix = (a, b, t) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, SHADE, t);

const cache = new Map();
/** Three isometric face colours: top (lightest), left (lit), right (shadow side). */
export function tone(c) {
  let t = cache.get(c);
  if (!t) {
    t = { top: lighten(c, 0.26), left: c, right: darken(c, 0.3) };
    cache.set(c, t);
  }
  return t;
}

export const PAL = {
  ink: '#1b1340',
  indigo: '#2e2475',
  indigo2: '#3a2f8c',
  night: '#140f33',
  violet: '#9b7bff',
  gold: '#ffc857',
  gold2: '#ffb100',
  saffron: '#ff8a3d',
  teal: '#2ec4b6',
  rose: '#ff5d73',
  lime: '#8de05a',
  sky: '#4cc9f0',
  cream: '#fff7e6',
  cream2: '#f3e6c8',
  stone: '#e8d9b8',
  stoneDark: '#b9a782',
  slab: '#6a62b4',
  grass: '#6fcf7a',
  grassDark: '#3fa862',
  water: '#37c5d6',
  white: '#ffffff',
  glass: '#7fd6ee',
  dark: '#2b2260',
};
