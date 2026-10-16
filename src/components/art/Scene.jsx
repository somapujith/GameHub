// Full-bleed night backdrops for Hyderabad: charminar | cyberabad | hussainsagar | golconda | banjara | night | jail.
// viewBox 800x600, preserveAspectRatio="xMidYMid slice". Layers are <g class="hyt-layer" data-depth="0..1"> so the
// shell can parallax them (translate by depth * pointer). Animations (twinkle, blink, ripples, searchlight) are plain CSS
// and switch off under prefers-reduced-motion.
import { memo, useId } from 'react';
import { CharminarFront } from './marks.jsx';

const W = 800;
const H = 600;
const HZ = 470; // horizon / ground line (scene content is shifted up by SHIFT so 16:9 crops keep the ground)
const SHIFT = -40;
const BOT = 720;

const CSS = `
.hyt-st{fill:#fff;opacity:.85;animation:hyt-tw 3.4s ease-in-out infinite}
.hyt-s2{animation-duration:4.6s}
.hyt-s3{animation-duration:5.8s}
.hyt-sg{fill:#ffe9a8}
.hyt-bl{animation:hyt-bl 1.9s steps(2,end) infinite}
.hyt-fl{animation:hyt-fl 1.7s ease-in-out infinite}
.hyt-rp{animation:hyt-rp 7s ease-in-out infinite}
.hyt-sw{transform-origin:0 0;animation:hyt-sw 8s ease-in-out infinite}
@keyframes hyt-tw{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes hyt-bl{0%,100%{opacity:1}50%{opacity:.12}}
@keyframes hyt-fl{0%,100%{opacity:.95}40%{opacity:.55}70%{opacity:1}}
@keyframes hyt-rp{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}
@keyframes hyt-sw{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}
@media (prefers-reduced-motion: reduce){.hyt-st,.hyt-bl,.hyt-fl,.hyt-rp,.hyt-sw{animation:none!important}}
`;

const rng = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const f = (n) => Math.round(n * 10) / 10;

