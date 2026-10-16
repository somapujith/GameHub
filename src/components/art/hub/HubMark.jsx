// The GameHub symbol: a tilted die whose four corner pips are the player colours, all wired to one glowing centre pip.
// "Games" (the die) + "hub" (spokes to the middle). Original mark, drawn from scratch.
import { memo } from 'react';
import { BRAND } from '@/platform/brand.js';
import { useUid, HUB } from './kit.jsx';

const PIPS = [
  [20, 19, HUB.p1],
  [44, 19, HUB.p2],
  [20, 43, HUB.p3],
  [44, 43, HUB.p4],
];

/** Inner artwork in a 64x64 box (no <svg>), reused by the mark, the favicon and the app icons. */
export function MarkArt({ uid }) {
  return (
    <>
      <defs>
        <linearGradient id={uid + 'f'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7defe" />
        </linearGradient>
        <radialGradient id={uid + 'c'} cx=".38" cy=".3" r=".8">
          <stop offset="0" stopColor="#6b55ff" />
          <stop offset="1" stopColor="#2a1f78" />
        </radialGradient>
      </defs>
      <g transform="translate(0 -1.6) rotate(-8 32 32)">
        <rect x="7" y="12" width="50" height="50" rx="15" fill="#3b2a9a" stroke="#2a1f78" strokeWidth="2" />
        <rect x="7" y="6" width="50" height="50" rx="15" fill={`url(#${uid}f)`} stroke="#2a1f78" strokeWidth="2" />
        <path d="M13 18.5A9 9 0 0 1 21 11.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
        <g stroke="#cdbffa" strokeWidth="3.6" strokeLinecap="round">
          {PIPS.map(([x, y], i) => <path key={i} d={`M32 31L${x} ${y}`} />)}
        </g>
        {PIPS.map(([x, y, c], i) => (
          <g key={i}>
            <circle cx={x + 0.6} cy={y + 1.3} r="5" fill="#2a1f78" opacity=".28" />
            <circle cx={x} cy={y} r="4.9" fill={c} />
            <circle cx={x - 1.4} cy={y - 1.5} r="1.5" fill="#fff" opacity=".7" />
          </g>
        ))}
        <circle cx="32" cy="32.2" r="7.4" fill="#2a1f78" opacity=".25" />
        <circle cx="32" cy="31" r="6.8" fill={`url(#${uid}c)`} />
        <circle cx="32" cy="31" r="2.7" fill={HUB.gold} />
        <circle cx="31.2" cy="30.2" r="1" fill="#fff6d6" />
      </g>
    </>
  );
}

function HubMarkBase({ size = 40, className, title, style }) {
  const uid = useUid();
  const label = title === undefined ? undefined : title || BRAND.name;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none', display: 'block', ...style }}
    >
      <MarkArt uid={uid} />
    </svg>
  );
}
export const HubMark = memo(HubMarkBase);

// "GameHub" -> ["Game", "Hub"] so the second half can be gold; any other name stays one colour.
const split = (name) => {
  const m = /^(.+?)([A-Z][a-z]+)$/.exec(name);
  return m ? [m[1], m[2]] : [name, ''];
};

function HubLogoBase({ size = 40, compact = false, wordmark = true, className, style }) {
  const [a, b] = split(BRAND.name);
  const fs = size * (compact ? 0.47 : 0.62);
  const lift = Math.max(1, size * 0.045);
  return (
    <span
      className={className}
      role="img"
      aria-label={BRAND.name}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * (compact ? 0.18 : 0.24), lineHeight: 1, ...style }}
    >
      <HubMark size={size} />
      {wordmark && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-display, system-ui, sans-serif)',
            fontWeight: 800,
            fontSize: fs,
            letterSpacing: '-.015em',
            color: '#fff',
            textShadow: `0 ${lift}px 0 rgba(42,31,120,.9), 0 ${lift * 2.2}px ${size * 0.16}px rgba(0,0,0,.35)`,
            whiteSpace: 'nowrap',
          }}
        >
          {a}
          {b && <span style={{ color: HUB.gold, textShadow: `0 ${lift}px 0 #b8741a, 0 ${lift * 2.2}px ${size * 0.16}px rgba(0,0,0,.35)` }}>{b}</span>}
        </span>
      )}
    </span>
  );
}
export const HubLogo = memo(HubLogoBase);
