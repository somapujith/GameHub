import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/art/index.js';
import { api, errorMessage } from '@/lib/api.js';
import { useUserEvents } from '@/lib/auth.jsx';
import { applyPresence, normalizeFriends } from './friendsModel.js';
import '@/styles/online.css';

const RESEND_AFTER = 30000;

/** Lobby panel: one tap invites an online friend to this room (POST /api/invites). */
export default function InviteFriends({ code, onNotify }) {
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [sent, setSent] = useState({}); // userId -> 'sending' | 'sent'
  const timers = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const set = timers.current;
    return () => {
      alive.current = false;
      set.forEach((t) => clearTimeout(t));
      set.clear();
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const raw = await api.get('/api/friends');
      if (alive.current) setData(normalizeFriends(raw));
    } catch (e) {
      if (alive.current) setError(errorMessage(e, 'Could not load your friends'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useUserEvents((msg) => setData((d) => (d ? applyPresence(d, msg.userId, msg.online) : d)), ['presence']);

  const invite = async (friend) => {
    setSent((s) => ({ ...s, [friend.id]: 'sending' }));
    try {
      await api.post('/api/invites', { code, userId: friend.id });
      if (!alive.current) return;
      setSent((s) => ({ ...s, [friend.id]: 'sent' }));
      onNotify?.(`Invite sent to ${friend.name}`, 'good');
      const t = setTimeout(() => {
        timers.current.delete(t);
        if (alive.current) setSent((s) => ({ ...s, [friend.id]: undefined }));
      }, RESEND_AFTER);
      timers.current.add(t);
    } catch (e) {
      if (!alive.current) return;
      setSent((s) => ({ ...s, [friend.id]: undefined }));
      onNotify?.(errorMessage(e, 'Could not send the invite'), 'bad');
    }
  };

  return (
    <section className="ho-card ho-invite" aria-label="Invite friends">
      <div className="ho-card__head">
        <h2 className="ho-h2">Invite friends</h2>
        {data && data.friends.length > 0 && <span className="ho-muted">{data.friends.filter((f) => f.online).length} online</span>}
      </div>

      {error ? (
        <div className="ho-inline-error" role="alert">
          <span>{error}</span>
          <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={load}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <ul className="ho-list" aria-busy="true" aria-label="Loading friends">
          {[0, 1].map((i) => (
            <li key={i} className="ho-row ho-skel-row" aria-hidden="true">
              <span className="ho-skel ho-skel--circle" />
              <span className="ho-skel ho-skel--line" />
            </li>
          ))}
        </ul>
      ) : data.friends.length === 0 ? (
        <p className="ho-empty">
          No friends yet. Share the link above, or <Link to={`/friends?room=${code}`}>add friends</Link> to invite them in one tap.
        </p>
      ) : (
        <ul className="ho-list">
          {data.friends.map((f) => {
            const state = sent[f.id];
            return (
              <li key={f.id} className="ho-row">
                <span className="ho-row__avatar">
                  <Avatar preset={f.avatar} size={40} />
                  <span className={`ho-dot ho-row__dot ${f.online ? 'is-on' : 'is-off'}`} role="img" aria-label={f.online ? 'Online' : 'Offline'} />
                </span>
                <span className="ho-row__main">
                  <span className="ho-row__name">{f.name}</span>
                  <span className="ho-row__sub">{f.online ? 'Online now' : 'Offline'} · Lv {f.level}</span>
                </span>
                <button
                  type="button"
                  className={`ho-btn ho-btn--sm ${state === 'sent' ? 'ho-btn--ghost' : 'ho-btn--primary'}`}
                  onClick={() => invite(f)}
                  disabled={!f.online || state === 'sending' || state === 'sent'}
                  aria-label={`Invite ${f.name}`}
                >
                  {state === 'sending' ? 'Sending...' : state === 'sent' ? 'Invited' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
