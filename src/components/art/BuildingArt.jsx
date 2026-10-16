// Property illustrations: plot -> Kirana -> Apartments -> Mall -> glass Tower (isometric, tinted by group colour).
import { memo } from 'react';
import { MAX_LEVEL, LEVEL_NAMES } from '@shared/board.js';
import { PAL, tone, lighten, darken } from './palette.js';
import Hotel from './Hotel.jsx';
import { Box, Pad, Cyl, Cone, Dome, Face, Gable, Disc, Shade, Tree, Bush, Letters, Windows, archPath, pt, Poly, Slab, lettersWidth } from './iso.jsx';

const WALL = '#fff0d2';
const GLASS = '#79d3ea';

function Stake({ x, y, c }) {
  const [cx, cy] = pt(x, y, 0);
  return (
    <g>
      <Box x={x - 1.2} y={y - 1.2} z={0} w={2.4} d={2.4} h={9} c="#fff3d6" />
      <Box x={x - 1.2} y={y - 1.2} z={9} w={2.4} d={2.4} h={5} c={c} />
      <polygon points={`${cx},${cy - 14} ${cx + 9},${cy - 11.4} ${cx},${cy - 8.6}`} fill={lighten(c, 0.1)} />
    </g>
  );
}

function Brick({ x, y, z = 0, c = '#e0713f' }) {
  return <Box x={x} y={y} z={z} w={7} d={3.4} h={2.2} c={c} />;
}

/* ---------------- level 0 ---------------- */
function Plot({ c }) {
  const corners = [pt(-24, -24, 8), pt(24, -24, 8), pt(24, 24, 8), pt(-24, 24, 8)];
  const ground = [pt(-24, -24), pt(24, -24), pt(24, 24), pt(-24, 24)];
  const line = (a, b, k) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={lighten(c, 0.45)} strokeWidth="1.1" strokeLinecap="round" />;
  return (
    <g>
      <Pad x={-34} y={-34} w={68} d={68} c="#cfae72" r={5} />
      <Pad x={-31} y={-31} w={62} d={62} c="#ecd8a4" r={4} />
      {/* furrow stripes */}
      {[-18, -8, 2, 12].map((v) => (
        <Pad key={v} x={-28} y={v} w={56} d={3} c="#dfc88f" />
      ))}
      <polygon points={ground.map((p) => p.join(',')).join(' ')} fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="4 3" opacity=".9" />
      {/* back string lines */}
      {line(corners[0], corners[1], 'a')}
      {line(corners[0], corners[3], 'b')}
      <Stake x={-24} y={-24} c={c} />
      {/* brick pile + sand cone at back */}
      <Cone x={14} y={-16} r={6.5} h={8} c="#e8c27a" />
      <Brick x={-18} y={-18} />
      <Brick x={-18} y={-14.4} />
      <Brick x={-17} y={-16.2} z={2.2} c="#cf5f33" />
      <Brick x={-10} y={-20} c="#cf5f33" />
      <Stake x={24} y={-24} c={c} />
      <Stake x={-24} y={24} c={c} />
      {line(corners[1], corners[2], 'c')}
      {line(corners[3], corners[2], 'd')}
      {/* for-sale sign */}
      <Box x={-4} y={24} w={1.6} d={1.6} h={13} c="#8a5a3c" />
      <Box x={9} y={24} w={1.6} d={1.6} h={13} c="#8a5a3c" />
      <Box x={-6} y={24.2} z={10} w={18} d={1.6} h={11} c={c} />
      <Face p="L" at={25.8}>
        <rect x={-4.6} y={11.2} width={15.2} height={8.6} rx={1} fill={lighten(c, 0.88)} />
        <Letters text="₹" u={-1.5} v={12.4} s={0.62} color={darken(c, 0.2)} sw={1.3} />
        <rect x={3.6} y={13} width={5} height={1.3} rx=".6" fill={darken(c, 0.2)} opacity=".7" />
        <rect x={3.6} y={15.8} width={5} height={1.3} rx=".6" fill={darken(c, 0.2)} opacity=".7" />
      </Face>
      <Stake x={24} y={24} c={c} />
      <Bush x={-27} y={4} s={0.9} />
      <Bush x={27} y={-6} s={0.8} />
    </g>
  );
}

