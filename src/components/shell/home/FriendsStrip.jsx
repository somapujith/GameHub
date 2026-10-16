import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import Ava from '@/platform/home/Ava.jsx';
import { useApi, useApiGate } from '@/platform/home/useApi.js';
import { useAccount } from '../hooks.js';

/** A friendly inline message with an optional action, used for every non-list state of the strip. */
function Prompt({ icon, title, children, action, quiet }) {
  return (
    <div className={`hh2-prompt ${quiet ? 'hh2-prompt--quiet' : ''}`}>
      <span className="hh2-prompt__icon" aria-hidden="true">
        <HubIcon name={icon} size={22} />
      </span>
      <p className="hh2-prompt__text">
        <b>{title}</b>
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

/** Home > "Friends online" strip. Signed-out and guest players get a sign-in prompt; network trouble degrades quietly. */
export default function FriendsStrip() {
  const { account, guest, loading } = useAccount();
  const { ready } = useApiGate();
  const remote = useApi('/api/friends', { enabled: ready && account });
  const { data, reload } = remote;
  // `ready` is false while auth boots and when the API is unreachable (static dev); treat the latter as offline.
  const status = account && !ready && !loading ? 'offline' : remote.status;
  const friends = Array.isArray(data?.friends) ? data.friends : [];
  const incoming = Array.isArray(data?.incoming) ? data.incoming.length : 0;
  const sorted = [...friends].sort((a, b) => Number(!!b.online) - Number(!!a.online));
  const online = friends.filter((f) => f.online).length;

  let body;
  if (loading || (account && (status === 'loading' || status === 'idle'))) {
    body = (
      <ul className="hub-row hub-row--tight hh2-friends__rail" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="hh2-friend">
            <span className="hub-skel hub-skel--dot" style={{ width: 58, height: 58 }} />
            <span className="hub-skel hub-skel--line" style={{ width: 44, height: 10 }} />
          </li>
        ))}
      </ul>
    );
  } else if (!account) {
    body = (
      <Prompt
        icon="users"
        title={guest ? 'Friends need a full account' : 'Play with friends'}
        action={
          <Link to={paths.login(paths.hub())} className="hub-btn hub-btn--primary hub-btn--sm">
            {guest ? 'Sign in with Google' : 'Sign in'}
          </Link>
        }
      >
        {guest ? 'Guests can join tables. Sign in with Google to add friends and see who is online.' : 'Sign in to add friends, see who is online and invite them to a table.'}
      </Prompt>
    );
  } else if (status === 'auth' || status === 'offline' || status === 'error') {
    body = (
      <Prompt
        quiet
        icon="wifiOff"
        title={status === 'auth' ? 'Session expired' : 'Friends are offline'}
        action={
          status === 'auth' ? (
            <Link to={paths.login(paths.hub())} className="hub-btn hub-btn--primary hub-btn--sm">
              Sign in
            </Link>
          ) : (
            <button type="button" className="hub-btn hub-btn--soft hub-btn--sm" onClick={reload}>
              <HubIcon name="refresh" size={16} /> Retry
            </button>
          )
        }
      >
        {status === 'auth' ? 'Sign in again to see your friends.' : 'We cannot reach the server right now. Games against bots still work.'}
      </Prompt>
    );
  } else if (!friends.length) {
    body = (
      <Prompt
        icon="users"
        title="No friends yet"
        action={
          <Link to={paths.friends()} className="hub-btn hub-btn--primary hub-btn--sm">
            <HubIcon name="plus" size={16} /> Add a friend
          </Link>
        }
      >
        Share your friend code or link and invite people to a table.
      </Prompt>
    );
  } else {
    body = (
      <ul className="hub-row hub-row--tight hh2-friends__rail">
        <li>
          <Link to={paths.friends()} className="hh2-friend hh2-friend--invite">
            <span className="hh2-friend__plus" aria-hidden="true">
              <HubIcon name="plus" size={22} strokeWidth={2.4} />
            </span>
            <span className="hh2-friend__name">Invite</span>
          </Link>
        </li>
        {sorted.slice(0, 14).map((f) => (
          <li key={f.id}>
            <Link to={paths.friends()} className={`hh2-friend ${f.online ? 'is-online' : ''}`} aria-label={`${f.name}, ${f.online ? 'online' : 'offline'}`}>
              <Ava preset={f.avatar} size={56} dot={f.online ? 'on' : 'off'} />
              <span className="hh2-friend__name">{f.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const showCount = account && status === 'ok' && friends.length > 0;
  return (
    <section className="hub-section hh2-friends" aria-labelledby="hh2-friends-h">
      <div className="hub-section__head">
        <h2 id="hh2-friends-h" className="hub-section__title">
          Friends online
          {showCount && <span className="hub-pill hub-pill--good hh2-pill-gap">{online} online</span>}
        </h2>
        {account && (
          <Link to={paths.friends()} className="hub-section__more">
            {incoming ? `${incoming} request${incoming > 1 ? 's' : ''}` : 'Manage'}
          </Link>
        )}
      </div>
      {body}
    </section>
  );
}
