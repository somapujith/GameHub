// Covers + icons for the placeholder "coming soon" games: ludo-lanes, carrom-club, tambola-night, word-rush,
// plus a generic mystery box for any other id. Same isometric family as the Tycoon cover, each with its own vivid palette.
// All covers are 800x450 with the left third kept calm for overlaid text.
import { memo } from 'react';
import { Slab, Pad, Box, Cyl, Disc, Poly, Face, Shade, Letters, pt } from '../iso.jsx';
import { lighten, darken, CoverSvg, IconSvg, Pawn, Die, Sparkle, Num, Float, Floor, FloorDefs, rng, f, useUid, COVER_CSS } from './kit.jsx';

/* ---------- shared backdrop: gradient, sunburst, glow, bokeh, calm-left shade ---------- */
function Backdrop({ u, c0, c1, c2, cx = 560, cy = 230, ray = '#fff', seed = 3, vw = 800, vh = 450, calm = true }) {
  const rand = rng(seed);
  let rays = '';
  const n = 14, R = 900;
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
    rays += `M${cx} ${cy}L${f(cx + R * Math.cos(a0))} ${f(cy + R * Math.sin(a0))}L${f(cx + R * Math.cos(a1))} ${f(cy + R * Math.sin(a1))}Z`;
  }
  const bokeh = [];
  for (let i = 0; i < 16; i++) {
    const r = 5 + rand() * 20;
    bokeh.push(<circle key={i} cx={Math.round(rand() * vw)} cy={Math.round(rand() * vh)} r={f(r)} fill={ray} opacity={f(0.05 + rand() * 0.09)} />);
  }
  return (
    <>
      <defs>
        <linearGradient id={u + 'bg'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c0} />
          <stop offset=".55" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
        <radialGradient id={u + 'gl'} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={ray} stopOpacity=".55" />
          <stop offset="1" stopColor={ray} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={u + 'cm'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(c0, 0.5)} stopOpacity=".5" />
          <stop offset="1" stopColor={darken(c0, 0.5)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <FloorDefs uid={u} />
      <rect width={vw} height={vh} fill={`url(#${u}bg)`} />
      <path d={rays} fill={ray} opacity=".06" />
      <ellipse cx={cx} cy={cy} rx="330" ry="250" fill={`url(#${u}gl)`} opacity=".7" />
      {bokeh}
      {calm && <rect width="400" height={vh} fill={`url(#${u}cm)`} />}
    </>
  );
}

const ISO = { strokeWidth: '.6', strokeLinejoin: 'round' };

/* ============================== LUDO ============================== */
const LUDO = { red: '#ff4d6d', green: '#34d399', yellow: '#ffd23f', blue: '#3a8bff' };
const CELL = 9;

