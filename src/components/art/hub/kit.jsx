// Shared drawing helpers for the GameHub brand art (covers, icons, badges, backdrop).
// Same family as the Tycoon art kit (flat shapes + isometric props, hue-shifted shadows), just bolder.
// Pure inline SVG: no assets, no dependencies. Private to src/components/art/hub/.
import { useId } from 'react';
import { mix, lighten, darken } from '../palette.js';
import { pt, roundedPath, Face } from '../iso.jsx';

export { mix, lighten, darken, pt, roundedPath, Face };

export const f = (n) => Math.round(n * 10) / 10;

export const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

/** Unique, CSS/url()-safe id prefix per component instance. */
export function useUid() {
  return 'h' + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/** Brand colours shared by every hub piece. */
export const HUB = {
  navy: '#0b1020',
  navy2: '#121a36',
  ink: '#1b1340',
  indigo: '#2e2475',
  violet: '#8f6bff',
  gold: '#ffc857',
  gold2: '#ffb100',
  saffron: '#ff8a3d',
  rose: '#ff5d73',
  teal: '#2ec4b6',
  sky: '#4cc9f0',
  lime: '#8de05a',
  cream: '#fff7e6',
  // player colours (same as the engine's first four)
  p1: '#ff4d6d',
  p2: '#ffd23f',
  p3: '#3ddc97',
  p4: '#4cc9f0',
};

/** Standard 16:9 cover <svg>: fills its parent, crops like object-fit: cover, decorative unless `title` is given. */
export function CoverSvg({ className, title, css, children, vb = '0 0 800 450' }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox={vb}
      preserveAspectRatio="xMidYMid slice"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: 'block' }}
    >
      {css ? <style>{css}</style> : null}
      {children}
    </svg>
  );
}

/** Square icon <svg> (viewBox 0 0 128 128). Full-bleed art; `rounded` clips it to an app-icon squircle. */
export function IconSvg({ size = 64, title, rounded = false, className, uid, children, style }) {
  const clip = rounded ? `url(#${uid}rc)` : undefined;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: 'block', flex: 'none', ...style }}
    >
      {rounded && (
        <defs>
          <clipPath id={`${uid}rc`}>
            <rect width="128" height="128" rx="28" />
          </clipPath>
        </defs>
      )}
      <g clipPath={clip}>{children}</g>
    </svg>
  );
}

/** Four-point sparkle centred at 0,0 (use inside a translated <g> or pass x/y). */
export function Sparkle({ x = 0, y = 0, s = 6, c = '#fff', o = 1, cls }) {
  const k = f(s * 0.2);
  s = f(s);
  return (
    <path
      className={cls}
      transform={`translate(${f(x)} ${f(y)})`}
      d={`M0 ${-s}Q${k} ${-k} ${s} 0Q${k} ${k} 0 ${s}Q${-k} ${k} ${-s} 0Q${-k} ${-k} 0 ${-s}Z`}
      fill={c}
      opacity={o}
    />
  );
}

/** Rupee glyph, y-down, ~6 wide x 10 tall, centred on 0,0. */
export const RUPEE = 'M-2 -5H3M-2 -2.6H3M-1.8 -5H0Q2.6 -5 2.6 -2.6Q2.6 -0.2 0 -0.2H-1.8L2 5';

