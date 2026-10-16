// Tiny isometric toolkit (2:1 dimetric). World axes: x -> lower-right, y -> lower-left, z -> up.
// Screen:  sx = x - y,  sy = (x + y) / 2 - z.
// Visible faces of a box: top (+z), "left" (+y side, lit) and "right" (+x side, shadow).
// Draw order is the caller's job (back to front: small x+y first, then low z first).
import { PAL, tone, lighten, darken } from './palette.js';

const r1 = (n) => Math.round(n * 10) / 10;
export const pt = (x, y, z = 0) => [r1(x - y), r1((x + y) / 2 - z)];
const P = (a) => a.map((p) => p[0] + ',' + p[1]).join(' ');
// Seam-free fills: stroke == fill. The root <svg> of every consumer sets stroke-width=.6 + round joins once (inherited).
const seam = (c) => ({ fill: c, stroke: c });

export function Poly({ pts, c, o }) {
  return <polygon points={P(pts)} {...seam(c)} opacity={o} />;
}

/** Flat rectangle lying on the ground (or at height z). */
export function Pad({ x = 0, y = 0, z = 0, w, d, c, o, r = 0 }) {
  const v = [pt(x, y, z), pt(x + w, y, z), pt(x + w, y + d, z), pt(x, y + d, z)];
  if (r > 0) return <path d={roundedPath(v, r)} {...seam(c)} opacity={o} />;
  return <polygon points={P(v)} {...seam(c)} opacity={o} />;
}

/** Solid box. `c` base colour (or `t` = {top,left,right}). */
export function Box({ x = 0, y = 0, z = 0, w, d, h, c, t }) {
  const T = t || tone(c);
  const top = [pt(x, y, z + h), pt(x + w, y, z + h), pt(x + w, y + d, z + h), pt(x, y + d, z + h)];
  const left = [pt(x, y + d, z), pt(x + w, y + d, z), pt(x + w, y + d, z + h), pt(x, y + d, z + h)];
  const right = [pt(x + w, y, z), pt(x + w, y + d, z), pt(x + w, y + d, z + h), pt(x + w, y, z + h)];
  return (
    <g>
      <polygon points={P(left)} {...seam(T.left)} />
      <polygon points={P(right)} {...seam(T.right)} />
      <polygon points={P(top)} {...seam(T.top)} />
    </g>
  );
}

/** Gable roof prism sitting at z. axis 'x' = ridge runs along x. */
export function Gable({ x = 0, y = 0, z = 0, w, d, h, c, axis = 'x' }) {
  const lit = lighten(c, 0.14);
  const shade = darken(c, 0.18);
  if (axis === 'x') {
    const ry = y + d / 2;
    const e0 = pt(x, y, z), e1 = pt(x + w, y, z), e2 = pt(x + w, y + d, z), e3 = pt(x, y + d, z);
    const r0 = pt(x, ry, z + h), r1_ = pt(x + w, ry, z + h);
    return (
      <g>
        <polygon points={P([e0, e1, r1_, r0])} {...seam(shade)} />
        <polygon points={P([e3, e2, r1_, r0])} {...seam(lit)} />
        <polygon points={P([e1, e2, r1_])} {...seam(c)} />
      </g>
    );
  }
  const rx = x + w / 2;
  const e0 = pt(x, y, z), e1 = pt(x + w, y, z), e2 = pt(x + w, y + d, z), e3 = pt(x, y + d, z);
  const r0 = pt(rx, y, z + h), r1_ = pt(rx, y + d, z + h);
  return (
    <g>
      <polygon points={P([e0, e3, r1_, r0])} {...seam(lit)} />
      <polygon points={P([e3, e2, r1_])} {...seam(c)} />
      <polygon points={P([e1, e2, r1_, r0])} {...seam(shade)} />
    </g>
  );
}

/** Upright cylinder. (x,y) = centre of the circle, r = world radius. */
export function Cyl({ x = 0, y = 0, z = 0, r, h, c, t, cap = true }) {
  const T = t || tone(c);
  const [cx, cb] = pt(x, y, z);
  const ct = cb - h;
  const rx = r1(r * 1.414), ry = r1(r * 0.707);
  return (
    <g>
      <path d={`M${cx - rx} ${ct}V${cb}A${rx} ${ry} 0 0 0 ${cx} ${cb + ry}V${ct + ry}Z`} {...seam(T.left)} />
      <path d={`M${cx} ${ct + ry}V${cb + ry}A${rx} ${ry} 0 0 0 ${cx + rx} ${cb}V${ct}Z`} {...seam(T.right)} />
      {cap && <ellipse cx={cx} cy={ct} rx={rx} ry={ry} {...seam(T.top)} />}
    </g>
  );
}

