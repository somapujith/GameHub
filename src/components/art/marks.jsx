// Flat front-elevation Charminar, in a 64x64 box (ground at y = 56). Shared by TileIcon, Logo and BrandMark.
import { PAL } from './palette.js';

export function CharminarFront({ stone = '#f4e6c6', shade = '#d9c59b', arch = '#2e2475', archInner = '#5445b8', gold = PAL.gold, cap = '#fff7e6', ground = true }) {
  const minaret = (cx, h, key) => (
    <g key={key}>
      <rect x={cx - 2.9} y={h} width="5.8" height={56 - h} fill={stone} />
      <rect x={cx + 0.4} y={h} width="2.5" height={56 - h} fill={shade} />
      <rect x={cx - 5} y="26" width="10" height="2.2" rx="1" fill={shade} />
      <rect x={cx - 4.2} y="25" width="8.4" height="1.2" rx=".6" fill={gold} />
      <rect x={cx - 5} y="39" width="10" height="2.2" rx="1" fill={shade} />
      <rect x={cx - 4.2} y="38" width="8.4" height="1.2" rx=".6" fill={gold} />
      <rect x={cx - 3.4} y={h - 5} width="6.8" height="5.4" rx="1" fill={stone} />
      <path d={`M${cx - 4.6} ${h - 4.6}A4.6 5 0 0 1 ${cx + 4.6} ${h - 4.6}Z`} fill={cap} />
      <path d={`M${cx} ${h - 9.4}V${h - 14}`} stroke={gold} strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
  const arc = (x, y, w, h, fill, key) => <path key={key} d={`M${x} ${y}V${y - h + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y - h + w / 2}V${y}Z`} fill={fill} />;
  return (
    <g>
      {ground && <ellipse cx="32" cy="57.4" rx="26" ry="3" fill="#1b1340" opacity=".18" />}
      {/* back minarets */}
      {[22.6, 41.4].map((cx, i) => (
        <g key={i}>
          <rect x={cx - 1.7} y="19" width="3.4" height="14" fill={shade} />
          <path d={`M${cx - 3} 19A3 3.6 0 0 1 ${cx + 3} 19Z`} fill={cap} />
          <path d={`M${cx} 15V12`} stroke={gold} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
      {minaret(11, 15, 'l')}
      {minaret(53, 15, 'r')}
      {/* body */}
      <rect x="16.4" y="30" width="31.2" height="26" fill={stone} />
      <rect x="32" y="30" width="15.6" height="26" fill={shade} opacity=".5" />
      <rect x="15.6" y="29" width="32.8" height="2.2" rx="1" fill={shade} />
      <rect x="18" y="22" width="28" height="8" fill={stone} />
      <rect x="32" y="22" width="14" height="8" fill={shade} opacity=".5" />
      <rect x="16.6" y="20.4" width="30.8" height="2.4" rx="1" fill={shade} />
      <rect x="16.6" y="20.4" width="30.8" height="1" fill={gold} />
      {/* arches */}
      {arc(25.6, 56, 12.8, 20, arch, 'a')}
      {arc(27.6, 56, 8.8, 15.4, archInner, 'a2')}
      {arc(18.6, 55, 4.6, 10, arch, 'b')}
      {arc(40.8, 55, 4.6, 10, arch, 'c')}
      {[22.2, 29.8, 37.4].map((x, i) => arc(x, 28, 4.4, 6.4, arch, 'w' + i))}
      {/* roof domes */}
      {[[21.4, 2.8], [42.6, 2.8]].map(([cx, r], i) => (
        <g key={i}>
          <rect x={cx - 1.6} y="15.6" width="3.2" height="5" fill={stone} />
          <path d={`M${cx - r - 0.6} 16A${r + 0.6} ${r + 1} 0 0 1 ${cx + r + 0.6} 16Z`} fill={cap} />
        </g>
      ))}
      <rect x="28.2" y="13" width="7.6" height="8" fill={stone} />
      <path d="M26.6 14A5.4 7 0 0 1 37.4 14Z" fill={cap} />
      <path d="M32 6.6V2.6" stroke={gold} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="32" cy="2.4" r="1" fill={gold} />
    </g>
  );
}
