// Isometric dioramas, part 1: Charminar, Metro, Hussain Sagar boat, Airport, Electricity.
// World frame: slab footprint 0..96 x 0..96 (centre 48,48). Each diorama returns { top, node }.
import { PAL, tone, lighten, darken } from './palette.js';
import { Box, Pad, Cyl, Cone, Dome, Face, Gable, Disc, Shade, Tree, Bush, Grass, Letters, archPath, pt, Poly, Windows } from './iso.jsx';

const STONE = '#f1e2c0';
const STONE_D = '#d8c49a';

function Minaret({ x, y, h = 60 }) {
  return (
    <g>
      <Cyl x={x} y={y} r={3.5} h={h} c={STONE} />
      <Cyl x={x} y={y} z={h * 0.62} r={3.8} h={1.1} c={PAL.gold} />
      <Cyl x={x} y={y} z={20} r={5.4} h={1.6} c={STONE_D} />
      <Cyl x={x} y={y} z={21.6} r={4.4} h={0.8} c={PAL.gold} />
      <Cyl x={x} y={y} z={41} r={5.4} h={1.6} c={STONE_D} />
      <Cyl x={x} y={y} z={42.6} r={4.4} h={0.8} c={PAL.gold} />
      <Cyl x={x} y={y} z={h} r={3.2} h={7} c={STONE} />
      <Cyl x={x} y={y} z={h + 7} r={4.2} h={1.2} c={STONE_D} />
      <Dome x={x} y={y} z={h + 8.2} r={3.8} h={6.4} c="#fff7e6" />
      <Cone x={x} y={y} z={h + 14.4} r={0.7} h={6} c={PAL.gold} />
    </g>
  );
}

function Chhatri({ x, y, z }) {
  return (
    <g>
      <Cyl x={x} y={y} z={z} r={1.7} h={4.2} c={STONE} />
      <Dome x={x} y={y} z={z + 4.2} r={2.7} h={3.6} c="#fff7e6" />
      <Cone x={x} y={y} z={z + 7.6} r={0.4} h={3} c={PAL.gold} />
    </g>
  );
}

export function Charminar() {
  const arch = (u, v, w, h, key) => (
    <g key={key}>
      <path d={archPath(u - 1, v, w + 2, h + 1)} fill={STONE_D} />
      <path d={archPath(u, v, w, h)} fill="#2e2475" />
      <path d={archPath(u + 1.2, v, w - 2.4, h - 2.4)} fill="#5445b8" />
    </g>
  );
  const faceStuff = (
    <>
      {arch(42, 0, 12, 17.5, 'a')}
      {arch(33.6, 2.4, 4, 9, 'b')}
      {arch(58.4, 2.4, 4, 9, 'c')}
      <rect x={30} y={20} width={36} height={1} fill={PAL.gold} opacity=".85" />
      {[37.6, 46, 54.4].map((u, i) => arch(u, 25.6, 4, 5.4, 'w' + i))}
      <rect x={30} y={34.4} width={36} height={0.9} fill={PAL.gold} opacity=".7" />
    </>
  );
  const roofItems = [
    [35, 35], [61, 35], [35, 61], [61, 61], [48, 35], [35, 48], [61, 48], [48, 61],
  ];
  const back = roofItems.filter(([x, y]) => x + y < 96);
  const front = roofItems.filter(([x, y]) => x + y >= 96);
  return {
    top: '#6a62b4',
    node: (
      <g>
        {/* plaza */}
        <Pad x={7} y={7} w={82} d={82} c="#e2d2ac" r={6} />
        <Pad x={11} y={11} w={74} d={74} c="#f6ebcf" r={5} />
        <Pad x={17} y={17} w={62} d={62} c="#e9dab6" r={4} />
        <Grass x={10} y={72} w={14} d={14} />
        <Grass x={72} y={10} w={14} d={14} />
        <Tree x={17} y={79} s={1} />
        <Tree x={79} y={17} s={1} c={PAL.grass} />
        <Minaret x={30} y={30} />
        {/* base block */}
        <Box x={30} y={30} w={36} d={36} h={22} c={STONE} />
        <Face p="L" at={66}>{faceStuff}</Face>
        <Face p="R" at={66}>{faceStuff}</Face>
        <Box x={29} y={29} z={22} w={38} d={38} h={2} c={STONE_D} />
        <Box x={33} y={33} z={24} w={30} d={30} h={10} c={STONE} />
        <Box x={32} y={32} z={34} w={32} d={32} h={2} c={STONE_D} />
        {back.map(([x, y]) => <Chhatri key={x + '-' + y} x={x} y={y} z={36} />)}
        <Box x={42} y={42} z={36} w={12} d={12} h={6} c={STONE} />
        <Dome x={48} y={48} z={42} r={5.6} h={8.4} c="#fff7e6" />
        <Cone x={48} y={48} z={50} r={0.8} h={6} c={PAL.gold} />
        {front.map(([x, y]) => <Chhatri key={x + '-' + y} x={x} y={y} z={36} />)}
        <Minaret x={66} y={30} />
        <Minaret x={30} y={66} />
        <Minaret x={66} y={66} />
        <Bush x={12} y={40} s={0.9} />
        <Bush x={84} y={58} s={0.9} />
      </g>
    ),
  };
}

