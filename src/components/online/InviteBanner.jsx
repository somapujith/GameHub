import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/art/index.js';
import { paths } from '@/platform/paths.js';
import '@/styles/online.css';

// Floating notices for realtime user-socket events: game invites (Join / Dismiss) and a small heads-up
// for friend requests / accepted requests. Rendered through a portal by <AuthProvider>, which may sit
// OUTSIDE the router, so navigation works with or without a router context.

const TTL = { invite: 45000, friend_request: 9000, friend_accepted: 7000 };

/** Router-less navigation: React Router's BrowserRouter listens to popstate. */
function navigateWithoutRouter(to) {
  try {
    window.history.pushState({}, '', to);
    const Ev = window.PopStateEvent || window.Event;
    window.dispatchEvent(new Ev('popstate', { state: window.history.state }));
  } catch {
    window.location.assign(to);
  }
}

/** The words and destination of a notice (pure, unit-tested). */
export function noticeContent({ kind, from, code, gameName }) {
  const name = from?.name || 'A friend';
  let title;
  let body;
  let actionLabel;
  let target;
  if (kind === 'invite') {
    // `gameName` comes from the server's invite push ({t:'invite', from, code, gameId, gameName})
    title = gameName ? `${name} invited you to play ${gameName}` : `${name} invited you to play`;
    body = code ? `Room ${code}` : 'Tap Join to jump in';
    actionLabel = 'Join';
    // the join page checks the room (full? started?) and then opens the lobby
    target = code ? paths.join(code) : null;
  } else if (kind === 'friend_request') {
    title = `${name} sent you a friend request`;
    body = 'Open Friends to accept';
    actionLabel = 'View';
    target = paths.friends();
  } else {
    title = `${name} accepted your friend request`;
    body = 'You are friends now';
    actionLabel = 'Friends';
    target = paths.friends();
  }
  return { title, body, actionLabel, target };
}

function Notice({ item, onDismiss, go }) {
  const { key, kind, from } = item;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(key), TTL[kind] || 8000);
    return () => clearTimeout(t);
  }, [key, kind, onDismiss]);

  const { title, body, actionLabel, target } = noticeContent(item);

  return (
    <div className={`ho-notice ho-notice--${kind}`} role={kind === 'invite' ? 'alert' : 'status'}>
      <Avatar preset={Number.isInteger(from?.avatar) ? from.avatar : 0} size={44} className="ho-notice__avatar" />
      <div className="ho-notice__text">
        <strong className="ho-notice__title">{title}</strong>
        <span className="ho-notice__body">{body}</span>
      </div>
      <div className="ho-notice__actions">
        {target && (
          <button
            type="button"
            className="ho-btn ho-btn--primary ho-btn--sm"
            onClick={() => {
              onDismiss(key);
              go(target);
            }}
          >
            {actionLabel}
          </button>
        )}
        <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={() => onDismiss(key)} aria-label={`Dismiss: ${title}`}>
          {kind === 'invite' ? 'Dismiss' : '✕'}
        </button>
      </div>
    </div>
  );
}

function BannerView({ items, onDismiss, go }) {
  if (!items || items.length === 0 || typeof document === 'undefined') return null;
  return createPortal(
    <div className="ho-notices" aria-label="Notifications" aria-live="polite">
      {items.map((it) => (
        <Notice key={it.key} item={it} onDismiss={onDismiss} go={go} />
      ))}
    </div>,
    document.body,
  );
}

function WithRouter(props) {
  const navigate = useNavigate();
  return <BannerView {...props} go={(to) => navigate(to)} />;
}

function WithoutRouter(props) {
  return <BannerView {...props} go={navigateWithoutRouter} />;
}

/** `items`: [{ key, kind: 'invite'|'friend_request'|'friend_accepted', from:{id,name,avatar}, code? }] */
export function InviteBanner({ items, onDismiss }) {
  const inRouter = useInRouterContext();
  const Comp = inRouter ? WithRouter : WithoutRouter;
  return <Comp items={items} onDismiss={onDismiss} />;
}

export default InviteBanner;
