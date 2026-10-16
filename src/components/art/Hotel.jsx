// Level 5: grand 5-star Hotel (capstone of the building ladder). Same isometric frame as BuildingArt.
import { PAL, tone, darken } from './palette.js';
import { Box, Pad, Cyl, Disc, Face, Shade, Bush, Palm, Letters, archPath, pt, lettersWidth } from './iso.jsx';

const hsh = (i, j, k) => (((i + 3) * 73856093) ^ ((j + 7) * 19349663) ^ ((k + 11) * 83492791)) >>> 0;

function Lights({ u, v, cols, rows, du, dv, w = 3.2, h = 3.4, seed = 0 }) {
  let a = '', b = '', c = '';
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const r = hsh(i, j, seed) % 9;
      const seg = `M${+(u + i * du).toFixed(1)} ${+(v + j * dv).toFixed(1)}h${w}v${h}h${-w}Z`;
      if (r < 5) a += seg;
      else if (r < 7) b += seg;
      else c += seg;
    }
  }
  return (
    <g>
      <path d={a} fill="#ffd36e" stroke="#ffd36e" />
      <path d={b} fill="#ffe9ad" stroke="#ffe9ad" />
      <path d={c} fill="#6d62c4" stroke="#6d62c4" />
    </g>
  );
}

function Flag({ x, y, c }) {
  const [cx, cy] = pt(x, y, 26);
  return (
    <g>
      <Cyl x={x} y={y} r={0.55} h={26} c="#e8e0f8" />
      <circle cx={cx} cy={cy - 0.4} r="1.1" fill={PAL.gold} />
      <polygon points={`${cx},${cy} ${cx + 10},${cy + 1.8} ${cx + 10},${cy + 8.6} ${cx},${cy + 6.8}`} fill={c} />
      <polygon points={`${cx},${cy + 2.6} ${cx + 10},${cy + 4.1} ${cx + 10},${cy + 6.2} ${cx},${cy + 4.7}`} fill="#fff7e6" />
    </g>
  );
}

const pts = (a) => a.map((p) => p.join(',')).join(' ');