/** Half-sphere dome standing on the ground circle (x,y,z). h = visual height. */
export function Dome({ x = 0, y = 0, z = 0, r, h, c, t }) {
  const T = t || tone(c);
  const [cx, cy] = pt(x, y, z);
  const rx = r1(r * 1.414), ry = r1(r * 0.707);
  return (
    <g>
      <path d={`M${cx} ${cy - h}A${rx} ${h} 0 0 0 ${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx} ${cy + ry}Z`} {...seam(T.left)} />
      <path d={`M${cx} ${cy - h}A${rx} ${h} 0 0 1 ${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}Z`} {...seam(T.right)} />
      <ellipse cx={cx - rx * 0.32} cy={cy - h * 0.58} rx={rx * 0.16} ry={h * 0.2} fill={T.top} opacity=".75" transform={`rotate(-24 ${cx - rx * 0.32} ${cy - h * 0.58})`} />
    </g>
  );
}

/** Cone / spire. */
export function Cone({ x = 0, y = 0, z = 0, r, h, c, t }) {
  const T = t || tone(c);
  const [cx, cy] = pt(x, y, z);
  const rx = r1(r * 1.414), ry = r1(r * 0.707);
  return (
    <g>
      <path d={`M${cx} ${cy - h}L${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx} ${cy + ry}Z`} {...seam(T.left)} />
      <path d={`M${cx} ${cy - h}L${cx} ${cy + ry}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}Z`} {...seam(T.right)} />
    </g>
  );
}

/** Flat disc lying at height z (ring when `ring` given). */
export function Disc({ x = 0, y = 0, z = 0, r, c, o, stroke, sw }) {
  const [cx, cy] = pt(x, y, z);
  return <ellipse cx={cx} cy={cy} rx={r * 1.414} ry={r * 0.707} fill={c} opacity={o} stroke={stroke} strokeWidth={sw} />;
}

/** Local 2D drawing plane glued to a face. p: 'L' (y = at), 'R' (x = at), 'T' (z = at).
 *  Local x runs along the face, local y points UP (world z) on L/R. */
export function Face({ p, at, children }) {
  const m =
    p === 'L' ? `matrix(1 .5 0 -1 ${-at} ${at / 2})` :
    p === 'R' ? `matrix(-1 .5 0 -1 ${at} ${at / 2})` :
    `matrix(1 .5 -1 .5 0 ${-at})`;
  return <g transform={m}>{children}</g>;
}

/** Rounded convex polygon path (screen coords). */
export function roundedPath(v, r) {
  const n = v.length;
  const cs = v.map((p, i) => {
    const pr = v[(i + n - 1) % n], nx = v[(i + 1) % n];
    const toward = (q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      return [r1(p[0] + (dx / l) * r), r1(p[1] + (dy / l) * r)];
    };
    return { v: p, a: toward(pr), b: toward(nx) };
  });
  let d = '';
  cs.forEach((c, i) => {
    d += (i === 0 ? 'M' : 'L') + c.a.join(' ') + 'Q' + c.v.join(' ') + ' ' + c.b.join(' ');
  });
  return d + 'Z';
}

const qm = (a, v, b) => [r1(0.25 * a[0] + 0.5 * v[0] + 0.25 * b[0]), r1(0.25 * a[1] + 0.5 * v[1] + 0.25 * b[1])];
const mid = (a, b) => [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2)];
const sh = (p, t) => [p[0], r1(p[1] + t)];

