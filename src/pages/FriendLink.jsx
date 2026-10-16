import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '@/components/art/index.js';
import { api, errorMessage, getFriendByCode } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { paths } from '@/platform/paths.js';
import { parseFriendLink } from '@/components/online/codes.js';
import InviteToGameSheet from '@/components/online/InviteToGameSheet.jsx';
import StatusPanel, { Loading } from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
import '@/styles/online.css';

/**
 * /f/:code (a friend link): "Add <name>?" with Add / Cancel, or the current relation when there is nothing to add
 * (already friends, request pending, it is you). Signed-out visitors and guests are asked to sign in first and come back.
 */
export default function FriendLink() {
  const { code: raw } = useParams();
  const code = parseFriendLink(raw || '');
  const { user, loading } = useAuth();

  if (!code) {
    return (
      <div className="ho-page ho-join">
        <StatusPanel
          icon="?"
          tone="bad"
          title="That friend link does not look right"
          body="Friend codes look like HYD-7K2Q. Ask your friend to send their link again, or type their code on the Friends page."
          actions={[
            { label: 'Open Friends', to: paths.friends(), primary: true },
            { label: 'Home', to: paths.hub() },
          ]}
        />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="ho-page ho-join">
        <Loading text="Opening the friend link..." />
      </div>
    );
  }
  const here = paths.friendLink(code);
  if (!user) {
    return (
      <div className="ho-page ho-join">
        <StatusPanel
          icon="👋"
          title="Sign in to add this friend"
          body="Someone shared their friend link with you. Sign in (it takes a few seconds) and you will land right back here."
          actions={[
            { label: 'Sign in', to: paths.login(here), primary: true },
            { label: 'Home', to: paths.hub() },
          ]}
        />
      </div>
    );
  }
  if (user.isGuest) {
    return (
      <div className="ho-page ho-join">
        <StatusPanel
          icon="👥"
          title="Friends are for Google accounts"
          body="Guests can host and join rooms with a code or link. Sign in with Google to add friends, then open this link again."
          actions={[
            { label: 'Sign in with Google', to: paths.login(here), primary: true },
            { label: 'Home', to: paths.hub() },
          ]}
        />
      </div>
    );
  }
  // the canonical spelling of the link (`/f/hyd7k2q` -> `/f/HYD-7K2Q`)
  if (raw !== code) return <Navigate to={here} replace />;
  return <FriendCard code={code} me={user} />;
}

