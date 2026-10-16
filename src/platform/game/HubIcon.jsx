import { Icon } from '@/components/shell/icons.jsx';

/*
 * Hub icon set: 24x24 stroke icons that inherit `currentColor`. Names that are not in this table fall back
 * to the shared shell `Icon` set (users, user, trophy, book, map, key, door, share, copy, ...), so a manifest
 * `extras[].icon` can use either set.
 */
const P = {
  gamepad: 'M7 7.5h10a4.5 4.5 0 0 1 4.4 3.6l.6 3.4a3 3 0 0 1-5 2.7L15 15.5H9L7 17.2a3 3 0 0 1-5-2.7l.6-3.4A4.5 4.5 0 0 1 7 7.5zM7.5 10.5v3M6 12h3M15.5 11.2h.01M17.8 13h.01',
  robot: 'M6 8.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2zM12 8.5V5.2M12 4h.01M9 13.2h.01M15 13.2h.01M9.5 16.6h5M2 13v3M22 13v3',
  table: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 21.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM20 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  hash: 'M9.5 4 8 20M16 4l-1.5 16M4.5 9h16M3.5 15h16',
  podium: 'M3 20.5h18M4 20.5v-6h5v6M9.5 20.5V10h5v10.5M15 20.5v-8h5v8M12 3.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 5.3l2-.3z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 20a7.5 7.5 0 0 1 15 0',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 21a2 2 0 0 0 4 0',
  chevDown: 'M6 9.5l6 6 6-6',
  chevR: 'M9 5l7 7-7 7',
  chevL: 'M15 5l-7 7 7 7',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17.5 19 7',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 0 0-14.5-3.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.5 3.5M20 20v-4.5h-4.5',
  clock: 'M12 7.5V12l3 1.8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  play: 'M8 5.5v13l11-6.5z',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  wifiOff: 'M3 3l18 18M8.5 8.8A11 11 0 0 0 2.5 12M15.5 8.8A11 11 0 0 1 21.5 12M5.5 15.2a8 8 0 0 1 4-2.2M18.5 15.2a8 8 0 0 0-2.4-1.8M12 19h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  plug: 'M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4',
};

const FILLED = new Set(['play', 'bolt']);

export default function HubIcon({ name, size = 22, strokeWidth = 2, className = '', title, ...rest }) {
  const d = P[name];
  if (!d) return <Icon name={name} size={size} strokeWidth={strokeWidth} className={className} title={title} {...rest} />;
  return (
    <svg
      className={`hub-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={FILLED.has(name) ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ flex: 'none' }}
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

export { HubIcon };