/** Procedural skyline: one silhouette path + two window paths (warm / cool). */
function city(rand, o) {
  const { x0 = -10, x1 = W + 10, base = HZ, hmin = 40, hmax = 120, wmin = 24, wmax = 50, gap = [0, 6], lit = 0.4, warm = 0.6, cw = 3.4, ch = 4.4, gx = 4, gy = 5.4, spire = 0 } = o;
  let body = '', w1 = '', w2 = '';
  let x = x0;
  while (x < x1) {
    const w = wmin + rand() * (wmax - wmin);
    const h = hmin + rand() * (hmax - hmin);
    const y = base - h;
    body += `M${f(x)} ${f(y)}h${f(w)}V${base}h${f(-w)}Z`;
    if (spire && rand() < spire) { const hh = f(10 + rand() * 14); body += `M${f(x + w / 2 - 0.8)} ${f(y)}v${-hh}h1.6v${hh}Z`; }
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

function City({ c, fill, op = 1, warm = '#ffd36e', cool = '#8fe3ff', wo = 0.85 }) {
  return (
    <g opacity={op}>
      <path d={c.body} fill={fill} />
      {c.w1 && <path d={c.w1} fill={warm} opacity={wo} />}
      {c.w2 && <path d={c.w2} fill={cool} opacity={wo} />}
    </g>
  );
}

function ridge(rand, y0, amp, step = 50, bottom = BOT) {
  let d = `M-10 ${bottom}V${f(y0)}`;
  let x = -10, py = y0;
  while (x < W + 10) {
    x += step;
    const ny = y0 + (rand() - 0.5) * 2 * amp;
    d += `Q${f(x - step / 2)} ${f(py + (rand() - 0.5) * amp)} ${f(x)} ${f(ny)}`;
    py = ny;
  }
  return d + `V${bottom}Z`;
}

const merlons = (x0, x1, y, w = 6, h = 5, g = 5) => {
  let d = '';
  for (let x = x0; x + w <= x1; x += w + g) d += `M${f(x)} ${y}h${w}v${-h}h${-w}Z`;
  return d;
};

function Sky({ id, stops, glow = '#ffb36b', glowOp = 0.55, glowY = HZ + SHIFT, moon = { x: 640, y: 120, r: 24 }, stars = 56, seed = 7, ymax = 360 }) {
  const rand = rng(seed);
  const st = [];
  for (let i = 0; i < stars; i++) {
    const x = rand() * W, y = rand() * ymax;
    const r = 0.5 + rand() * 1.4;
    st.push(
      <circle key={i} className={`hyt-st hyt-s${1 + (i % 3)}${i % 7 === 0 ? ' hyt-sg' : ''}`} cx={Math.round(x)} cy={Math.round(y)} r={f(r)} style={{ animationDelay: `-${f(rand() * 5)}s` }} />,
    );
  }
  return (
    <g className="hyt-layer" data-depth="0">
      <defs>
        <linearGradient id={id + 'sky'} x1="0" y1="0" x2="0" y2="1">
          {stops.map((c, i) => <stop key={i} offset={[0, 0.22, 0.4, 0.54, 0.65, 0.74][i]} stopColor={c} />)}
        </linearGradient>
        <radialGradient id={id + 'moon'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe9c4" stopOpacity=".3" />
          <stop offset="1" stopColor="#ffe9c4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + 'glow'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={glow} stopOpacity={glowOp} />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <ellipse cx={W / 2} cy={glowY} rx="560" ry="170" fill={`url(#${id}glow)`} />
      {st}
      {moon && (
        <g>
          <circle cx={moon.x} cy={moon.y} r={moon.r * 3.6} fill={`url(#${id}moon)`} />
          <path d={`M${moon.x} ${moon.y - moon.r}A${moon.r} ${moon.r} 0 1 0 ${moon.x} ${moon.y + moon.r}A${moon.r * 1.45} ${moon.r * 1.45} 0 0 1 ${moon.x} ${moon.y - moon.r}Z`} fill="#fff3d6" />
        </g>
      )}
    </g>
  );
}

const Layer = ({ d, children }) => (
  <g className="hyt-layer" data-depth={d}>
    <g transform={`translate(0 ${SHIFT})`}>{children}</g>
  </g>
);

const Glow = ({ x, y, r = 10, c = '#ffc857', o = 0.35, cls }) => (
  <g className={cls}>
    <circle cx={x} cy={y} r={r * 2.4} fill={c} opacity={o * 0.35} />
    <circle cx={x} cy={y} r={r} fill={c} opacity={o + 0.3} />
    <circle cx={x} cy={y} r={r * 0.45} fill="#fff6d6" />
  </g>
);

function Auto({ x, y, s = 1, flip }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="34" cy="43" rx="40" ry="3.6" fill="#05031a" opacity=".5" />
      <path d="M2 38V24Q4 12 20 10L52 8Q60 8 62 20L66 30Q70 32 70 38Z" fill="#0f0a30" />
      <path d="M8 12L52 6Q58 6 60 12L8 16Z" fill="#241a68" />
      <path d="M10 26H44V18Q30 16 12 20Z" fill="#ffc857" opacity=".25" />
      <circle cx="16" cy="40" r="6.4" fill="#05031a" />
      <circle cx="58" cy="40" r="6.4" fill="#05031a" />
      <circle cx="68" cy="30" r="3.6" fill="#ffe08a" />
      <circle cx="68" cy="30" r="9" fill="#ffe08a" opacity=".22" />
    </g>
  );
}

function Palm({ x, y, s = 1, c = '#07041c' }) {
  const leaf = 'M0 0Q22 -26 54 -4Q28 -12 0 0Z';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
      <path d="M-3 0Q2 -50 -2 -92L3 -92Q8 -50 4 0Z" />
      <g transform="translate(0 -92)">
        {[-20, -52, -90, -128, -160, 8].map((a, i) => <path key={i} d={leaf} transform={`rotate(${a}) scale(${0.8 + (i % 3) * 0.12})`} />)}
      </g>
    </g>
  );
}

function Lamp({ x, y, h = 70, c = '#ffd36e' }) {
  return (
    <g>
      <rect x={x - 1.4} y={y - h} width="2.8" height={h} fill="#070420" />
      <rect x={x - 1.4} y={y - h} width="12" height="2.4" fill="#070420" />
      <Glow x={x + 10} y={y - h + 5} r={4.2} c={c} o={0.4} cls="hyt-fl" />
    </g>
  );
}

/* ================= scenes ================= */

function Charminar({ id }) {
  const r = rng(11);
  const far = city(r, { hmin: 26, hmax: 70, wmin: 20, wmax: 44, lit: 0.18, base: HZ });
  const left = city(rng(5), { x0: -10, x1: 290, hmin: 70, hmax: 150, wmin: 30, wmax: 56, lit: 0.2, base: HZ + 6, spire: 0.3 });
  const right = city(rng(9), { x0: 520, x1: 820, hmin: 70, hmax: 150, wmin: 30, wmax: 56, lit: 0.2, base: HZ + 6, spire: 0.3 });
  const bunting = (y0, sag, cols) => {
    const out = cols.map(() => '');
    const wire = `M-10 ${y0}Q${W / 2} ${y0 + sag} ${W + 10} ${y0}`;
    let k = 0;
    for (let x = 14; x < W; x += 22) {
      const t = x / W;
      const y = y0 + 2 * (1 - t) * t * sag;
      out[k % cols.length] += `M${f(x - 6)} ${f(y)}h12l-6 12Z`;
      k++;
    }
    return { wire, out };
  };
  const b1 = bunting(300, 56, ['#ff8a3d', '#ff5d73', '#2ec4b6', '#ffc857']);
  const b2 = bunting(250, 40, ['#9b7bff', '#ffc857', '#ff5d73', '#4cc9f0']);
  const bulbs = [];
  for (let i = 0; i < 20; i++) {
    const t = (i + 0.5) / 20;
    const x = t * W;
    const y = (1 - t) * (1 - t) * 340 + 2 * (1 - t) * t * 388 + t * t * 340;
    bulbs.push(<Glow key={i} x={f(x)} y={f(y)} r={2.6} c={i % 3 === 0 ? '#ff8a3d' : '#ffd36e'} o={0.35} cls="hyt-fl" />);
  }
  return (
    <>
      <Sky id={id} stops={['#0d0826', '#241659', '#5a2f98', '#b04a93', '#f2705f', '#ffb15e']} seed={3} moon={{ x: 610, y: 110, r: 22 }} />
      <Layer d="0.1">
        <City c={far} fill="#37278a" wo={0.5} />
      </Layer>
      <Layer d="0.25">
        <ellipse cx="400" cy="330" rx="300" ry="230" fill={`url(#${id}glow)`} opacity=".8" />
        <path d={`M-10 ${HZ - 6}H${W + 10}V${BOT}H-10Z`} fill="#241a6a" />
      </Layer>
      <Layer d="0.4">
        <City c={left} fill="#1c1458" />
        <City c={right} fill="#1c1458" />
        <g fill="#1c1458">
          <path d={`M214 ${HZ}V210h8v${HZ - 210}Z`} />
          <path d={`M578 ${HZ}V210h8v${HZ - 210}Z`} />
          <path d="M210 210A8 9 0 0 1 226 210Z M574 210A8 9 0 0 1 590 210Z" />
        </g>
        <Glow x={218} y={198} r={2.4} />
        <Glow x={582} y={198} r={2.4} />
      </Layer>
      <Layer d="0.5">
        <g fill="none" stroke="#0a0626" strokeWidth="1.2"><path d={b1.wire} /><path d={b2.wire} /></g>
        {b1.out.map((d, i) => <path key={'a' + i} d={d} fill={['#ff8a3d', '#ff5d73', '#2ec4b6', '#ffc857'][i]} opacity=".9" />)}
        {b2.out.map((d, i) => <path key={'b' + i} d={d} fill={['#9b7bff', '#ffc857', '#ff5d73', '#4cc9f0'][i]} opacity=".85" />)}
        {bulbs}
      </Layer>
      <Layer d="0.6">
        <g transform={`translate(${400 - 150} ${HZ - 262}) scale(4.7)`}>
          <CharminarFront ground={false} stone="#4c3ba8" shade="#38298a" arch="#ffc857" archInner="#ff9a3d" gold="#ffc857" cap="#6552c0" />
        </g>
        <path d={`M-10 ${HZ}H${W + 10}V${BOT}H-10Z`} fill="#130d3e" />
        <ellipse cx="400" cy={HZ + 6} rx="230" ry="20" fill={`url(#${id}glow)`} />
      </Layer>
      <Layer d="1">
        <Lamp x={150} y={540} h={110} />
        <Lamp x={650} y={540} h={110} />
        <Auto x={60} y={528} s={1.15} />
        <Auto x={640} y={540} s={1.0} flip />
        <path d={`M-10 ${H - 24}H${W + 10}V${BOT}H-10Z`} fill="#06031a" />
      </Layer>
    </>
  );
}

function Cyber({ id }) {
  const far = city(rng(21), { hmin: 50, hmax: 140, wmin: 22, wmax: 40, lit: 0.12, base: HZ, spire: 0.2 });
  const mid = city(rng(23), { x0: -10, x1: 330, hmin: 90, hmax: 240, wmin: 34, wmax: 60, lit: 0.26, warm: 0.4, base: HZ, gx: 5, gy: 7 });
  const mid2 = city(rng(27), { x0: 480, x1: 820, hmin: 90, hmax: 240, wmin: 34, wmax: 60, lit: 0.26, warm: 0.4, base: HZ, gx: 5, gy: 7 });
  const tw = [];
  const hero = [
    [338, 56, 330, 'slant'],
    [394, 70, 262, 'step'],
    [464, 46, 200, 'flat'],
  ];
  let hb = '', hw1 = '', hw2 = '';
  const r = rng(31);
  hero.forEach(([x, w, h, kind]) => {
    const y = HZ - h;
    if (kind === 'slant') hb += `M${x} ${HZ}V${y + 26}L${x + w} ${y}V${HZ}Z`;
    else if (kind === 'step') hb += `M${x} ${HZ}V${y}h${w}V${HZ}ZM${x + 10} ${y}V${y - 22}h${w - 20}V${y}Z`;
    else hb += `M${x} ${HZ}V${y}h${w}V${HZ}Z`;
    const cols = Math.floor((w - 8) / 7.6), rows = Math.floor((h - 18) / 9.4);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (r() > 0.46) continue;
      const d = `M${f(x + 5 + i * 7.6)} ${f(y + 18 + j * 9.4)}h4.4v5.2h-4.4Z`;
      if (r() < 0.45) hw1 += d; else hw2 += d;
    }
    tw.push(<rect key={x} x={x} y={y + 8} width="5" height={h - 8} fill="#3f6fe0" opacity=".28" />);
  });
  const trails = [];
  for (let i = 0; i < 16; i++) {
    const x = 20 + i * 52;
    trails.push(<rect key={'r' + i} x={x} y={HZ + 20 + (i % 2) * 5} width={22 + (i % 3) * 10} height="2.2" rx="1" fill={i % 2 ? '#ff5d73' : '#fff3c4'} opacity=".85" />);
  }
  return (
    <>
      <Sky id={id} stops={['#070b26', '#0f1f66', '#2b3fa6', '#6a56c9', '#d672a0', '#ffb277']} seed={13} moon={{ x: 170, y: 110, r: 20 }} glowOp={0.5} />
      <Layer d="0.1"><City c={far} fill="#26307f" wo={0.55} cool="#9fe9ff" /></Layer>
      <Layer d="0.3">
        <City c={mid} fill="#141052" />
        <City c={mid2} fill="#141052" />
      </Layer>
      <Layer d="0.55">
        <path d={hb} fill="#120e4a" />
        {tw}
        <path d={hw1} fill="#ffd36e" opacity=".85" />
        <path d={hw2} fill="#8fe3ff" opacity=".9" />
        <path d={`M${338 + 28} ${HZ - 330 + 8}V${HZ - 372}`} stroke="#8c84c8" strokeWidth="1.6" />
        <g className="hyt-bl"><circle cx={366} cy={HZ - 374} r="3" fill="#ff5d73" /><circle cx={366} cy={HZ - 374} r="9" fill="#ff5d73" opacity=".25" /></g>
        <g className="hyt-bl" style={{ animationDelay: '.9s' }}><circle cx={429} cy={HZ - 286} r="2.4" fill="#ff5d73" /><circle cx={429} cy={HZ - 286} r="7" fill="#ff5d73" opacity=".25" /></g>
      </Layer>
      <Layer d="0.8">
        <path d={`M-10 ${HZ}H${W + 10}V${BOT}H-10Z`} fill="#0b0838" />
        <rect x="-10" y={HZ + 12} width={W + 20} height="22" fill="#161160" />
        <rect x="-10" y={HZ + 12} width={W + 20} height="2.4" fill="#6f7de0" opacity=".6" />
        {[60, 220, 380, 540, 700].map((x) => <rect key={x} x={x} y={HZ + 34} width="12" height="40" fill="#0b0838" />)}
        {trails}
      </Layer>
      <Layer d="1">
        <path d={`M-10 ${H - 70}H${W + 10}V${BOT}H-10Z`} fill="#06031a" />
        <Lamp x={110} y={H - 40} h={120} c="#8fe3ff" />
        <Lamp x={690} y={H - 40} h={120} c="#8fe3ff" />
        <Auto x={420} y={H - 62} s={0.9} />
      </Layer>
    </>
  );
}

