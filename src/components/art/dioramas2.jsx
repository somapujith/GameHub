// Isometric dioramas, part 2: Water Board, Tax, Film City, Jail, Auction, Kismet.
// World frame: slab footprint 0..96 x 0..96 (centre 48,48). Each builder returns { top, node }.
import { PAL, tone, lighten, darken } from './palette.js';
import { Box, Pad, Cyl, Cone, Dome, Face, Gable, Disc, Shade, Tree, Bush, Grass, Letters, archPath, pt, Poly, lettersWidth } from './iso.jsx';

const pts = (a) => a.map((p) => p.join(',')).join(' ');
const stroke = (a, b, w, c, extra = {}) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" {...extra} />;

function Drop({ s = 1, c = '#3ec1e3' }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M0 -16C6 -8 10 -2.4 10 3.6A10 10 0 0 1 -10 3.6C-10 -2.4 -6 -8 0 -16Z" fill={c} />
      <path d="M0 -16C6 -8 10 -2.4 10 3.6A10 10 0 0 1 3 13.2C9 8 6 -4 0 -16Z" fill={darken(c, 0.25)} />
      <path d="M-6.4 4.4C-6.6 0.6 -4.6 -3 -2.4 -6.2" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

/* ---------------- Water Board ---------------- */
export function Water() {
  const [dx, dy] = pt(66, 30, 34);
  const sp = pt(24.4, 22, 24);
  const [tx0, ty0] = pt(20, 64, 16), [tx1, ty1] = pt(62, 64, 16);
  const ring = (x) => {
    const a = pt(x, 64, 16), b = pt(x + 1.2, 64, 16);
    return <line key={x} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1c7fa6" strokeWidth="17.6" />;
  };
  const wheel = (u, key) => (
    <g key={key}>
      <circle cx={u} cy={4.4} r="5" fill="#2b2260" />
      <circle cx={u} cy={4.4} r="2.5" fill="#cfc7e8" />
      <circle cx={u} cy={4.4} r="1" fill="#6a62b4" />
    </g>
  );
  return {
    top: '#6a62b4',
    node: (
      <g>
        <Grass x={6} y={6} w={84} d={10} />
        <Pad x={6} y={46} w={84} d={44} c="#5a53a2" r={5} />
        <Pad x={9} y={49} w={78} d={38} c="#625bac" r={4} />
        {/* puddle + giant drop */}
        <Disc x={66} y={30} r={17} c="#2aa7c9" />
        <Disc x={66} y={30} r={15} c="#5fd8ee" />
        <Disc x={66} y={30} r={10.5} c="none" stroke="#fff" sw={1.1} o={0.75} />
        <Disc x={66} y={30} r={6} c="none" stroke="#fff" sw={1.1} o={0.9} />
        <Disc x={66} y={30} r={2} c="#fff" o={0.8} />
        <Tree x={82} y={12} s={0.9} />
        <Tree x={50} y={12} s={0.8} c={PAL.grass} />
        {/* standpipe */}
        <Box x={12} y={18} w={8} d={8} h={3} c="#cfc7e8" />
        <Cyl x={16} y={22} z={3} r={2.6} h={20} c="#2ec4b6" />
        <Cyl x={16} y={22} z={23} r={3.4} h={2.4} c="#1f9d97" />
        <g>
          {stroke(pt(16, 22, 22), pt(25, 22, 22), 5, '#1f9d97')}
          {stroke(pt(16, 22, 22.6), pt(25, 22, 22.6), 3.2, '#2ec4b6')}
          <ellipse cx={pt(25.4, 22, 22)[0]} cy={pt(25.4, 22, 22)[1]} rx="1.8" ry="2.8" fill="#14706d" />
        </g>
        <Disc x={16} y={22} z={25.6} r={3.4} c={PAL.gold} />
        <Disc x={16} y={22} z={25.7} r={1} c="#b8741a" />
        <Disc x={26} y={22} r={5} c="#5fd8ee" />
        <Disc x={26} y={22} r={2.6} c="none" stroke="#fff" sw={0.9} o={0.8} />
        {stroke(pt(25.6, 22, 20), pt(25.6, 22, 7), 1.4, '#9aeaf7')}
        <g transform={`translate(${pt(25.6, 22, 12)[0]} ${pt(25.6, 22, 12)[1]})`}><Drop s={0.3} c="#5fd8ee" /></g>
        {/* giant drop with soft shadow on the puddle */}
        <ellipse cx={pt(66, 30, 0)[0]} cy={pt(66, 30, 0)[1] + 1} rx="9" ry="3.6" fill="#1b4f7a" opacity=".25" />
        <g transform={`translate(${dx} ${dy})`}><Drop s={1.75} /></g>
        {[[-22, -4], [22, -6], [-14, 18], [18, 16]].map(([ox, oy], i) => (
          <g key={i} transform={`translate(${dx + ox} ${dy + 26 + oy})`}><Drop s={0.26 + (i % 2) * 0.08} c="#7de3f4" /></g>
        ))}
        {/* tanker truck */}
        <Box x={8} y={57} z={3} w={72} d={14} h={3} c="#3a2f8c" />
        <Box x={64} y={57} z={6} w={16} d={14} h={13} c={PAL.saffron} />
        <Box x={78} y={58.5} z={6} w={5} d={11} h={7} c="#e8731f" />
        <Face p="L" at={71}>
          <rect x={66} y={13} width={6.4} height={4.8} rx="1" fill="#9be3f2" />
          <rect x={66} y={16.6} width={6.4} height={1.2} rx=".6" fill="#fff" opacity=".6" />
          <rect x={64} y={8} width={16} height={0.8} fill="#fff" opacity=".35" />
        </Face>
        <Face p="R" at={80}>
          <rect x={59.4} y={13} width={9.2} height={5} rx="1" fill="#9be3f2" />
        </Face>
        <Face p="R" at={83}>
          <circle cx="60.4" cy="9" r="1.3" fill={PAL.gold} />
          <circle cx="67.6" cy="9" r="1.3" fill={PAL.gold} />
        </Face>
        {/* tank */}
        {stroke([tx0, ty0], [tx1, ty1], 17, '#1c7fa6')}
        {ring(30)}{ring(40)}{ring(50)}
        {stroke([tx0 - 1, ty0 - 1.6], [tx1 - 1, ty1 - 1.6], 14, '#3ec1e3')}
        {stroke([tx0 - 1.4, ty0 - 5.6], [tx1 - 1.4, ty1 - 5.6], 3.6, '#a5ecf8')}
        <Cyl x={40} y={64} z={24.4} r={2.6} h={1.6} c="#cfc7e8" />
        <g transform={`translate(${pt(40, 66, 13)[0] + 1} ${pt(40, 66, 13)[1] + 1})`}><Drop s={0.5} c="#ffffff" /></g>
        <Face p="L" at={71.4}>{[20, 33, 71].map(wheel)}</Face>
        <Bush x={88} y={86} s={1} />
        <Tree x={8} y={86} s={0.9} />
      </g>
    ),
  };
}

/* ---------------- GHMC Tax ---------------- */
export function Tax() {
  const offs = [[0, 0], [1.2, -0.8], [-0.8, 1], [0.6, 0.8], [-1, -0.6], [1, 0.4], [0, -1], [0, 0]];
  const sheet = { top: '#fffdf6', left: '#efe6d0', right: '#c9bd9c' };
  const sheets = offs.map(([dx, dy], i) => <Box key={i} x={24 + dx} y={29 + dy} z={5 + i * 1.5} w={44} d={34} h={1.5} t={sheet} />);
  const TOP = 5 + offs.length * 1.5;
  const coin = (x, y, n, k) =>
    Array.from({ length: n }, (_, i) => (
      <Cyl key={k + i} x={x} y={y} z={i * 2} r={5} h={2} t={i % 2 ? { top: '#ffe08a', left: '#ffb100', right: '#c98200' } : { top: '#ffdc7a', left: '#ffc857', right: '#d99a1d' }} />
    ));
  const btn = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) btn.push(<Pad key={r + '-' + c} x={75.4 + c * 3.8} y={14.6 + r * 3.2} z={3} w={2.8} d={2.2} c={r === 0 && c === 2 ? PAL.rose : c === 2 ? PAL.gold : '#e8e2ff'} />);
  return {
    top: '#6a62b4',
    node: (
      <g transform="translate(0 48) scale(1.12) translate(0 -48)">
        <Shade x={46} y={50} rx={48} o={0.16} />
        {/* calculator */}
        <Box x={74} y={8} w={15} d={19} h={3} c="#4a3fb0" />
        <Pad x={75.4} y={9.4} z={3} w={12.2} d={4} c="#8bf0e4" />
        {btn}
        {/* folders + paper stack */}
        <Box x={18} y={24} w={58} d={46} h={2.4} c={PAL.rose} />
        <Box x={20} y={26} z={2.4} w={56} d={44} h={2.4} c={PAL.teal} />
        {sheets}
        {/* top sheet print */}
        <Face p="T" at={TOP}>
          <Letters text="TAX" u={30} v={42} s={0.95} flip color="#2e2475" sw={1.7} gap={2.6} />
          <rect x={30} y={44.6} width={36} height={1.3} rx=".6" fill="#8c84c8" />
          {[48.4, 52, 55.6, 59.2].map((y, i) => (
            <rect key={y} x={30} y={y} width={[34, 30, 33, 20][i]} height={1.2} rx=".6" fill="#cfc9e8" />
          ))}
          <circle cx="50" cy="52" r="9" fill="none" stroke={PAL.rose} strokeWidth="1.5" opacity=".85" />
          <circle cx="50" cy="52" r="6.8" fill="none" stroke={PAL.rose} strokeWidth=".8" opacity=".85" />
          <Letters text="₹" u={47} v={56.4} s={0.7} flip color={PAL.rose} sw={1.5} />
        </Face>
        {/* stamp */}
        <Cyl x={66} y={35} z={TOP} r={6.4} h={2.6} c="#2b2260" />
        <Cyl x={66} y={35} z={TOP + 2.6} r={3.4} h={5} c="#c98a4a" />
        <Cyl x={66} y={35} z={TOP + 7.6} r={2.6} h={9} c="#d9a35f" />
        <Dome x={66} y={35} z={TOP + 16.6} r={4.6} h={5} c={PAL.gold} />
        {/* pen */}
        <Box x={42} y={62} z={TOP} w={17} d={1.5} h={1.5} c="#4a3fb0" />
        <Box x={59} y={62.2} z={TOP} w={3} d={1.1} h={1.1} c={PAL.gold} />
        {/* coins */}
        {coin(80, 72, 5, 'a')}
        {coin(72, 80, 3, 'b')}
        <Cyl x={84} y={58} r={5} h={2} c={PAL.gold} />
        <Face p="T" at={2}>
          <Letters text="₹" u={81.2} v={61.4} s={0.5} flip color="#b8741a" sw={1.1} />
        </Face>
        <Bush x={88} y={12} s={1} />
        <Tree x={10} y={86} s={0.9} />
      </g>
    ),
  };
}

