// Category glyphs for the hub (board, card, arcade, social, word, sports). 24x24, two-tone using only currentColor:
// a soft tinted fill + a rounded outline, so they take whatever text colour the chip/row gives them.
import { memo } from 'react';

const T = '.2'; // tint opacity

function Glyph({ id }) {
  switch (id) {
    case 'board':
      return (
        <>
          <circle cx="12" cy="6.6" r="3.2" fill="currentColor" fillOpacity=".34" />
          <path d="M9.9 10.4h4.2" />
          <path d="M10.2 10.4c.2 2.7-.7 4.3-2.2 6.4h8c-1.5-2.1-2.4-3.7-2.2-6.4Z" fill="currentColor" fillOpacity={T} />
          <rect x="5.4" y="16.8" width="13.2" height="3.8" rx="1.9" fill="currentColor" fillOpacity=".34" />
        </>
      );
    case 'card':
      return (
        <>
          <g transform="rotate(-14 9 13)">
            <rect x="3.6" y="5.4" width="10.6" height="14.6" rx="2.3" fill="currentColor" fillOpacity={T} />
          </g>
          <g transform="rotate(11 15.5 12)">
            <rect x="9.8" y="4" width="10.8" height="15" rx="2.3" fill="currentColor" fillOpacity=".34" />
            <path d="M15.2 15.8c-3.1-2.1-3.9-3.5-3.9-4.8 0-1.3.9-2.2 1.9-2.2.8 0 1.5.4 2 1.1.5-.7 1.2-1.1 2-1.1 1 0 1.9.9 1.9 2.2 0 1.3-.8 2.7-3.9 4.8Z" fill="currentColor" stroke="none" />
          </g>
        </>
      );
    case 'arcade':
      return (
        <>
          <path d="M7.3 7.6h9.4a4.7 4.7 0 0 1 4.6 3.8l.9 4.7a2.4 2.4 0 0 1-4.2 2L16.4 16H7.6l-1.6 2.1a2.4 2.4 0 0 1-4.2-2l.9-4.7a4.7 4.7 0 0 1 4.6-3.8Z" fill="currentColor" fillOpacity={T} />
          <path d="M7.7 10v4M5.7 12h4" />
          <circle cx="15.6" cy="10.6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="18.2" cy="13" r="1.1" fill="currentColor" stroke="none" />
        </>
      );
    case 'social':
      return (
        <>
          <circle cx="16.6" cy="8.6" r="2.7" fill="currentColor" fillOpacity={T} />
          <path d="M15.4 13.4c.4-.1.8-.1 1.2-.1 2.4 0 4.4 1.9 4.4 4.7" />
          <circle cx="9" cy="8.8" r="3.2" fill="currentColor" fillOpacity=".34" />
          <path d="M3 19.2c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5Z" fill="currentColor" fillOpacity=".34" />
        </>
      );
    case 'word':
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.2" fill="currentColor" fillOpacity={T} />
          <path d="M7.6 16.6 12 7l4.4 9.6M9.3 13.4h5.4" />
          <circle cx="17.3" cy="17.3" r=".9" fill="currentColor" stroke="none" />
        </>
      );
    case 'sports':
      return (
        <>
          <circle cx="12" cy="12" r="8.7" fill="currentColor" fillOpacity={T} />
          <path d="M3.3 12h17.4M12 3.3v17.4" />
          <path d="M5.7 5.9c3 2.6 3 9.6 0 12.2M18.3 5.9c-3 2.6-3 9.6 0 12.2" />
        </>
      );
    default: // unknown id: a die
      return (
        <>
          <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.4" fill="currentColor" fillOpacity={T} />
          <circle cx="8.4" cy="8.4" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="15.6" cy="8.4" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="8.4" cy="15.6" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="15.6" cy="15.6" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
  }
}

function CategoryIconBase({ id, size = 24, className, title, style }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ flex: 'none', display: 'block', ...style }}
    >
      <Glyph id={id} />
    </svg>
  );
}
export const CategoryIcon = memo(CategoryIconBase);