function Sagar({ id }) {
  const far = city(rng(41), { hmin: 14, hmax: 50, wmin: 14, wmax: 30, lit: 0.3, base: 440, gap: [2, 8] });
  const statue = (
    <g>
      <path d="M-100 0Q-76 -22 -44 -28Q0 -36 44 -28Q76 -22 100 0Z" fill="#150f40" />
      <path d="M-36 -27L-28 -41H28L36 -27Z" fill="#1b1350" />
      <rect x="-24" y="-53" width="48" height="13" fill="#221862" />
      <rect x="-30" y="-58" width="60" height="6" rx="2.4" fill="#2c2174" />
      <g transform="translate(0 -58) scale(5.2)" fill="#2a1f78">
        <path d="M-4.2 0C-4.6 -8 -3.8 -14 -3 -19L3 -19C3.8 -14 4.6 -8 4.2 0Z" />
        <path d="M-5.2 -17.4Q-5.4 -20.4 -3 -20.8L3 -20.8Q5.4 -20.4 5.2 -17.4Z" />
        <rect x="-1.1" y="-22" width="2.2" height="2" />
        <circle cx="0" cy="-23.4" r="2.5" />
        <circle cx="0" cy="-26" r="1.1" />
        <path d="M3.6 -18.4Q7.4 -19.4 7.6 -24L6.4 -24.2Q6 -20.6 3 -19.4Z" />
        <ellipse cx="7" cy="-25" rx="1" ry="1.6" />
        <path d="M-3.8 -18.4Q-6.4 -14 -5 -9L-3.8 -9.4Q-4.8 -13.6 -2.8 -17Z" />
      </g>
      <g transform="translate(0 -58) scale(5.2)" fill="none" stroke="#ffb15e" strokeWidth=".32" strokeLinecap="round" opacity=".85">
        <path d="M3 -19C3.8 -14 4.6 -8 4.2 0" />
        <path d="M2.4 -24.4A2.5 2.5 0 0 0 0 -25.9" />
        <path d="M5.2 -17.4Q5.4 -20.4 3 -20.8" />
      </g>
    </g>
  );
  const ripples = [];
  for (let i = 0; i < 22; i++) {
    const y = HZ + 14 + i * 5.6 + (i % 3);
    const x = (i * 137) % 700 + 20;
    const w = 40 + ((i * 53) % 90);
    ripples.push(<rect key={i} className="hyt-rp" x={x} y={y} width={w} height="1.6" rx=".8" fill={i % 4 === 0 ? '#ffd9a0' : '#ffffff'} opacity={0.12 + (i % 4) * 0.06} style={{ animationDelay: `${(i % 7) * 0.6}s` }} />);
  }
  const boat = (x, y, s, key) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0H64L56 10H8Z" fill="#06031a" />
      <path d="M32 0V-46L8 -4Z" fill="#251b6e" />
      <path d="M34 -2V-34L56 -2Z" fill="#33257f" />
      <circle cx="4" cy="-4" r="3" fill="#ffd36e" /><circle cx="4" cy="-4" r="8" fill="#ffd36e" opacity=".25" />
    </g>
  );
  return (
    <>
      <Sky id={id} stops={['#0a0724', '#1a1250', '#3e2a8e', '#8f48a6', '#f27e6e', '#ffc277']} seed={17} moon={{ x: 200, y: 130, r: 24 }} glowY={HZ - 10} />
      <Layer d="0.12">
        <City c={far} fill="#2c2080" wo={0.9} />
        <path d={ridge(rng(51), 438, 8, 60, 450)} fill="#231a70" />
      </Layer>
      <Layer d="0.3">
        <defs>
          <linearGradient id={id + 'wt'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6806e" />
            <stop offset=".25" stopColor="#8f48a6" />
            <stop offset=".7" stopColor="#2a1c78" />
            <stop offset="1" stopColor="#0e0838" />
          </linearGradient>
        </defs>
        <rect x="-10" y={HZ} width={W + 20} height={BOT - HZ} fill={`url(#${id}wt)`} />
        {/* reflections */}
        <g transform={`translate(0 ${HZ * 2}) scale(1 -1)`} opacity=".22">
          <City c={far} fill="#6a56c9" />
          <g transform="translate(400 470)">{statue}</g>
        </g>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={200 - 22 + i * 3 - (i % 2) * 6} y={HZ + 8 + i * 9} width={44 - i * 4} height="2" rx="1" fill="#fff3d6" opacity={0.28 - i * 0.03} />)}
      </Layer>
      <Layer d="0.5">
        <ellipse cx="400" cy={HZ - 90} rx="230" ry="200" fill={`url(#${id}glow)`} opacity=".85" />
        <g transform={`translate(400 ${HZ})`}>{statue}</g>
        <path d="M-10 466Q60 452 130 464T270 470H-10Z M560 470Q650 452 720 462T820 466V470Z" fill="#0c0732" />
      </Layer>
      <Layer d="0.7">{ripples}</Layer>
      <Layer d="0.85">
        {boat(150, 520, 1.1, 'a')}
        {boat(560, 548, 0.8, 'b')}
      </Layer>
      <Layer d="1">
        <Palm x={40} y={H + 10} s={1.5} />
        <Palm x={92} y={H + 10} s={1.1} />
        <Palm x={W - 50} y={H + 10} s={1.4} />
        <Palm x={W - 108} y={H + 10} s={1.0} />
      </Layer>
    </>
  );
}