/* ---------------- Film City ---------------- */
export function Film() {
  const planks = [];
  for (let i = 0; i < 7; i++) planks.push(<Pad key={i} x={6} y={7 + i * 12} w={84} d={6} c="#7f77ca" />);
  const bar = (n, c1, c2) =>
    Array.from({ length: n }, (_, i) => <polygon key={i} points={`${i * 6.4},0 ${i * 6.4 + 3.2},0 ${i * 6.4 + 6},5.6 ${i * 6.4 + 2.8},5.6`} fill={i % 2 ? c1 : c2} />);
  const star = (() => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = (-90 + i * 36) * (Math.PI / 180);
      const r = i % 2 ? 2.4 : 5.6;
      p.push([+(36 + Math.cos(a) * r).toFixed(2), +(76 + Math.sin(a) * r).toFixed(2)]);
    }
    return pts(p);
  })();
  const lamp = pt(80, 20, 30);
  const f0 = pt(60, 40, 0), f1 = pt(36, 56, 0);
  const lens = [[lamp[0] - 9, lamp[1] + 4], [lamp[0] - 3, lamp[1] + 9]];
  const [ox, oy] = pt(48, 46, 0);
  return {
    top: '#7a72c6',
    node: (
      <g>
        {planks}
        <Pad x={9} y={68} w={78} d={13} c="#b8323f" r={2} />
        <Pad x={9} y={68} w={78} d={13} c="none" r={2} />
        <Pad x={9} y={67.4} w={78} d={1.2} c={PAL.gold} />
        <Pad x={9} y={80.6} w={78} d={1.2} c={PAL.gold} />
        <Pad x={10.6} y={69.4} w={74.8} d={10.2} c={PAL.rose} r={1} />
        <Face p="T" at={0.1}><polygon points={star} fill={PAL.gold} /></Face>
        {/* spotlight stand + beam */}
        <polygon points={pts([lens[0], lens[1], f1, f0])} fill="#ffe9a8" opacity=".22" />
        <ellipse cx={ox + 2} cy={oy + 2} rx="19" ry="9.4" fill="#ffe9a8" opacity=".3" />
        <Box x={76} y={16} w={8} d={8} h={1.8} c="#2b2260" />
        <Cyl x={80} y={20} z={1.8} r={0.9} h={26} c="#a79fe0" />
        <g transform={`translate(${lamp[0]} ${lamp[1]}) rotate(32)`}>
          <rect x="-8" y="-5.2" width="16" height="10.4" rx="2.6" fill="#3a2f8c" />
          <rect x="-8" y="-5.2" width="16" height="4" rx="2" fill="#6a5fd6" />
          <ellipse cx="-8" cy="0" rx="2.6" ry="5.2" fill={PAL.gold} />
          <ellipse cx="-8.6" cy="-0.4" rx="1.2" ry="3" fill="#fff6c8" />
          <path d="M2 -5V5M5 -5V5" stroke="#2b2260" strokeWidth="1.1" />
        </g>
        {/* clapperboard */}
        <Box x={12} y={42} w={38} d={3.4} h={22} c="#2b2260" t={{ top: '#6a5fd6', left: '#2f2570', right: '#1b1340' }} />
        <Face p="L" at={45.4}>
          <rect x={12.6} y={1} width={36.8} height={13.6} fill="#2f2570" />
          <rect x={12.6} y={14.6} width={36.8} height={5.8} fill="#ffffff" />
          <g transform="translate(12.6 14.6)">{bar(6, '#ffffff', '#1b1340')}</g>
          <g stroke="#f4ecff" strokeWidth=".7" strokeLinecap="round" opacity=".9">
            <path d="M14 11.4H48M14 7.4H48M14 3.4H48M31 3.4V11.4" />
          </g>
          <rect x={16} y={4.4} width={9} height={1.4} rx=".6" fill={PAL.gold} />
          <rect x={34} y={4.4} width={7} height={1.4} rx=".6" fill={PAL.rose} />
          <rect x={16} y={8.4} width={11} height={1.4} rx=".6" fill={PAL.teal} />
          <g transform="translate(12.4 20.6) rotate(12)">{<rect x="0" y="0" width="37" height="5.6" fill="#fff" />}{bar(6, '#ffffff', '#1b1340')}</g>
        </Face>
        {/* camera on tripod */}
        {stroke(pt(66, 54, 22), pt(56, 46, 0), 1.8, '#2b2260')}
        {stroke(pt(66, 54, 22), pt(80, 52, 0), 1.8, '#2b2260')}
        {stroke(pt(66, 54, 22), pt(66, 70, 0), 1.8, '#2b2260')}
        <Box x={58} y={47} z={20} w={18} d={12} h={12} c="#4a3fb0" />
        <Box x={56} y={50} z={23} w={3} d={5} h={4} c="#2e2475" />
        <Box x={76} y={50} z={21.5} w={8} d={8} h={8} c="#2b2260" />
        <Face p="R" at={84}>
          <circle cx="54" cy="25.5" r="3.2" fill="#6dd4ea" />
          <circle cx="53" cy="26.6" r="1" fill="#fff" opacity=".8" />
        </Face>
        <Face p="L" at={53}>
          <circle cx="63" cy="40" r="6" fill="#2e2475" />
          <circle cx="63" cy="40" r="4.2" fill="#4a3fb0" />
          <circle cx="63" cy="40" r="1.4" fill={PAL.gold} />
          <circle cx="72" cy="38.4" r="5" fill="#2e2475" />
          <circle cx="72" cy="38.4" r="3.4" fill="#4a3fb0" />
          <circle cx="72" cy="38.4" r="1.2" fill={PAL.gold} />
        </Face>
        <Face p="L" at={59}>
          <rect x={60} y={22.6} width={14} height={2} rx="1" fill={PAL.rose} />
        </Face>
        <Bush x={10} y={92} s={0.9} />
        <Tree x={88} y={86} s={0.9} />
      </g>
    ),
  };
}

