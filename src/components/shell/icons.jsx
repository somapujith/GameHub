import { useId } from 'react';

/* Small stroke icon set (24x24). Inline SVG only, inherits `currentColor`. */
const P = {
  home: 'M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  play: 'M8 5.5v13l11-6.5z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 20a7.5 7.5 0 0 1 15 0',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a2.5 2.5 0 0 0 3 3.5M16 6h3.5a2.5 2.5 0 0 1-3 3.5M12 13v4M8.5 20h7M10 17h4',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  flame: 'M12 3c1 3.5 4.5 5 4.5 9.2A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.8c0-2 1-3.2 2-4.2.2 1.2.8 2 1.6 2.4C11 8 11 5.5 12 3zM12 20.5a2.5 2.5 0 0 0 2.5-2.4',
  volume: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11',
  volumeOff: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17.5 19 7',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z',
  crown: 'M4 17.5 3.5 8l4.5 4 4-6.5L16 12l4.5-4L20 17.5zM4.5 20.5h15',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  login: 'M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M14 8l4 4-4 4M18 12H9',
  logout: 'M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 8 6 12l4 4M6 12h9',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  dice: 'M5 5h14v14H5z',
  gift: 'M4 11h16v9H4zM3 7.5h18V11H3zM12 7.5V20M12 7.5C10 3 6.5 4.5 8 6.5c.7 1 2.4 1 4 1zM12 7.5c2-4.5 5.5-3 4-1-.7 1-2.4 1-4 1z',
  pencil: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM14.5 7.5l3 3',
  mic: 'M12 14.5a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5.5a3 3 0 0 0 3 3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
  book: 'M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  info: 'M12 11v5M12 8h.01',
  clock: 'M12 8v4.5l3 1.5',
  building: 'M5 20V6l7-2.5V20M12 9h7v11M8.5 9h.01M8.5 12.5h.01M8.5 16h.01M15.5 13h.01M15.5 16.5h.01M3 20h18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  refresh: 'M20 11a8 8 0 0 0-14.5-3.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 3.5M20 20v-4.5h-4.5',
  wifiOff: 'M3 3l18 18M8.5 8.8A11 11 0 0 0 2.5 12M15.5 8.8A11 11 0 0 1 21.5 12M5.5 15.2a8 8 0 0 1 4-2.2M18.5 15.2a8 8 0 0 0-2.4-1.8M12 19h.01',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5',
  share: 'M8.5 12 15.5 8M8.5 12l7 4M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  rupee: 'M7 5h10M7 9h10M10 5c4 0 6 1.5 6 4s-2 4-6 4H8l8 7',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  key: 'M14.5 9.5a4 4 0 1 0-3.4 4L12 14.5h2v2h2v2h2.5v-2.8l-4.2-4.2zM8.5 8.5h.01',
  door: 'M6 20V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V20M4 20h16M14.5 12h.01',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  swords: 'M5 4l7.5 7.5M4 5l2 3 3 2M20 4l-7.5 7.5M20 5l-2 3-3 2M9.5 14.5 6 18l-2 .5.5-2L8 13M14.5 14.5 18 18l2 .5-.5-2L16 13',
  medal: 'M12 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 3.5 10 10M15.5 3.5 14 10',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
};

const FILLED = new Set(['play', 'star', 'bolt']);
const CIRCLES = {
  dice: [[9, 9], [15, 9], [12, 12], [9, 15], [15, 15]],
};
const RINGS = { info: [12, 12, 9], clock: [12, 12, 8.5], wifiOff: null };

export function Icon({ name, size = 22, className = '', strokeWidth = 2, title, ...rest }) {
  const d = P[name];
  if (!d) return null;
  const filled = FILLED.has(name);
  const ring = RINGS[name];
  return (
    <svg
      className={`hh-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {ring && <circle cx={ring[0]} cy={ring[1]} r={ring[2]} />}
      <path d={d} />
      {CIRCLES[name]?.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.15" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

/** Shiny gold coin used for the soft currency (not rupees). */
export function CoinIcon({ size = 18, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`hh-coin ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.45" stopColor="#ffc857" />
          <stop offset="1" stopColor="#e08a00" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill={`url(#c${id})`} stroke="#b36b00" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="7.3" fill="none" stroke="#b36b00" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M9.2 8h5.6M9.2 10.6h5.6M10.4 8c2.6 0 3.6 1 3.6 2.3s-1 2.3-3.6 2.3h-.7l4 3.4" fill="none" stroke="#8a4f00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default Icon;