function Golconda({ id }) {
  const hill = 'M-10 470Q90 452 190 440Q290 420 340 372Q380 330 424 304Q470 330 510 372Q570 424 660 440Q740 452 820 470V720H-10Z';
  const torches = [[190, 438], [262, 438], [338, 436], [510, 436], [598, 438], [672, 440], [372, 396], [478, 396], [404, 352], [444, 352], [424, 296]];
  const towers = [[168, 40], [300, 52], [350, 44], [498, 44], [548, 52], [676, 40]];
  return (
    <>
      <Sky id={id} stops={['#0c0724', '#21154f', '#4d2b8f', '#9b4aa0', '#f5805a', '#ffbe6a']} seed={29} moon={{ x: 640, y: 118, r: 22 }} />
      <Layer d="0.1">
        <path d={ridge(rng(61), 420, 22, 70)} fill="#3a2a86" opacity=".85" />
      </Layer>
      <Layer d="0.25">
        <path d={ridge(rng(63), 446, 14, 60)} fill="#2a1d72" />
      </Layer>
      <Layer d="0.45">
        <path d={hill} fill="#1d1456" />
        {/* lower curtain wall + bastions */}
        <path d="M150 470V434H690V470Z" fill="#17104a" />
        <path d={merlons(150, 690, 434, 7, 6, 5)} fill="#17104a" />
        {towers.map(([x, h]) => (
          <g key={x}>
            <rect x={x - 15} y={470 - h - 14} width="30" height={h + 14} fill="#150e44" />
            <path d={merlons(x - 15, x + 15, 470 - h - 14, 5, 5, 3)} fill="#150e44" />
            <path d={`M${x - 3} ${470 - h + 8}h6v14a3 3 0 0 1 -6 0Z`} fill="#ffc857" opacity=".9" />
          </g>
        ))}
        {/* gate */}
        <path d="M388 470V440A12 12 0 0 1 412 440V470Z" fill="#0a0630" />
        <path d="M393 470V442A7 7 0 0 1 407 442V470Z" fill="#ffc857" opacity=".75" />
        {/* upper wall */}
        <path d="M300 392V376H548V392Z" fill="#150e44" />
        <path d={merlons(300, 548, 376, 6, 5, 4)} fill="#150e44" />
        {[[300, 36], [548, 36]].map(([x, h]) => <g key={x}><rect x={x - 12} y={392 - h} width="24" height={h} fill="#130c3e" /><path d={merlons(x - 12, x + 12, 392 - h, 5, 5, 3)} fill="#130c3e" /></g>)}
        {/* Bala Hissar */}
        <rect x="378" y="318" width="92" height="40" fill="#130c3e" />
        <path d={merlons(378, 470, 318, 7, 5, 6)} fill="#130c3e" />
        <rect x="392" y="286" width="64" height="32" fill="#150e44" />
        {[404, 424, 444].map((x) => <path key={x} d={`M${x - 5} 318V300A5 5 0 0 1 ${x + 5} 300V318Z`} fill="#ffc857" opacity=".85" />)}
        {[392, 456].map((x) => <g key={x}><rect x={x - 3} y="276" width="6" height="14" fill="#150e44" /><path d={`M${x - 6} 276A6 7 0 0 1 ${x + 6} 276Z`} fill="#1d1456" /></g>)}
        <path d="M410 286A14 17 0 0 1 438 286Z" fill="#1d1456" />
        <path d="M424 269V252" stroke="#150e44" strokeWidth="2" />
        <path d="M424 252L438 256L424 261Z" fill="#ff8a3d" />
        {torches.map(([x, y], i) => <Glow key={i} x={x} y={y} r={3} c="#ff9a3d" o={0.3} cls="hyt-fl" />)}
        <path d={`M-10 ${HZ}H${W + 10}V${BOT}H-10Z`} fill="#120c3a" />
      </Layer>
      <Layer d="0.8">
        <g fill="#0a0626">
          <ellipse cx="90" cy="520" rx="70" ry="42" /><ellipse cx="150" cy="540" rx="46" ry="30" />
          <ellipse cx="700" cy="522" rx="80" ry="44" /><ellipse cx="640" cy="545" rx="44" ry="28" />
        </g>
        <path d="M356 600L390 470H458L492 600Z" fill="#1a1250" />
        {[490, 510, 530, 550, 570].map((y) => <rect key={y} x={380 - (y - 470) * 0.4} y={y} width={88 + (y - 470) * 0.8} height="3" fill="#2b1f78" />)}
      </Layer>
      <Layer d="1">
        <Palm x={34} y={H + 10} s={1.3} />
        <Palm x={W - 36} y={H + 10} s={1.2} />
      </Layer>
    </>
  );
}