/** Gold coin with a rupee mark. (x,y) centre, r radius, sy squashes it into a tilted ellipse, rot spins the tilt axis. */
export function Coin({ x = 0, y = 0, r = 12, sy = 1, rot = 0, edge = true, mark = true, lite = false, cls }) {
  const t = Math.max(1.2, r * 0.16);
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
    <g className={cls}>
    <g transform={`rotate(${rot}) scale(1 ${sy})`}>
      {edge && <ellipse cx={t * 0.5} cy={t} rx={r} ry={r} fill="#b8741a" />}
      <circle r={r} fill="#ffb100" />
      <circle r={r * 0.84} fill="#ffc857" />
      {!lite && <circle r={r * 0.84} fill="none" stroke="#ffe9a8" strokeWidth={Math.max(0.6, r * 0.06)} opacity=".8" />}
      {!lite && <path d={`M${-r * 0.62} ${-r * 0.3}A${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.12} ${-r * 0.7}`} fill="none" stroke="#fff6d6" strokeWidth={Math.max(0.8, r * 0.13)} strokeLinecap="round" opacity=".85" />}
      {mark && (
        <path
          d={RUPEE}
          transform={`scale(${(r * 0.095).toFixed(3)})`}
          fill="none"
          stroke="#b8741a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
    </g>
    </g>
  );
}

/** Wrapper that places children at (x,y) and lets a CSS animation class move them without clobbering the position. */
export function Float({ x = 0, y = 0, cls, children, scale = 1, rot = 0 }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${scale})`}>
      <g className={cls}>{children}</g>
    </g>
  );
}

/** Soft elliptical contact shadow (radial fade, no hard edge). Needs <FloorDefs uid> once in the same svg. */
export function Floor({ uid, cx, cy, rx, ry, o = 1 }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}sh)`} opacity={o} />;
}
export function FloorDefs({ uid }) {
  return (
    <defs>
      <radialGradient id={uid + 'sh'} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#05031a" stopOpacity=".55" />
        <stop offset=".6" stopColor="#05031a" stopOpacity=".25" />
        <stop offset="1" stopColor="#05031a" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** Pawn token standing on the point (x,y). */
export function Pawn({ x = 0, y = 0, s = 1, c = HUB.p1 }) {
  const hi = lighten(c, 0.4);
  const lo = darken(c, 0.32);
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <ellipse cx="1" cy="1" rx="10" ry="4" fill="#1b1340" opacity=".28" />
      <path d="M-8.4 0Q-8.6 -4.4 -4.6 -6.4Q-1.8 -9 -3 -14H3Q1.8 -9 4.6 -6.4Q8.6 -4.4 8.4 0A8.4 3.6 0 0 1 -8.4 0Z" fill={c} />
      <path d="M0 -14H3Q1.8 -9 4.6 -6.4Q8.6 -4.4 8.4 0A8.4 3.6 0 0 1 0 3.6Z" fill={lo} opacity=".55" />
      <circle cx="0" cy="-19" r="6" fill={c} />
      <path d="M0 -25A6 6 0 0 1 0 -13Z" fill={lo} opacity=".4" />
      <circle cx="-2" cy="-21" r="2" fill={hi} opacity=".8" />
    </g>
  );
}

/** Rounded isometric die standing with its bottom-corner at world (0,0,0) -> screen (x,y). Shows 3 faces. */
export function Die({ x = 0, y = 0, s = 30, top = 5, left = 3, right = 1, pip = '#2e2475', one = HUB.rose, shade = true, rot = 0 }) {
  const r = Math.max(2, s * 0.16);
  const T = [pt(0, 0, s), pt(s, 0, s), pt(s, s, s), pt(0, s, s)];
  const L = [pt(0, s, 0), pt(s, s, 0), pt(s, s, s), pt(0, s, s)];
  const R = [pt(s, 0, 0), pt(s, s, 0), pt(s, s, s), pt(s, 0, s)];
  const body = [pt(0, 0, s), pt(s, 0, s), pt(s, 0, 0), pt(s, s, 0), pt(0, s, 0), pt(0, s, s)];
  const pr = s * 0.085;
  const m = s / 2;
  const q = s * 0.26;
  const LAY = {
    1: [[m, m]],
    2: [[q, q], [s - q, s - q]],
    3: [[q, q], [m, m], [s - q, s - q]],
    4: [[q, q], [s - q, q], [q, s - q], [s - q, s - q]],
    5: [[q, q], [s - q, q], [m, m], [q, s - q], [s - q, s - q]],
    6: [[q, q], [s - q, q], [q, m], [s - q, m], [q, s - q], [s - q, s - q]],
  };
  const pips = (n) => LAY[n].map(([u, v], i) => <circle key={i} cx={f(u)} cy={f(v)} r={f(n === 1 ? pr * 1.5 : pr)} fill={n === 1 ? one : pip} />);
  return (
    <g transform={`translate(${f(x)} ${f(y)})${rot ? ` rotate(${rot})` : ''}`}>
      {shade && <ellipse cx="0" cy={f(s + 1)} rx={f(s * 1.5)} ry={f(s * 0.62)} fill="#1b1340" opacity=".26" />}
      <path d={roundedPath(body, r * 1.05)} fill="#a89ad8" stroke="#a89ad8" strokeWidth=".6" />
      <path d={roundedPath(L, r)} fill="#f4eeff" stroke="#f4eeff" strokeWidth=".6" />
      <path d={roundedPath(R, r)} fill="#c9bdf0" stroke="#c9bdf0" strokeWidth=".6" />
      <path d={roundedPath(T, r)} fill="#ffffff" stroke="#ffffff" strokeWidth=".6" />
      <Face p="T" at={s}>{pips(top)}</Face>
      <Face p="L" at={s}>{pips(left)}</Face>
      <Face p="R" at={s}>{pips(right)}</Face>
    </g>
  );
}

/** Procedural skyline: silhouette path + two window paths (warm / cool). */
export function skyline(rand, o) {
  const { x0 = -10, x1 = 810, base = 400, hmin = 40, hmax = 120, wmin = 24, wmax = 50, gap = [0, 6], lit = 0.4, warm = 0.6, cw = 3.4, ch = 4.4, gx = 4, gy = 5.4, spire = 0 } = o;
  let body = '', w1 = '', w2 = '';
  let x = x0;
  while (x < x1) {
    const w = wmin + rand() * (wmax - wmin);
    const h = hmin + rand() * (hmax - hmin);
    const y = base - h;
    body += `M${f(x)} ${f(y)}h${f(w)}V${base}h${f(-w)}Z`;
    if (spire && rand() < spire) {
      const hh = f(10 + rand() * 14);
      body += `M${f(x + w / 2 - 0.8)} ${f(y)}v${-hh}h1.6v${hh}Z`;
    }
    const cols = Math.floor((w - 5) / (cw + gx));
    const rows = Math.floor((h - 8) / (ch + gy));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (rand() > lit) continue;
        const px = x + 3 + i * (cw + gx), py = y + 6 + j * (ch + gy);
        const d = `M${f(px)} ${f(py)}h${cw}v${ch}h${-cw}Z`;
        if (rand() < warm) w1 += d; else w2 += d;
      }
    }
    x += w + gap[0] + rand() * (gap[1] - gap[0]);
  }
  return { body, w1, w2 };
}

