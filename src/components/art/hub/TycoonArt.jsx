// Hyderabad Tycoon cover (16:9) + app icon, drawn for the hub: an isometric Charminar diorama on a Monopoly-style board
// ring, under a warm night skyline, with coins and a die in front. The left third of the cover is deliberately calm so
// card/hero text can sit on it. Repeated parts (minarets, chhatris, arch faces) are drawn once and <use>d to keep the SVG small.
import { memo } from 'react';
import { PAL } from '../palette.js';
import { Slab, Pad, Box, Gable, Cyl, Dome, Cone, Face, Grass, Tree, Bush, archPath, pt } from '../iso.jsx';
import { CharminarFront } from '../marks.jsx';
import { CoverSvg, IconSvg, Coin, Pawn, Die, Sparkle, Stars, skyline, rng, f, useUid, COVER_CSS, RUPEE, HUB } from './kit.jsx';

const STONE = '#f1e2c0';
const STONE_D = '#d8c49a';
const SIDE = 26;
const N = 156;
const HZ = 354;
const Z = 2.6; // tile height

/* ---------------- Charminar (iso) ---------------- */
function Minaret({ h = 60 }) {
  return (
    <g>
      <Cyl x={0} y={0} r={3.5} h={h} c={STONE} />
      <Cyl x={0} y={0} z={h * 0.62} r={3.8} h={1.1} c={PAL.gold} />
      <Cyl x={0} y={0} z={20} r={5.4} h={1.6} c={STONE_D} />
      <Cyl x={0} y={0} z={41} r={5.4} h={1.6} c={STONE_D} />
      <Cyl x={0} y={0} z={h} r={3.2} h={7} c={STONE} />
      <Dome x={0} y={0} z={h + 8.2} r={3.8} h={6.4} c="#fff7e6" />
      <Cone x={0} y={0} z={h + 14.4} r={0.7} h={6} c={PAL.gold} />
    </g>
  );
}
function Chhatri({ z = 36 }) {
  return (
    <g>
      <Cyl x={0} y={0} z={z} r={1.7} h={4.2} c={STONE} />
      <Dome x={0} y={0} z={z + 4.2} r={2.7} h={3.6} c="#fff7e6" />
      <Cone x={0} y={0} z={z + 7.6} r={0.4} h={3} c={PAL.gold} />
    </g>
  );
}
const Arch = ({ u, v, w, h }) => (
  <g>
    <path d={archPath(u, v, w, h)} fill="#2e2475" />
    <path d={archPath(u + 1.2, v, w - 2.4, h - 2.4)} fill="#5445b8" />
  </g>
);

function Charminar({ id }) {
  const use = (name, x, y, k) => {
    const [sx, sy] = pt(x, y);
    return <use key={k} href={`#${id}${name}`} x={sx} y={sy} />;
  };
  const roof = [[35, 35], [61, 35], [35, 61], [61, 61], [48, 35], [35, 48], [61, 48], [48, 61]];
  return (
    <g>
      <defs>
        <g id={id + 'm'}><Minaret /></g>
        <g id={id + 'c'}><Chhatri /></g>
        <g id={id + 'f'}>
          <Arch u={42} v={0} w={12} h={17.5} />
          <Arch u={33.6} v={2.4} w={4} h={9} />
          <Arch u={58.4} v={2.4} w={4} h={9} />
          <rect x={30} y={20} width={36} height={1} fill={PAL.gold} opacity=".85" />
          {[37.6, 46, 54.4].map((u) => <Arch key={u} u={u} v={25.6} w={4} h={5.4} />)}
          <rect x={30} y={34.4} width={36} height={0.9} fill={PAL.gold} opacity=".7" />
        </g>
      </defs>
      <Pad x={7} y={7} w={82} d={82} c="#e2d2ac" r={6} />
      <Pad x={11} y={11} w={74} d={74} c="#f6ebcf" r={5} />
      <Pad x={17} y={17} w={62} d={62} c="#e9dab6" r={4} />
      <Grass x={10} y={72} w={14} d={14} />
      <Grass x={72} y={10} w={14} d={14} />
      <Tree x={17} y={79} s={1} />
      <Tree x={79} y={17} s={1} c={PAL.grass} />
      {use('m', 30, 30, 'm1')}
      <Box x={30} y={30} w={36} d={36} h={22} c={STONE} />
      <Face p="L" at={66}><use href={`#${id}f`} /></Face>
      <Face p="R" at={66}><use href={`#${id}f`} /></Face>
      <Box x={29} y={29} z={22} w={38} d={38} h={2} c={STONE_D} />
      <Box x={33} y={33} z={24} w={30} d={30} h={10} c={STONE} />
      <Box x={32} y={32} z={34} w={32} d={32} h={2} c={STONE_D} />
      {roof.filter(([x, y]) => x + y < 96).map(([x, y]) => use('c', x, y, 'c' + x + y))}
      <Box x={42} y={42} z={36} w={12} d={12} h={6} c={STONE} />
      <Dome x={48} y={48} z={42} r={5.6} h={8.4} c="#fff7e6" />
      <Cone x={48} y={48} z={50} r={0.8} h={6} c={PAL.gold} />
      {roof.filter(([x, y]) => x + y >= 96).map(([x, y]) => use('c', x, y, 'c' + x + y))}
      {use('m', 66, 30, 'm2')}
      {use('m', 30, 66, 'm3')}
      {use('m', 66, 66, 'm4')}
      <Bush x={12} y={40} s={0.9} />
      <Bush x={84} y={58} s={0.9} />
    </g>
  );
}