function Banjara({ id }) {
  const towersL = city(rng(71), { x0: -10, x1: 250, hmin: 160, hmax: 330, wmin: 40, wmax: 66, lit: 0.27, warm: 0.7, base: 500, gap: [4, 10], gx: 5, gy: 6.6 });
  const towersR = city(rng(73), { x0: 540, x1: 820, hmin: 150, hmax: 320, wmin: 40, wmax: 66, lit: 0.27, warm: 0.7, base: 500, gap: [4, 10], gx: 5, gy: 6.6 });
  const far = city(rng(77), { hmin: 30, hmax: 100, wmin: 18, wmax: 34, lit: 0.14, base: HZ });
  const dots = [];
  const r = rng(79);
  for (let i = 0; i < 46; i++) dots.push(<circle key={i} cx={f(r() * W)} cy={f(HZ - 4 + r() * 24)} r={f(0.7 + r() * 1.1)} fill={r() < 0.6 ? '#ffd36e' : '#fff3c4'} opacity={0.5 + r() * 0.4} />);
  const rock = (x, y, rx, ry, c) => (
    <g key={x + '' + y}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={c} />
      <ellipse cx={x - rx * 0.18} cy={y - ry * 0.22} rx={rx * 0.7} ry={ry * 0.55} fill="#ffffff" opacity=".05" />
    </g>
  );
  const trails = [];
  for (let i = 0; i < 9; i++) trails.push(<rect key={i} x={30 + i * 82} y={H - 36 + (i % 2) * 6} width={26 + (i % 3) * 8} height="2.2" rx="1" fill={i % 2 ? '#ff5d73' : '#fff3c4'} opacity=".85" />);
  return (
    <>
      <Sky id={id} stops={['#0a0824', '#1a1256', '#3a2c9a', '#7b45b0', '#d96aa0', '#ffa26a']} seed={37} moon={{ x: 400, y: 100, r: 20 }} />
      <Layer d="0.1">
        <City c={far} fill="#33268a" wo={0.5} />
        <path d={ridge(rng(81), 440, 16, 70, 520)} fill="#2a1e78" />
        {dots}
      </Layer>
      <Layer d="0.3">
        <path d={ridge(rng(83), 470, 12, 80, 560)} fill="#1c1458" />
        {[[110, 474, 80, 44], [215, 490, 58, 30], [700, 476, 86, 46], [606, 492, 60, 30]].map(([x, y, rx, ry]) => rock(x, y, rx, ry, '#2d2184'))}
      </Layer>
      <Layer d="0.55">
        <City c={towersL} fill="#150e48" />
        <City c={towersR} fill="#150e48" />
        <g fill="#f8f1ff" opacity=".1"><rect x="40" y="200" width="4" height="300" /><rect x="650" y="210" width="4" height="290" /></g>
        {/* lit villa with pool glow */}
        <rect x="326" y="456" width="148" height="34" fill="#120c3e" />
        <rect x="346" y="440" width="108" height="16" fill="#1a1250" />
        <rect x="338" y="452" width="124" height="3" fill="#2a1f78" />
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={336 + i * 21} y="464" width="12" height="14" fill="#ffd36e" opacity=".85" />)}
        {[0, 1, 2, 3].map((i) => <rect key={"u" + i} x={356 + i * 24} y="444" width="14" height="8" fill="#ffd36e" opacity=".7" />)}
        <ellipse cx="400" cy="494" rx="96" ry="9" fill="#4cc9f0" opacity=".3" />
      </Layer>
      <Layer d="0.8">
        <path d={`M-10 500H${W + 10}V${BOT}H-10Z`} fill="#0d0838" />
        {rock(60, 540, 90, 52, '#1a1156')}
        {rock(760, 548, 100, 56, '#1a1156')}
        {rock(120, 580, 60, 30, '#0a0630')}
        {rock(690, 584, 70, 32, '#0a0630')}
        <Palm x={250} y={540} s={1.1} />
        <Palm x={560} y={546} s={1.2} />
      </Layer>
      <Layer d="1">
        <path d={`M-10 ${H - 44}H${W + 10}V${BOT}H-10Z`} fill="#06031a" />
        {trails}
        <Lamp x={34} y={H - 20} h={130} />
        <Lamp x={W - 46} y={H - 20} h={130} />
      </Layer>
    </>
  );
}

