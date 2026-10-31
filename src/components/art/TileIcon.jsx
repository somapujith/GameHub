// Small flat icons (64x64 box) for every tile.art key. Same palette + soft-highlight style as the rest of the art kit.
import { memo } from 'react';
import { GROUPS } from '@shared/board.js';
import { PAL, darken } from './palette.js';
import { Box, Pad, Gable, Face, archPath } from './iso.jsx';
import { Beacon, ChaiCup } from './marks.jsx';

const INK = '#1b1340';
const Shadow = ({ rx = 20, y = 58 }) => <ellipse cx="32" cy={y} rx={rx} ry="3" fill={INK} opacity=".16" />;

function Property({ color }) {
  return (
    <g transform="translate(32 34) scale(.55)">
      <Pad x={-27} y={-27} w={54} d={54} c="#d6cdf0" r={7} />
      <Box x={-15} y={-15} w={30} d={30} h={21} c="#fff0d2" />
      <Face p="L" at={15}>
        <rect x={-11} y={10} width={7} height={7} rx="1.2" fill="#79d3ea" />
        <rect x={4} y={10} width={7} height={7} rx="1.2" fill="#79d3ea" />
        <path d={archPath(-3.4, 0, 6.8, 11)} fill={darken(color, 0.25)} />
      </Face>
      <Face p="R" at={15}>
        <rect x={-11} y={10} width={7} height={7} rx="1.2" fill="#79d3ea" />
        <rect x={4} y={10} width={7} height={7} rx="1.2" fill="#79d3ea" />
      </Face>
      <Gable x={-18} y={-18} z={21} w={36} d={36} h={15} c={color} axis="y" />
    </g>
  );
}

function Metro() {
  return (
    <g>
      <Shadow rx={22} />
      <rect x="8" y="53.5" width="48" height="3" rx="1.2" fill="#8c84c8" />
      {[12, 22, 32, 42, 52].map((x) => <rect key={x} x={x - 1} y="56.5" width="2.4" height="2" fill="#6a62b4" />)}
      <path d="M14 52V22Q14 10 26 10H38Q50 10 50 22V52Z" fill="#f6f2ff" />
      <path d="M32 10H38Q50 10 50 22V52H32Z" fill="#d8d0f3" />
      <path d="M17.6 20Q17.6 15 23 15H41Q46.4 15 46.4 20V32H17.6Z" fill="#2e2475" />
      <path d="M20 19Q20 17 23 17H29L22 30H20Z" fill="#6f66d8" opacity=".8" />
      <rect x="14" y="37" width="36" height="4" fill={PAL.rose} />
      <rect x="14" y="41" width="36" height="1.6" fill="#3a2f8c" />
      <circle cx="21" cy="47" r="2.6" fill={PAL.gold} />
      <circle cx="43" cy="47" r="2.6" fill={PAL.gold} />
      <rect x="28" y="44.4" width="8" height="2.4" rx="1.2" fill="#8c84c8" />
      <rect x="26" y="6.4" width="12" height="3.6" rx="1.6" fill="#8c84c8" />
    </g>
  );
}

function Plane() {
  return (
    <g>
      <ellipse cx="34" cy="55" rx="20" ry="3" fill={INK} opacity=".14" />
      <g transform="translate(32 33) scale(.94) translate(-32 -32) rotate(-34 32 32)">
        <path d="M24 32L40 32L31 7H22Z" fill="#c9cfee" />
        <path d="M24 32L40 32L31 57H22Z" fill="#e6e9fb" />
        <path d="M6 30Q6 27 10 27H50Q60 27 60 32Q60 37 50 37H10Q6 37 6 34Z" fill="#fff" />
        <path d="M10 34.4H52Q58 34.4 59.4 33Q58 37 50 37H10Q6 37 6 34Z" fill="#d8d0f3" />
        <path d="M6 31L2 22L10 22L14 28Z" fill={PAL.saffron} />
        <path d="M8 36L4 44H10L14 38Z" fill="#c9cfee" />
        <path d="M44 28.6L52 28.6Q56 29 57 31L48 31Z" fill="#3a2f8c" />
        <g fill="#3a2f8c">{[18, 22, 26, 30, 34, 38].map((x) => <circle key={x} cx={x} cy="31.6" r="1" />)}</g>
        <path d="M26 32L36 32L34 38H27Z" fill="#8f98c9" opacity=".5" />
      </g>
    </g>
  );
}

