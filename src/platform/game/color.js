// Tiny colour helpers for per-game theming (manifest.theme = { accent, accent2, bg }).

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex) {
  const m = HEX.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour that reads on top of `hex`. */
export function readableOn(hex) {
  return luminance(hex) > 0.38 ? '#0b1021' : '#ffffff';
}

/** `rgba(...)` string for a hex colour (falls back to the hub violet). */
export function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex) || [123, 109, 255];
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const FALLBACK = { accent: '#7b6dff', accent2: '#4cc9f0', bg: '#141c38' };

/** CSS custom properties for a game's theme; spread into `style` of a wrapper element. */
export function themeVars(theme) {
  const t = { ...FALLBACK, ...(theme || {}) };
  return {
    '--g-accent': t.accent,
    '--g-accent-2': t.accent2 || t.accent,
    '--g-bg': t.bg,
    '--g-on': readableOn(t.accent),
    '--g-soft': alpha(t.accent, 0.16),
    '--g-line': alpha(t.accent, 0.4),
    '--g-glow': alpha(t.accent, 0.35),
  };
}