function Night({ id }) {
  const far = city(rng(91), { hmin: 30, hmax: 100, wmin: 22, wmax: 46, lit: 0.22, base: HZ });
  const mid = city(rng(93), { x0: 280, x1: 520, hmin: 60, hmax: 190, wmin: 30, wmax: 52, lit: 0.3, base: HZ });
  return (
    <>
      <Sky id={id} stops={['#0b0820', '#1b1450', '#3d2a8f', '#8a3fa6', '#e0627f', '#ffa05a']} seed={5} moon={{ x: 580, y: 120, r: 24 }} stars={64} />
      <Layer d="0.12">
        <path d={ridge(rng(95), 430, 18, 70)} fill="#33268a" opacity=".7" />
        <City c={far} fill="#2d2180" wo={0.6} />
      </Layer>
      <Layer d="0.3">
        <City c={mid} fill="#181050" />
        <g transform={`translate(${130 - 64 * 1.9 / 2} ${HZ - 56 * 1.9}) scale(1.9)`}>
          <CharminarFront ground={false} stone="#2c2178" shade="#221964" arch="#ffc857" archInner="#ff9a3d" cap="#3a2d90" />
        </g>
        <g fill="#181050">
          <path d="M600 470V420H690V470Z" />
          <path d={merlons(600, 690, 420, 6, 5, 5)} />
          <rect x="628" y="396" width="34" height="24" />
          <path d="M628 396A17 18 0 0 1 662 396Z" />
          <path d="M700 470V430H770V470Z" />
          <path d={merlons(700, 770, 430, 6, 5, 5)} />
        </g>
        {[618, 640, 652, 712, 740].map((x, i) => <rect key={x} x={x} y={i < 3 ? 436 : 442} width="4" height="7" fill="#ffd36e" opacity=".85" />)}
      </Layer>
      <Layer d="0.6">
        <path d={`M-10 ${HZ - 4}H${W + 10}V${BOT}H-10Z`} fill="#100a38" />
        <path d={ridge(rng(97), 500, 8, 60)} fill="#0b0730" />
      </Layer>
      <Layer d="1">
        <Palm x={44} y={H + 10} s={1.3} />
        <Palm x={W - 44} y={H + 10} s={1.2} />
        <Lamp x={150} y={H - 6} h={110} />
        <Lamp x={650} y={H - 6} h={110} />
      </Layer>
    </>
  );
}