/* ---------------- Jail ---------------- */
function BarWin({ u, v, w = 3.8, h = 7 }) {
  const bars = [];
  const n = Math.max(2, Math.round(w / 1.15));
  for (let i = 1; i < n; i++) bars.push(<rect key={i} x={u + (w * i) / n - 0.25} y={v} width={0.5} height={h} fill="#2e2475" />);
  return (
    <g>
      <rect x={u - 0.9} y={v - 0.9} width={w + 1.8} height={h + 1.8} rx="1" fill="#cbbd9c" />
      <rect x={u} y={v} width={w} height={h} rx=".6" fill="#ffd36e" />
      <rect x={u} y={v + h - 1.6} width={w} height={1.6} fill="#f0a91b" opacity=".6" />
      {bars}
      <rect x={u} y={v + h / 2 - 0.25} width={w} height={0.5} fill="#2e2475" />
    </g>
  );
}

export function Jail() {
  const STONE_ = '#eadfc4';
  const cols = [40, 45.3, 50.7, 56];
  return {
    top: '#4f4890',
    node: (
      <g>
        {/* plinth */}
        <Pad x={7} y={7} w={82} d={82} c="#9a8d70" r={6} />
        <Pad x={9} y={9} w={78} d={78} c="#cfc3a6" r={5} />
        <Grass x={12} y={12} w={13} d={13} />
        <Grass x={71} y={12} w={13} d={13} />
        <Grass x={12} y={71} w={13} d={13} />
        <Grass x={71} y={71} w={13} d={13} />
        <Shade x={48} y={48} rx={56} o={0.14} />
        <g transform="translate(0 48) scale(1.14) translate(0 -48)">
        <Box x={14} y={14} w={68} d={68} h={2.6} c="#e0d5ba" />
        {/* main block */}
        <Box x={30} y={30} z={2.6} w={36} d={36} h={24} c={STONE_} />
        <Face p="L" at={66}>
          {[[32, 5], [36.4, 5], [59.6, 5], [64, 5], [32, 15], [36.4, 15], [59.6, 15], [64, 15]].map(([u, v], i) => (
            <BarWin key={i} u={u - 0.4} v={v + 2.6} w={3.4} h={6.4} />
          ))}
          <path d={archPath(44, 2.6, 8, 15)} fill="#2b2260" />
          {[45, 46.6, 48.2, 49.8, 51].map((u) => <rect key={u} x={u - 0.25} y={2.6} width={0.55} height={13} fill="#c9cdf0" />)}
          <rect x={44} y={9} width={8} height={0.6} fill="#c9cdf0" />
        </Face>
        <Box x={28.6} y={28.6} z={26.6} w={38.8} d={38.8} h={2.2} c="#f6edd4" />
        <Pad x={31} y={31} z={28.8} w={34} d={34} c="#d3c8ac" />
        <Cyl x={48} y={48} z={28.8} r={12.4} h={6.4} c="#e6dbc0" />
        <Cyl x={48} y={48} z={35.2} r={13.4} h={1.8} c="#6a62b4" />
        <Dome x={48} y={48} z={37} r={12.4} h={15} c="#bba98a" />
        <Cyl x={48} y={48} z={50.4} r={2.4} h={3.4} c="#e6dbc0" />
        <Dome x={48} y={48} z={53.8} r={2.8} h={3.6} c={PAL.gold} />
        <Cone x={48} y={48} z={57.2} r={0.4} h={3.4} c={PAL.gold} />
        {/* annex with gable roof */}
        <Box x={66} y={36} z={2.6} w={16} d={30} h={15} c={STONE_} />
        <Gable x={66} y={36} z={17.6} w={16} d={30} h={7.5} c="#b8a98a" axis="y" />
        <Face p="R" at={82}>
          {[39.4, 46.4, 53.4, 60.4].map((u) => <BarWin key={u} u={u} v={6.6} w={3.6} h={6.4} />)}
        </Face>
        <Face p="L" at={66}>
          <BarWin u={69.4} v={7.6} w={3.6} h={6} />
          <BarWin u={76.4} v={7.6} w={3.6} h={6} />
        </Face>
        {/* portico */}
        <Box x={36} y={66} z={2.6} w={24} d={9} h={1.2} c="#f3e9cf" />
        {cols.map((x) => <Cyl key={x} x={x} y={73} z={3.8} r={1.5} h={17.8} c="#fff6e0" />)}
        <Box x={37.6} y={67} z={21.6} w={20.8} d={8.4} h={2.6} c="#f6edd4" />
        <Gable x={37.6} y={67} z={24.2} w={20.8} d={8.4} h={6} c="#d9cdaf" axis="x" />
        <Box x={34} y={75.6} z={0} w={28} d={5} h={1.6} c="#f3e9cf" />
        <Box x={36} y={74} z={1.6} w={24} d={2.4} h={1.2} c="#f3e9cf" />
        {/* police car */}
        <g>
          <Box x={70} y={72} z={2.6} w={12} d={6} h={4} c="#ffffff" />
          <Box x={72} y={72.4} z={6.6} w={7} d={5.2} h={3.2} c="#9be3f2" />
          <Box x={74.4} y={73.6} z={9.8} w={1.6} d={2.8} h={1.4} c="#ff5d73" />
          <Box x={76} y={73.6} z={9.8} w={1.6} d={2.8} h={1.4} c="#4cc9f0" />
          <Cyl x={72.6} y={78.4} z={2.6} r={1.5} h={1.3} c="#2b2260" />
          <Cyl x={79.4} y={78.4} z={2.6} r={1.5} h={1.3} c="#2b2260" />
          <Face p="L" at={78}><rect x={70} y={4.8} width={12} height={1.2} fill="#3a56c8" /></Face>
        </g>
        </g>
        <Tree x={13} y={82} s={0.9} />
        <Tree x={83} y={13} s={0.9} c={PAL.grass} />
      </g>
    ),
  };
}