/** Scatter of twinkling stars / dots. */
export function Stars({ rand, n = 40, w = 800, ymax = 260, xmin = 0, c = '#fff', cls = 'hub-tw', o = 0.8 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = xmin + rand() * (w - xmin), y = rand() * ymax, r = 0.6 + rand() * 1.5;
    out.push(<circle key={i} className={i % 4 === 0 ? cls : undefined} cx={Math.round(x)} cy={Math.round(y)} r={f(r)} opacity={f(o * (0.45 + rand() * 0.55))} style={i % 4 === 0 ? { animationDelay: `-${f(rand() * 5)}s` } : undefined} />);
  }
  return <g fill={c}>{out}</g>;
}

/** CSS shared by animated covers; every rule is disabled under prefers-reduced-motion. */
export const COVER_CSS = `
.hub-tw{animation:hub-tw 3.6s ease-in-out infinite}
.hub-bob{animation:hub-bob 5s ease-in-out infinite}
.hub-bob2{animation:hub-bob 6.4s ease-in-out -2s infinite}
.hub-spin{animation:hub-spin 9s ease-in-out infinite}
@keyframes hub-tw{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes hub-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes hub-spin{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@media (prefers-reduced-motion: reduce){.hub-tw,.hub-bob,.hub-bob2,.hub-spin{animation:none!important}}
`;

/* ---- stroke digits (6 wide x 10 tall, y-down) so numbers never depend on a font ---- */
const DG = {
  0: 'M3 0Q0 0 0 5Q0 10 3 10Q6 10 6 5Q6 0 3 0Z',
  1: 'M1 2.4L3.6 0V10',
  2: 'M0.4 2.6Q0.9 0 3 0Q5.6 0 5.6 2.8Q5.6 4.8 3.4 6.6L0 10H6',
  3: 'M0.6 1.4Q1.5 0 3 0Q5.6 0 5.6 2.6Q5.6 4.8 2.6 4.8Q6 4.8 6 7.4Q6 10 3 10Q1 10 0 8.4',
  4: 'M4.6 10V0L0 7H6.4',
  5: 'M5.4 0H1.2L0.6 4.6Q1.6 3.8 3 3.8Q6 3.8 6 6.8Q6 10 3 10Q1 10 0 8.4',
  6: 'M5 1Q4 0 3 0Q0 0 0 5V6.6Q0 10 3 10Q6 10 6 6.8Q6 3.8 3 3.8Q1 3.8 0 5.4',
  7: 'M0 0H6L2.4 10',
  8: 'M3 0Q0.6 0 0.6 2.5Q0.6 4.8 3 5Q0 5.2 0 7.6Q0 10 3 10Q6 10 6 7.6Q6 5.2 3 5Q5.4 4.8 5.4 2.5Q5.4 0 3 0Z',
  9: 'M1 9Q2 10 3 10Q6 10 6 5V3.4Q6 0 3 0Q0 0 0 3.2Q0 6.2 3 6.2Q5 6.2 6 4.6',
};

/** Number drawn with strokes, horizontally centred on x, vertically centred on y, digit height h. */
export function Num({ text, x = 0, y = 0, h = 10, color = '#1b1340', sw, rot = 0 }) {
  const s = h / 10;
  const str = String(text);
  const adv = 8 * s;
  const total = (str.length - 1) * adv + 6 * s;
  const w = sw || Math.max(1, h * 0.17);
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${rot}) translate(${f(-total / 2)} ${f(-h / 2)})`}>
      {[...str].map((ch, i) => (DG[ch] ? (
        <path key={i} d={DG[ch]} transform={`translate(${f(i * adv)} 0) scale(${s})`} fill="none" stroke={color} strokeWidth={f(w / s)} strokeLinecap="round" strokeLinejoin="round" />
      ) : null))}
    </g>
  );
}
