import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/art/index.js';
import { api, errorMessage, sendInvite } from '@/lib/api.js';
import { useAuth, useUserEvents } from '@/lib/auth.jsx';
import { paths } from '@/platform/paths.js';
import { canShare, shareOrCopy, useCopied } from '@/components/online/clipboard.js';
import { friendInviteMessage, friendLinkUrl, isFriendCode, isRoomCode, normalizeFriendCode, normalizeRoomCode, parseFriendLink } from '@/components/online/codes.js';
import ConfirmDialog from '@/components/online/ConfirmDialog.jsx';
import InviteToGameSheet from '@/components/online/InviteToGameSheet.jsx';
import StatusPanel, { Loading } from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
import {
  acceptLocal,
  addFriend,
  addIncoming,
  applyPresence,
  countOnline,
  emptyFriends,
  normalizeFriends,
  removeFriend,
  removeIncoming,
  removeOutgoing,
} from '@/components/online/friendsModel.js';
import '@/styles/online.css';

function Dot({ online }) {
  return <span className={`ho-dot ho-row__dot ${online ? 'is-on' : 'is-off'}`} role="img" aria-label={online ? 'Online' : 'Offline'} />;
}

function SkeletonRows({ n = 3 }) {
  return (
    <ul className="ho-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="ho-row ho-skel-row" aria-hidden="true">
          <span className="ho-skel ho-skel--circle" />
          <span className="ho-skel ho-skel--line" />
        </li>
      ))}
    </ul>
  );
}

/** /friends: the People tab. */
export default function Friends() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="ho-page">
        <Loading text="Loading friends..." />
      </div>
    );
  }
  if (!user || user.isGuest) {
    const here = paths.friends() + (typeof window !== 'undefined' ? window.location.search : '');
    return (
      <div className="ho-page">
        <StatusPanel
          icon="👥"
          title={user ? 'Friends are for Google accounts' : 'Sign in to add friends'}
          body={
            user
              ? 'Guests can host and join rooms with a code or link. Sign in with Google to add friends, see who is online and invite them to a game in one tap.'
              : 'Add friends with a friend link, see who is online and invite them to a game in one tap.'
          }
          actions={[
            { label: user ? 'Sign in with Google' : 'Sign in', to: paths.login(here), primary: true },
            { label: 'Join a room with a code', to: paths.join() },
          ]}
        />
      </div>
    );
  }
  return <FriendsInner user={user} />;
}