/** Rounded ground slab (the "diorama base"). Footprint 0..w x 0..d, thickness t. */
export function Slab({ w = 96, d = 96, t = 14, r = 8, top = PAL.slab, left, right, children }) {
  const L_ = left || darken(top, 0.34);
  const R_ = right || darken(top, 0.52);
  const T_ = pt(0, 0), R = pt(w, 0), B = pt(w, d), L = pt(0, d);
  const V = [T_, R, B, L];
  const cs = V.map((p, i) => {
    const pr = V[(i + 3) % 4], nx = V[(i + 1) % 4];
    const toward = (q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      return [r1(p[0] + (dx / l) * r), r1(p[1] + (dy / l) * r)];
    };
    const a = toward(pr), b = toward(nx);
    return { v: p, a, b, m: qm(a, p, b) };
  });
  const [, cR, cB, cL] = cs;
  const leftFace =
    `M${cB.m.join(' ')}Q${mid(cB.v, cB.b).join(' ')} ${cB.b.join(' ')}L${cL.a.join(' ')}Q${mid(cL.a, cL.v).join(' ')} ${cL.m.join(' ')}` +
    `V${r1(cL.m[1] + t)}Q${mid(cL.a, cL.v)[0]} ${r1(mid(cL.a, cL.v)[1] + t)} ${cL.a[0]} ${r1(cL.a[1] + t)}L${cB.b[0]} ${r1(cB.b[1] + t)}` +
    `Q${mid(cB.v, cB.b)[0]} ${r1(mid(cB.v, cB.b)[1] + t)} ${cB.m[0]} ${r1(cB.m[1] + t)}Z`;
  const rightFace =
    `M${cR.m.join(' ')}Q${mid(cR.v, cR.b).join(' ')} ${cR.b.join(' ')}L${cB.a.join(' ')}Q${mid(cB.a, cB.v).join(' ')} ${cB.m.join(' ')}` +
    `V${r1(cB.m[1] + t)}Q${mid(cB.a, cB.v)[0]} ${r1(mid(cB.a, cB.v)[1] + t)} ${cB.a[0]} ${r1(cB.a[1] + t)}L${cR.b[0]} ${r1(cR.b[1] + t)}` +
    `Q${mid(cR.v, cR.b)[0]} ${r1(mid(cR.v, cR.b)[1] + t)} ${cR.m[0]} ${r1(cR.m[1] + t)}Z`;
  void sh;
  return (
    <g>
      <path d={leftFace} {...seam(L_)} />
      <path d={rightFace} {...seam(R_)} />
      <path d={roundedPath(V, r)} {...seam(top)} />
      {children}
    </g>
  );
}

/** Soft contact shadow under an object. */
export function Shade({ x, y, z = 0, rx = 20, ry, o = 0.22 }) {
  const [cx, cy] = pt(x, y, z);
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry || rx / 2} fill="#1b1340" opacity={o} />;
}

export function Tree({ x, y, z = 0, s = 1, c = PAL.grassDark }) {
  const [cx, cy] = pt(x, y, z);
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={6 * s} ry={3 * s} fill="#1b1340" opacity=".2" />
      <rect x={cx - 1.2 * s} y={cy - 8 * s} width={2.4 * s} height={8 * s} rx={1} fill="#8a5a3c" />
      <circle cx={cx} cy={cy - 13 * s} r={7.5 * s} fill={darken(c, 0.25)} />
      <circle cx={cx - 1 * s} cy={cy - 14.2 * s} r={6.4 * s} fill={c} />
      <circle cx={cx - 2.6 * s} cy={cy - 16 * s} r={2.6 * s} fill={lighten(c, 0.35)} opacity=".8" />
    </g>
  );
}

export function Bush({ x, y, z = 0, s = 1, c = PAL.grass }) {
  const [cx, cy] = pt(x, y, z);
  return (
    <g>
      <ellipse cx={cx + 1} cy={cy + 0.5} rx={5 * s} ry={2.4 * s} fill="#1b1340" opacity=".18" />
      <circle cx={cx - 2 * s} cy={cy - 2.4 * s} r={3.4 * s} fill={darken(c, 0.2)} />
      <circle cx={cx + 2 * s} cy={cy - 2.2 * s} r={3.2 * s} fill={darken(c, 0.2)} />
      <circle cx={cx - 0.6 * s} cy={cy - 3.6 * s} r={3.6 * s} fill={c} />
      <circle cx={cx - 1.6 * s} cy={cy - 4.6 * s} r={1.4 * s} fill={lighten(c, 0.4)} opacity=".8" />
    </g>
  );
}

export function Palm({ x, y, z = 0, s = 1 }) {
  const [cx, cy] = pt(x, y, z);
  const leaf = 'M0 0Q6 -8 15 -2Q8 -3.4 0 0Z';
  const L = [[-30, '#3fa862', 1], [-72, '#5fc27a', 0.9], [-118, '#3fa862', 0.95], [-150, '#5fc27a', 0.8], [-10, '#5fc27a', 0.7]];
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <ellipse cx="0" cy="0.6" rx="6" ry="2.6" fill="#1b1340" opacity=".2" />
      <path d="M0 0Q2.4 -9 -0.6 -20" stroke="#8d5f3d" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M0.6 -3.6L2 -3.2M0.8 -8L2.2 -7.4M0.6 -12.6L1.8 -11.8" stroke="#6b4228" strokeWidth=".8" strokeLinecap="round" />
      <g transform="translate(-0.6 -20)">
        {L.map(([a, col, k], i) => (
          <path key={i} d={leaf} fill={col} transform={`rotate(${a}) scale(${k * 0.9})`} />
        ))}
        <path d={leaf} fill="#3fa862" transform="scale(-0.8 0.8) rotate(-16)" />
        <circle cx="0.6" cy="1.4" r="1.4" fill="#8d5f3d" />
      </g>
    </g>
  );
}

