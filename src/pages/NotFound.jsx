import { Link, useLocation } from 'react-router-dom';
import { BRAND } from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import useDocTitle from '@/platform/game/useDocTitle.js';

const PIPS = [
  [-19, -19],
  [19, -19],
  [-19, 19],
  [19, 19],
];

function Die({ x, y, rot }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-44" y="-44" width="88" height="88" rx="20" fill="#0a0f1f" opacity=".35" transform="translate(0 6)" />
      <rect x="-44" y="-44" width="88" height="88" rx="20" fill="url(#nf404a)" />
      <rect x="-43" y="-43" width="86" height="86" rx="19" fill="none" stroke="#fff" strokeOpacity=".35" />
      {PIPS.map(([px, py]) => (
        <circle key={`${px}${py}`} cx={px} cy={py} r="7.5" fill="#fff" />
      ))}
    </g>
  );
}

/** Hub-themed 404: a "4 0 4" made of two dice and a token. */
export default function NotFound() {
  const { pathname } = useLocation();
  useDocTitle(`Page not found · ${BRAND.name}`);
  return (
    <section className="hub-404" aria-labelledby="hub-404-h">
      <div className="hub-404__art" aria-hidden="true">
        <svg viewBox="0 0 320 170" focusable="false">
          <defs>
            <linearGradient id="nf404a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9a8bff" />
              <stop offset="1" stopColor="#5b4cf0" />
            </linearGradient>
            <linearGradient id="nf404b" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb84d" />
              <stop offset="1" stopColor="#ff5d73" />
            </linearGradient>
          </defs>
          <ellipse cx="160" cy="150" rx="132" ry="9" fill="#000" opacity=".28" />
          <Die x={62} y={88} rot={-9} />
          <circle cx="160" cy="88" r="40" fill="none" stroke="#0a0f1f" strokeOpacity=".35" strokeWidth="18" transform="translate(0 6)" />
          <circle cx="160" cy="88" r="40" fill="none" stroke="url(#nf404b)" strokeWidth="18" />
          <circle cx="160" cy="88" r="49" fill="none" stroke="#fff" strokeOpacity=".3" />
          <Die x={258} y={88} rot={8} />
        </svg>
      </div>
      <p className="hub-eyebrow">Error 404</p>
      <h1 id="hub-404-h" className="hub-h1">
        This table doesn't exist
      </h1>
      <p className="hub-lead">
        We couldn't find <code>{pathname}</code>. The link may be old, or the room may have closed.
      </p>
      <div className="hub-404__actions">
        <Link to={paths.hub()} className="hub-btn hub-btn--primary hub-btn--lg">
          <HubIcon name="gamepad" size={20} /> Browse games
        </Link>
        <button type="button" className="hub-btn hub-btn--ghost hub-btn--lg" onClick={() => window.dispatchEvent(new Event('hub:open-code'))}>
          <HubIcon name="hash" size={20} /> Have a code?
        </button>
      </div>
    </section>
  );
}
