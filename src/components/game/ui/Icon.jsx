// Tiny inline icon set (stroke icons on a 24px grid). gameui-panels owns this file.
const FILL = { more: true, crown: true, dot: true };

const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="18.5" cy="12" r="1.9" />
    </>
  ),
  chat: (
    <>
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5A1.5 1.5 0 0 1 3.5 15.5V6A1.5 1.5 0 0 1 5 4.5z" />
      <path d="M7.5 9h9M7.5 12.5h5.5" />
    </>
  ),
  send: <path d="M3.5 11.2l17-7.7-6.7 17-2.7-7.1zM10.9 13.4l3.4-3.4" />,
  crown: <path d="M3 8.2l4.6 4 4.4-7 4.4 7 4.6-4-1.9 10.8H4.9z" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bot: (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="3" />
      <path d="M12 8V4.5M9 13v1.5M15 13v1.5M2.5 12.5v3M21.5 12.5v3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.6 4.6L19 7.6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  sound: (
    <>
      <path d="M4 9.5v5h3.8L13 18.5v-13L7.8 9.5z" />
      <path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.7 6.7a7.5 7.5 0 0 1 0 10.6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  text: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="3" />
      <path d="M7 11h4M13 11h4M7 14.5h2.5M12 14.5h5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7.5A2.5 2.5 0 0 1 5 17.5z" />
      <path d="M5 17.5a2.5 2.5 0 0 1 2.5-2.5H18" />
    </>
  ),
  exit: <path d="M9.5 4.5H5v15h4.5M14 8l4 4-4 4M8.5 12H18" />,
  home: <path d="M4 11.2l8-7 8 7V20h-5.2v-5.8H9.2V20H4z" />,
  chevronUp: <path d="M6 14.5l6-6 6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  upgrade: <path d="M12 19V6M6 11.5l6-6 6 6M6 20.5h12" />,
  list: <path d="M4 6.5h16M4 12h16M4 17.5h10" />,
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5v1.5A3 3 0 0 0 7.8 10.5M16.5 6h3v1.5a3 3 0 0 1-3.3 3M12 14v3.5M8.5 20h7M9.5 17.5h5" />
    </>
  ),
  refresh: <path d="M19.5 8A8 8 0 0 0 5 9.5M4.5 4.5v5h5M4.5 16a8 8 0 0 0 14.5-1.5M19.5 19.5v-5h-5" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.2h5M9.5 12h5M10.5 9.2c3.2 0 3.2 5.6 0 5.6l3.2 3" />
    </>
  ),
  spark: <path d="M12 3.5l1.9 5.2 5.2 1.9-5.2 1.9L12 17.7l-1.9-5.2L4.9 10.6l5.2-1.9z" />,
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 4.5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 4.5-4 8.5s4 4.5 4 8.5" />,
  swap: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  ticket: (
    <>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v1.5A1.5 1.5 0 0 1 19 17H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z" />
      <path d="M14.5 7.5v1.5M14.5 11.2v1.6M14.5 15v1.5" />
    </>
  ),
  bank: <path d="M3.5 9.5L12 4l8.5 5.5M5.5 10.5v7M9.5 10.5v7M14.5 10.5v7M18.5 10.5v7M3.5 20h17M3.5 17.5h17" />,
  warn: <path d="M12 4.5l9 15.5H3zM12 10v4.5M12 17.2v.1" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.7v.1" />
    </>
  ),
};

export default function Icon({ name, size = 22, strokeWidth = 2, className = '', style }) {
  const filled = FILL[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`hg-icon ${className}`}
      style={style}
    >
      {PATHS[name] || null}
    </svg>
  );
}