/* ---------------- board ring ---------------- */
// colour bands: [x, y, colour, side]
const BANDS = (() => {
  const b = [];
  const A = ['#ff8a3d', '#ffc857', '#4cc9f0', '#9b7bff'];
  const D = ['#ff5d73', '#2ec4b6', '#ffc857', '#8de05a'];
  const B = ['#9b7bff', '#ff8a3d', '#4cc9f0', '#ff5d73'];
  const C = ['#2ec4b6', '#8de05a', '#ff5d73', '#ffc857'];
  A.forEach((c, i) => b.push([SIDE + i * SIDE, 0, c, 'A']));
  D.forEach((c, i) => b.push([N - SIDE, SIDE + i * SIDE, c, 'D']));
  B.forEach((c, i) => b.push([N - 2 * SIDE - i * SIDE, N - SIDE, c, 'B']));
  C.forEach((c, i) => b.push([0, N - 2 * SIDE - i * SIDE, c, 'C']));
  return b;
})();

function Band({ x, y, c, s }) {
  const b = 7;
  const g =
    s === 'A' ? [x + 1, y + SIDE - b - 1, SIDE - 2, b] :
    s === 'B' ? [x + 1, y + 1, SIDE - 2, b] :
    s === 'C' ? [x + SIDE - b - 1, y + 1, b, SIDE - 2] :
    [x + 1, y + 1, b, SIDE - 2];
  return <Pad x={g[0]} y={g[1]} z={Z} w={g[2]} d={g[3]} c={c} r={1.4} />;
}

// thin joints between tiles (one path)
const JOINTS = (() => {
  let d = '';
  const seg = (x, y, x2, y2) => `M${pt(x, y, Z).join(' ')}L${pt(x2, y2, Z).join(' ')}`;
  for (let i = 1; i < 6; i++) {
    const t = i * SIDE;
    d += seg(t, 0, t, SIDE) + seg(t, N - SIDE, t, N) + seg(0, t, SIDE, t) + seg(N - SIDE, t, N, t);
  }
  return d;
})();

function House({ x, y, roof = '#ff5d73', hotel }) {
  return hotel ? (
    <g>
      <Box x={x} y={y} z={Z} w={9} d={9} h={13} c="#fff7e6" />
      <Box x={x - 1} y={y - 1} z={Z + 13} w={11} d={11} h={2} c={roof} />
    </g>
  ) : (
    <g>
      <Box x={x} y={y} z={Z} w={10} d={8} h={6.5} c="#fff7e6" />
      <Gable x={x - 1} y={y - 1} z={Z + 6.5} w={12} d={10} h={5.4} c={roof} axis="x" />
    </g>
  );
}