function FriendsInner({ user }) {
  const [params] = useSearchParams();
  const rawRoom = normalizeRoomCode(params.get('room') || '');
  const room = isRoomCode(rawRoom) ? rawRoom : '';
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [inviteSheet, setInviteSheet] = useState(null); // friend picked for "Invite to game"
  const [invited, setInvited] = useState({});
  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [codeCopied, copyCode] = useCopied();
  const [linkCopied, copyLink] = useCopied();
  const { push, node } = useToasts();
  const dataRef = useRef(null);
  const addRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  });

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadError(null);
    try {
      const raw = await api.get('/api/friends');
      setData(normalizeFriends(raw));
      setLoadError(null);
    } catch (e) {
      if (!silent) setLoadError(errorMessage(e, 'Could not load your friends'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // refresh quietly when the tab regains focus (requests may have arrived while we were away)
  useEffect(() => {
    const onFocus = () => load({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // live updates from the user socket
  useUserEvents(
    (msg) => {
      if (msg.t === 'presence') setData((d) => (d ? applyPresence(d, msg.userId, msg.online) : d));
      else if (msg.t === 'friend_request') {
        setData((d) => addIncoming(d || emptyFriends(), msg.from));
        load({ silent: true });
      } else if (msg.t === 'friend_accepted') {
        setData((d) => addFriend(d || emptyFriends(), { ...msg.by, online: true }));
        if (msg.by && msg.by.name) push(`${msg.by.name} accepted your request`, 'good');
        load({ silent: true });
      }
    },
    ['presence', 'friend_request', 'friend_accepted'],
  );

  /** Optimistic update + request; rolls back and resyncs on failure. */
  const mutate = useCallback(
    async (userId, optimistic, request, { success, failure }) => {
      const prev = dataRef.current;
      setBusy((b) => ({ ...b, [userId]: true }));
      if (optimistic) setData((d) => (d ? optimistic(d) : d));
      try {
        await request();
        if (success) push(success, 'good');
        load({ silent: true });
      } catch (e) {
        setData(prev);
        push(errorMessage(e, failure), 'bad');
        load({ silent: true });
      } finally {
        setBusy((b) => {
          const n = { ...b };
          delete n[userId];
          return n;
        });
      }
    },
    [load, push],
  );

  const accept = (u) =>
    mutate(u.id, (d) => acceptLocal(d, u.id), () => api.post('/api/friends/accept', { userId: u.id }), {
      success: `You and ${u.name} are friends now`,
      failure: 'Could not accept the request',
    });
  const decline = (u) =>
    mutate(u.id, (d) => removeIncoming(d, u.id), () => api.post('/api/friends/decline', { userId: u.id }), { failure: 'Could not decline the request' });
  const cancel = (u) =>
    mutate(u.id, (d) => removeOutgoing(d, u.id), () => api.del(`/api/friends/${encodeURIComponent(u.id)}`), {
      success: 'Request cancelled',
      failure: 'Could not cancel the request',
    });
  const remove = (u) =>
    mutate(u.id, (d) => removeFriend(d, u.id), () => api.del(`/api/friends/${encodeURIComponent(u.id)}`), {
      success: `${u.name} removed`,
      failure: 'Could not remove this friend',
    });

  /** Invite to the room we came here from (`/friends?room=CODE`). */
  const inviteToRoom = async (u) => {
    setInvited((s) => ({ ...s, [u.id]: 'sending' }));
    try {
      await sendInvite(room, u.id);
      setInvited((s) => ({ ...s, [u.id]: 'sent' }));
      push(`Invite sent to ${u.name}`, 'good');
    } catch (e) {
      setInvited((s) => ({ ...s, [u.id]: undefined }));
      push(errorMessage(e, 'Could not send the invite'), 'bad');
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    const c = parseFriendLink(code);
    if (!isFriendCode(c)) {
      setAddError('Friend codes look like HYD-7K2Q (4 letters or numbers after HYD-). You can also paste a friend link.');
      addRef.current?.focus();
      return;
    }
    if (c === user.friendCode) {
      setAddError('That is your own code. Share it with a friend instead.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await api.post('/api/friends/request', { friendCode: c });
      setCode('');
      push('Friend request sent', 'good');
      load({ silent: true });
    } catch (err) {
      const msg = errorMessage(err, 'Could not send the request');
      setAddError(msg);
      push(msg, 'bad');
    } finally {
      setAdding(false);
    }
  };

  const link = user.friendCode ? friendLinkUrl(user.friendCode) : '';
  const share = async () => {
    const res = await shareOrCopy(friendInviteMessage(user.friendCode));
    if (res === 'copied') push('Friend link copied', 'good');
    else if (res === 'failed') push('Could not share. Copy your link instead.', 'bad');
  };

  const d = data || emptyFriends();
  const online = countOnline(d);

  // an old share link (`/friends?add=HYD-7K2Q`) opens the "Add <name>?" screen instead
  const legacyAdd = parseFriendLink(params.get('add') || '');
  if (legacyAdd) return <Navigate to={paths.friendLink(legacyAdd)} replace />;

  return (
    <div className="ho-page ho-friends">
      <header className="ho-head">
        <div>
          <h1 className="ho-h1">Friends</h1>
          <p className="ho-muted">Add people once, then invite them to any game.</p>
        </div>
        {data && d.friends.length > 0 && <span className="ho-pill">{online} online</span>}
      </header>

      {room && (
        <div className="ho-banner ho-banner--info" role="status">
          <span>
            Inviting to room <strong>{room}</strong>. Tap Invite next to an online friend.
          </span>
          <Link to={paths.lobby(room)} className="ho-btn ho-btn--ghost ho-btn--sm">
            Back to lobby
          </Link>
        </div>
      )}

      <div className="ho-grid">
        <div className="ho-col">
          <section className="ho-card ho-mycode" aria-label="Your friend link">
            <span className="ho-eyebrow">Your friend code</span>
            <div className="ho-bigcode ho-bigcode--friend" aria-label={`Your friend code ${user.friendCode}`}>
              {user.friendCode || '...'}
            </div>
            <div className="ho-linkrow">
              <input className="ho-input ho-linkrow__input" readOnly value={link} aria-label="Your friend link" onFocus={(e) => e.target.select()} placeholder="Your friend link" />
              <button
                type="button"
                className="ho-btn ho-btn--ghost"
                onClick={async () => {
                  if (!(await copyLink(link))) push('Could not copy the link.', 'bad');
                }}
                disabled={!link}
              >
                {linkCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <div className="ho-share__actions">
              <button
                type="button"
                className="ho-btn ho-btn--ghost"
                onClick={async () => {
                  if (!(await copyCode(user.friendCode))) push('Could not copy. Select the code and copy it manually.', 'bad');
                }}
                disabled={!user.friendCode}
              >
                {codeCopied ? 'Copied!' : 'Copy code'}
              </button>
              <button type="button" className="ho-btn ho-btn--primary" onClick={share} disabled={!user.friendCode}>
                {canShare() ? 'Share link' : 'Copy invite'}
              </button>
            </div>
            <p className="ho-help">Anyone who opens your link can add you in one tap. No account needed to look.</p>
          </section>

          <section className="ho-card" aria-label="Add a friend by code">
            <h2 className="ho-h2">Add by code</h2>
            <form onSubmit={submitAdd} noValidate className="ho-addform">
              <label className="ho-field__label" htmlFor="ho-add-code">
                Friend code or link
              </label>
              <div className="ho-addform__row">
                <input
                  id="ho-add-code"
                  ref={addRef}
                  className="ho-input ho-input--code"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value;
                    // a pasted link/code becomes the clean code; plain typing is normalised as you go
                    setCode(parseFriendLink(v) || (v.includes('/') ? v : normalizeFriendCode(v)));
                    if (addError) setAddError('');
                  }}
                  placeholder="HYD-7K2Q"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  aria-invalid={addError ? true : undefined}
                  aria-describedby={addError ? 'ho-add-error' : undefined}
                />
                <button type="submit" className="ho-btn ho-btn--primary" disabled={adding || !code}>
                  {adding ? 'Sending...' : 'Add'}
                </button>
              </div>
              {addError && (
                <p id="ho-add-error" className="ho-inline-error" role="alert">
                  {addError}
                </p>
              )}
            </form>
          </section>
        </div>

        <div className="ho-col">
          {loadError ? (
            <section className="ho-card">
              <div className="ho-inline-error" role="alert">
                <span>{loadError}</span>
                <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={() => load()}>
                  Try again
                </button>
              </div>
            </section>
          ) : (
            <>
              {(!data || d.incoming.length > 0) && (
                <section className="ho-card" aria-label="Friend requests">
                  <div className="ho-card__head">
                    <h2 className="ho-h2">Requests</h2>
                    {d.incoming.length > 0 && <span className="ho-count">{d.incoming.length}</span>}
                  </div>
                  {!data ? (
                    <SkeletonRows n={1} />
                  ) : (
                    <ul className="ho-list">
                      {d.incoming.map((u) => (
                        <li key={u.id} className="ho-row">
                          <span className="ho-row__avatar">
                            <Avatar preset={u.avatar} size={44} />
                          </span>
                          <span className="ho-row__main">
                            <span className="ho-row__name">{u.name}</span>
                            <span className="ho-row__sub">wants to be friends</span>
                          </span>
                          <span className="ho-row__actions">
                            <button type="button" className="ho-btn ho-btn--primary ho-btn--sm" onClick={() => accept(u)} disabled={!!busy[u.id]} aria-label={`Accept request from ${u.name}`}>
                              Accept
                            </button>
                            <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={() => decline(u)} disabled={!!busy[u.id]} aria-label={`Decline request from ${u.name}`}>
                              Decline
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section className="ho-card" aria-label="Your friends">
                <div className="ho-card__head">
                  <h2 className="ho-h2">Your friends</h2>
                  {data && d.friends.length > 0 && <span className="ho-count">{d.friends.length}</span>}
                </div>
                {!data ? (
                  <SkeletonRows />
                ) : d.friends.length === 0 ? (
                  <p className="ho-empty">
                    No friends yet. Share your friend link above, or add a friend by code. Friends show up here with a green dot when they are online, and you can invite them to any game.
                  </p>
                ) : (
                  <ul className="ho-list">
                    {d.friends.map((f) => {
                      const st = invited[f.id];
                      return (
                        <li key={f.id} className="ho-row">
                          <span className="ho-row__avatar">
                            <Avatar preset={f.avatar} size={44} />
                            <Dot online={f.online} />
                          </span>
                          <span className="ho-row__main">
                            <span className="ho-row__name">{f.name}</span>
                            <span className="ho-row__sub">
                              {f.online ? 'Online' : 'Offline'} · Lv {f.level}
                            </span>
                          </span>
                          <span className="ho-row__actions">
                            {room ? (
                              <button
                                type="button"
                                className={`ho-btn ho-btn--sm ${st === 'sent' ? 'ho-btn--ghost' : 'ho-btn--primary'}`}
                                onClick={() => inviteToRoom(f)}
                                disabled={!f.online || st === 'sending' || st === 'sent'}
                                aria-label={`Invite ${f.name} to room ${room}`}
                              >
                                {st === 'sending' ? 'Sending...' : st === 'sent' ? 'Invited' : 'Invite'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ho-btn ho-btn--primary ho-btn--sm"
                                onClick={() => setInviteSheet(f)}
                                disabled={!f.online}
                                title={f.online ? undefined : `${f.name} is offline`}
                                aria-label={`Invite ${f.name} to a game`}
                              >
                                <span className="ho-narrow">Invite</span>
                                <span className="ho-wide">Invite to game</span>
                              </button>
                            )}
                            <button type="button" className="ho-iconbtn" onClick={() => setConfirm(f)} disabled={!!busy[f.id]} aria-label={`Remove ${f.name} from friends`}>
                              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {data && d.outgoing.length > 0 && (
                <section className="ho-card" aria-label="Sent requests">
                  <div className="ho-card__head">
                    <h2 className="ho-h2">Sent requests</h2>
                    <span className="ho-count">{d.outgoing.length}</span>
                  </div>
                  <ul className="ho-list">
                    {d.outgoing.map((u) => (
                      <li key={u.id} className="ho-row">
                        <span className="ho-row__avatar">
                          <Avatar preset={u.avatar} size={44} />
                        </span>
                        <span className="ho-row__main">
                          <span className="ho-row__name">{u.name}</span>
                          <span className="ho-row__sub">Waiting for them to accept</span>
                        </span>
                        <span className="ho-row__actions">
                          <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={() => cancel(u)} disabled={!!busy[u.id]} aria-label={`Cancel request to ${u.name}`}>
                            Cancel
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {inviteSheet && <InviteToGameSheet friend={inviteSheet} onClose={() => setInviteSheet(null)} />}

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `Remove ${confirm.name}?` : ''}
        body="You will no longer see each other online or be able to invite each other. You can add them again with their code."
        confirmLabel="Remove"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const f = confirm;
          setConfirm(null);
          if (f) remove(f);
        }}
      />
      {node}
    </div>
  );
}