function FriendCard({ code, me }) {
  const navigate = useNavigate();
  const { push, node } = useToasts();
  const [state, setState] = useState({ phase: 'loading', person: null, message: '' }); // loading | ready | notfound | error
  const [relation, setRelation] = useState('none');
  const [busy, setBusy] = useState('');
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    setState({ phase: 'loading', person: null, message: '' });
    try {
      const res = await getFriendByCode(code);
      const person = res && res.user;
      if (!person || person.id == null) throw Object.assign(new Error('No player with that code.'), { status: 404 });
      setRelation(person.relation || 'none');
      setState({ phase: 'ready', person, message: '' });
    } catch (e) {
      if (e && (e.status === 404 || e.status === 400)) setState({ phase: 'notfound', person: null, message: '' });
      else setState({ phase: 'error', person: null, message: errorMessage(e, 'Could not open this friend link') });
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  const { phase, person } = state;
  const isMe = phase === 'ready' && (String(person.id) === String(me.id) || code === me.friendCode);

  const act = async (name, request, success, failure) => {
    if (busy) return;
    setBusy(name);
    try {
      await request();
      if (success) push(success, 'good');
      // the server decides the resulting relation (a request to someone who already asked you becomes a friendship)
      try {
        const res = await getFriendByCode(code);
        if (res && res.user && res.user.relation) setRelation(res.user.relation);
      } catch {
        /* keep the optimistic relation */
      }
    } catch (e) {
      push(errorMessage(e, failure), 'bad');
    } finally {
      setBusy('');
    }
  };

  const add = () => act('add', () => api.post('/api/friends/request', { friendCode: code }), `Friend request sent to ${person.name}`, 'Could not send the request');
  const accept = () => act('accept', () => api.post('/api/friends/accept', { userId: person.id }), `You and ${person.name} are friends now`, 'Could not accept the request');
  const decline = async () => {
    await act('decline', () => api.post('/api/friends/decline', { userId: person.id }), null, 'Could not decline the request');
    navigate(paths.friends(), { replace: true });
  };
  const cancelRequest = () => act('cancel', () => api.del(`/api/friends/${encodeURIComponent(person.id)}`), 'Request cancelled', 'Could not cancel the request');

  if (phase === 'loading') {
    return (
      <div className="ho-page ho-join">
        <Loading text="Looking up this friend..." />
      </div>
    );
  }
  if (phase === 'notfound') {
    return (
      <div className="ho-page ho-join">
        <StatusPanel
          icon="?"
          tone="bad"
          title="No player with that code"
          body={`We could not find ${code}. Check the link with your friend and try again.`}
          actions={[
            { label: 'Open Friends', to: paths.friends(), primary: true },
            { label: 'Home', to: paths.hub() },
          ]}
        />
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="ho-page ho-join">
        <StatusPanel
          icon="!"
          tone="bad"
          title="Could not open this link"
          body={state.message}
          actions={[
            { label: 'Try again', onClick: load, primary: true },
            { label: 'Home', to: paths.hub() },
          ]}
        />
      </div>
    );
  }

  let title;
  let body;
  let actions;
  if (isMe) {
    title = 'This is your own friend link';
    body = 'Send it to a friend so they can add you. They tap it, press Add, and you are connected.';
    actions = (
      <>
        <Link to={paths.friends()} className="ho-btn ho-btn--primary">
          Share from Friends
        </Link>
        <Link to={paths.hub()} className="ho-btn ho-btn--ghost">
          Home
        </Link>
      </>
    );
  } else if (relation === 'friends') {
    title = `You and ${person.name} are friends`;
    body = 'Already connected. Invite them to a game whenever they are online.';
    actions = (
      <>
        <button type="button" className="ho-btn ho-btn--primary" onClick={() => setSheet(true)}>
          Invite to game
        </button>
        <Link to={paths.friends()} className="ho-btn ho-btn--ghost">
          Open Friends
        </Link>
      </>
    );
  } else if (relation === 'outgoing') {
    title = 'Request sent';
    body = `Waiting for ${person.name} to accept. You will get a note when they do.`;
    actions = (
      <>
        <Link to={paths.friends()} className="ho-btn ho-btn--primary">
          Open Friends
        </Link>
        <button type="button" className="ho-btn ho-btn--ghost" onClick={cancelRequest} disabled={!!busy}>
          {busy === 'cancel' ? 'Cancelling...' : 'Cancel request'}
        </button>
      </>
    );
  } else if (relation === 'incoming') {
    title = `${person.name} wants to be friends`;
    body = 'They already sent you a request. Accept it to become friends.';
    actions = (
      <>
        <button type="button" className="ho-btn ho-btn--primary" onClick={accept} disabled={!!busy}>
          {busy === 'accept' ? 'Accepting...' : 'Accept'}
        </button>
        <button type="button" className="ho-btn ho-btn--ghost" onClick={decline} disabled={!!busy}>
          Decline
        </button>
      </>
    );
  } else {
    title = `Add ${person.name}?`;
    body = 'You will be able to see when they are online and invite each other to games.';
    actions = (
      <>
        <button type="button" className="ho-btn ho-btn--primary" onClick={add} disabled={!!busy}>
          {busy === 'add' ? 'Sending...' : 'Add friend'}
        </button>
        <button type="button" className="ho-btn ho-btn--ghost" onClick={() => navigate(paths.hub())} disabled={!!busy}>
          Cancel
        </button>
      </>
    );
  }

  return (
    <div className="ho-page ho-join">
      <section className="ho-card ho-friendlink" aria-labelledby="ho-fl-title">
        <div className="ho-friendlink__avatar">
          <Avatar preset={Number.isInteger(person.avatar) ? person.avatar : 0} size={96} />
        </div>
        <span className="ho-eyebrow">Friend link</span>
        <h1 id="ho-fl-title" className="ho-h1">
          {title}
        </h1>
        <p className="ho-friendlink__who">
          <strong>{person.name}</strong>
          {Number.isFinite(person.level) && <span> · Level {person.level}</span>}
          <span className="ho-chip ho-chip--static ho-friendlink__code">{person.friendCode || code}</span>
        </p>
        <p className="ho-muted" aria-live="polite">
          {body}
        </p>
        <div className="ho-status__actions">{actions}</div>
      </section>
      {sheet && <InviteToGameSheet friend={{ id: person.id, name: person.name }} onClose={() => setSheet(false)} />}
      {node}
    </div>
  );
}