/* ---------------- level 1: Kirana ---------------- */
function Kirana({ c }) {
  const tc = tone(c);
  const X0 = -20, X1 = 20, Y0 = -18, Y1 = 10, H = 26;
  const stripes = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = X0 + ((X1 - X0) * i) / n, b = X0 + ((X1 - X0) * (i + 1)) / n;
    stripes.push(
      <polygon key={i} points={[pt(a, Y1, 20), pt(b, Y1, 20), pt(b, Y1 + 7, 15), pt(a, Y1 + 7, 15)].map((p) => p.join(',')).join(' ')} fill={i % 2 ? '#ffffff' : c} stroke={i % 2 ? '#ffffff' : c} strokeWidth=".5" />,
    );
  }
  const frontEdge = [];
  for (let i = 0; i < n; i++) {
    const a = X0 + ((X1 - X0) * i) / n, b = X0 + ((X1 - X0) * (i + 1)) / n;
    const m = (a + b) / 2;
    const A = pt(a, Y1 + 7, 15), B = pt(b, Y1 + 7, 15), M = pt(m, Y1 + 7, 12.4);
    frontEdge.push(<path key={i} d={`M${A[0]} ${A[1]}Q${A[0] + (B[0] - A[0]) / 2} ${M[1] + 1.6} ${B[0]} ${B[1]}Z`} fill={i % 2 ? '#e9e4f5' : darken(c, 0.12)} />);
  }
  const shelves = ['#ff5d73', '#ffc857', '#2ec4b6', '#9b7bff', '#8de05a', '#ff8a3d'];
  return (
    <g>
      <Shade x={0} y={4} rx={44} o={0.16} />
      <Bush x={-27} y={-14} s={0.8} />
      <Box x={X0} y={Y0} w={X1 - X0} d={Y1 - Y0} h={H} c={WALL} />
      {/* roof cap + parapet */}
      <Box x={X0 - 1} y={Y0 - 1} z={H} w={X1 - X0 + 2} d={Y1 - Y0 + 2} h={2} t={tc} />
      <Pad x={X0 + 1} y={Y0 + 1} z={H + 2} w={X1 - X0 - 2} d={Y1 - Y0 - 2} c="#d7c9ec" />
      {/* roof water tank */}
      <Box x={-14} y={-12} z={H + 2} w={2} d={2} h={4} c="#8a6a52" />
      <Box x={-6} y={-12} z={H + 2} w={2} d={2} h={4} c="#8a6a52" />
      <Cyl x={-9} y={-10} z={H + 6} r={5.4} h={7} c="#4cc9f0" />
      {/* storefront (left face, y = Y1) */}
      <Face p="L" at={Y1}>
        <rect x={-17} y={0} width={34} height={14} rx="1.2" fill="#35295f" />
        {/* shelves */}
        {[0, 1, 2].map((r) =>
          shelves.map((s, i) => (
            <rect key={r + '-' + i} x={-15 + i * 5.2} y={5.4 + r * 3.1} width={3.6} height={2.2} rx=".5" fill={s} opacity={r === 1 ? 0.85 : 1} />
          )),
        )}
        <rect x={-17} y={0} width={34} height={4.4} fill="#c98a4a" />
        <rect x={-17} y={4.4} width={34} height={0.9} fill="#a86a32" />
        {/* shutter pillars */}
        <rect x={-18.6} y={0} width={1.8} height={15} fill="#fff6e3" />
        <rect x={16.8} y={0} width={1.8} height={15} fill="#fff6e3" />
        {/* sign band */}
        <rect x={-17} y={21} width={34} height={4.6} rx="1" fill={c} />
        <rect x={-17} y={21} width={34} height={1.2} fill={darken(c, 0.2)} opacity=".5" />
        <Letters text="KIRANA" u={-lettersWidth('KIRANA', 0.27, 2.4) / 2} v={22.1} s={0.27} gap={2.4} color="#fff7e6" sw={0.95} />
      </Face>
      {/* side window */}
      <Face p="R" at={X1}>
        <rect x={-14} y={7} width={9} height={8} rx="1" fill="#35295f" />
        <rect x={-13} y={8} width={7} height={6} fill={GLASS} />
        <path d="M-9.5 8V14M-13 11H-6" stroke="#35295f" strokeWidth=".8" />
        <rect x={-14} y={6.2} width={9} height={1} fill="#fff6e3" />
      </Face>
      {/* awning */}
      <Poly pts={[pt(X1, Y1, 20), pt(X1, Y1 + 7, 15), pt(X1, Y1, 15)]} c={darken(c, 0.35)} />
      {stripes}
      {frontEdge}
      <Box x={X0 + 1} y={Y1 + 6} w={1.4} d={1.4} h={15} c="#8a5a3c" />
      <Box x={X1 - 2.4} y={Y1 + 6} w={1.4} d={1.4} h={15} c="#8a5a3c" />
      {/* produce crates */}
      <Box x={-12} y={Y1 + 9.5} w={9} d={7} h={5} c="#c98a4a" />
      <Disc x={-9.2} y={Y1 + 11.6} z={5} r={1.8} c="#ff5d73" />
      <Disc x={-6.2} y={Y1 + 12} z={5} r={1.8} c="#ff5d73" />
      <Disc x={-8} y={Y1 + 14.2} z={5} r={1.8} c="#ff8a3d" />
      <Disc x={-4.6} y={Y1 + 14} z={5} r={1.8} c="#ff5d73" />
      <Box x={0} y={Y1 + 10} w={9} d={7} h={5} c="#c98a4a" />
      <Disc x={2.6} y={Y1 + 12} z={5} r={1.8} c="#8de05a" />
      <Disc x={5.6} y={Y1 + 12} z={5} r={1.8} c="#ffc857" />
      <Disc x={4.2} y={Y1 + 14.6} z={5} r={1.8} c="#8de05a" />
      {/* sack */}
      <Cyl x={15} y={Y1 + 11.6} r={3.8} h={8} c="#e9d3a3" />
      <Bush x={26} y={4} s={0.9} />
    </g>
  );
}