function Bulb() {
  return (
    <g>
      <circle cx="32" cy="26" r="25" fill={PAL.gold} opacity=".22" />
      <g stroke={PAL.gold2} strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 2V6M10 10L13 13M54 10L51 13M5 26H9M55 26H59" />
      </g>
      <rect x="25" y="44" width="14" height="4" rx="1.4" fill="#8d93c4" />
      <rect x="25.6" y="48" width="12.8" height="4" rx="1.4" fill="#6d73a8" />
      <rect x="27.4" y="52" width="9.2" height="4" rx="2" fill="#4b4585" />
      <path d="M24 38H40L38 45H26Z" fill="#ffd34e" />
      <circle cx="32" cy="27" r="16.4" fill="#ffd34e" />
      <circle cx="30.4" cy="25.4" r="13.4" fill="#ffe27a" />
      <circle cx="29" cy="24.4" r="9.4" fill="#fff3b8" />
      <path d="M27 40V31L29.6 28L32 32L34.4 28L37 31V40" fill="none" stroke={PAL.saffron} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21Q22 15.4 27 13" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
    </g>
  );
}

function Water() {
  return (
    <g>
      <ellipse cx="32" cy="56" rx="18" ry="4" fill="#5fd8ee" />
      <ellipse cx="32" cy="56" rx="11" ry="2.4" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".8" />
      <path d="M32 4C40 15 48 24 48 34A16 16 0 0 1 16 34C16 24 24 15 32 4Z" fill="#3ec1e3" />
      <path d="M32 4C40 15 48 24 48 34A16 16 0 0 1 36 49.4C46 41 42 24 32 4Z" fill="#2a98c2" />
      <path d="M22 36C21.6 29 25 24 28.6 18.6" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity=".85" />
      <path d="M52 26C54 29 56 31 56 34A4 4 0 0 1 48 34C48 31 50 29 52 26Z" fill="#7de3f4" />
    </g>
  );
}