function Board({ id }) {
  const px = (x, y) => pt(x + SIDE / 2, y + SIDE / 2);
  const p1 = px(N - 2 * SIDE, N - SIDE);
  const p2 = px(N - SIDE, N - 3 * SIDE);
  const p3 = px(SIDE * 2, N - SIDE);
  const cream = { top: '#fff9ec', left: '#efdcb4', right: '#c9b27f' };
  const back = BANDS.filter((t) => t[3] === 'A' || t[3] === 'C');
  const front = BANDS.filter((t) => t[3] === 'B' || t[3] === 'D');
  return (
    <g strokeWidth=".6" strokeLinejoin="round">
      <Slab w={N} d={N} t={17} r={11} top="#4b3fb5" left="#2c2178" right="#1d1556">
        <Pad x={SIDE} y={SIDE} w={N - 2 * SIDE} d={N - 2 * SIDE} c="#2a1f78" r={4} />
        <Box x={0} y={0} w={N} d={SIDE} h={Z} t={cream} />
        <Box x={0} y={SIDE} w={SIDE} d={N - 2 * SIDE} h={Z} t={cream} />
        {back.map(([x, y, c, s]) => <Band key={x + '-' + y} x={x} y={y} c={c} s={s} />)}
        <Pad x={0} y={0} z={Z} w={SIDE} d={SIDE} c="#ff8a3d" r={2} />
        <Pad x={N - SIDE} y={0} z={Z} w={SIDE} d={SIDE} c="#ffc857" r={2} />
        <Pad x={0} y={N - SIDE} z={Z} w={SIDE} d={SIDE} c="#ff5d73" r={2} />
        <g transform="translate(0 30)"><Charminar id={id} /></g>
        <Box x={N - SIDE} y={SIDE} w={SIDE} d={N - 2 * SIDE} h={Z} t={cream} />
        <Box x={0} y={N - SIDE} w={N} d={SIDE} h={Z} t={cream} />
        {front.map(([x, y, c, s]) => <Band key={x + '-' + y} x={x} y={y} c={c} s={s} />)}
        <Pad x={N - SIDE} y={N - SIDE} z={Z} w={SIDE} d={SIDE} c="#ff8a3d" r={2} />
        <Face p="T" at={Z}>
          <path d="M5 8H16V3L24 11.5L16 20V15H5Z" transform={`translate(${N - SIDE + 1} ${N - SIDE + 2})`} fill="#fff7e6" stroke="#fff7e6" strokeWidth="1.2" strokeLinejoin="round" />
        </Face>
        <path d={JOINTS} fill="none" stroke="#c9b27f" strokeWidth=".7" opacity=".9" />
        <House x={N - SIDE + 8} y={SIDE + 6} roof="#ff5d73" />
        <House x={N - SIDE + 8} y={4 * SIDE + 6} hotel roof="#ff5d73" />
      </Slab>
      <Pawn x={p1[0]} y={p1[1] + 3} s={0.95} c={HUB.p1} />
      <Pawn x={p2[0] + 2} y={p2[1] + 4} s={0.9} c={HUB.p2} />
      <Pawn x={p3[0] - 2} y={p3[1] + 5} s={0.95} c={HUB.p4} />
    </g>
  );
}

function CoinStack({ x, y, n = 5, r = 11 }) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(<Cyl key={i} x={0} y={0} z={i * 4.2} r={r} h={4.2} c={i % 2 ? '#ffc857' : '#ffb100'} />);
  return (
    <g transform={`translate(${f(x)} ${f(y)})`} strokeWidth=".5" strokeLinejoin="round">
      <ellipse cx="2" cy="4" rx={r * 1.6} ry={r * 0.82} fill="#1b1340" opacity=".32" />
      {out}
      <Face p="T" at={n * 4.2}>
        <path d={RUPEE} transform="scale(.98)" fill="none" stroke="#b8741a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Face>
    </g>
  );
}

