// Safe accessors for the hub art kit (`src/components/art/hub/index.js`, owned by the art agent).
//
// Every hub screen imports its art from HERE instead of from the kit directly. A namespace import never
// throws for a missing export, so if a piece of art is not delivered (or is renamed) the chrome still
// renders with the tiny fallbacks below instead of crashing the whole app.
import * as Kit from '@/components/art/hub/index.js';

const pick = (name, fallback) => (Kit && Kit[name] ? Kit[name] : fallback);

function FallbackMark({ size = 32, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id="hubfm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a8bff" />
          <stop offset="1" stopColor="#5b4cf0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hubfm)" />
      <path d="M9 12.5h14a3.5 3.5 0 0 1 3.4 2.7l.6 3a2.6 2.6 0 0 1-4.3 2.4L20.5 19h-9l-2.2 1.6A2.6 2.6 0 0 1 5 18.2l.6-3a3.5 3.5 0 0 1 3.4-2.7z" fill="#fff" opacity=".95" />
    </svg>
  );
}

function FallbackLogo({ size = 30, className = '' }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, lineHeight: 1 }}>
      <FallbackMark size={size} />
      <b style={{ fontSize: size * 0.62, letterSpacing: '-.02em' }}>GameHub</b>
    </span>
  );
}

const Nothing = () => null;

/** Small plain cover used only when the art kit has no cover for a game. */
function FallbackCover({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="160" height="90" fill="#1b2547" />
      <circle cx="120" cy="30" r="46" fill="#26325e" />
      <circle cx="30" cy="80" r="40" fill="#141c38" />
    </svg>
  );
}

export const HubLogo = pick('HubLogo', FallbackLogo);
export const HubMark = pick('HubMark', FallbackMark);
export const HubBackdrop = pick('HubBackdrop', Nothing);
export const CategoryIcon = pick('CategoryIcon', Nothing);
export const ComingSoonCover = pick('ComingSoonCover', FallbackCover);
export const ComingSoonIcon = pick('ComingSoonIcon', FallbackMark);
export const BadgeIcon = pick('BadgeIcon', Nothing);
export const TycoonCover = pick('TycoonCover', FallbackCover);
export const TycoonIcon = pick('TycoonIcon', FallbackMark);
export { FallbackCover };
