import { Link } from 'react-router-dom';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { NAV_ITEMS, useIsActive } from './nav/navItems.js';

/** Kept for the barrel (`@/components/shell/index.js`): both lists are the same four hub destinations. */
export const TABS = NAV_ITEMS;
export const NAV = NAV_ITEMS;

/** Bottom tab bar, shown on phones and tablets (hidden >= 900 px, where the left rail takes over). */
export default function TabBar() {
  const active = useIsActive();
  return (
    <nav className="hub-tabbar" aria-label="Primary">
      <ul>
        {NAV_ITEMS.map((t) => {
          const on = active(t);
          return (
            <li key={t.id}>
              <Link to={t.to} className={`hub-tab${on ? ' is-active' : ''}`} aria-current={on ? 'page' : undefined}>
                <span className="hub-tab__icon">
                  <HubIcon name={t.icon} size={22} strokeWidth={on ? 2.3 : 2} />
                </span>
                <span className="hub-tab__label">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Left rail for wide screens (>= 900 px; hidden below by CSS). Same destinations as the tab bar. */
export function TopNav() {
  const active = useIsActive();
  return (
    <nav className="hub-rail" aria-label="Main">
      <ul>
        {NAV_ITEMS.map((t) => {
          const on = active(t);
          return (
            <li key={t.id}>
              <Link to={t.to} className={`hub-rail__link${on ? ' is-active' : ''}`} aria-current={on ? 'page' : undefined}>
                <span className="hub-rail__icon">
                  <HubIcon name={t.icon} size={22} strokeWidth={on ? 2.3 : 2} />
                </span>
                <span className="hub-rail__label">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