/* ---------------- level 2: Apartments ---------------- */
function Apartments({ c }) {
  const tc = tone(c);
  const MX0 = -24, MX1 = 6, MY0 = -24, MY1 = 6, MH = 44;
  const WX0 = 6, WX1 = 28, WY0 = -10, WY1 = 18, WH = 28;
  const roof = (x0, y0, x1, y1, h) => (
    <g>
      <Box x={x0 - 0.8} y={y0 - 0.8} z={h} w={x1 - x0 + 1.6} d={y1 - y0 + 1.6} h={2} t={{ top: '#fff8e4', left: '#f1e3c4', right: '#cdb98f' }} />
      <Pad x={x0 + 1} y={y0 + 1} z={h + 2} w={x1 - x0 - 2} d={y1 - y0 - 2} c="#cabde3" />
    </g>
  );
  return (
    <g>
      <Shade x={2} y={-2} rx={52} o={0.16} />
      {/* main tower block */}
      <Box x={MX0} y={MY0} w={MX1 - MX0} d={MY1 - MY0} h={MH} c={WALL} />
      {/* accent corner fin */}
      <Box x={MX1 - 3} y={MY1 - 3.2} w={3.2} d={3.4} h={MH} t={tc} />
      {roof(MX0, MY0, MX1, MY1, MH)}
      <Box x={-20} y={-18} z={MH + 2} w={2} d={2} h={4} c="#8a6a52" />
      <Box x={-10} y={-18} z={MH + 2} w={2} d={2} h={4} c="#8a6a52" />
      <Cyl x={-14} y={-16} z={MH + 6} r={5} h={7} c="#4cc9f0" />
      <Box x={-2} y={-8} z={MH + 2} w={5} d={4} h={3} c="#d6c7e8" />
      {/* windows main, left face */}
      <Face p="L" at={MY1}>
        {[0, 1, 2, 3, 4].map((j) => (
          <g key={j}>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={-21 + i * 8} y={4 + j * 8} width={5.2} height={5.4} rx="1" fill={GLASS} />
                <rect x={-21 + i * 8} y={4 + j * 8} width={5.2} height={2} rx="1" fill="#fff" opacity=".35" />
              </g>
            ))}
            <rect x={-24} y={2.2 + j * 8} width={26} height={0.9} fill="#fff" opacity=".55" />
          </g>
        ))}
      </Face>
      <Face p="R" at={MX1}>
        {[0, 1, 2, 3, 4].map((j) => (
          <g key={j}>
            {[0, 1, 2].map((i) => (
              <rect key={i} x={-21 + i * 8} y={4 + j * 8} width={5.2} height={5.4} rx="1" fill={GLASS} />
            ))}
          </g>
        ))}
      </Face>
      {/* balconies */}
      {[1, 2, 3, 4].map((j) =>
        [0, 2].map((i) => (
          <g key={j + '-' + i}>
            <Box x={-21 + i * 8 - 1.2} y={MY1} z={2.2 + j * 8} w={7.6} d={3} h={1.2} c="#fffaf0" />
            <Box x={-21 + i * 8 - 1.2} y={MY1 + 2.4} z={3.4 + j * 8} w={7.6} d={0.6} h={2.2} t={tc} />
          </g>
        )),
      )}
      {/* low wing */}
      <Box x={WX0} y={WY0} w={WX1 - WX0} d={WY1 - WY0} h={WH} c="#ffe6bd" />
      {roof(WX0, WY0, WX1, WY1, WH)}
      <Face p="L" at={WY1}>
        {[0, 1, 2].map((j) => (
          <g key={j}>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={9 + i * 6.6} y={9 + j * 7.4} width={4.4} height={4.6} rx="1" fill={GLASS} />
                <rect x={9 + i * 6.6} y={9 + j * 7.4} width={4.4} height={1.6} rx="1" fill="#fff" opacity=".35" />
              </g>
            ))}
          </g>
        ))}
        <rect x={7} y={6.6} width={20} height={0.9} fill="#fff" opacity=".6" />
        {/* entrance */}
        <path d={archPath(15.4, 0, 5, 7)} fill="#35295f" />
        <path d={archPath(16.4, 0, 3, 5.6)} fill="#ffc857" opacity=".85" />
      </Face>
      <Box x={13} y={WY1} z={7.8} w={9.4} d={3.6} h={1.3} t={tc} />
      <Face p="R" at={WX1}>
        {[0, 1].map((j) => [0, 1, 2].map((i) => <rect key={j + '-' + i} x={-6 + i * 7} y={9 + j * 8} width={4.4} height={4.6} rx="1" fill={GLASS} />))}
      </Face>
      <Tree x={-30} y={14} s={1.1} />
      <Bush x={-8} y={12} s={0.9} />
      <Bush x={4} y={24} s={1} />
      <Tree x={30} y={26} s={0.9} c={PAL.grass} />
    </g>
  );
}

