// Profile badges: shiny medallions (64x64) with a distinct outline, colour and emblem each.
// ids: first-win, ten-wins, hotel-tycoon, social-butterfly, daily-streak, night-owl. Unknown ids get a plain star medal.
import { memo } from 'react';
import { useUid, Sparkle, Num } from './kit.jsx';

const CFG = {
  'first-win': { shape: 'rosette', rim: ['#fff0a8', '#d98a0f'], face: ['#ffe27a', '#f29a12'], label: 'First win' },
  'ten-wins': { shape: 'shield', rim: ['#f7f9ff', '#8f9ddb'], face: ['#8a7bff', '#3a2fb0'], label: 'Ten wins' },
  'hotel-tycoon': { shape: 'hex', rim: ['#fff0a8', '#d98a0f'], face: ['#ff7a94', '#c2255c'], label: 'Hotel tycoon' },
  'social-butterfly': { shape: 'circle', rim: ['#e2fff8', '#2aa89a'], face: ['#5fe6d2', '#2380c4'], label: 'Social butterfly' },
  'daily-streak': { shape: 'circle', rim: ['#ffe9b0', '#e07b1a'], face: ['#ff9a45', '#e0382e'], label: 'Daily streak' },
  'night-owl': { shape: 'circle', rim: ['#ece8ff', '#7a6dc8'], face: ['#5a49c4', '#1a1250'], label: 'Night owl' },
};
const FALLBACK = { shape: 'circle', rim: ['#fff0a8', '#d98a0f'], face: ['#ffe27a', '#f29a12'], label: 'Badge' };

const HEX = 'M32 4.5L55.5 18V46L32 59.5L8.5 46V18Z';
const SHIELD = 'M32 3.5L54.5 11.2V31.5C54.5 45.5 44.6 54 32 60.5C19.4 54 9.5 45.5 9.5 31.5V11.2Z';
function Medal({ uid, cfg, children }) {
  const { shape } = cfg;
  const grad = { fill: `url(#${uid}r)`, stroke: `url(#${uid}r)` };
  const face = { fill: `url(#${uid}f)` };
  const lip = cfg.rim[1];
  const inner = `translate(32 32) scale(.82) translate(-32 -32)`;
  let rim, base;
  if (shape === 'rosette') {
    rim = (
      <>
        <circle cx="32" cy="32" r="26" {...grad} />
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={(32 + 25.8 * Math.cos(a)).toFixed(1)} cy={(32 + 25.8 * Math.sin(a)).toFixed(1)} r="5.4" {...grad} />;
        })}
      </>
    );
    base = (
      <>
        <circle cx="32" cy="33.6" r="26" fill={lip} />
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={(32 + 25.8 * Math.cos(a)).toFixed(1)} cy={(33.6 + 25.8 * Math.sin(a)).toFixed(1)} r="5.4" fill={lip} />;
        })}
      </>
    );
  } else if (shape === 'hex') {
    base = <path d={HEX} transform="translate(0 1.8)" fill={lip} stroke={lip} strokeWidth="5" strokeLinejoin="round" />;
    rim = <path d={HEX} {...grad} strokeWidth="5" strokeLinejoin="round" />;
  } else if (shape === 'shield') {
    base = <path d={SHIELD} transform="translate(0 1.8)" fill={lip} stroke={lip} strokeWidth="2.4" strokeLinejoin="round" />;
    rim = <path d={SHIELD} {...grad} strokeWidth="2.4" strokeLinejoin="round" />;
  } else {
    base = <circle cx="32" cy="33.8" r="30" fill={lip} />;
    rim = <circle cx="32" cy="32" r="30" {...grad} />;
  }
  return (
    <>
      <defs>
        <linearGradient id={uid + 'r'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cfg.rim[0]} />
          <stop offset="1" stopColor={cfg.rim[1]} />
        </linearGradient>
        <linearGradient id={uid + 'f'} x1=".2" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor={cfg.face[0]} />
          <stop offset="1" stopColor={cfg.face[1]} />
        </linearGradient>
      </defs>
      {base}
      {rim}
      <g transform={shape === 'circle' ? undefined : inner}>
        {shape === 'circle' ? <circle cx="32" cy="32" r="25" {...face} /> : shape === 'rosette' ? <circle cx="32" cy="32" r="29.5" {...face} /> : <path d={shape === 'hex' ? HEX : SHIELD} {...face} stroke={`url(#${uid}f)`} strokeWidth={shape === 'hex' ? 5 : 2.4} strokeLinejoin="round" />}
      </g>
      <g transform={shape === 'circle' ? undefined : inner} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2">
        {shape === 'circle' ? <circle cx="32" cy="32" r="25" /> : shape === 'rosette' ? <circle cx="32" cy="32" r="29.5" /> : <path d={shape === 'hex' ? HEX : SHIELD} />}
      </g>
      {children}
      <ellipse cx="22.5" cy="15.5" rx="11" ry="4.6" transform="rotate(-32 22.5 15.5)" fill="#fff" opacity=".28" />
      <Sparkle x={shape === 'shield' ? 47 : 49} y={14.5} s={3.4} c="#fff" o=".95" />
    </>
  );
}