/* ---------------- Metro ---------------- */
function Car({ x, lead, last }) {
  const W = 25, y = 28, z = 30;
  const wins = [];
  const n = 5;
  for (let i = 0; i < n; i++) wins.push(<rect key={i} x={x + 2.4 + i * 4.4} y={z + 5.2} width={3.2} height={4.4} rx=".6" fill="#2e2475" />);
  return (
    <g>
      <Box x={x} y={y} z={z} w={W} d={12} h={12} c="#f6f2ff" t={{ top: '#ffffff', left: '#f6f2ff', right: '#cdc6ee' }} />
      <Face p="L" at={y + 12}>
        <rect x={x} y={z + 1.2} width={W} height={1.6} fill="#3a2f8c" />
        <rect x={x} y={z + 3} width={W} height={1.6} fill={PAL.rose} />
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <rect x={x + 2.4 + i * 4.4} y={z + 5.4} width={3.2} height={4.4} rx=".6" fill="#2e2475" />
            <rect x={x + 2.4 + i * 4.4} y={z + 5.4} width={3.2} height={1.2} rx=".6" fill="#6f66d8" />
          </g>
        ))}
        <rect x={x + W / 2 - 0.4} y={z + 1.2} width={0.8} height={9.6} fill="#9a90d6" opacity=".5" />
      </Face>
      <Box x={x + 4} y={y + 3} z={z + 12} w={W - 8} d={6} h={1.4} c="#ddd6f5" />
      {lead && (
        <g>
          <Box x={x + W} y={y + 1} z={z} w={4} d={10} h={9} c="#f6f2ff" t={{ top: '#ffffff', left: '#f6f2ff', right: '#cdc6ee' }} />
          <Face p="R" at={x + W + 4}>
            <rect x={y + 2} y={z + 3} width={6} height={4.6} rx="1.4" fill="#2e2475" />
            <rect x={y + 2} y={z + 3} width={6} height={1.4} rx="1" fill="#6f66d8" />
            <circle cx={y + 1.8} cy={z + 1.8} r=".9" fill={PAL.gold} />
            <circle cx={y + 8.2} cy={z + 1.8} r=".9" fill={PAL.gold} />
          </Face>
          <Face p="R" at={x + W}>
            <rect x={y + 1} y={z} width={10} height={1.2} fill={PAL.rose} />
          </Face>
        </g>
      )}
      {void wins}
      {void last}
    </g>
  );
}