function LudoBoard({ detail = true, pawns = true }) {
  const N = CELL * 15;
  const homes = [
    [0, 0, LUDO.red], [9, 0, LUDO.green], [0, 9, LUDO.blue], [9, 9, LUDO.yellow],
  ];
  const inHome = (i, j) => (i < 6 || i >= 9) && (j < 6 || j >= 9);
  const colour = (i, j) => {
    if (i === 7 && j >= 1 && j <= 5) return LUDO.red;
    if (j === 7 && i >= 9 && i <= 13) return LUDO.green;
    if (i === 7 && j >= 9 && j <= 13) return LUDO.yellow;
    if (j === 7 && i >= 1 && i <= 5) return LUDO.blue;
    if (i === 8 && j === 1) return LUDO.red;
    if (i === 13 && j === 8) return LUDO.green;
    if (i === 6 && j === 13) return LUDO.yellow;
    if (i === 1 && j === 6) return LUDO.blue;
    return '#ffffff';
  };
  const cells = [];
  if (detail) {
    for (let i = 0; i < 15; i++) {
      for (let j = 0; j < 15; j++) {
        if (inHome(i, j) || (i >= 6 && i < 9 && j >= 6 && j < 9)) continue;
        cells.push(<Pad key={i + '-' + j} x={i * CELL + 0.6} y={j * CELL + 0.6} w={CELL - 1.2} d={CELL - 1.2} c={colour(i, j)} r={1.3} />);
      }
    }
  }
  const spot = (x0, y0, k) => [x0 * CELL + (k % 2 ? 36.5 : 17.5), y0 * CELL + (k > 1 ? 36.5 : 17.5)];
  const c = 7.5 * CELL, a = 6 * CELL, b = 9 * CELL;
  const order = [];
  homes.forEach(([x0, y0, col]) => [0, 3].forEach((k) => order.push([...spot(x0, y0, k), col])));
  order.push([8.5 * CELL, 3.5 * CELL, LUDO.red]);
  order.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  return (
    <g {...ISO}>
      <Slab w={N} d={N} t={15} r={10} top="#fff7e6" left="#c4b8e8" right="#8b7fc4">
        {homes.map(([x0, y0, col]) => (
          <g key={col}>
            <Pad x={x0 * CELL} y={y0 * CELL} w={6 * CELL} d={6 * CELL} c={col} r={6} />
            <Pad x={x0 * CELL + 8} y={y0 * CELL + 8} w={38} d={38} c={lighten(col, 0.74)} r={5} />
            {[0, 1, 2, 3].map((k) => {
              const [sx, sy] = spot(x0, y0, k);
              return <Disc key={k} x={sx} y={sy} r={6} c={col} />;
            })}
          </g>
        ))}
        {cells}
        <Poly pts={[pt(a, a), pt(b, a), pt(c, c)]} c={LUDO.red} />
        <Poly pts={[pt(b, a), pt(b, b), pt(c, c)]} c={LUDO.green} />
        <Poly pts={[pt(a, b), pt(b, b), pt(c, c)]} c={LUDO.yellow} />
        <Poly pts={[pt(a, a), pt(a, b), pt(c, c)]} c={LUDO.blue} />
        {pawns && order.map(([x, y, col], i) => { const [sx, sy] = pt(x, y); return <Pawn key={i} x={sx} y={sy + 1} s={0.92} c={col} />; })}
      </Slab>
    </g>
  );
}

function LudoCover({ u }) {
  return (
    <>
      <Backdrop u={u} c0="#0b1f6e" c1="#2559e0" c2="#3cc0ff" cx={575} cy={230} ray="#bfe6ff" seed={4} />
      <g transform="translate(578 104) scale(1.62)"><LudoBoard /></g>
      <Floor uid={u} cx={580} cy={372} rx={260} ry={46} />
      <g transform="translate(690 360)"><Die s={34} top={6} left={4} right={2} /></g>
      <Sparkle x={420} y={118} s={9} c="#fff" cls="hub-tw" />
      <Sparkle x={742} y={96} s={7} c="#ffe9a8" cls="hub-tw" />
      <Sparkle x={380} y={330} s={6} c="#fff" cls="hub-tw" />
      <Sparkle x={780} y={300} s={8} c="#fff" cls="hub-tw" />
      <g className="hub-bob"><circle cx="452" cy="236" r="9" fill={LUDO.yellow} /><circle cx="449" cy="233" r="3" fill="#fff" opacity=".6" /></g>
      <g className="hub-bob2"><circle cx="410" cy="190" r="6" fill={LUDO.red} /><circle cx="408" cy="188" r="2" fill="#fff" opacity=".6" /></g>
      <g className="hub-bob2"><circle cx="772" cy="400" r="8" fill={LUDO.green} /><circle cx="770" cy="398" r="2.6" fill="#fff" opacity=".6" /></g>
    </>
  );
}