const Star = ({ x, y, s = 5, c = '#ffc857', stroke }) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.45 : s;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={c} stroke={stroke || c} strokeWidth={stroke ? 1.1 : 0} strokeLinejoin="round" />;
};

function Emblem({ id }) {
  switch (id) {
    case 'first-win':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <g transform="translate(0 1.4)" fill="#b8620a" opacity=".45" stroke="#b8620a">
            <path d="M21.5 19h21v7.5c0 7-4.6 11.6-10.5 11.6S21.5 33.5 21.5 26.5Z" strokeWidth="1" />
            <rect x="29" y="37.5" width="6" height="4.4" /><rect x="23.5" y="41.5" width="17" height="5" rx="1.8" />
          </g>
          <path d="M21.5 21.4H18.2c-1.3 0-2 .9-1.8 2.2.5 4 3 6.4 6.4 7M42.5 21.4h3.3c1.3 0 2 .9 1.8 2.2-.5 4-3 6.4-6.4 7" fill="none" stroke="#fff8e0" strokeWidth="2.4" />
          <path d="M21.5 19h21v7.5c0 7-4.6 11.6-10.5 11.6S21.5 33.5 21.5 26.5Z" fill="#fff8e0" stroke="#fff8e0" strokeWidth="1" />
          <path d="M32 19h10.5v7.5c0 7-4.6 11.6-10.5 11.6Z" fill="#ffd98a" stroke="#ffd98a" strokeWidth="1" opacity=".75" />
          <rect x="29" y="37.5" width="6" height="4.4" fill="#fff8e0" stroke="#fff8e0" />
          <rect x="23.5" y="41.4" width="17" height="5" rx="1.8" fill="#fff8e0" stroke="#fff8e0" />
          <rect x="26" y="43" width="12" height="1.6" rx=".8" fill="#e8a02a" stroke="none" />
          <Star x={32} y={27.4} s={5.2} c="#f29a12" />
          <path d="M24.8 22.2V27" stroke="#fff" strokeWidth="1.8" opacity=".9" fill="none" />
        </g>
      );
    case 'ten-wins':
      return (
        <g>
          <Num text="10" x={32.8} y={32.6} h={21} sw={5} color="#241a78" />
          <Num text="10" x={32} y={31.2} h={21} sw={5} color="#ffffff" />
          <Star x={32} y={47.6} s={4.6} c="#ffd45a" />
          <Star x={23.4} y={46.2} s={3.2} c="#ffd45a" />
          <Star x={40.6} y={46.2} s={3.2} c="#ffd45a" />
        </g>
      );
    case 'hotel-tycoon':
      return (
        <g strokeLinejoin="round">
          <rect x="22.6" y="24.6" width="20" height="22" rx="2" fill="#7a1238" opacity=".4" transform="translate(0 1.4)" />
          <rect x="22" y="23.4" width="20" height="22" rx="2" fill="#fff7e6" />
          <rect x="33" y="23.4" width="9" height="22" rx="2" fill="#f1d9c0" opacity=".7" />
          <rect x="19.6" y="21" width="24.8" height="5" rx="2.2" fill="#ffc857" />
          <rect x="19.6" y="21" width="24.8" height="1.8" rx=".9" fill="#fff3c4" />
          {[0, 1, 2].map((i) => [0, 1].map((j) => <rect key={i + '-' + j} x={24.2 + i * 5.8} y={28.4 + j * 5.4} width="3.4" height="3.4" rx=".7" fill="#ffb100" />))}
          {[0, 2].map((i) => <rect key={'w' + i} x={24.2 + i * 5.8} y={39.2} width="3.4" height="3.4" rx=".7" fill="#ffb100" />)}
          <path d="M29.6 45.4V40.6A2.4 2.4 0 0 1 34.4 40.6V45.4Z" fill="#c2255c" />
          <Star x={32} y={16.4} s={5.6} c="#ffd45a" stroke="#fff3c4" />
        </g>
      );
    case 'social-butterfly':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <g transform="translate(0 1.2)" opacity=".28" fill="#0e3b64">
            <path d="M31 31C27 19 15 18 14.5 26C14.2 31 22 34.5 31 33ZM33 31C37 19 49 18 49.5 26C49.8 31 42 34.5 33 33Z" />
          </g>
          <path d="M31 34C23 33.5 17 37 18.5 43C20 48.4 28 47.4 31 38Z" fill="#9b7bff" />
          <path d="M33 34C41 33.5 47 37 45.5 43C44 48.4 36 47.4 33 38Z" fill="#9b7bff" />
          <path d="M31 31C27 19 15 18 14.5 26C14.2 31 22 34.5 31 33Z" fill="#ff7aa8" />
          <path d="M33 31C37 19 49 18 49.5 26C49.8 31 42 34.5 33 33Z" fill="#ff7aa8" />
          <path d="M29.6 31.8C26 24 20 22.4 18.4 25" fill="none" stroke="#ffc2d6" strokeWidth="1.6" />
          <path d="M34.4 31.8C38 24 44 22.4 45.6 25" fill="none" stroke="#ffc2d6" strokeWidth="1.6" />
          <circle cx="21" cy="27.4" r="2.2" fill="#fff" opacity=".9" /><circle cx="43" cy="27.4" r="2.2" fill="#fff" opacity=".9" />
          <circle cx="22.8" cy="42.2" r="1.8" fill="#fff" opacity=".85" /><circle cx="41.2" cy="42.2" r="1.8" fill="#fff" opacity=".85" />
          <ellipse cx="32" cy="34" rx="2" ry="9.4" fill="#2a1f78" />
          <circle cx="32" cy="23.6" r="2.4" fill="#2a1f78" />
          <path d="M31 22C29.6 19.4 28 18.4 26.4 18.8M33 22C34.4 19.4 36 18.4 37.6 18.8" fill="none" stroke="#2a1f78" strokeWidth="1.3" />
        </g>
      );
    case 'daily-streak':
      return (
        <g strokeLinejoin="round">
          <path d="M32.5 14C33.5 21.5 42 25.4 42 36.6C42 44.2 37.6 49.5 32 49.5C26.4 49.5 22 44.2 22 36.6C22 31.6 24.8 28.6 26.8 25.4C27.4 28.4 29 30 30.6 30.4C29.6 25 30 19 32.5 14Z" fill="#8a1c14" opacity=".35" transform="translate(0 1.6)" />
          <path d="M32.5 13C33.5 20.5 42 24.4 42 35.6C42 43.2 37.6 48.5 32 48.5C26.4 48.5 22 43.2 22 35.6C22 30.6 24.8 27.6 26.8 24.4C27.4 27.4 29 29 30.6 29.4C29.6 24 30 18 32.5 13Z" fill="#ffc83a" stroke="#ffc83a" strokeWidth="1" />
          <path d="M33 22C34 28 40 30 40 37C40 43 36.4 47.6 32 47.6C27.6 47.6 24 43 24 37C24 33.6 26 31.6 27.4 29.4C28 31.4 29.4 32.6 30.8 32.8C30.4 28.6 31 25.4 33 22Z" fill="#ff8a3d" opacity=".55" />
          <path d="M32 31C33 34.6 37 36.8 37 41.4C37 44.8 34.8 47 32 47C29.2 47 27 44.8 27 41.4C27 38.6 29.8 36.6 30.6 33.6C31 34.4 31.6 34.8 32.4 34.8C32.2 33.6 32 32.4 32 31Z" fill="#fff7d6" stroke="#fff7d6" strokeWidth=".8" />
          <circle cx="45" cy="22" r="1.6" fill="#ffd45a" /><circle cx="19.4" cy="29" r="1.2" fill="#ffd45a" /><circle cx="46.4" cy="31" r="1" fill="#fff3c4" />
        </g>
      );
    case 'night-owl':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M47 9.6A6.4 6.4 0 1 0 51.6 19A5.4 5.4 0 0 1 47 9.6Z" fill="#ffd45a" />
          <Sparkle x={17} y={19} s={3.2} c="#ffe9a8" /><Sparkle x={52} y={31} s={2.4} c="#cfc6ff" />
          <path d="M19.5 22.5L17.6 13L27 19.4Z M44.5 22.5L46.4 13L37 19.4Z" fill="#8b7cf0" stroke="#8b7cf0" strokeWidth="1.6" />
          <path d="M32 18.2C41.6 18.2 47 25.4 47 35C47 44.6 40.4 50.4 32 50.4C23.6 50.4 17 44.6 17 35C17 25.4 22.4 18.2 32 18.2Z" fill="#a89cff" />
          <path d="M32 18.2C41.6 18.2 47 25.4 47 35C47 44.6 40.4 50.4 32 50.4Z" fill="#8b7cf0" opacity=".6" />
          <ellipse cx="32" cy="43.4" rx="7.6" ry="6.4" fill="#efeaff" />
          <path d="M28 41.4Q29.4 43 31 41.4M33 41.4Q34.6 43 36 41.4M30.4 45.4Q32 47 33.6 45.4" fill="none" stroke="#a89cff" strokeWidth="1.1" />
          <circle cx="25.6" cy="31.4" r="6.6" fill="#fff" /><circle cx="38.4" cy="31.4" r="6.6" fill="#fff" />
          <circle cx="25.6" cy="31.4" r="6.6" fill="none" stroke="#ffd45a" strokeWidth="1.6" /><circle cx="38.4" cy="31.4" r="6.6" fill="none" stroke="#ffd45a" strokeWidth="1.6" />
          <circle cx="26.2" cy="31.8" r="3.2" fill="#1a1250" /><circle cx="37.8" cy="31.8" r="3.2" fill="#1a1250" />
          <circle cx="27.2" cy="30.6" r="1.1" fill="#fff" /><circle cx="38.8" cy="30.6" r="1.1" fill="#fff" />
          <path d="M32 34.6L29.6 38.8H34.4Z" fill="#ff9a45" stroke="#ff9a45" strokeWidth="1" />
        </g>
      );
    default:
      return <Star x={32} y={32} s={15} c="#fff8e0" />;
  }
}

function BadgeIconBase({ id, size = 48, className, title, style }) {
  const uid = useUid();
  const cfg = CFG[id] || FALLBACK;
  const label = title === undefined ? undefined : title || cfg.label;
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
      <Medal uid={uid} cfg={cfg}>
        <Emblem id={id} />
      </Medal>
    </svg>
  );
}
export const BadgeIcon = memo(BadgeIconBase);