export function Metro() {
  const piers = [14, 46, 76];
  const dash = [];
  for (let i = 0; i < 8; i++) dash.push(<Pad key={i} x={8 + i * 11} y={70.4} w={6} d={1.4} c="#fff7e6" o=".85" />);
  return {
    top: '#6a62b4',
    node: (
      <g>
        <Grass x={6} y={6} w={84} d={13} />
        <Tree x={14} y={13} s={0.9} />
        <Tree x={44} y={12} s={1} c={PAL.grass} />
        <Bush x={76} y={13} s={1} />
        <Pad x={4} y={58} w={88} d={26} c="#4a4380" r={3} />
        <Pad x={4} y={58} w={88} d={1.4} c="#fff7e6" o=".5" />
        <Pad x={4} y={82.6} w={88} d={1.4} c="#fff7e6" o=".5" />
        {dash}
        {piers.map((px) => (
          <g key={px}>
            <Box x={px} y={29} w={8} d={10} h={22} c="#d6cef0" />
            <Box x={px - 3} y={26} z={22} w={14} d={16} h={4} c="#e6e0f7" />
          </g>
        ))}
        {/* deck */}
        <Box x={4} y={24} z={26} w={88} d={20} h={4} c="#e6e0f7" />
        <Box x={4} y={24} z={30} w={88} d={1.4} h={2.6} c="#fff7e6" />
        <Pad x={5} y={25.4} z={30} w={86} d={17.2} c="#a79fd6" />
        <Pad x={9} y={30} z={30.1} w={80} d={1.2} c="#7f76c2" />
        <Pad x={9} y={37} z={30.1} w={80} d={1.2} c="#7f76c2" />
        <Car x={8} />
        <Car x={35} />
        <Car x={62} lead />
        <Box x={4} y={42.6} z={30} w={88} d={1.4} h={2.6} c="#fff7e6" />
        {/* signage pole + lights */}
        {[20, 52, 84].map((x) => (
          <g key={x}>
            <Box x={x} y={42.6} z={30} w={1.2} d={1.2} h={9} c="#8c84c8" />
            <Disc x={x + 0.6} y={43.2} z={39.4} r={1.1} c={PAL.gold} />
          </g>
        ))}
        {(() => {
          const [mx, my] = pt(9, 52, 0);
          return (
            <g transform={`translate(${mx} ${my})`}>
              <ellipse cx="0" cy="0.6" rx="4" ry="1.8" fill="#1b1340" opacity=".2" />
              <rect x="-0.8" y="-26" width="1.6" height="26" fill="#8c84c8" />
              <circle cx="0" cy="-31" r="7.4" fill="#e5484d" />
              <circle cx="0" cy="-31" r="6" fill="none" stroke="#fff" strokeWidth=".8" />
              <path d="M-3.4 -28V-34L0 -30.4L3.4 -34V-28" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })()}
        <Grass x={6} y={47} w={30} d={9} />
        <Grass x={62} y={47} w={28} d={9} />
        <Tree x={14} y={52} s={0.9} />
        <Bush x={72} y={52} s={0.9} />
        {/* auto-rickshaw */}
        <g>
          <Box x={52} y={72} z={1.4} w={11} d={6} h={4} c="#2fa86a" />
          <Box x={53} y={72.2} z={5.4} w={7} d={5.6} h={4.6} c="#ffc857" />
          <Box x={59.6} y={72.6} z={5.4} w={2} d={4.8} h={3.4} c="#2b2260" />
          <Cyl x={55} y={78.6} z={1.4} r={1.6} h={1.4} c="#2b2260" />
          <Cyl x={60.4} y={78.6} z={1.4} r={1.6} h={1.4} c="#2b2260" />
        </g>
        <g>
          <Box x={20} y={64} z={1.4} w={11} d={5.4} h={3.4} c={PAL.sky} />
          <Box x={22} y={64.3} z={4.8} w={6.4} d={4.8} h={2.6} c="#dff6ff" />
          <Cyl x={22.4} y={69.8} z={1.4} r={1.5} h={1.3} c="#2b2260" />
          <Cyl x={28.6} y={69.8} z={1.4} r={1.5} h={1.3} c="#2b2260" />
        </g>
      </g>
    ),
  };
}

/* ---------------- Hussain Sagar boat ---------------- */
function Buddha() {
  // sprite, base centre at (0,0), up = -y
  return (
    <g>
      <ellipse cx="0" cy="0" rx="8" ry="3.4" fill="#cfc4a6" />
      <path d="M-5.4 -2 C-6.6 -9 -4.6 -17 -3.6 -22 L3.6 -22 C4.6 -17 6.6 -9 5.4 -2Z" fill="#f4ecd8" />
      <path d="M0 -2 L5.4 -2 C6.6 -9 4.6 -17 3.6 -22 L0 -22Z" fill="#d6c9ac" />
      <path d="M-3.4 -21 Q-9 -16 -8.4 -10 L-6.6 -10 Q-6.8 -15 -2.4 -19Z" fill="#f4ecd8" />
      <path d="M3.4 -21 Q8.6 -22 9.6 -28 L7.8 -28.6 Q6.6 -24 2.6 -22Z" fill="#d6c9ac" />
      <circle cx="0" cy="-26" r="3.6" fill="#f4ecd8" />
      <path d="M0 -26 m0 -3.6 a3.6 3.6 0 0 1 0 7.2z" fill="#d6c9ac" />
      <circle cx="0" cy="-30.6" r="1.7" fill="#f4ecd8" />
      <path d="M-1 -26.4 q1 .8 2 0" fill="none" stroke="#9c8a68" strokeWidth=".5" strokeLinecap="round" />
    </g>
  );
}

function Sailboat() {
  return (
    <g>
      {/* wake */}
      <Disc x={12} y={0} z={0} r={16} c="none" stroke="#ffffff" sw={1} o={0.5} />
      <Disc x={12} y={0} z={0} r={22} c="none" stroke="#ffffff" sw={0.8} o={0.28} />
      <Box x={0} y={-4} z={0} w={22} d={8} h={4} c="#fff7e6" t={{ top: '#ffffff', left: '#fff7e6', right: '#d8cfe8' }} />
      <Box x={0} y={-4} z={0} w={22} d={8} h={1.6} c="#3a2f8c" t={{ top: '#3a2f8c', left: '#3a2f8c', right: '#2a2060' }} />
      <Poly pts={[pt(22, -4, 4), pt(29, 0, 4), pt(22, 4, 4)]} c="#ffffff" />
      <Poly pts={[pt(22, 4, 1.6), pt(29, 0, 1.6), pt(29, 0, 4), pt(22, 4, 4)]} c="#fff7e6" />
      <Poly pts={[pt(22, 4, 0), pt(29, 0, 0), pt(29, 0, 1.6), pt(22, 4, 1.6)]} c="#3a2f8c" />
      <Cyl x={11} y={0} z={4} r={0.7} h={36} c="#8a5a3c" />
      <Face p="L" at={0}>
        <polygon points="10.2,38 10.2,8.2 -1,8.2" fill="#ffffff" />
        <polygon points="10.2,38 10.2,8.2 4,8.2" fill="#e9e1f7" />
        <polygon points="12,34 12,8.4 27,8.4" fill={PAL.saffron} />
        <polygon points="12,34 12,8.4 18,8.4" fill="#ff9d57" />
      </Face>
      <polygon points={`${pt(11, 0, 40)[0]},${pt(11, 0, 40)[1]} ${pt(11, 0, 40)[0] + 6},${pt(11, 0, 40)[1] + 1.8} ${pt(11, 0, 40)[0]},${pt(11, 0, 40)[1] + 3.6}`} fill={PAL.rose} />
    </g>
  );
}

export function Boat() {
  const wave = (x, y, k) => {
    const [cx, cy] = pt(x, y);
    return <path key={k} d={`M${cx - 5} ${cy}q2.5 -2 5 0t5 0`} fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity=".6" />;
  };
  const [bx, by] = pt(66, 32, 15);
  return {
    top: '#6fcf7a',
    node: (
      <g>
        <Pad x={6} y={6} w={84} d={84} c="#2aa7c0" r={9} />
        <Pad x={8} y={8} w={80} d={80} c="#37c5d6" r={8} />
        <Pad x={12} y={12} w={72} d={72} c="#4ad3e0" r={8} o=".55" />
        {wave(30, 22, 1)}{wave(56, 14, 2)}{wave(20, 50, 3)}{wave(78, 52, 4)}{wave(48, 74, 5)}{wave(70, 74, 6)}{wave(34, 82, 7)}
        {/* Buddha island */}
        <Disc x={66} y={32} r={17} c="#a28f6c" />
        <Cyl x={66} y={32} r={15} h={4} c="#b9a782" />
        <Cyl x={66} y={32} z={4} r={10} h={3} c="#c9b894" />
        <Cyl x={66} y={32} z={7} r={5.6} h={8} c="#e2d6bc" />
        <Cyl x={66} y={32} z={15} r={6.4} h={1.6} c="#f4ecd8" />
        <g transform={`translate(${bx} ${by - 1.6})`}><Buddha /></g>
        <Bush x={58} y={40} z={4} s={0.7} c="#5fd08a" />
        <Bush x={74} y={42} z={4} s={0.6} c="#5fd08a" />
        {/* sailboat */}
        <g transform={`translate(${pt(24, 58, 0)[0]} ${pt(24, 58, 0)[1]})`}>
          <g transform="translate(-0 0)"><SailboatShift /></g>
        </g>
        {/* shore trees */}
        <Tree x={4} y={90} s={1} />
        <Tree x={90} y={90} s={1} c={PAL.grass} />
        <Tree x={90} y={4} s={0.9} />
        <Tree x={4} y={4} s={0.9} c={PAL.grass} />
      </g>
    ),
  };
}
function SailboatShift() {
  // sailboat authored at world (0,0) -> shift so the hull centre sits at origin
  return <g transform={`translate(${-pt(11, 0, 0)[0]} ${-pt(11, 0, 0)[1]})`}><Sailboat /></g>;
}

/* ---------------- Airport ---------------- */
function Airplane() {
  const lineA = pt(28, 48, 9), lineB = pt(78, 48, 9);
  const tailA = pt(18, 48, 11.5), tailB = pt(32, 48, 10);
  const win = [pt(36, 50.2, 9.8), pt(70, 50.2, 9.8)];
  const poly = (a) => a.map((p) => pt(p[0], p[1], p[2])).map((p) => p.join(',')).join(' ');
  const WZ = 8;
  return (
    <g>
      {/* shadow */}
      <ellipse cx={pt(52, 48)[0] + 2} cy={pt(52, 48)[1] + 4} rx="38" ry="7" fill="#1b1340" opacity=".25" transform={`rotate(26.6 ${pt(52, 48)[0]} ${pt(52, 48)[1]})`} />
      {/* back stabiliser + back wing */}
      <polygon points={poly([[31, 47, 11.5], [26, 47, 11.5], [20, 37, 11.5], [25, 37, 11.5]])} fill="#c9cfee" />
      <polygon points={poly([[62, 46, WZ - 1.4], [48, 46, WZ - 1.4], [36, 13, WZ - 1.4], [44, 13, WZ - 1.4]])} fill="#8f98c9" />
      <polygon points={poly([[62, 46, WZ], [48, 46, WZ], [36, 13, WZ], [44, 13, WZ]])} fill="#e6e9fb" />
      {/* tail cone + fuselage */}
      <line x1={tailA[0]} y1={tailA[1]} x2={tailB[0]} y2={tailB[1]} stroke="#8f98c9" strokeWidth="5" strokeLinecap="round" />
      <line x1={lineA[0]} y1={lineA[1] + 1.2} x2={lineB[0]} y2={lineB[1] + 1.2} stroke="#6c63c9" strokeWidth="11.5" strokeLinecap="round" />
      <line x1={lineA[0]} y1={lineA[1]} x2={lineB[0]} y2={lineB[1]} stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
      <line x1={lineA[0] + 2} y1={lineA[1] - 2.2} x2={lineB[0] - 4} y2={lineB[1] - 2.2} stroke="#f1f3ff" strokeWidth="3" strokeLinecap="round" />
      <line x1={win[0][0]} y1={win[0][1]} x2={win[1][0]} y2={win[1][1]} stroke="#3a2f8c" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.1 2.9" />
      <line x1={pt(30, 50.6, 5.2)[0]} y1={pt(30, 50.6, 5.2)[1]} x2={pt(70, 50.6, 5.2)[0]} y2={pt(70, 50.6, 5.2)[1]} stroke={PAL.saffron} strokeWidth="1.5" strokeLinecap="round" />
      {/* cockpit */}
      <polygon points={`${pt(74, 50.2, 11)[0]},${pt(74, 50.2, 11)[1]} ${pt(79, 49, 11)[0]},${pt(79, 49, 11)[1]} ${pt(79, 48.4, 8.4)[0]},${pt(79, 48.4, 8.4)[1]} ${pt(74, 50.2, 8.4)[0]},${pt(74, 50.2, 8.4)[1]}`} fill="#3a2f8c" />
      {/* tail fin */}
      <Face p="L" at={50.5}>
        <polygon points="30,11 24.5,27 32.4,27 41,11" fill={PAL.saffron} />
        <polygon points="36.6,11 31,22.6 28.6,22.6 33.8,11" fill="#ffd8a8" opacity=".5" />
        <polygon points="30,11 28.4,14.6 38.4,14.6 41,11" fill="#3a2f8c" />
      </Face>
      {/* front stabiliser */}
      <polygon points={poly([[31, 49, 11.5], [26, 49, 11.5], [20, 59, 11.5], [25, 59, 11.5]])} fill="#f1f3ff" />
      {/* front wing + engine */}
      <polygon points={poly([[62, 50, WZ - 1.4], [48, 50, WZ - 1.4], [36, 83, WZ - 1.4], [44, 83, WZ - 1.4]])} fill="#8f98c9" />
      <polygon points={poly([[62, 50, WZ], [48, 50, WZ], [36, 83, WZ], [44, 83, WZ]])} fill="#ffffff" />
      <polygon points={poly([[44, 80, WZ], [37, 80, WZ], [36, 83, WZ], [44, 83, WZ]])} fill={PAL.saffron} />
      <line x1={pt(47, 66, 5)[0]} y1={pt(47, 66, 5)[1]} x2={pt(55, 66, 5)[0]} y2={pt(55, 66, 5)[1]} stroke="#8f98c9" strokeWidth="6.2" strokeLinecap="round" />
      <line x1={pt(47, 66, 5.6)[0]} y1={pt(47, 66, 5.6)[1]} x2={pt(54, 66, 5.6)[0]} y2={pt(54, 66, 5.6)[1]} stroke="#e6e9fb" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx={pt(56, 66, 5)[0]} cy={pt(56, 66, 5)[1]} rx="1.6" ry="2.4" fill="#3a2f8c" transform={`rotate(-20 ${pt(56, 66, 5)[0]} ${pt(56, 66, 5)[1]})`} />
    </g>
  );
}

export function Plane() {
  const dashes = [];
  for (let i = 0; i < 7; i++) dashes.push(<Pad key={i} x={8 + i * 13} y={47.3} w={7} d={1.4} c="#fff7e6" />);
  const bars = [];
  for (let i = 0; i < 5; i++) {
    bars.push(<Pad key={'a' + i} x={4} y={38 + i * 4.4} w={7} d={2} c="#fff7e6" o=".85" />);
    bars.push(<Pad key={'b' + i} x={85} y={38 + i * 4.4} w={7} d={2} c="#fff7e6" o=".85" />);
  }
  return {
    top: '#6a62b4',
    node: (
      <g>
        <Grass x={6} y={6} w={84} d={22} />
        <Grass x={6} y={72} w={84} d={18} />
        <Pad x={2} y={32} w={92} d={32} c="#3f3875" r={3} />
        <Pad x={2} y={32} w={92} d={1.3} c="#fff7e6" o=".6" />
        <Pad x={2} y={62.7} w={92} d={1.3} c="#fff7e6" o=".6" />
        {dashes}
        {bars}
        {/* control tower */}
        <g>
          <Cyl x={20} y={16} r={3.4} h={26} c="#f6efe0" />
          <Cyl x={20} y={16} z={26} r={6.6} h={2} c="#d8c9a8" />
          <Cyl x={20} y={16} z={28} r={5.6} h={6.4} c="#4ac3dc" t={{ top: '#d9f6ff', left: '#6dd4ea', right: '#2a94b8' }} />
          <Cyl x={20} y={16} z={34.4} r={6.6} h={1.8} c="#d8c9a8" />
          <Cone x={20} y={16} z={36.2} r={5.4} h={5.4} c={PAL.saffron} />
          <Cyl x={20} y={16} z={41.6} r={0.5} h={7} c="#c8c0e6" />
        </g>
        <Tree x={84} y={14} s={1} />
        <Bush x={60} y={16} s={1.1} />
        <Tree x={10} y={84} s={0.9} c={PAL.grass} />
        <Bush x={78} y={82} s={1} />
        <Airplane />
        {/* runway cones */}
        {[16, 80].map((x) => (
          <Cone key={x} x={x} y={29} r={1.8} h={4.2} c={PAL.saffron} />
        ))}
      </g>
    ),
  };
}

/* ---------------- Electricity ---------------- */
function Pylon({ x, y, s = 1 }) {
  const [cx, cy] = pt(x, y);
  const st = '#8d93c4';
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`} stroke={st} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <ellipse cx="0" cy="1" rx="12" ry="5" fill="#1b1340" opacity=".2" stroke="none" />
      <path d="M-10 0L-3 -52M10 0L3 -52" />
      <path d="M-10 0L7 -17L-7 -33L4 -45M10 0L-7 -17L7 -33L-4 -45" strokeWidth="1" />
      <path d="M-8 -14H8M-5.6 -30H5.6" strokeWidth="1" />
      <path d="M-3 -52H3" />
      <path d="M-18 -50H18M-14 -40H14" strokeWidth="1.8" />
      <path d="M-3 -52L-18 -50M3 -52L18 -50M-3 -52L0 -58L3 -52" strokeWidth="1" />
      <g fill="#cfd6ff" stroke="none">
        <rect x="-18.8" y="-49" width="1.8" height="4" rx=".8" />
        <rect x="17" y="-49" width="1.8" height="4" rx=".8" />
        <rect x="-14.8" y="-39" width="1.8" height="4" rx=".8" />
        <rect x="13" y="-39" width="1.8" height="4" rx=".8" />
      </g>
    </g>
  );
}

export function Bulb({ gid }) {
  const [bx, by] = pt(48, 48, 28);
  const sx = pt(76, 22);
  const px = pt(20, 22);
  const wire = (a, b, k, sag = 8) => <path key={k} d={`M${a[0]} ${a[1]}Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + sag} ${b[0]} ${b[1]}`} fill="none" stroke="#6d73a8" strokeWidth=".9" />;
  return {
    top: '#6a62b4',
    node: (
      <g>
        <defs>
          <radialGradient id={gid + 'g'} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff3b0" stopOpacity=".95" />
            <stop offset=".45" stopColor="#ffd34e" stopOpacity=".45" />
            <stop offset="1" stopColor="#ffb100" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Pad x={6} y={6} w={84} d={84} c="#7d76c4" r={6} />
        <Grass x={8} y={62} w={22} d={26} />
        <Grass x={66} y={64} w={22} d={24} />
        <Pylon x={20} y={22} s={1.12} />
        <Pylon x={76} y={22} s={0.98} />
        {wire([px[0] - 20, px[1] - 56], [sx[0] - 18, sx[1] - 49], 'w1', 9)}
        {wire([px[0] + 20, px[1] - 56], [sx[0] + 17, sx[1] - 49], 'w2', 9)}
        {wire([px[0] - 15, px[1] - 45], [sx[0] - 14, sx[1] - 39], 'w3', 7)}
        {wire([px[0] + 15, px[1] - 45], [sx[0] + 14, sx[1] - 39], 'w4', 7)}
        {/* substation pad with transformers */}
        <Box x={64} y={44} w={22} d={20} h={2} c="#cfc7e8" />
        <Box x={67} y={47} z={2} w={7} d={6} h={7} c="#6dd4ea" />
        <Cyl x={69} y={49} z={9} r={1} h={3} c="#f1ecff" />
        <Cyl x={72} y={49} z={9} r={1} h={3} c="#f1ecff" />
        <Box x={67} y={55} z={2} w={7} d={6} h={7} c="#6dd4ea" />
        <Cyl x={69} y={57} z={9} r={1} h={3} c="#f1ecff" />
        <Cyl x={72} y={57} z={9} r={1} h={3} c="#f1ecff" />
        <Box x={77} y={47} z={2} w={5} d={12} h={9} c="#a79fe0" />
        {/* pedestal */}
        <Shade x={46} y={48} rx={26} o={0.18} />
        <Box x={36} y={38} w={20} d={20} h={12} c="#4a3fb0" />
        <Face p="L" at={58}>
          <polygon points="46,9 41.4,4.6 45,4.6 43.6,1.6 49.6,6.4 46,6.4 47.6,9" fill={PAL.gold} />
        </Face>
        <Box x={34} y={36} z={12} w={24} d={24} h={2.6} c="#6a5fd6" />
        {/* bulb sprite */}
        <g transform={`translate(${bx} ${by})`}>
          <circle cx="0" cy="-8" r="44" fill={`url(#${gid}g)`} />
          <g stroke={PAL.gold} strokeWidth="2.2" strokeLinecap="round">
            <path d="M-34 -28L-28 -23M34 -28L28 -23M0 -50V-44M-44 -6H-37M44 -6H37M-26 -44L-22 -39M26 -44L22 -39" />
          </g>
          <rect x="-6.6" y="14" width="13.2" height="3.4" rx="1" fill="#8d93c4" />
          <rect x="-6.6" y="17.4" width="13.2" height="3.4" rx="1" fill="#6d73a8" />
          <rect x="-5" y="20.8" width="10" height="3" rx="1.4" fill="#4b4585" />
          <path d="M-9 8L9 8L7 14.6L-7 14.6Z" fill="#ffd34e" />
          <circle cx="0" cy="-8" r="19.5" fill="#ffd34e" />
          <circle cx="-2" cy="-10" r="16" fill="#ffe27a" />
          <circle cx="-3.4" cy="-11" r="11" fill="#fff3b8" />
          <path d="M-5 8.4V-1L-2.4 -4.4L0 0L2.4 -4.4L5 -1V8.4" fill="none" stroke={PAL.saffron} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-13 -16Q-11.4 -22 -6 -25" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
          <path d="M8.6 -2Q16.6 -8 16.4 -16" fill="none" stroke="#f0a91b" strokeWidth="2" strokeLinecap="round" opacity=".5" />
        </g>
        <Tree x={12} y={72} s={1} />
        <Bush x={80} y={80} s={1} />
        <Bush x={34} y={74} s={0.9} />
      </g>
    ),
  };
}