/* ---------------- Laad Bazaar Auction ---------------- */
function Pearl({ cx, cy, r = 2.1 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#e9e3f7" />
      <circle cx={cx - 0.25} cy={cy - 0.3} r={r * 0.8} fill="#ffffff" />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.4} r={r * 0.28} fill="#fff" />
      <path d={`M${cx + r * 0.1} ${cy + r * 0.9}A${r} ${r} 0 0 0 ${cx + r * 0.95} ${cy - r * 0.2}`} fill="none" stroke="#cfc6ea" strokeWidth={r * 0.35} strokeLinecap="round" />
    </g>
  );
}

export function Auction() {
  const bangleCols = ['#ff5d73', '#ffc857', '#2ec4b6', '#9b7bff', '#ff8a3d', '#8de05a', '#ff5d73'];
  const bangles = bangleCols.map((c, i) => {
    const [cx, cy] = pt(74, 26, 1.4 + i * 2.6);
    return (
      <g key={i} fill="none">
        <ellipse cx={cx} cy={cy + 1.3} rx="10.4" ry="5.2" stroke={darken(c, 0.35)} strokeWidth="2.9" />
        <ellipse cx={cx} cy={cy} rx="10.4" ry="5.2" stroke={c} strokeWidth="2.9" />
        <ellipse cx={cx} cy={cy - 0.5} rx="9.2" ry="4.5" stroke={lighten(c, 0.5)} strokeWidth=".7" opacity=".7" />
      </g>
    );
  });
  const pearls = [];
  for (let k = 0; k < 17; k++) {
    const a = 0.45 + (k / 17) * (Math.PI * 2 - 0.9);
    const x = 26 + 14 * Math.cos(a), y = 73 + 11 * Math.sin(a);
    pearls.push({ x, y, d: x + y });
  }
  pearls.sort((a, b) => a.d - b.d);
  const HZ = 12.6, HX = 42;
  const h0 = pt(HX, 43, HZ), h1 = pt(HX, 65, HZ);
  const e = (x0, x1, c, w = 14.4) => stroke(pt(HX, x0, HZ), pt(HX, x1, HZ), w, c, { strokeLinecap: 'butt' });
  const hc = pt(HX, 54, HZ);
  const hand0 = pt(HX + 4, 54, HZ), hand1 = pt(78, 54, HZ + 7);
  return {
    top: '#6a62b4',
    node: (
      <g>
        <Pad x={6} y={6} w={84} d={84} c="#ffc857" r={7} />
        <Pad x={8.4} y={8.4} w={79.2} d={79.2} c="#2a8f94" r={6} />
        <Pad x={13} y={13} w={70} d={70} c="#34a3a4" r={5} />
        <g transform="translate(0 48) scale(1.16) translate(0 -48)">
        {/* paddle */}
        <Cyl x={22} y={34} r={0.9} h={20} c="#8a5a3c" />
        <Face p="L" at={34}>
          <circle cx="22" cy="26.4" r="7.4" fill="#3a2f8c" />
          <circle cx="22" cy="26.4" r="6.2" fill={PAL.rose} />
          <circle cx="22" cy="26.4" r="6.2" fill="none" stroke="#ffe3e8" strokeWidth=".7" />
          <Letters text="₹" u={19.2} v={23.4} s={0.62} color="#fff7e6" sw={1.3} />
        </Face>
        {/* coins at the back */}
        {[0, 1, 2, 3].map((i) => (
          <Cyl key={i} x={17} y={20} z={i * 2} r={4.4} h={2} t={i % 2 ? { top: '#ffe08a', left: '#ffb100', right: '#c98200' } : { top: '#ffdc7a', left: '#ffc857', right: '#d99a1d' }} />
        ))}
        {/* bangles */}
        <Shade x={74} y={28} rx={13} o={0.2} />
        {bangles}
        {/* sound block */}
        <Shade x={46} y={58} rx={20} o={0.22} />
        <Cyl x={46} y={56} r={14} h={5.6} c="#b97a44" />
        <Disc x={46} y={56} z={5.6} r={10.6} c="#a86a38" />
        <Disc x={46} y={56} z={5.7} r={8.6} c="#c98a4e" />
        {/* gavel */}
        {stroke(hand0, hand1, 4.6, '#8f5226')}
        {stroke([hand0[0], hand0[1] - 0.9], [hand1[0], hand1[1] - 0.9], 2.8, '#c47a3e')}
        {stroke(h0, h1, 14, '#8f5226', { strokeLinecap: 'butt' })}
        {stroke([h0[0] - 1.1, h0[1] - 1.6], [h1[0] - 1.1, h1[1] - 1.6], 11.4, '#c47a3e', { strokeLinecap: 'butt' })}
        {stroke([h0[0] - 1.8, h0[1] - 4.2], [h1[0] - 1.8, h1[1] - 4.2], 3, '#eaa86c', { strokeLinecap: 'butt' })}
        {e(45.4, 47.4, '#ffc857')}
        {e(60.6, 62.6, '#ffc857')}
        <Face p="L" at={65}>
          <circle cx={HX} cy={HZ} r="7" fill="#d99354" />
          <circle cx={HX} cy={HZ} r="5" fill="#c47a3e" />
          <circle cx={HX} cy={HZ} r="1.8" fill="#eaa86c" />
        </Face>
        <circle cx={hand0[0] + 1.6} cy={hand0[1] - 0.2} r="3.6" fill="#ffc857" />
        <circle cx={hand0[0] + 0.8} cy={hand0[1] - 1} r="1.1" fill="#fff0b8" />
        <circle cx={hand1[0]} cy={hand1[1]} r="3" fill="#ffc857" />
        <circle cx={hand1[0] - 0.8} cy={hand1[1] - 0.9} r="1" fill="#fff0b8" />
        <g fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".85">
          <path d={`M${pt(30, 62, 9)[0]} ${pt(30, 62, 9)[1]}q-4 -1 -7 2`} />
          <path d={`M${pt(32, 56, 14)[0]} ${pt(32, 56, 14)[1]}q-5 -3 -9 -1`} />
          <path d={`M${pt(34, 49, 17)[0] - 1} ${pt(34, 49, 17)[1]}q-3 -5 -8 -5`} />
        </g>
        {/* pearl necklace + loose pearls */}
        {pearls.map((p, i) => {
          const [cx, cy] = pt(p.x, p.y, 2);
          return <Pearl key={i} cx={cx} cy={cy} />;
        })}
        {[[60, 74], [64, 77], [58, 79], [66, 71]].map(([x, y], i) => {
          const [cx, cy] = pt(x, y, 2);
          return <Pearl key={'l' + i} cx={cx} cy={cy} r={2.4} />;
        })}
        </g>
        <Bush x={88} y={86} s={0.9} />
      </g>
    ),
  };
}

