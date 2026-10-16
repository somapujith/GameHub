import { Link, useLocation } from 'react-router-dom';
import { AvatarRing } from './ui.jsx';
import { useProfile } from './stores.js';
import { useAccount } from './hooks.js';
import { paths } from '@/platform/paths.js';

/**
 * Top-bar chip: avatar with a signed-in indicator (green = account, amber = guest, grey = signed out),
 * name and level. Signed-in players go to their profile; visitors go to the login screen and come back.
 */
export default function ProfileChip() {
  const [profile] = useProfile();
  const { signedIn, guest, user } = useAccount();
  const { pathname, search } = useLocation();

  const name = (signedIn && user?.name) || profile.name || 'Guest';
  const avatar = signedIn && Number.isInteger(user?.avatar) ? user.avatar : profile.avatar;
  const level = signedIn && Number.isFinite(Number(user?.level)) ? Number(user.level) : profile.level;
  const status = signedIn ? (guest ? 'Guest account' : 'Signed in') : 'Not signed in';
  const sub = !signedIn ? 'Sign in' : guest ? 'Guest' : `Lv ${level}`;
  const to = signedIn ? paths.profile() : paths.login(`${pathname}${search}`);

  return (
    <Link to={to} className="hub-userchip" aria-label={`Profile: ${name}. ${status}${signedIn ? `, level ${level}` : ''}`}>
      <AvatarRing preset={avatar} size={32} dot={signedIn ? (guest ? 'guest' : 'on') : 'off'} />
      <span className="hub-userchip__meta">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </Link>
  );
}
