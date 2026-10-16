import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './icons.jsx';

/* Each item lists the path prefixes that should light it up. */
export const TABS = [
  { to: '/', label: 'Home', icon: 'home', match: ['/'], exact: true },
  { to: '/play', label: 'Play', icon: 'play', match: ['/play', '/campaign'] },
  { to: '/friends', label: 'Friends', icon: 'users', match: ['/friends', '/lobby', '/join'] },
  { to: '/settings', label: 'Profile', icon: 'user', match: ['/settings', '/leaderboard', '/login'] },
];

export const NAV = [
  { to: '/', label: 'Home', icon: 'home', match: ['/'], exact: true },
  { to: '/play', label: 'Quick Play', icon: 'play', match: ['/play'] },
  { to: '/campaign', label: 'Story Mode', icon: 'map', match: ['/campaign'] },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'trophy', match: ['/leaderboard'] },
  { to: '/friends', label: 'Friends', icon: 'users', match: ['/friends', '/lobby', '/join'] },
];

function useActive() {
  const { pathname } = useLocation();
  return (item) => (item.exact ? pathname === '/' : item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
}

/** Bottom tab bar, shown on phones and tablets (hidden >= 900px by CSS). */
export default function TabBar() {
  const active = useActive();
  return (
    <nav className="hh-tabbar" aria-label="Primary">
      <ul>
        {TABS.map((t) => {
          const on = active(t);
          return (
            <li key={t.to}>
              <NavLink to={t.to} end className={`hh-tab ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
                <span className="hh-tab__icon">
                  <Icon name={t.icon} size={24} strokeWidth={on ? 2.4 : 2} />
                </span>
                <span className="hh-tab__label">{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Horizontal nav for the top bar on wide screens (hidden < 900px by CSS). */
export function TopNav() {
  const active = useActive();
  return (
    <nav className="hh-topnav" aria-label="Main">
      {NAV.map((t) => {
        const on = active(t);
        return (
          <NavLink key={t.to} to={t.to} end className={`hh-topnav__link ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