/* ---------------- level 3: Mall ---------------- */
function Mall({ c }) {
  const tc = tone(c);
  const X0 = -30, X1 = 30, Y0 = -20, Y1 = 12, H = 24;
  return (
    <g>
      <Shade x={0} y={0} rx={58} o={0.16} />
      <Box x={X0} y={Y0} w={X1 - X0} d={Y1 - Y0} h={H} c="#f4ecff" />
      {/* facade colour band */}
      <Box x={X0 - 1} y={Y0 - 1} z={H} w={X1 - X0 + 2} d={Y1 - Y0 + 2} h={3} t={tc} />
      <Pad x={X0 + 1} y={Y0 + 1} z={H + 3} w={X1 - X0 - 2} d={Y1 - Y0 - 2} c="#cabde3" />
      {/* roof units */}
      <Box x={-24} y={-14} z={H + 3} w={8} d={6} h={4} c="#e1d8f2" />
      <Box x={14} y={-12} z={H + 3} w={9} d={6} h={3} c="#e1d8f2" />
      <Dome x={0} y={-6} z={H + 3} r={8} h={9} c="#8fdcf0" />
      {/* glass storefront */}
      <Face p="L" at={Y1}>
        <rect x={-27} y={2} width={54} height={15.5} rx="1.4" fill="#38306f" />
        <rect x={-26} y={3} width={52} height={13.5} fill={GLASS} />
        {/* diagonal reflections */}
        <polygon points="-26,3 -16,3 -2,16.5 -12,16.5" fill="#fff" opacity=".28" />
        <polygon points="6,3 12,3 22,16.5 16,16.5" fill="#fff" opacity=".28" />
        {/* mullions */}
        {Array.from({ length: 11 }, (_, i) => -26 + (i + 1) * 4.333).map((u) => (
          <rect key={u} x={u - 0.35} y={3} width={0.7} height={13.5} fill="#38306f" opacity=".7" />
        ))}
        <rect x={-26} y={9.4} width={52} height={0.8} fill="#38306f" opacity=".7" />
        {/* shop silhouettes behind glass */}
        {[-20, -8, 12, 22].map((u, i) => (
          <rect key={u} x={u} y={3} width={5} height={3 + (i % 2) * 1.6} fill="#ffc857" opacity=".8" />
        ))}
        {/* entrance */}
        <rect x={-5.5} y={0} width={11} height={11.5} rx="1.4" fill="#2a2360" />
        <rect x={-4.2} y={0} width={4} height={10.4} fill="#ffe6a0" opacity=".9" />
        <rect x={0.2} y={0} width={4} height={10.4} fill="#ffe6a0" opacity=".9" />
        {/* lower plinth */}
        <rect x={-27} y={0} width={54} height={2} fill="#d9cdf0" />
        {/* banners */}
        {[-24, 20].map((u) => (
          <g key={u}>
            <rect x={u} y={18} width={4} height={5.4} fill={c} />
            <polygon points={`${u},18 ${u + 4},18 ${u + 2},16.4`} fill={darken(c, 0.2)} />
          </g>
        ))}
      </Face>
      <Face p="R" at={X1}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={-17 + i * 7.6} y={8} width={5} height={10} rx="1" fill={GLASS} />
            <rect x={-17 + i * 7.6} y={8} width={5} height={3} rx="1" fill="#fff" opacity=".3" />
          </g>
        ))}
        <rect x={-18} y={4} width={32} height={1.6} fill={c} opacity=".9" />
      </Face>
      {/* entrance canopy */}
      <Box x={-8} y={Y1} z={13.4} w={16} d={5.6} h={1.6} t={tc} />
      <Box x={-8} y={Y1 + 4.6} w={1.2} d={1.2} h={13.4} c="#fffaf2" />
      <Box x={6.8} y={Y1 + 4.6} w={1.2} d={1.2} h={13.4} c="#fffaf2" />
      {/* rooftop sign */}
      <Box x={-12} y={-2} z={H + 3} w={1.6} d={1.6} h={6} c="#8a8aa8" />
      <Box x={10.4} y={-2} z={H + 3} w={1.6} d={1.6} h={6} c="#8a8aa8" />
      <Box x={-15} y={-2} z={H + 8} w={30} d={2} h={11} c={c} />
      <Face p="L" at={0}>
        <rect x={-13.4} y={H + 8.9} width={26.8} height={9.2} rx="1.4" fill={darken(c, 0.16)} />
        <Letters text="MALL" u={-lettersWidth('MALL', 0.82, 2.6) / 2} v={H + 10.4} s={0.82} gap={2.6} color="#fff7e6" sw={1.6} />
      </Face>
      {/* little car */}
      <Box x={4} y={Y1 + 12} w={11} d={5.4} h={3.6} c="#ff5d73" />
      <Box x={6} y={Y1 + 12.4} z={3.6} w={6.4} d={4.6} h={2.8} c="#ffe1e6" />
      <Cyl x={7} y={Y1 + 17.4} r={1.6} h={1.4} c="#2b2260" />
      <Cyl x={13} y={Y1 + 17.4} r={1.6} h={1.4} c="#2b2260" />
      {/* planters */}
      <Bush x={-32} y={16} s={1.1} />
      <Bush x={-20} y={22} s={1} />
      <Tree x={26} y={20} s={1} />
      <Bush x={34} y={10} s={0.9} />
    </g>
  );
}