/* ============================== CARROM ============================== */
function CarromBoard({ detail = true, striker = true }) {
  const N = 140;
  const coins = [];
  const cx = 70, cy = 70;
  coins.push([cx, cy, '#ff4d6d']);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; coins.push([cx + 11.4 * Math.cos(a), cy + 11.4 * Math.sin(a), i % 2 ? '#2b2440' : '#fff7e6']); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.26; coins.push([cx + 21.2 * Math.cos(a), cy + 21.2 * Math.sin(a), i % 2 ? '#fff7e6' : '#2b2440']); }
  coins.sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  const line = (x, y, w, d, key) => <rect key={key} x={x} y={y} width={w} height={d} rx={Math.min(w, d) / 2} fill="none" stroke="#b5702c" strokeWidth="1.1" />;
  return (
    <g {...ISO}>
      <Slab w={N} d={N} t={16} r={10} top="#8c4b22" left="#5c2f14" right="#3e1f0c">
        <Pad x={9} y={9} w={N - 18} d={N - 18} c="#a0602d" r={6} />
        <Pad x={11} y={11} w={N - 22} d={N - 22} c="#f6e4b8" r={5} />
        {[[17, 17], [N - 17, 17], [17, N - 17], [N - 17, N - 17]].map(([x, y], i) => (
          <g key={i}><Disc x={x} y={y} r={8.6} c="#5c2f14" /><Disc x={x} y={y} r={7.2} c="#1f1230" /></g>
        ))}
        {detail && (
          <Face p="T" at={0.1}>
            {line(30, 22, 80, 9, 'a')}{line(30, N - 31, 80, 9, 'b')}{line(22, 30, 9, 80, 'c')}{line(N - 31, 30, 9, 80, 'd')}
            {[[30, 26.5], [110, 26.5], [30, N - 26.5], [110, N - 26.5], [26.5, 30], [26.5, 110], [N - 26.5, 30], [N - 26.5, 110]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.2" fill="#d94a3a" />)}
            <circle cx="70" cy="70" r="27" fill="none" stroke="#d94a3a" strokeWidth="1.6" />
            <circle cx="70" cy="70" r="22" fill="none" stroke="#2b2440" strokeWidth="1" />
            <circle cx="70" cy="70" r="5" fill="none" stroke="#d94a3a" strokeWidth="1" />
            <path d="M22 22L36 36M118 22L104 36M22 118L36 104M118 118L104 104" stroke="#d94a3a" strokeWidth="1.4" strokeLinecap="round" />
            {striker && <path d="M96 112C92 98 82 86 74 78" fill="none" stroke="#fff" strokeWidth="1.8" strokeDasharray="1 4.4" strokeLinecap="round" />}
          </Face>
        )}
        {coins.map(([x, y, c], i) => (
          <g key={i}>
            <Cyl x={x} y={y} z={0} r={5} h={3} c={c} />
            <Disc x={x} y={y} z={3} r={3} c="none" stroke={c === '#fff7e6' ? '#d9c79b' : c === '#ff4d6d' ? '#ffd0d8' : '#6a5f94'} sw="0.5" />
          </g>
        ))}
        {striker && (
          <g>
            <Shade x={100} y={116} rx={16} />
            <Cyl x={100} y={116} z={0} r={8.8} h={4} c="#2ec4b6" />
            <Disc x={100} y={116} z={4} r={6.4} c="#9bf3e6" />
            <Disc x={100} y={116} z={4} r={3} c="#2ec4b6" />
          </g>
        )}
      </Slab>
    </g>
  );
}

function CarromCover({ u }) {
  return (
    <>
      <Backdrop u={u} c0="#052e36" c1="#0b7a66" c2="#3be0a0" cx={575} cy={230} ray="#b9ffe0" seed={8} />
      <g transform="translate(578 112) scale(1.6)"><CarromBoard /></g>
      <Floor uid={u} cx={580} cy={376} rx={270} ry={48} />
      <g {...ISO} transform="translate(716 384) scale(1.5)">
        <Shade x={0} y={0} rx={13} />
        <Cyl x={0} y={0} z={0} r={7} h={3} c="#fff7e6" /><Cyl x={0} y={0} z={3} r={7} h={3} c="#2b2440" /><Cyl x={0} y={0} z={6} r={7} h={3} c="#fff7e6" /><Cyl x={0} y={0} z={9} r={7} h={3} c="#ff4d6d" />
      </g>
      <g {...ISO} transform="translate(420 386) scale(1.5)"><Shade x={0} y={0} rx={13} /><Cyl x={0} y={0} z={0} r={7} h={3} c="#2b2440" /><Cyl x={0} y={0} z={3} r={7} h={3} c="#fff7e6" /></g>
      <Sparkle x={430} y={120} s={9} c="#fff" cls="hub-tw" />
      <Sparkle x={760} y={110} s={7} c="#d8ffe9" cls="hub-tw" />
      <Sparkle x={776} y={310} s={8} c="#fff" cls="hub-tw" />
      <Sparkle x={360} y={290} s={5} c="#d8ffe9" cls="hub-tw" />
    </>
  );
}

/* ============================== TAMBOLA ============================== */
const TICKET = [
  [4, 0, 23, 0, 46, 0, 61, 0, 85],
  [0, 12, 0, 34, 0, 55, 0, 72, 88],
  [9, 0, 28, 0, 49, 0, 67, 79, 0],
];
const MARKED = new Set([23, 55, 49, 79, 12]);

function Ticket({ u, detail = true }) {
  const cw = 30.6, ch = 37;
  const x0 = -138, y0 = -50;
  const out = [];
  TICKET.forEach((row, r) => row.forEach((n, c) => {
    const x = x0 + c * cw, y = y0 + r * ch;
    if (!n) {
      out.push(<rect key={r + '-' + c} x={x + 1} y={y + 1} width={cw - 2} height={ch - 2} rx="4" fill="#e9defd" />);
      return;
    }
    const m = MARKED.has(n);
    out.push(
      <g key={r + '-' + c}>
        <rect x={x + 1} y={y + 1} width={cw - 2} height={ch - 2} rx="4" fill="#fff" stroke="#e3d8fb" strokeWidth="1" />
        {m && <circle cx={x + cw / 2} cy={y + ch / 2} r="13.4" fill="#ff4da6" />}
        {m && <circle cx={x + cw / 2 - 4} cy={y + ch / 2 - 5} r="3" fill="#fff" opacity=".4" />}
        <Num text={n} x={x + cw / 2} y={y + ch / 2} h={detail ? 15 : 17} color={m ? '#fff' : '#2a1b6e'} sw={2.6} />
      </g>,
    );
  }));
  const lights = [];
  for (let i = 0; i < 15; i++) lights.push(<circle key={i} cx={-132 + i * 18.9} cy={-72} r="3.3" fill={['#fff3c4', '#ffd23f', '#fff'][i % 3]} opacity=".95" />);
  return (
    <g>
      <rect x="-142" y="-78" width="300" height="176" rx="18" fill="#12062e" opacity=".3" />
      <rect x="-150" y="-88" width="300" height="176" rx="18" fill="#fff7e6" />
      <path d="M-150 -70A18 18 0 0 1 -132 -88H132A18 18 0 0 1 150 -70V-56H-150Z" fill={`url(#${u}hd)`} />
      {lights}
      <rect x="-146" y="-84" width="292" height="168" rx="15" fill="none" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1.5" />
      {out}
      <path d="M-138 80H138" stroke="#e3d8fb" strokeWidth="1.6" strokeDasharray="1 7" strokeLinecap="round" />
    </g>
  );
}

function Ball({ u, k, x, y, r, c, n, dark }) {
  return (
    <g>
      <defs>
        <radialGradient id={u + 'bl' + k} cx=".34" cy=".28" r=".85">
          <stop offset="0" stopColor={lighten(c, 0.55)} />
          <stop offset=".45" stopColor={c} />
          <stop offset="1" stopColor={darken(c, 0.4)} />
        </radialGradient>
      </defs>
      <ellipse cx={x + r * 0.2} cy={y + r * 1.15} rx={r * 0.9} ry={r * 0.28} fill="#10052e" opacity=".3" />
      <circle cx={x} cy={y} r={r} fill={`url(#${u}bl${k})`} />
      <circle cx={x} cy={y} r={r * 0.56} fill="#fff7e6" />
      <Num text={n} x={x} y={y + 0.4} h={r * 0.56} color={dark || '#2a1b6e'} sw={Math.max(1.4, r * 0.1)} />
      <ellipse cx={x - r * 0.42} cy={y - r * 0.62} rx={r * 0.26} ry={r * 0.14} transform={`rotate(-34 ${x - r * 0.42} ${y - r * 0.62})`} fill="#fff" opacity=".7" />
    </g>
  );
}

function TambolaCover({ u }) {
  const rand = rng(21);
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push(<circle key={i} className={i % 5 === 0 ? 'hub-tw' : undefined} cx={Math.round(rand() * 800)} cy={Math.round(rand() * 300)} r={f(0.6 + rand() * 1.4)} fill="#fff" opacity={f(0.4 + rand() * 0.5)} style={i % 5 === 0 ? { animationDelay: `-${f(rand() * 4)}s` } : undefined} />);
  return (
    <>
      <Backdrop u={u} c0="#150a45" c1="#5a1b9c" c2="#e0409a" cx={580} cy={230} ray="#ffb3e6" seed={6} />
      <g>{stars}</g>
      <defs>
        <linearGradient id={u + 'hd'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff4da6" /><stop offset=".5" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ffc857" />
        </linearGradient>
      </defs>
      <g transform="translate(588 232) rotate(-7)"><Ticket u={u} /></g>
      <Ball u={u} k={0} x={470} y={118} r={28} c="#ff5d73" n={17} />
      <Ball u={u} k={1} x={738} y={96} r={24} c="#2ec4b6" n={42} />
      <Ball u={u} k={2} x={736} y={376} r={31} c="#ffc857" n={63} />
      <Ball u={u} k={3} x={452} y={346} r={25} c="#4cc9f0" n={8} />
      <Ball u={u} k={4} x={650} y={58} r={16} c="#8de05a" n={90} dark="#1d4a10" />
      <Sparkle x={400} y={210} s={7} c="#fff" cls="hub-tw" />
      <Sparkle x={786} y={226} s={8} c="#ffe9f6" cls="hub-tw" />
      <Sparkle x={560} y={398} s={7} c="#fff3c4" cls="hub-tw" />
    </>
  );
}

/* ============================== WORD RUSH ============================== */
function Tile({ x, y, z, ch, c = '#fff3dc' }) {
  const T = 30;
  return (
    <g>
      <Shade x={x + T / 2} y={y + T / 2} rx={24} o={z ? 0.18 : 0.26} />
      <Box x={x} y={y} z={z} w={T} d={T} h={9} t={{ top: c, left: darken(c, 0.14), right: darken(c, 0.34) }} />
      <Face p="T" at={z + 9}>
        <Letters text={ch} u={x + 9.4} v={y + 24.4} s={1.85} color="#4a123f" sw={3.6} flip />
        <circle cx={x + 25} cy={y + 5.4} r="1.6" fill="#ff8a3d" />
      </Face>
    </g>
  );
}

function WordTiles({ lift = [0, 12, 4, 16], cols = 4 }) {
  const word = 'RUSH';
  return (
    <g {...ISO}>
      {[...word].map((ch, i) => (
        <Tile key={i} x={(i % cols) * 36} y={Math.floor(i / cols) * 36} z={lift[i]} ch={ch} c={['#fff3dc', '#fff3dc', '#fff3dc', '#ffe9a8'][i]} />
      ))}
    </g>
  );
}

function WordCover({ u }) {
  const streaks = [];
  const rand = rng(33);
  for (let i = 0; i < 9; i++) {
    const y = 120 + rand() * 230, x = 380 + rand() * 180, w = 50 + rand() * 120;
    streaks.push(<rect key={i} x={f(x)} y={f(y)} width={f(w)} height={f(2 + rand() * 3)} rx="2" fill="#fff" opacity={f(0.1 + rand() * 0.18)} />);
  }
  return (
    <>
      <Backdrop u={u} c0="#a3173a" c1="#ee5a2a" c2="#ffc23d" cx={590} cy={225} ray="#ffe2a8" seed={14} />
      {streaks}
      <g transform="translate(414 182) scale(2.4)"><WordTiles /></g>
      <Float x={742} y={96} cls="hub-bob">
        <path d="M0 -26L-17 4H-3L-8 26L17 -6H3L11 -26Z" fill="#ffd23f" stroke="#ffd23f" strokeWidth="2" strokeLinejoin="round" />
        <path d="M0 -26L-17 4H-3L-8 26L17 -6H3L11 -26Z" fill="#fff6c8" opacity=".5" transform="scale(.55) translate(2 -8)" />
      </Float>
      <Float x={420} y={372} cls="hub-bob2">
        <circle r="18" fill="#fff7e6" /><circle r="18" fill="none" stroke="#4a123f" strokeWidth="3.2" />
        <path d="M0 -10V0L7 5" fill="none" stroke="#ff4d6d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="-4" y="-25" width="8" height="5" rx="2" fill="#4a123f" />
      </Float>
      <Sparkle x={448} y={110} s={9} c="#fff" cls="hub-tw" />
      <Sparkle x={786} y={296} s={9} c="#fff3c4" cls="hub-tw" />
      <Sparkle x={380} y={256} s={6} c="#fff" cls="hub-tw" />
      <Sparkle x={690} y={404} s={7} c="#fff" cls="hub-tw" />
    </>
  );
}

/* ============================== MYSTERY ============================== */
const QMARK = 'M-5.4 -5.6Q-5.4 -11 0 -11Q5.6 -11 5.6 -5.6Q5.6 -1.8 0 0.4V4';

function MysteryBox({ s = 34 }) {
  const rib = '#ffc857';
  return (
    <g {...ISO}>
      <Box x={0} y={0} z={0} w={s} d={s} h={s} t={{ top: '#a98bff', left: '#7d5cf0', right: '#5238b8' }} />
      <Face p="T" at={s}><rect x={s / 2 - 3.4} y="0" width="6.8" height={s} fill={rib} /></Face>
      <Face p="L" at={s}>
        <rect x={s / 2 - 3.4} y="0" width="6.8" height={s} fill="#e8a21f" />
        <g transform={`translate(${s * 0.5} ${s * 0.5})`}>
          <circle r="11.6" fill="#fff7e6" /><circle r="11.6" fill="none" stroke="#5238b8" strokeWidth="1.6" />
          <g transform="scale(.96 -.96)"><path d={QMARK} fill="none" stroke="#5238b8" strokeWidth="3.2" strokeLinecap="round" transform="translate(0 1)" /><circle cx="0" cy="-8.6" r="1.8" fill="#5238b8" /></g>
        </g>
      </Face>
      <Face p="R" at={s}>
        <rect x={s / 2 - 3.4} y="0" width="6.8" height={s} fill="#c47f12" />
      </Face>
      <g transform={`translate(${pt(s / 2, s / 2, s)[0]} ${pt(s / 2, s / 2, s)[1]})`}>
        <ellipse cx="-9" cy="-4" rx="9" ry="5.6" transform="rotate(-24 -9 -4)" fill={rib} />
        <ellipse cx="9" cy="-4" rx="9" ry="5.6" transform="rotate(24 9 -4)" fill="#ffd97a" />
        <circle cx="0" cy="-1" r="3.6" fill="#e8a21f" />
      </g>
    </g>
  );
}

function MysteryCover({ u }) {
  const q = [[420, 120, 22], [760, 330, 26], [450, 340, 18], [720, 80, 16], [372, 230, 14]];
  return (
    <>
      <Backdrop u={u} c0="#13123a" c1="#3a2f8c" c2="#7c5cff" cx={585} cy={230} ray="#cfc6ff" seed={19} />
      {q.map(([x, y, s], i) => (
        <Float key={i} x={x} y={y} scale={s / 14} cls={i % 2 ? 'hub-bob' : 'hub-bob2'}>
          <g opacity=".85">
            <path d={QMARK} fill="none" stroke="#e8e2ff" strokeWidth="3" strokeLinecap="round" transform="translate(0 7)" />
            <circle cx="0" cy="11.4" r="1.7" fill="#e8e2ff" />
          </g>
        </Float>
      ))}
      <Floor uid={u} cx={585} cy={246} rx={170} ry={40} />
      <g transform="translate(585 150) scale(3.0)"><MysteryBox /></g>
      <Sparkle x={480} y={150} s={10} c="#fff" cls="hub-tw" />
      <Sparkle x={690} y={200} s={8} c="#ffe9a8" cls="hub-tw" />
      <Sparkle x={620} y={380} s={7} c="#fff" cls="hub-tw" />
    </>
  );
}

const COVERS = { 'ludo-lanes': LudoCover, 'carrom-club': CarromCover, 'tambola-night': TambolaCover, 'word-rush': WordCover };
const NAMES = { 'ludo-lanes': 'Ludo Lanes', 'carrom-club': 'Carrom Club', 'tambola-night': 'Tambola Night', 'word-rush': 'Word Rush' };

function ComingSoonCoverBase({ id, className, title, animated = true }) {
  const u = useUid();
  const C = COVERS[id] || MysteryCover;
  return (
    <CoverSvg className={className} title={title === true ? NAMES[id] || 'Mystery game' : title} css={animated ? COVER_CSS : COVER_CSS.replace(/animation:[^;}]+/g, 'animation:none')}>
      <C u={u} />
    </CoverSvg>
  );
}
export const ComingSoonCover = memo(ComingSoonCoverBase);

/* ============================== ICONS (128 square) ============================== */
function IconBg({ u, c0, c1, glow }) {
  return (
    <>
      <defs>
        <linearGradient id={u + 'ib'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c0} /><stop offset="1" stopColor={c1} /></linearGradient>
        <radialGradient id={u + 'ig'} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={glow} stopOpacity=".6" /><stop offset="1" stopColor={glow} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="128" height="128" fill={`url(#${u}ib)`} />
      <circle cx="64" cy="66" r="62" fill={`url(#${u}ig)`} />
    </>
  );
}

const ICONS = {
  'ludo-lanes': (u) => (
    <>
      <IconBg u={u} c0="#0b1f6e" c1="#3cc0ff" glow="#bfe6ff" />
      <ellipse cx="64" cy="82" rx="52" ry="12" fill="#061242" opacity=".3" />
      <g transform="translate(64 32) scale(.46)"><LudoBoard detail={false} pawns /></g>
      <Sparkle x={104} y={22} s={6} c="#fff" /><Sparkle x={20} y={100} s={4.5} c="#fff" />
    </>
  ),
  'carrom-club': (u) => (
    <>
      <IconBg u={u} c0="#052e36" c1="#3be0a0" glow="#b9ffe0" />
      <ellipse cx="64" cy="84" rx="52" ry="12" fill="#031c22" opacity=".3" />
      <g transform="translate(64 34) scale(.4)"><CarromBoard detail striker /></g>
      <Sparkle x={104} y={22} s={6} c="#fff" /><Sparkle x={20} y={100} s={4.5} c="#d8ffe9" />
    </>
  ),
  'tambola-night': (u) => (
    <>
      <IconBg u={u} c0="#150a45" c1="#e0409a" glow="#ffb3e6" />
      <defs><linearGradient id={u + 'hd'} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff4da6" /><stop offset=".5" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ffc857" /></linearGradient></defs>
      <g transform="translate(60 62) rotate(-8) scale(.33)"><Ticket u={u} detail={false} /></g>
      <Ball u={u} k={0} x={98} y={98} r={17} c="#ffc857" n={63} />
      <Ball u={u} k={1} x={26} y={30} r={12} c="#2ec4b6" n={42} />
      <Sparkle x={104} y={24} s={6} c="#fff" />
    </>
  ),
  'word-rush': (u) => (
    <>
      <IconBg u={u} c0="#a3173a" c1="#ffc23d" glow="#ffe2a8" />
      <g transform="translate(64 50) scale(.8)"><WordTiles lift={[0, 10, 5, 15]} cols={2} /></g>
      <path transform="translate(104 24)" d="M0 -14L-9 2H-1.6L-4.4 14L9 -3.4H1.6L6 -14Z" fill="#ffd23f" stroke="#ffd23f" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
};

function MysteryIcon(u) {
  return (
    <>
      <IconBg u={u} c0="#13123a" c1="#7c5cff" glow="#cfc6ff" />
      <g transform="translate(64 72) scale(1.3)"><MysteryBox /></g>
      <Sparkle x={24} y={26} s={6} c="#fff" /><Sparkle x={104} y={100} s={5} c="#ffe9a8" />
    </>
  );
}

function ComingSoonIconBase({ id, size = 64, className, title, rounded }) {
  const u = useUid();
  const body = (ICONS[id] || MysteryIcon)(u);
  return (
    <IconSvg size={size} className={className} rounded={rounded} uid={u} title={title === true ? NAMES[id] || 'Mystery game' : title}>
      {body}
    </IconSvg>
  );
}
export const ComingSoonIcon = memo(ComingSoonIconBase);