function Tax() {
  return (
    <g>
      <Shadow rx={18} />
      <rect x="15" y="9" width="32" height="44" rx="3" fill="#cfc7e8" transform="rotate(5 31 31)" />
      <rect x="13" y="6" width="32" height="44" rx="3" fill="#fffdf6" />
      <path d="M36 6H45V15Z" fill="#e6dfc8" />
      <rect x="18" y="13" width="14" height="3.2" rx="1.6" fill="#2e2475" />
      <rect x="18" y="20" width="22" height="2.4" rx="1.2" fill="#c9c3e6" />
      <rect x="18" y="26" width="20" height="2.4" rx="1.2" fill="#c9c3e6" />
      <rect x="18" y="32" width="22" height="2.4" rx="1.2" fill="#c9c3e6" />
      <g transform="translate(40 41)">
        <circle r="12" fill="#fff" opacity=".35" />
        <circle r="11" fill="none" stroke={PAL.rose} strokeWidth="2.4" />
        <circle r="8" fill="none" stroke={PAL.rose} strokeWidth="1" />
        <path d="M-4 -5.6H4M-4 -2.4H4M-3.6 -5.6Q3 -5.6 3 -3.6Q3 -2 -3.6 -2L3.4 6" fill="none" stroke={PAL.rose} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

// Nawab ka Farman: a rolled royal decree with a wax seal.
function Farman() {
  return (
    <g>
      <Shadow rx={22} />
      <rect x="16" y="12" width="32" height="40" fill="#fff1cf" />
      <rect x="32" y="12" width="16" height="40" fill="#ecd7a0" opacity=".6" />
      {[19, 25, 31].map((y, i) => <rect key={y} x="21" y={y} width={i === 2 ? 14 : 22} height="2.4" rx="1.2" fill="#9a7440" opacity=".75" />)}
      <rect x="10" y="7" width="44" height="9" rx="4.5" fill="#d89b4a" />
      <rect x="10" y="7" width="44" height="3.4" rx="1.7" fill="#f4c97f" />
      <circle cx="10.6" cy="11.5" r="4.4" fill="#b87a30" />
      <circle cx="53.4" cy="11.5" r="4.4" fill="#b87a30" />
      <rect x="10" y="48" width="44" height="9" rx="4.5" fill="#d89b4a" />
      <rect x="10" y="48" width="44" height="3.4" rx="1.7" fill="#f4c97f" />
      <circle cx="10.6" cy="52.5" r="4.4" fill="#b87a30" />
      <circle cx="53.4" cy="52.5" r="4.4" fill="#b87a30" />
      <g transform="translate(36 42)">
        <circle r="7.6" fill="#b3202f" />
        <circle r="6.4" fill="#e23a48" />
        <circle r="4.4" fill="none" stroke="#ff9aa4" strokeWidth=".9" />
        <path d="M0 -3L.9 -.9L3 -.8L1.4 .6L1.9 2.8L0 1.6L-1.9 2.8L-1.4 .6L-3 -.8L-.9 -.9Z" fill="#ffd34e" />
      </g>
    </g>
  );
}

// Hyderabadi Khazana: a treasure chest spilling gold.
function Khazana() {
  return (
    <g>
      <Shadow rx={24} />
      <path d="M13 31L17 14H47L51 31Z" fill="#6f3d1c" />
      <path d="M13 31L17 14H32V31Z" fill="#8a4f26" />
      {[[22, 25], [30, 22], [38, 25], [27, 17], [35, 18]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5.6" fill="#e0a800" />
          <circle cx={x - 0.5} cy={y - 0.6} r="4.6" fill="#ffd34e" />
          <circle cx={x - 0.5} cy={y - 0.6} r="2.6" fill="none" stroke="#e0a800" strokeWidth=".9" />
        </g>
      ))}
      <rect x="11" y="31" width="42" height="23" rx="3" fill="#9c5a2c" />
      <rect x="11" y="31" width="42" height="7" rx="2" fill="#b8733a" />
      <rect x="11" y="38" width="42" height="3.4" fill="#ffc857" />
      <rect x="11" y="31" width="5" height="23" rx="2" fill="#ffc857" />
      <rect x="48" y="31" width="5" height="23" rx="2" fill="#ffc857" />
      <rect x="27.4" y="35.6" width="9.2" height="11" rx="2" fill="#ffd34e" />
      <circle cx="32" cy="40.6" r="1.8" fill="#6f3d1c" />
      <rect x="31.2" y="41" width="1.6" height="4" rx=".8" fill="#6f3d1c" />
      <g fill="#fff3b8">
        <path d="M54 8L55.4 11.6L59 13L55.4 14.4L54 18L52.6 14.4L49 13L52.6 11.6Z" />
        <path d="M10 18L10.9 20.1L13 21L10.9 21.9L10 24L9.1 21.9L7 21L9.1 20.1Z" />
      </g>
    </g>
  );
}

function Jail() {
  return (
    <g>
      <Shadow rx={24} />
      <rect x="12" y="52" width="40" height="4" rx="1.4" fill="#d8c9a8" />
      <rect x="14" y="27" width="36" height="25" fill="#eadfc4" />
      <rect x="32" y="27" width="18" height="25" fill="#cbbd9c" opacity=".6" />
      <rect x="11.6" y="24" width="40.8" height="4.4" rx="1.4" fill="#f6edd4" />
      <rect x="20" y="20" width="24" height="4.4" fill="#e6dbc0" />
      <path d="M19.6 20A12.4 12.4 0 0 1 44.4 20Z" fill="#bba98a" />
      <path d="M32 7.6A12.4 12.4 0 0 1 44.4 20H32Z" fill="#9a8a6c" />
      <rect x="19" y="19.4" width="26" height="2" fill="#6a62b4" />
      <path d="M32 7.4V3.6" stroke={PAL.gold} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="3.4" r="1.6" fill={PAL.gold} />
      {[[17, 33], [41, 33]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 1} y={y - 1} width="8" height="12" rx="1.4" fill="#cbbd9c" />
          <rect x={x} y={y} width="6" height="10" rx="1" fill="#ffd36e" />
          {[2, 4, 6].map((d) => <rect key={d} x={x + d - 0.3} y={y} width="0.7" height="10" fill="#2e2475" />)}
          <rect x={x} y={y + 4.6} width="6" height="0.8" fill="#2e2475" />
        </g>
      ))}
      <path d="M27 52V40Q27 35 32 35Q37 35 37 40V52Z" fill="#2b2260" />
      {[29, 31, 33, 35].map((x) => <rect key={x} x={x - 0.3} y="36" width="0.8" height="16" fill="#c9cdf0" />)}
    </g>
  );
}

function TileIconBase({ tile, size = 32, className, title }) {
  const art = typeof tile === 'string' ? tile : tile?.art || 'property';
  const gcol = (tile && typeof tile === 'object' && tile.group && GROUPS[tile.group]?.color) || PAL.saffron;
  let node;
  switch (art) {
    case 'metro': node = <Metro />; break;
    case 'plane': node = <Plane />; break;
    case 'bulb': node = <Bulb />; break;
    case 'water': node = <Water />; break;
    case 'tax': node = <Tax />; break;
    case 'kismet': node = tile?.deck === 'chest' ? <Khazana /> : <Farman />; break;
    case 'jail': node = <Jail />; break;
    case 'parking': node = <ChaiCup />; break;
    case 'gotojail': node = <Beacon />; break;
    default: node = <Property color={gcol} />;
  }
  const label = title === undefined ? undefined : title || (typeof tile === 'object' && tile?.name) || art;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      strokeWidth=".6"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none' }}
    >
      {node}
    </svg>
  );
}

export const TileIcon = memo(TileIconBase);
export default TileIcon;
