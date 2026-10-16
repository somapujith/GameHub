import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { useProfile } from '@/components/shell/stores.js';
import Ava from './Ava.jsx';

/** Profile > Account: who is signed in, sign out, friend code, or a sign-in prompt. */
export default function AccountSection() {
  const toast = useToast();
  const [profile] = useProfile();
  const { user, signedIn, guest, auth } = useAccount();

  const logout = async () => {
    try {
      await auth.logout?.();
      toast('Signed out.', { tone: 'info' });
    } catch {
      toast('Could not sign out. Try again.', { tone: 'bad' });
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Friend code copied', { tone: 'good' });
    } catch {
      toast(text, { tone: 'info' });
    }
  };

  return (
    <section className="hub-panel hh2-account" aria-labelledby="hh2-acct-h">
      <h2 id="hh2-acct-h" className="hub-section__title">
        <HubIcon name="user" size={18} /> Account
      </h2>
      {signedIn ? (
        <div className="hh2-account__row">
          <Ava preset={user?.avatar ?? profile.avatar} size={52} dot={guest ? undefined : 'on'} />
          <div className="hh2-account__text">
            <b>{user?.name || profile.name}</b>
            <small>{guest ? 'Guest account (rooms only)' : 'Signed in with Google'}</small>
          </div>
          <button type="button" className="hub-btn hub-btn--soft hub-btn--sm" onClick={logout}>
            <Icon name="logout" size={16} /> Sign out
          </button>
          {user?.friendCode && !guest && (
            <button type="button" className="hh2-codechip" onClick={() => copy(user.friendCode)} aria-label={`Copy friend code ${user.friendCode}`}>
              <span>Friend code</span>
              <b>{user.friendCode}</b>
              <Icon name="copy" size={16} />
            </button>
          )}
          {guest && (
            <Link to={paths.login(paths.profile())} className="hh2-textlink">
              Sign in with Google for friends and rankings
            </Link>
          )}
        </div>
      ) : (
        <div className="hh2-account__row">
          <p className="hub-muted hh2-account__text">You are playing offline on this device. Sign in to save progress, add friends and play online tables.</p>
          <Link to={paths.login(paths.profile())} className="hub-btn hub-btn--primary">
            <Icon name="login" size={18} /> Sign in
          </Link>
        </div>
      )}
    </section>
  );
}