/** Grass tile on the ground with a lighter highlight. */
export function Grass({ x, y, w, d, z = 0 }) {
  return (
    <g>
      <Pad x={x} y={y} z={z} w={w} d={d} c={PAL.grassDark} r={2} />
      <Pad x={x + 1} y={y + 1} z={z} w={w - 2} d={d - 2} c={PAL.grass} r={2} />
    </g>
  );
}

/** Rectangular windows laid out on a Face plane. */
export function Windows({ u = 0, v = 0, cols = 1, rows = 1, du = 8, dv = 8, w = 4.5, h = 5.5, c = PAL.glass, lit = PAL.cream, round = false, litEvery = 0 }) {
  const out = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const isLit = litEvery && (i * 3 + j * 5) % litEvery === 0;
      out.push(
        <rect key={i + '-' + j} x={u + i * du} y={v + j * dv} width={w} height={h} rx={round ? w / 2 : 0.8} fill={isLit ? lit : c} />,
      );
    }
  }
  return <g>{out}</g>;
}

/** Arched opening path in Face-local coords (y up). */
export const archPath = (u, v, w, h) => {
  const r = w / 2;
  return `M${u} ${v}V${v + h - r}A${r} ${r} 0 0 0 ${u + w} ${v + h - r}V${v}Z`;
};

// ---- stroke-letter glyphs (y up, 6 wide, 10 tall) -> no font dependency ----
const G = {
  A: 'M0 0L3 10L6 0M1.2 3.6L4.8 3.6',
  D: 'M0 0V10H3Q6 10 6 5Q6 0 3 0Z',
  E: 'M6 10H0V0H6M0 5H4.5',
  H: 'M0 0V10M6 0V10M0 5H6',
  I: 'M3 0V10',
  J: 'M5 10V3Q5 0 2.5 0Q0.5 0 0 2',
  K: 'M0 0V10M5.5 10L0 4.5M1.8 6L5.5 0',
  L: 'M0 10V0H5',
  M: 'M0 0V10L3 5L6 10V0',
  N: 'M0 0V10L6 0V10',
  O: 'M3 0Q0 0 0 5Q0 10 3 10Q6 10 6 5Q6 0 3 0Z',
  P: 'M0 0V10H4Q6 10 6 7.5Q6 5 4 5H0',
  R: 'M0 0V10H4Q6 10 6 7.5Q6 5 4 5H0M3 5L6 0',
  S: 'M5.6 8.4Q4.8 10 3 10Q0.6 10 0.6 7.6Q0.6 5.6 3 5Q5.4 4.4 5.4 2.4Q5.4 0 3 0Q1 0 0.2 1.6',
  T: 'M0 10H6M3 10V0',
  U: 'M0 10V3Q0 0 3 0Q6 0 6 3V10',
  X: 'M0 0L6 10M0 10L6 0',
  Y: 'M0 10L3 5L6 10M3 5V0',
  '₹': 'M1 10H6M1 7.6H6M1.2 10H3Q5.6 10 5.6 7.6Q5.6 5.2 3 5.2H1.2L5 0',
};

/** Block letters drawn with strokes. flip=true for text lying on the ground (T plane). */
export function Letters({ text, u = 0, v = 0, s = 1, color = '#fff', sw = 1.6, gap = 2, flip = false }) {
  let ux = u;
  const out = [];
  [...text].forEach((ch, i) => {
    if (ch === ' ') { ux += 4 * s; return; }
    const d = G[ch];
    if (!d) return;
    out.push(
      <path key={i} d={d} transform={`translate(${r1(ux)} ${v}) scale(${s} ${flip ? -s : s})`} fill="none" stroke={color} strokeWidth={sw / s} strokeLinecap="round" strokeLinejoin="round" />,
    );
    ux += (6 + gap) * s;
  });
  return <g>{out}</g>;
}
export const lettersWidth = (text, s = 1, gap = 2) => [...text].reduce((a, ch) => a + (ch === ' ' ? 4 : 6 + gap) * s, 0) - gap * s;
