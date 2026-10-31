// Flat marks in a 64x64 box. CharminarFront (ground at y = 56) is shared by Logo, BrandMark and the hub cover;
// ChaiCup and Beacon are the Chai Break / Go to Jail tile art.
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

/** Irani Chai & Biryani Break: a cup of chai on a saucer, steam rising. */
export function ChaiCup({ ground = true }) {
  return (
    <g>
      {ground && <ellipse cx="32" cy="57" rx="25" ry="3" fill="#1b1340" opacity=".16" />}
      <ellipse cx="32" cy="52" rx="24" ry="5" fill="#fff7e6" />
      <ellipse cx="32" cy="52" rx="24" ry="5" fill="none" stroke="#d8b784" strokeWidth="1.2" />
      <ellipse cx="32" cy="51" rx="15" ry="2.8" fill="#eadbb8" />
      <path d="M46 31Q57 31 56 39Q55 46 45 46" fill="none" stroke="#fff7e6" strokeWidth="4" strokeLinecap="round" />
      <path d="M46 31Q57 31 56 39Q55 46 45 46" fill="none" stroke="#d8b784" strokeWidth=".9" strokeLinecap="round" opacity=".8" />
      <path d="M14 28H50V37Q50 51 32 51Q14 51 14 37Z" fill="#fffdf6" />
      <path d="M36 28H50V37Q50 51 32 51Q40 46 36 28Z" fill="#ecdfc2" opacity=".75" />
      <rect x="14" y="35.5" width="36" height="4" fill="#2e6dd2" opacity=".85" />
      <rect x="14" y="40.5" width="36" height="1.4" fill="#2e6dd2" opacity=".6" />
      <ellipse cx="32" cy="28" rx="18" ry="4.6" fill="#fffdf6" />
      <ellipse cx="32" cy="28.6" rx="15.6" ry="3.6" fill="#c6762f" />
      <ellipse cx="29" cy="28" rx="7" ry="1.4" fill="#e4a05a" opacity=".8" />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".92">
        <path d="M24 22C20 17 28 15 24 9" />
        <path d="M33 22C29 16 37 14 33 7" />
        <path d="M42 22C38 17 46 15 42 10" />
      </g>
    </g>
  );
}

/** Go to Jail: the police beacon from the signal where you were caught (red and blue halves, flashing rays). */
export function Beacon({ ground = true }) {
  return (
    <g>
      {ground && <ellipse cx="32" cy="58" rx="22" ry="3" fill="#1b1340" opacity=".16" />}
      <g stroke={PAL.gold2} strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 3V8M11 9L14.5 12.5M53 9L49.5 12.5M4 26H9M55 26H60" />
      </g>
      <rect x="12" y="48" width="40" height="8" rx="2.4" fill="#3a3f7a" />
      <rect x="12" y="48" width="40" height="3" rx="1.5" fill="#5d63a8" />
      <rect x="17" y="42" width="30" height="7" rx="2" fill="#555aa0" />
      <path d="M18 42V31Q18 14 32 14Q46 14 46 31V42Z" fill="#e5484d" />
      <path d="M32 14Q46 14 46 31V42H32Z" fill="#2f7be0" />
      <path d="M23 36Q22 24 28 19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <rect x="29" y="9" width="6" height="6" rx="1.6" fill="#8d93c4" />
    </g>
  );
}