export default function Hotel({ c }) {
  const tc = tone(c);
  const CREAM = '#fff4dc';
  const GOLD = { top: '#ffe7a3', left: '#ffc857', right: '#d99a1d' };
  const BX0 = -32, BX1 = 32, BY0 = -27, BY1 = -8, BH = 34;
  const floorLines = (x0, x1, v0, n, dv) =>
    Array.from({ length: n }, (_, j) => <rect key={j} x={x0} y={v0 + j * dv} width={x1 - x0} height={0.7} fill="#fff" opacity=".7" />);
  const [fx, fy] = pt(-12, 21, 10.8);
  return (
    <g>
      <Shade x={0} y={0} rx={62} o={0.16} />
      <Pad x={-35} y={-31} w={70} d={67} c="#e2d3b0" r={4} />
      <Pad x={-33} y={-29} w={66} d={63} c="#efe3c4" r={3} />
      <Pad x={-21} y={-8} w={42} d={42} c="#f8efd6" r={3} />
      <Pad x={-4} y={-8} w={8} d={42} c="#d9c9a4" />
      <Pad x={-0.3} y={-6} w={0.6} d={38} c="#fff4dc" o=".8" />
      {/* pool + deck */}
      <Pad x={4} y={13} w={20} d={21} c="#fff7e6" r={2} />
      <Pad x={5.6} y={14.6} w={16.8} d={17.8} c="#2bb6cf" r={2} />
      <Pad x={6.6} y={15.6} w={14.8} d={15.8} c="#4ed3e4" r={1.6} />
      <polygon points={pts([pt(8, 16), pt(13, 16), pt(8, 25)])} fill="#fff" opacity=".28" />
      <polygon points={pts([pt(15, 30), pt(21, 30), pt(21, 22)])} fill="#fff" opacity=".18" />
      {/* main block */}
      <Box x={BX0} y={BY0} w={BX1 - BX0} d={BY1 - BY0} h={BH} c={CREAM} />
      <Face p="L" at={BY1}>
        <rect x={BX0} y={0} width={BX1 - BX0} height={6.6} fill="#ecdcb8" />
        {[-27, -18, -9, 9, 18, 27].map((u) => (
          <g key={u}>
            <path d={archPath(u - 2.8, 0, 5.6, 6)} fill="#4b3a96" />
            <path d={archPath(u - 2, 0, 4, 5.2)} fill="#ffd36e" />
          </g>
        ))}
        <path d={archPath(-5.5, 0, 11, 10)} fill="#4b3a96" />
        <path d={archPath(-4.4, 0, 8.8, 8.8)} fill="#ffe08a" />
        <rect x={-0.4} y={0} width={0.8} height={8} fill="#4b3a96" opacity=".6" />
        <Lights u={-29} v={8.6} cols={12} rows={5} du={5.2} dv={5.2} seed={1} />
        {floorLines(BX0, BX1, 7.4, 5, 5.2)}
        <rect x={BX0} y={BH - 2.2} width={BX1 - BX0} height={1} fill={c} />
      </Face>
      <Face p="R" at={BX1}>
        <rect x={BY0} y={0} width={BY1 - BY0} height={6.6} fill="#ecdcb8" />
        <Lights u={-24} v={8.6} cols={3} rows={5} du={6} dv={5.2} seed={2} />
        {[-24, -18, -12].map((u) => (
          <path key={u} d={archPath(u, 0.4, 3.2, 5)} fill="#ffd36e" />
        ))}
        {floorLines(BY0, BY1, 7.4, 5, 5.2)}
      </Face>
      {/* gold cornice + tower */}
      <Box x={BX0 - 1} y={BY0 - 1} z={BH} w={BX1 - BX0 + 2} d={BY1 - BY0 + 2} h={2.4} t={GOLD} />
      <Box x={-11} y={-26} z={BH + 2.4} w={22} d={15} h={25.6} c={CREAM} />
      <Face p="L" at={-11}>
        <Lights u={-8.4} v={BH + 4.6} cols={4} rows={5} du={5.4} dv={5} w={3.4} h={3.2} seed={3} />
      </Face>
      <Face p="R" at={11}>
        <Lights u={-23} v={BH + 4.6} cols={3} rows={5} du={5} dv={5} w={3.2} h={3.2} seed={4} />
      </Face>
      <Box x={9.8} y={-13} z={BH + 2.4} w={1.8} d={2} h={25.6} t={tc} />
      <Box x={-11.6} y={-13} z={BH + 2.4} w={1.8} d={2} h={25.6} t={tc} />
      <Box x={-12.6} y={-27} z={62} w={25.2} d={17} h={2.4} t={GOLD} />
      <Pad x={-11.4} y={-26} z={64.4} w={22.8} d={15} c="#e8dcc0" />
      <Box x={-6} y={-24} z={64.4} w={5} d={4} h={3} c="#d6c9e8" />
      {/* rooftop sign */}
      <Box x={-11.4} y={-19.4} z={64.4} w={1.4} d={1.4} h={3} c="#8c84c8" />
      <Box x={10} y={-19.4} z={64.4} w={1.4} d={1.4} h={3} c="#8c84c8" />
      <Box x={-15.4} y={-19.4} z={66.8} w={30.8} d={2} h={13.6} c="#3a2f8c" t={{ top: '#7a6ee0', left: '#3a2f8c', right: '#241b5c' }} />
      <Face p="L" at={-17.4}>
        <rect x={-14.6} y={67.6} width={29.2} height={12} rx="1.6" fill="#2e2475" />
        <rect x={-14.6} y={67.6} width={29.2} height={12} rx="1.6" fill="none" stroke={PAL.gold} strokeWidth=".9" />
        <Letters text="HOTEL" u={-lettersWidth('HOTEL', 0.66, 2.2) / 2} v={72.6} s={0.66} gap={2.2} color={PAL.gold} sw={1.4} />
        {[-6.4, -3.2, 0, 3.2, 6.4].map((u) => (
          <circle key={u} cx={u} cy={69.9} r="0.8" fill={PAL.gold} />
        ))}
      </Face>
      {/* left wing */}
      <Box x={-32} y={-8} w={10} d={19} h={26} c={CREAM} />
      <Box x={-33} y={-9} z={26} w={12} d={21} h={2.2} t={GOLD} />
      <Face p="R" at={-22}>
        <Lights u={-5} v={5} cols={3} rows={4} du={5.6} dv={5.2} seed={5} />
      </Face>
      <Face p="L" at={11}>
        <Lights u={-29.4} v={5} cols={2} rows={4} du={5.4} dv={5.2} seed={6} />
        <rect x={-32} y={0} width={10} height={3.4} fill="#ecdcb8" />
      </Face>
      {/* porte-cochere canopy */}
      <Box x={-10} y={-8} z={10} w={20} d={10} h={1.8} t={tc} />
      <Box x={-9.4} y={0.4} w={1.3} d={1.3} h={10} c="#fff7e6" />
      <Box x={8.1} y={0.4} w={1.3} d={1.3} h={10} c="#fff7e6" />
      <Box x={-1} y={0.4} w={1.3} d={1.3} h={10} c="#fff7e6" />
      {/* flags */}
      <Flag x={-17} y={-5} c={c} />
      <Flag x={17} y={-5} c={c} />
      {/* fountain */}
      <Cyl x={-12} y={21} r={8.6} h={2.6} c="#efe3c4" />
      <Disc x={-12} y={21} z={2.6} r={7} c="#4ed3e4" />
      <Cyl x={-12} y={21} z={2.6} r={1.6} h={7} c="#efe3c4" />
      <Cyl x={-12} y={21} z={9.6} r={3.2} h={1.2} c="#efe3c4" />
      <g fill="none" stroke="#bff3fa" strokeWidth="1.1" strokeLinecap="round">
        <path d={`M${fx} ${fy}Q${fx - 5} ${fy - 7} ${fx - 8} ${fy + 3}`} />
        <path d={`M${fx} ${fy}Q${fx + 5} ${fy - 7} ${fx + 8} ${fy + 3}`} />
        <path d={`M${fx} ${fy}V${fy - 5}`} />
      </g>
      {/* right wing */}
      <Box x={22} y={-8} w={10} d={19} h={26} c={CREAM} />
      <Box x={21} y={-9} z={26} w={12} d={21} h={2.2} t={GOLD} />
      <Face p="L" at={11}>
        <Lights u={23.6} v={5} cols={2} rows={4} du={5.4} dv={5.2} seed={7} />
        <rect x={22} y={0} width={10} height={3.4} fill="#ecdcb8" />
      </Face>
      <Face p="R" at={32}>
        <Lights u={-5} v={5} cols={3} rows={4} du={5.6} dv={5.2} seed={8} />
      </Face>
      {/* poolside */}
      {[16, 22].map((y) => (
        <g key={y}>
          <Box x={-1} y={y} w={3.2} d={6.4} h={1.4} c="#fff7e6" />
          <Box x={-1} y={y} z={1.4} w={3.2} d={4.2} h={0.7} t={tc} />
        </g>
      ))}
      <Cyl x={1.8} y={29} r={0.4} h={11} c="#8a5a3c" />
      <Disc x={1.8} y={29} z={11} r={6.2} c={darken(c, 0.12)} />
      <Disc x={1.8} y={29} z={11.2} r={4.2} c={c} />
      <Disc x={1.8} y={29} z={11.4} r={1.4} c="#fff7e6" />
      {/* planting */}
      <Palm x={-28} y={30} s={1.15} />
      <Palm x={30} y={26} s={1.05} />
      <Palm x={-30} y={16} s={0.95} />
      <Bush x={-18} y={32} s={0.9} />
      <Bush x={-6} y={33} s={0.9} />
      <Bush x={8} y={36} s={0.9} />
      <Bush x={26} y={33} s={0.9} />
    </g>
  );
}
