import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/shell/icons.jsx';

/** Friendly Hyderabad-themed 404. */
export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="hh-404">
      <div className="hh-404__art" aria-hidden="true">
        <svg viewBox="0 0 280 150" width="280" height="150" focusable="false">
          <defs>
            <linearGradient id="hh404a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd978" />
              <stop offset="1" stopColor="#ffb100" />
            </linearGradient>
          </defs>
          {/* road */}
          <rect x="0" y="126" width="280" height="24" rx="4" fill="#1d1650" />
          <path d="M10 138h32M62 138h32M114 138h32M166 138h32M218 138h32" stroke="#867eb3" strokeWidth="3" strokeLinecap="round" />
          {/* Charminar silhouette */}
          <g fill="#3a2f8c" stroke="#6a5bd1" strokeWidth="1.5">
            <rect x="196" y="58" width="56" height="68" rx="3" />
            <rect x="190" y="52" width="68" height="10" rx="3" />
            <rect x="188" y="26" width="9" height="36" rx="3" />
            <rect x="251" y="26" width="9" height="36" rx="3" />
            <ellipse cx="192.5" cy="24" rx="6" ry="7" />
            <ellipse cx="255.5" cy="24" rx="6" ry="7" />
            <path d="M214 126V90a12 12 0 0 1 24 0v36z" fill="#140f33" />
          </g>
          {/* auto rickshaw */}
          <g>
            <path d="M40 108c0-26 16-40 40-40h22l8 18v22z" fill="url(#hh404a)" stroke="#b36b00" strokeWidth="2" strokeLinejoin="round" />
            <path d="M62 78h22l6 14H58z" fill="#ffe9a8" opacity=".85" />
            <rect x="34" y="104" width="86" height="12" rx="5" fill="#1b1340" />
            <circle cx="56" cy="118" r="11" fill="#1b1340" />
            <circle cx="56" cy="118" r="4.5" fill="#867eb3" />
            <circle cx="108" cy="118" r="11" fill="#1b1340" />
            <circle cx="108" cy="118" r="4.5" fill="#867eb3" />
            <path d="M80 68l4-12h14" stroke="#1b1340" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        </svg>
      </div>
      <p className="hh-404__code">404</p>
      <h1 className="hh-404__title">Wrong gully, boss!</h1>
      <p className="hh-404__text">
        <code>{pathname}</code> isn't on our map. Maybe the auto-driver took a shortcut through a Charminar traffic jam.
      </p>
      <p className="hh-404__te" lang="te">
        ఈ దారి ఎక్కడికీ వెళ్లదు
      </p>
      <div className="row hh-404__actions">
        <Link to="/" className="btn btn--primary btn--lg">
          <Icon name="home" size={18} /> Back home
        </Link>
        <Link to="/play" className="btn btn--ghost btn--lg">
          <Icon name="dice" size={18} /> Quick Play
        </Link>
      </div>
    </div>
  );
}
