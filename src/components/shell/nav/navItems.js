// The four hub destinations (bottom bar on phones, left rail >= 900 px). Each item lists the path prefixes
// that light it up, so /games/:id and /lobby/:code keep "Games" active and /login keeps "Profile" active.
import { paths } from '@/platform/paths.js';
import { useLocation } from 'react-router-dom';

export const NAV_ITEMS = [
  { id: 'games', to: paths.hub(), label: 'Games', icon: 'gamepad', exact: true, match: ['/games', '/lobby', '/join'] },
  { id: 'friends', to: paths.friends(), label: 'Friends', icon: 'users', match: ['/friends', '/f'] },
  { id: 'rank', to: paths.leaderboard(), label: 'Rank', icon: 'podium', match: ['/leaderboard'] },
  { id: 'profile', to: paths.profile(), label: 'Profile', icon: 'user', match: ['/profile', '/login'] },
];

export function isActive(item, pathname) {
  if (item.exact && pathname === '/') return true;
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** `(item) => boolean` for the current location. */
export function useIsActive() {
  const { pathname } = useLocation();
  return (item) => isActive(item, pathname);
}
