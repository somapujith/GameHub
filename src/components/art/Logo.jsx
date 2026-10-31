// Brand: Charminar mark in a gold badge + "Hyderabad Tycoon" lockup.
import { memo } from 'react';
import { PAL } from './palette.js';
import { CharminarFront } from './marks.jsx';

function BrandMarkBase({ size = 40, className, title }) {
  const s = 0.7;
  const label = title === undefined ? undefined : title || 'Hyderabad Tycoon';
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
      style={{ flex: 'none', display: 'block' }}
    >
      <circle cx="32" cy="33" r="30.5" fill="#b8741a" />
      <circle cx="32" cy="32" r="30.5" fill={PAL.gold2} />
      <circle cx="32" cy="32" r="27.6" fill={PAL.gold} />
      <path d="M10 25A24 24 0 0 1 36 8.4" fill="none" stroke="#fff3c4" strokeWidth="3.2" strokeLinecap="round" opacity=".8" />
      <circle cx="32" cy="32" r="25.4" fill="none" stroke="#fff3c4" strokeWidth="1" opacity=".55" />
      <g transform={`translate(${32 - 32 * s} ${32 - 29.4 * s + 1.4}) scale(${s})`}>
        <CharminarFront ground={false} stone="#2e2475" shade="#221a5e" arch={PAL.gold} archInner="#ffe08a" gold={PAL.gold} cap="#3a2f8c" />
      </g>
    </svg>
  );
}
export const BrandMark = memo(BrandMarkBase);

function LogoBase({ size = 40, compact = false, className, style }) {
  const word = size * (compact ? 0.5 : 0.56);
  const font = 'var(--font-display, system-ui, sans-serif)';
  return (
    <span
      className={className}
      role="img"
      aria-label="Hyderabad Tycoon"
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.24, lineHeight: 1, ...style }}
    >
      <BrandMark size={size} />
      {compact ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: font,
            fontWeight: 800,
            fontSize: word,
            letterSpacing: '.02em',
            color: PAL.gold,
            textShadow: `0 ${Math.max(1, size * 0.05)}px 0 #b8741a, 0 ${size * 0.09}px ${size * 0.14}px rgba(0,0,0,.4)`,
          }}
        >
          Tycoon
        </span>
      ) : (
        <span aria-hidden="true" style={{ display: 'inline-flex', flexDirection: 'column', gap: size * 0.02 }}>
          <span
            style={{
              fontFamily: font,
              fontWeight: 700,
              fontSize: size * 0.3,
              letterSpacing: '.28em',
              color: PAL.cream,
              textTransform: 'uppercase',
              opacity: 0.92,
              lineHeight: 1,
              paddingLeft: '.1em',
            }}
          >
            Hyderabad
          </span>
          <span
            style={{
              fontFamily: font,
              fontWeight: 800,
              fontSize: word,
              letterSpacing: '.03em',
              color: PAL.gold,
              textTransform: 'uppercase',
              lineHeight: 0.92,
              textShadow: `0 ${Math.max(1, size * 0.05)}px 0 #b8741a, 0 ${size * 0.09}px ${size * 0.16}px rgba(0,0,0,.45)`,
            }}
          >
            Tycoon
          </span>
        </span>
      )}
    </span>
  );
}
export const Logo = memo(LogoBase);