function Jail({ id }) {
  const far = city(rng(101), { hmin: 20, hmax: 60, wmin: 22, wmax: 44, lit: 0.12, base: HZ, warm: 0.3 });
  const wire = (x0, x1, y) => {
    let d = `M${x0} ${y}`;
    for (let x = x0; x < x1; x += 10) d += `l5 -6l5 6`;
    return d;
  };
  const beam = (x, y, delay) => (
    <g transform={`translate(${x} ${y})`}>
      <g className="hyt-sw" style={{ animationDelay: delay }}>
        <polygon points="0,0 -40,-250 40,-250" fill="#dfe9ff" opacity=".07" />
        <polygon points="0,0 -16,-250 16,-250" fill="#ffffff" opacity=".07" />
      </g>
    </g>
  );
  return (
    <>
      <Sky id={id} stops={['#060713', '#0e1633', '#1d2c5e', '#364a88', '#6a5aa6', '#b4688a']} seed={43} moon={{ x: 190, y: 120, r: 22 }} glow="#e0627f" glowOp={0.35} stars={56} />
      <Layer d="0.1">
        <City c={far} fill="#242d68" wo={0.6} />
        <path d={ridge(rng(103), 450, 10, 70, 480)} fill="#1c2358" />
      </Layer>
      <Layer d="0.3">{beam(176, HZ - 50, '0s')}{beam(624, HZ - 50, '-3.6s')}</Layer>
      <Layer d="0.5">
        {/* outer wall */}
        <rect x="-10" y="420" width={W + 20} height="60" fill="#121a42" />
        <path d={merlons(-10, W + 10, 420, 10, 6, 10)} fill="#121a42" />
        <path d={wire(-10, W + 10, 414)} fill="none" stroke="#6a78b8" strokeWidth="1" opacity=".8" />
        {/* watchtowers */}
        {[176, 624].map((x) => (
          <g key={x}>
            <rect x={x - 12} y="372" width="24" height="100" fill="#0f1638" />
            <rect x={x - 22} y="344" width="44" height="30" rx="3" fill="#0f1638" />
            <path d={`M${x - 26} 344L${x} 322L${x + 26} 344Z`} fill="#0c1230" />
            <rect x={x - 14} y="352" width="28" height="12" fill="#ffd36e" opacity=".85" />
            <g className="hyt-bl"><circle cx={x} cy="320" r="2.6" fill="#ff5d73" /><circle cx={x} cy="320" r="8" fill="#ff5d73" opacity=".25" /></g>
          </g>
        ))}
        {/* main block with dome */}
        <rect x="316" y="330" width="168" height="144" fill="#0f1638" />
        <path d={merlons(316, 484, 330, 8, 6, 8)} fill="#0f1638" />
        <rect x="360" y="296" width="80" height="34" fill="#0c1230" />
        <path d="M358 296A42 46 0 0 1 442 296Z" fill="#141c48" />
        <path d="M400 250V232" stroke="#0c1230" strokeWidth="2.4" />
        <circle cx="400" cy="230" r="3" fill="#ffc857" />
        {[0, 1].map((rw) => [0, 1, 2, 3, 4, 5].map((k) => {
          const x = 330 + k * 24 + (k > 2 ? 12 : 0);
          return (
            <g key={rw + '-' + k}>
              <rect x={x} y={350 + rw * 46} width="12" height="22" fill="#ffd36e" opacity=".8" />
              {[3, 6, 9].map((b) => <rect key={b} x={x + b - 0.4} y={350 + rw * 46} width="0.9" height="22" fill="#0f1638" />)}
            </g>
          );
        }))}
        <path d="M382 474V430A18 18 0 0 1 418 430V474Z" fill="#06081c" />
        {[388, 394, 400, 406, 412].map((x) => <rect key={x} x={x} y="414" width="1.2" height="60" fill="#8fa0d8" opacity=".7" />)}
        <path d="M-10 480H820V720H-10Z" fill="#0a0f2c" />
        {/* police glow */}
        <g transform="translate(52 498)">
          <ellipse cx="34" cy="26" rx="44" ry="4" fill="#02030c" opacity=".6" />
          <path d="M0 24V12Q0 8 6 8H14L22 -2H46L54 8H64Q70 8 70 12V24Z" fill="#05061a" />
          <path d="M26 6L30 0H40L44 6Z" fill="#1d2c5e" />
          <circle cx="16" cy="25" r="6" fill="#02030c" /><circle cx="54" cy="25" r="6" fill="#02030c" />
          <rect x="30" y="-5" width="5" height="3" fill="#ff5d73" /><rect x="36" y="-5" width="5" height="3" fill="#4c7bff" />
          <g className="hyt-bl"><circle cx="32" cy="-4" r="22" fill="#ff5d73" opacity=".2" /></g>
          <g className="hyt-bl" style={{ animationDelay: '.95s' }}><circle cx="39" cy="-4" r="22" fill="#4c7bff" opacity=".22" /></g>
        </g>
      </Layer>
      <Layer d="0.85">
        <path d={`M-10 ${H - 56}H${W + 10}V${BOT}H-10Z`} fill="#06081c" />
        {Array.from({ length: 26 }, (_, i) => <rect key={i} x={i * 32 + 6} y={H - 98} width="3" height="46" fill="#0a0f2c" />)}
        <rect x="-10" y={H - 92} width={W + 20} height="3" fill="#0a0f2c" />
        <rect x="-10" y={H - 66} width={W + 20} height="3" fill="#0a0f2c" />
      </Layer>
    </>
  );
}

const SCENES = { charminar: Charminar, cyberabad: Cyber, hussainsagar: Sagar, golconda: Golconda, banjara: Banjara, night: Night, jail: Jail };
export const SCENE_NAMES = Object.keys(SCENES);

function SceneBase({ name = 'night', className }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const C = SCENES[name] || Night;
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <style>{CSS}</style>
      <C id={id} />
    </svg>
  );
}

export const Scene = memo(SceneBase);
export default Scene;