/* ---------------- level 4: glass Tower ---------------- */
function Tower({ c }) {
  const tc = tone(c);
  const glassL = '#67c7e6', glassR = '#3f8fc4';
  const bands = (x0, x1, v0, v1) => {
    const w = x1 - x0;
    const n = Math.round(w / 4.6);
    let d = '';
    for (let i = 1; i < n; i++) d += `M${(x0 + (i * w) / n).toFixed(1)} ${v0}V${v1}`;
    for (let v = v0 + 6; v < v1 - 2; v += 6) d += `M${x0} ${v}H${x1}`;
    return <path d={d} stroke="#1f4f8c" strokeWidth=".7" opacity=".45" fill="none" />;
  };
  const T0 = -14, T1 = 14, B0 = 8, TH = 70;
  return (
    <g>
      <Shade x={2} y={2} rx={56} o={0.16} />
      {/* podium */}
      <Box x={-30} y={-30} w={60} d={60} h={8} c="#efe6ff" />
      <Box x={-30} y={-30} z={8} w={60} d={60} h={1.4} t={tc} />
      <Pad x={-28.6} y={-28.6} z={9.4} w={57.2} d={57.2} c="#d6c9ee" />
      {/* main tower */}
      <Box x={T0} y={T0} z={9.4} w={T1 - T0} d={T1 - T0} h={TH} c={glassL} t={{ top: '#d9f4fd', left: glassL, right: glassR }} />
      <Face p="L" at={T1}>
        <rect x={T0} y={9.4} width={T1 - T0} height={TH} fill="none" />
        {bands(T0, T1, 9.4, 9.4 + TH)}
        <polygon points={`${T0 + 2},${9.4 + TH} ${T0 + 9},${9.4 + TH} ${T0 + 2},${9.4 + TH - 22}`} fill="#fff" opacity=".35" />
        <polygon points={`${T0 + 14},${9.4 + TH} ${T0 + 17},${9.4 + TH} ${T0 + 2},${9.4 + 20} ${T0 + 2},${9.4 + 14}`} fill="#fff" opacity=".18" />
      </Face>
      <Face p="R" at={T1}>
        {bands(T0, T1, 9.4, 9.4 + TH)}
        <polygon points={`${T0 + 3},${9.4 + TH} ${T0 + 10},${9.4 + TH} ${T0 + 3},${9.4 + TH - 26}`} fill="#fff" opacity=".18" />
      </Face>
      {/* corner fins in group colour */}
      <Box x={T1 - 1.4} y={T1 - 1.4} z={9.4} w={2.8} d={2.8} h={TH + 12} t={tc} />
      {/* crown */}
      <Box x={-10} y={-10} z={9.4 + TH} w={20} d={20} h={12} c={c} t={tc} />
      <Face p="L" at={10}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={-8 + i * 4.6} y={9.4 + TH + 2.4} width={3} height={7} rx="1.4" fill="#fff7e6" opacity=".9" />
        ))}
      </Face>
      <Box x={-12} y={-12} z={9.4 + TH + 12} w={24} d={24} h={1.6} c="#fff7e6" />
      <Cyl x={0} y={0} z={9.4 + TH + 13.6} r={0.9} h={16} c="#c8c0e6" />
      <circle cx="0" cy={-(9.4 + TH + 13.6 + 16)} r="2" fill="#ff5d73" />
      <circle cx="0" cy={-(9.4 + TH + 13.6 + 16)} r="4.4" fill="#ff5d73" opacity=".25" />
      {/* short companion tower */}
      <Box x={14} y={2} z={9.4} w={14} d={14} h={36} c={glassL} t={{ top: '#d9f4fd', left: '#8bd6ee', right: glassR }} />
      <Face p="L" at={16}>
        {bands(14, 28, 9.4, 45.4)}
        <polygon points={`16,45.4 22,45.4 16,28`} fill="#fff" opacity=".32" />
      </Face>
      <Face p="R" at={28}>
        {bands(2, 16, 9.4, 45.4)}
      </Face>
      <Box x={14} y={2} z={45.4} w={14} d={14} h={2} t={tc} />
      {/* entrance canopy */}
      <Box x={-10} y={30} z={4.4} w={20} d={4} h={1.4} t={tc} />
      <Tree x={-26} y={22} s={0.9} />
      <Bush x={-4} y={38} s={0.9} />
      <Bush x={22} y={36} s={0.9} />
      <Tree x={30} y={-16} s={0.9} c={PAL.grass} />
    </g>
  );
}