/* ---------------- Kismet (biryani handi + card) ---------------- */
export function Kismet() {
  const [px, py] = pt(48, 48, 0);
  const rice = [
    [-18, -42, 3], [-8, -46, 2.4], [6, -48, 3], [16, -43, 2.6], [-14, -37, 2.2], [2, -41, 2.4], [12, -38, 2.8], [-2, -35, 2.2], [20, -37, 2],
  ];
  return {
    top: '#6a62b4',
    node: (
      <g>
        {/* platter */}
        <ellipse cx={px} cy={py + 3.6} rx="62" ry="31" fill="#4f4890" />
        <ellipse cx={px} cy={py + 1} rx="62" ry="31" fill="#ffc857" />
        <ellipse cx={px} cy={py + 1} rx="58" ry="28.6" fill="#fff0d2" />
        <ellipse cx={px} cy={py + 1} rx="50" ry="24" fill="none" stroke="#ffc857" strokeWidth="1.2" strokeDasharray="1.2 3.4" strokeLinecap="round" />
        {/* garnish on platter */}
        <g transform={`translate(${px - 40} ${py + 12})`}>
          <ellipse cx="0" cy="1" rx="8.4" ry="4.4" fill="#e0b800" />
          <ellipse cx="0" cy="0" rx="8.4" ry="4.4" fill="#ffe14d" />
          <ellipse cx="0" cy="0" rx="6.4" ry="3.2" fill="#fff6a8" />
          <path d="M0 0L-6 0M0 0L5 -2.4M0 0L4.6 2.6" stroke="#ffe14d" strokeWidth=".8" />
        </g>
        <g transform={`translate(${px + 36} ${py + 14})`}>
          <path d="M-10 0Q-2 -6 8 0Q-2 3 -10 0Z" fill="#3fa862" />
          <path d="M-10 0Q-2 -4.6 8 0" fill="none" stroke="#8de05a" strokeWidth="1" />
        </g>
        {[[-22, 18, '#ff5d73'], [-12, 22, '#ff8fa0'], [28, 18, '#ff5d73'], [20, 24, '#ffb3bf'], [44, 4, '#ff8fa0']].map(([x, y, c], i) => (
          <ellipse key={i} cx={px + x} cy={py + y} rx="3.2" ry="1.7" fill={c} transform={`rotate(${i * 30 - 20} ${px + x} ${py + y})`} />
        ))}
        <g transform={`translate(${px} ${py + 8})`}>
          <ellipse cx="0" cy="0.5" rx="22" ry="6" fill="#b8741a" opacity=".28" />
          {/* handi body */}
          <path d="M-13 0C-31 0 -38 -14 -33 -25C-31 -30 -27 -32 -27 -35L27 -35C27 -32 31 -30 33 -25C38 -14 31 0 13 0Z" fill="#e8872f" />
          <path d="M13 0C31 0 38 -14 33 -25C31 -30 27 -32 27 -35L19 -35C24 -26 26 -9 13 0Z" fill="#b5551d" />
          <path d="M-31 -18Q0 -9 31 -18" fill="none" stroke={PAL.gold} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M-31 -18Q0 -9 31 -18" fill="none" stroke="#fff3c4" strokeWidth=".8" strokeLinecap="round" strokeDasharray="1 4" />
          <path d="M-29 -26C-31 -20 -29 -10 -22 -5" fill="none" stroke="#ffc28a" strokeWidth="2.6" strokeLinecap="round" opacity=".8" />
          <ellipse cx="0" cy="-35" rx="28" ry="7.4" fill="#d9772b" />
          <ellipse cx="0" cy="-36" rx="25" ry="5.8" fill="#6d2c0f" />
          {/* biryani mound */}
          <path d="M-25 -37Q-20 -53 0 -55Q20 -53 25 -37Q0 -30 -25 -37Z" fill="#fff0c9" />
          <path d="M-25 -37Q-20 -53 0 -55Q4 -45 -4 -40Q-14 -36 -25 -37Z" fill="#fffaf0" opacity=".7" />
          <path d="M-18 -46Q-6 -50 4 -46M-22 -41Q-8 -45 8 -42M2 -50Q14 -49 20 -43" fill="none" stroke="#ff9a3d" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
          {rice.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r * 0.5} fill={i % 3 === 0 ? '#5ac46a' : i % 3 === 1 ? '#b5651d' : '#ffc857'} />
          ))}
          <ellipse cx="9" cy="-49" rx="4.4" ry="3.2" fill="#fff" />
          <ellipse cx="9" cy="-49" rx="2" ry="1.5" fill="#ffc857" />
          <path d="M-8 -38Q-4 -42 0 -38Q-4 -35 -8 -38Z" fill="#b5651d" />
          {/* steam */}
          <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="3.4" opacity=".85">
            <path d="M-12 -58C-18 -66 -6 -70 -12 -80" />
            <path d="M2 -60C-4 -69 8 -74 2 -86" />
            <path d="M16 -58C10 -66 22 -70 16 -78" />
          </g>
        </g>
        {/* cards */}
        <g transform={`translate(${px + 40} ${py - 6}) rotate(14)`}>
          <rect x="-12" y="-17" width="24" height="34" rx="4" fill="#fff7e6" />
          <rect x="-12" y="-17" width="24" height="34" rx="4" fill="none" stroke="#3a2f8c" strokeWidth="1.6" />
          <rect x="-9" y="-14" width="18" height="28" rx="2.6" fill="#ffc857" opacity=".45" />
          <path d="M-4.6 -7.4A5.4 5.4 0 1 1 3 -1.4Q0 .4 0 4" fill="none" stroke="#3a2f8c" strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="9.4" r="1.9" fill="#3a2f8c" />
        </g>
        <g transform={`translate(${px - 44} ${py - 8}) rotate(-12)`}>
          <rect x="-11" y="-16" width="22" height="32" rx="4" fill="#9b7bff" />
          <rect x="-11" y="-16" width="22" height="32" rx="4" fill="none" stroke="#fff7e6" strokeWidth="1.4" />
          <path d="M0 -8L2.4 -2.6L8 -2.4L3.6 1.4L5.2 7L0 3.8L-5.2 7L-3.6 1.4L-8 -2.4L-2.4 -2.6Z" fill="#ffc857" />
        </g>
        {/* sparkles */}
        {[[-52, -34, 4.6], [54, -40, 3.6], [-22, -62, 3], [30, -64, 4]].map(([x, y, r], i) => (
          <path key={i} d={`M${px + x} ${py + y - r}Q${px + x} ${py + y} ${px + x + r} ${py + y}Q${px + x} ${py + y} ${px + x} ${py + y + r}Q${px + x} ${py + y} ${px + x - r} ${py + y}Q${px + x} ${py + y} ${px + x} ${py + y - r}Z`} fill="#ffe9a8" />
        ))}
      </g>
    ),
  };
}
