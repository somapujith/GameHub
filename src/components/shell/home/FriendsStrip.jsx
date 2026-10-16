import { Link } from 'react-router-dom';
import { Icon } from '../icons.jsx';
import { AvatarRing, EmptyState, Skeleton } from '../ui.jsx';
import { useRemote } from '../net.js';
import { useAccount } from '../hooks.js';

/** Friends online. Degrades to sign-in / empty / offline states; never throws. */
export default function FriendsStrip() {
  const { account, guest, loading } = useAccount();
  const { status, data, reload } = useRemote('/api/friends', { enabled: account });
  const friends = Array.isArray(data?.friends) ? data.friends : [];
  const incoming = Array.isArray(data?.incoming) ? data.incoming.length : 0;
  const sorted = [...friends].sort((a, b) => Number(!!b.online) - Number(!!a.online));
  const online = friends.filter((f) => f.online).length;

  let body;
  if (loading || (account && status === 'loading')) {
    body = (
      <div className="hh-friends__row" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="hh-friend hh-friend--skel">
            <Skeleton w={52} h={52} r={26} />
            <Skeleton w={44} h={10} />
          </span>
        ))}
      </div>
    );
  } else if (!account) {
    body = (
      <EmptyState
        icon="users"
        title={guest ? 'Friends need a full account' : 'Play with friends'}
        action={
          <Link to="/login?next=/friends" className="btn btn--primary btn--sm">
            <Icon name="login" size={16} /> {guest ? 'Sign in with Google' : 'Sign in'}
          </Link>
        }
      >
        {guest ? 'Guests can join rooms, but friends and rankings are for signed-in players.' : 'Sign in to add friends, see who is online and invite them to a room.'}
      </EmptyState>
    );
  } else if (status === 'offline' || status === 'auth') {
    body = (
      <EmptyState
        icon="wifiOff"
        title={status === 'auth' ? 'Session expired' : 'Server unreachable'}
        action={
          status === 'auth' ? (
            <Link to="/login?next=/" className="btn btn--primary btn--sm">
              Sign in again
            </Link>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={reload}>
              <Icon name="refresh" size={16} /> Retry
            </button>
          )
        }
      >
        {status === 'auth' ? 'Please sign in again to see your friends.' : 'Friends will appear when you are back online. Offline games still work.'}
      </EmptyState>
    );
  } else if (!friends.length) {
    body = (
      <EmptyState
        icon="users"
        title="No friends yet"
        action={
          <Link to="/friends" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Add a friend
          </Link>
        }
      >
        Share your friend code and invite people to a room.
      </EmptyState>
    );
  } else {
    body = (
      <ul className="hh-friends__row">
        {sorted.slice(0, 12).map((f) => (
          <li key={f.id} className="hh-friend">
            <Link to="/friends" className="hh-friend__link" aria-label={`${f.name}, ${f.online ? 'online' : 'offline'}`}>
              <AvatarRing preset={f.avatar} size={52} dot={f.online ? 'on' : 'off'} tone={f.online ? 'good' : 'dim'} />
              <span className="hh-friend__name">{f.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="hh-card hh-friends" aria-labelledby="hh-friends-h">
      <div className="hh-card__head">
        <h2 id="hh-friends-h" className="hh-h2">
          Friends
          {account && status === 'ok' && friends.length > 0 && <span className="hh-pill hh-pill--good hh-friends__count">{online} online</span>}
        </h2>
        <Link to="/friends" className="hh-link hh-card__more">
          {incoming ? `${incoming} request${incoming > 1 ? 's' : ''}` : 'Manage'} <Icon name="chevR" size={16} />
        </Link>
      </div>
      {body}
    </section>
  );
}