export function BuildingModel({ level = 0, color = PAL.saffron }) {
  const L = Math.max(0, Math.min(MAX_LEVEL, level | 0));
  switch (L) {
    case 0: return <Plot c={color} />;
    case 1: return <Kirana c={color} />;
    case 2: return <Apartments c={color} />;
    case 3: return <Mall c={color} />;
    case 4: return <Tower c={color} />;
    default: return <Hotel c={color} />;
  }
}

/** Good footprint centre scale for each level when placed on the big slab. */
export const LEVEL_SCALE = [1.2, 1.18, 1.05, 0.96, 0.78, 0.76];

function BuildingArtBase({ level = 0, color = PAL.saffron, size = 96, className, title }) {
  const L = Math.max(0, Math.min(MAX_LEVEL, level | 0));
  const s = [1, 1, 0.96, 0.92, 0.84, 0.8][L] ?? 0.8;
  const label = title === undefined ? undefined : title || LEVEL_NAMES[L];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      strokeWidth=".6"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g transform={`translate(80 112) scale(${s})`}>
        <g transform="translate(0 -39)">
          <Slab w={78} d={78} t={6} r={7} top="#5f58a8" />
        </g>
        <BuildingModel level={L} color={color} />
      </g>
    </svg>
  );
}

export const BuildingArt = memo(BuildingArtBase);
export default BuildingArt;