function TycoonCoverBase({ className, title, animated = true }) {
  const u = useUid();
  const rand = rng(7);
  const far = skyline(rng(11), { x0: -10, x1: 810, base: HZ, hmin: 22, hmax: 84, wmin: 20, wmax: 44, lit: 0.07 });
  const midL = skyline(rng(5), { x0: 150, x1: 322, base: HZ + 6, hmin: 30, hmax: 104, wmin: 24, wmax: 42, lit: 0.2, gap: [2, 5] });
  const midR = skyline(rng(9), { x0: 700, x1: 752, base: HZ + 6, hmin: 96, hmax: 190, wmin: 22, wmax: 40, lit: 0.3, gap: [2, 5] });
  const hero = skyline(rng(21), { x0: 334, x1: 335, base: HZ + 6, hmin: 244, hmax: 244, wmin: 42, wmax: 42, lit: 0.26, gx: 5, gy: 7 });
  const hero2 = skyline(rng(23), { x0: 756, x1: 757, base: HZ + 6, hmin: 262, hmax: 262, wmin: 48, wmax: 48, lit: 0.26, gx: 5, gy: 7 });
  const bulbs = [];
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12;
    const x = (1 - t) * (1 - t) * 355 + 2 * (1 - t) * t * 552 + t * t * 780;
    const y = (1 - t) * (1 - t) * 108 + 2 * (1 - t) * t * 8 + t * t * 92;
    const c = i % 3 === 0 ? '#ff8a3d' : i % 3 === 1 ? '#ffd36e' : '#ff5d73';
    bulbs.push(
      <circle key={i} cx={f(x)} cy={f(y + 3)} r="3" fill={c} stroke={c} strokeOpacity=".28" strokeWidth="5" />,
    );
  }
  const streaks = [];
  for (let i = 0; i < 9; i++) {
    const x = 24 + i * 90 + (i % 3) * 11;
    streaks.push(<rect key={i} x={x} y={HZ + 14 + (i % 4) * 3} width="3" height={18 + (i % 5) * 7} rx="1.5" fill={i % 2 ? '#ffd36e' : '#8fe3ff'} opacity=".14" />);
  }
  return (
    <CoverSvg className={className} title={title} css={animated ? COVER_CSS : COVER_CSS.replace(/animation:[^;}]+/g, 'animation:none')}>
      <defs>
        <linearGradient id={u + 'sky'} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={HZ + 10}>
          <stop offset="0" stopColor="#0c0724" />
          <stop offset=".3" stopColor="#25175c" />
          <stop offset=".52" stopColor="#58309c" />
          <stop offset=".7" stopColor="#a8489a" />
          <stop offset=".86" stopColor="#ee6f66" />
          <stop offset="1" stopColor="#ffb86a" />
        </linearGradient>
        <radialGradient id={u + 'glow'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffb36b" stopOpacity=".75" />
          <stop offset=".55" stopColor="#ff7a5c" stopOpacity=".28" />
          <stop offset="1" stopColor="#ff7a5c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + 'gr'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1c7c" />
          <stop offset="1" stopColor="#0f0a35" />
        </linearGradient>
        <radialGradient id={u + 'sh'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#05031a" stopOpacity=".7" />
          <stop offset=".6" stopColor="#05031a" stopOpacity=".35" />
          <stop offset="1" stopColor="#05031a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + 'vg'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0a0624" stopOpacity=".55" />
          <stop offset="1" stopColor="#0a0624" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={u + 'moon'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe9c4" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffe9c4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="460" fill={`url(#${u}sky)`} />
      <Stars rand={rand} n={20} ymax={230} />
      <circle cx="722" cy="52" r="46" fill={`url(#${u}moon)`} />
      <path d="M722 36A16 16 0 1 0 722 68A23 23 0 0 1 722 36Z" fill="#fff3d6" />
      <ellipse cx="560" cy="300" rx="420" ry="230" fill={`url(#${u}glow)`} />
      <path d={far.body} fill="#3a2a8e" opacity=".9" />
      <path d={far.w1} fill="#ffd36e" opacity=".5" /><path d={far.w2} fill="#8fe3ff" opacity=".45" />
      <path d={midL.body + midR.body} fill="#241766" />
      <g fill="#1b1252">
        <path d={hero.body + hero2.body} />
        <path d="M354.2 112V92H355.8V112ZM775.2 92V70H776.8V92Z" />
      </g>
      <path d={midL.w1 + midR.w1 + hero.w1 + hero2.w1} fill="#ffd36e" opacity=".85" />
      <path d={midL.w2 + midR.w2 + hero.w2 + hero2.w2} fill="#8fe3ff" opacity=".8" />
      <g className="hub-tw"><circle cx="355" cy="90" r="2.6" fill="#ff5d73" /><circle cx="355" cy="90" r="8" fill="#ff5d73" opacity=".25" /></g>
      <g className="hub-tw" style={{ animationDelay: '-1.4s' }}><circle cx="776" cy="68" r="2.6" fill="#ff5d73" /><circle cx="776" cy="68" r="8" fill="#ff5d73" opacity=".25" /></g>
      <path d="M355 108Q552 6 780 92" fill="none" stroke="#0a0626" strokeWidth="1.4" opacity=".8" />
      {bulbs}
      <rect x="-10" y={HZ + 6} width="820" height={460 - HZ} fill={`url(#${u}gr)`} />
      <rect x="-10" y={HZ + 6} width="820" height="2" fill="#7f6cf0" opacity=".35" />
      {streaks}
      <ellipse cx="548" cy={HZ + 20} rx="300" ry="40" fill={`url(#${u}sh)`} />
      <g transform="translate(548 131) scale(1.45)"><Board id={u} /></g>
      <g transform="translate(366 342)"><Die s={31} top={5} left={3} right={1} /></g>
      <CoinStack x={668} y={404} n={5} r={13} />
      <Coin x={716} y={410} r={10} sy={0.62} rot={8} lite />
      <Coin x={620} y={426} r={11} sy={0.62} rot={-12} lite />
      <Coin x={420} y={176} r={11} sy={0.9} rot={-16} cls="hub-bob" lite />
      <Coin x={782} y={196} r={9} sy={0.8} rot={14} cls="hub-bob2" lite />
      <Sparkle x={470} y={128} s={9} c="#fff3c4" cls="hub-tw" />
      <Sparkle x={624} y={116} s={7} c="#ffe9a8" cls="hub-tw" />
      <Sparkle x={746} y={300} s={8} c="#fff3c4" cls="hub-tw" />
      <Sparkle x={392} y={226} s={6} c="#ffd0a0" cls="hub-tw" />
      <rect x="0" y="0" width="380" height="450" fill={`url(#${u}vg)`} />
    </CoverSvg>
  );
}
export const TycoonCover = memo(TycoonCoverBase);

function TycoonIconBase({ size = 64, title, className, rounded }) {
  const u = useUid();
  const s = 1.56;
  return (
    <IconSvg size={size} title={title} className={className} rounded={rounded} uid={u}>
      <defs>
        <linearGradient id={u + 'bg'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1252" />
          <stop offset=".45" stopColor="#4a2a95" />
          <stop offset=".78" stopColor="#d65f78" />
          <stop offset="1" stopColor="#ffa95a" />
        </linearGradient>
        <radialGradient id={u + 'gl'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd08a" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffd08a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" fill={`url(#${u}bg)`} />
      <circle cx="64" cy="84" r="62" fill={`url(#${u}gl)`} />
      <g fill="#fff">
        <circle cx="20" cy="22" r="1.3" opacity=".9" /><circle cx="42" cy="12" r="1" opacity=".7" /><circle cx="100" cy="36" r="1.2" opacity=".8" /><circle cx="14" cy="54" r="1" opacity=".6" />
      </g>
      <path d="M112 12A6.4 6.4 0 1 0 112 25A9.2 9.2 0 0 1 112 12Z" fill="#fff3d6" />
      <path d="M-4 112Q30 102 64 106T132 110V132H-4Z" fill="#1b1340" />
      <g transform={`translate(${64 - 32 * s} ${111 - 56 * s}) scale(${s})`}>
        <CharminarFront ground={false} stone="#ffe3b0" shade="#e6a566" arch="#2e2475" archInner="#ffc857" gold={PAL.gold} cap="#fff4d6" />
      </g>
      <Die x={30} y={98} s={17} top={5} left={3} right={1} />
      <Coin x={98} y={100} r={18} sy={1} rot={0} />
      <Sparkle x={96} y={64} s={6} c="#fff3c4" />
      <Sparkle x={26} y={60} s={4.5} c="#ffe9a8" />
    </IconSvg>
  );
}
export const TycoonIcon = memo(TycoonIconBase);
