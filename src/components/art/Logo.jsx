// Brand: Charminar mark in a gold badge + "Hyderabad Tycoon" lockup. Also the UI badges (Hotel, colour set).
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
  const font = 'var(--font-display, "Baloo Tammudu 2", system-ui, sans-serif)';
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

/* ---------- small UI badges ---------- */
function HotelBadgeBase({ size = 24, className, title }) {
  const label = title === undefined ? undefined : title || 'Hotel';
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
      style={{ flex: 'none' }}
    >
      <circle cx="32" cy="33" r="30" fill="#b8741a" />
      <circle cx="32" cy="32" r="30" fill={PAL.gold2} />
      <circle cx="32" cy="32" r="26.6" fill={PAL.gold} />
      <path d="M12 24A22 22 0 0 1 34 10.4" fill="none" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <g fill="#2e2475">
        <rect x="12.4" y="19" width="5.2" height="27" rx="2.2" />
        <rect x="12.4" y="36" width="39.2" height="7.4" rx="2.4" />
        <rect x="12.4" y="42" width="5.2" height="5.4" rx="1.4" />
        <rect x="46.4" y="42" width="5.2" height="5.4" rx="1.4" />
      </g>
      <rect x="19.6" y="28.6" width="12.4" height="7" rx="3.2" fill={PAL.cream} />
      <path d="M33.6 35.6V30Q33.6 28.4 35.4 28.4H47Q51.6 28.4 51.6 33V35.6Z" fill={PAL.rose} />
      <path d="M46 12.4L47.2 15.4L50.4 15.6L47.9 17.6L48.8 20.7L46 18.9L43.2 20.7L44.1 17.6L41.6 15.6L44.8 15.4Z" fill="#fff" />
    </svg>
  );
}
export const HotelBadge = memo(HotelBadgeBase);

function SetBadgeBase({ size = 24, level = 0, color = PAL.gold, className, title }) {
  const L = Math.max(0, Math.min(5, level | 0));
  const label = title === undefined ? undefined : title || (L >= 5 ? 'Colour set with a hotel' : 'Colour set complete');
  // three arcs of 100 degrees with 20 degree gaps
  const arc = (a0, a1) => {
    const r = 25.5;
    const p = (a) => [32 + r * Math.cos((a * Math.PI) / 180), 32 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const pips = [];
  if (L >= 1 && L <= 4) {
    const cells = [[24, 24], [34, 24], [24, 34], [34, 34]];
    for (let i = 0; i < L; i++) pips.push(<rect key={i} x={cells[i][0]} y={cells[i][1]} width="7" height="7" rx="2" fill="#fff7e6" />);
  }
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
      style={{ flex: 'none' }}
    >
      <circle cx="32" cy="32" r="30" fill="#241b5c" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.6" />
      <g fill="none" stroke={color} strokeWidth="6.4" strokeLinecap="round">
        <path d={arc(-80, 20)} />
        <path d={arc(40, 140)} />
        <path d={arc(160, 260)} />
      </g>
      {L === 0 && (
        <g fill={color}>
          <circle cx="23" cy="32" r="3.2" /><circle cx="32" cy="32" r="3.2" /><circle cx="41" cy="32" r="3.2" />
        </g>
      )}
      {pips}
      {L >= 5 && (
        <path d="M32 17L36.4 26.4L46.6 27.6L39 34.6L41.2 44.8L32 39.6L22.8 44.8L25 34.6L17.4 27.6L27.6 26.4Z" fill={PAL.gold} stroke="#fff3c4" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}
export const SetBadge = memo(SetBadgeBase);
