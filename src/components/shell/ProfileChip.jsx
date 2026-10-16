import { Link } from 'react-router-dom';
import { AvatarRing, Coins } from './ui.jsx';
import { useProfile } from './stores.js';
import { useAccount } from './hooks.js';

/** Top-bar chip: avatar, level, coins, and a signed-in indicator. Links to the profile screen. */
export default function ProfileChip() {
  const [profile] = useProfile();
  const { signedIn, guest, user } = useAccount();
  const label = signedIn ? (guest ? 'Guest account' : 'Signed in') : 'Not signed in';
  const name = (signedIn && user?.name) || profile.name;
  return (
    <Link to="/settings" className="hh-chip" aria-label={`Profile: ${name}, level ${profile.level}, ${profile.coins} coins. ${label}`}>
      <AvatarRing preset={profile.avatar} size={34} dot={signedIn ? (guest ? 'guest' : 'on') : 'off'} />
      <span className="hh-chip__meta">
        <span className="hh-chip__name">{name}</span>
        <span className="hh-chip__lvl">Lv {profile.level}</span>
      </span>
      <Coins value={profile.coins} className="hh-chip__coins" size={16} />
    </Link>
  );
}
