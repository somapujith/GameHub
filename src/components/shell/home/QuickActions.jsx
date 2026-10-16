import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scene } from '@/components/art/index.js';
import { Icon } from '../icons.jsx';
import { apiPost } from '../net.js';
import { useAccount } from '../hooks.js';
import { useToast } from '../Toast.jsx';

const ROOM_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** The four big entry points: Quick Play, Story Mode, Create Room, Join with code. */
export default function QuickActions() {
  const navigate = useNavigate();
  const toast = useToast();
  const { signedIn, loading } = useAccount();
  const [creating, setCreating] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const input = useRef(null);

  const toLogin = (next) => navigate(`/login?next=${encodeURIComponent(next)}`);

  const createRoom = async () => {
    if (creating || loading) return;
    if (!signedIn) return toLogin('/');
    setCreating(true);
    try {
      const res = await apiPost('/api/rooms', {});
      if (!res?.code) throw new Error('No room code returned');
      navigate(`/lobby/${res.code}`);
    } catch (e) {
      toast(e?.status ? e.message || 'Could not create a room.' : 'Cannot reach the server. Online rooms need a connection.', { tone: 'bad' });
      setCreating(false);
    }
  };

  const openJoin = () => {
    if (loading) return;
    if (!signedIn) return toLogin('/join');
    setJoinOpen((o) => {
      if (!o) setTimeout(() => input.current?.focus(), 60);
      return !o;
    });
    setErr('');
  };

  const submitJoin = (e) => {
    e.preventDefault();
    if (!ROOM_CODE.test(code)) {
      setErr('Room codes have 6 characters: letters A–Z and digits 2–9.');
      input.current?.focus();
      return;
    }
    navigate(`/lobby/${code}`);
  };

  return (
    <section className="hh-actions" aria-label="Play">
      <Link to="/play" className="hh-act hh-act--play">
        <span className="hh-act__scene" aria-hidden="true">
          <Scene name="banjara" />
        </span>
        <span className="hh-act__shade" aria-hidden="true" />
        <span className="hh-act__body">
          <span className="hh-act__icon">
            <Icon name="dice" size={26} />
          </span>
          <span className="hh-act__title">Quick Play</span>
          <span className="hh-act__sub">Vs bots · 2–4 players</span>
        </span>
        <Icon name="chevR" size={22} className="hh-act__go" />
      </Link>

      <Link to="/campaign" className="hh-act hh-act--story">
        <span className="hh-act__scene" aria-hidden="true">
          <Scene name="golconda" />
        </span>
        <span className="hh-act__shade" aria-hidden="true" />
        <span className="hh-act__body">
          <span className="hh-act__icon">
            <Icon name="map" size={26} />
          </span>
          <span className="hh-act__title">Story Mode</span>
          <span className="hh-act__sub">5 chapters · earn rewards</span>
        </span>
        <Icon name="chevR" size={22} className="hh-act__go" />
      </Link>

      <button type="button" className="hh-act hh-act--room" onClick={createRoom} disabled={creating || loading} aria-busy={creating}>
        <span className="hh-act__body hh-act__body--row">
          <span className="hh-act__icon">{creating ? <span className="hh-spinner" aria-hidden="true" /> : <Icon name="users" size={24} />}</span>
          <span className="hh-act__text">
            <span className="hh-act__title">{creating ? 'Creating…' : 'Create Room'}</span>
            <span className="hh-act__sub">{signedIn ? 'Invite friends' : 'Sign in to host'}</span>
          </span>
        </span>
      </button>

      <button
        type="button"
        className={`hh-act hh-act--join ${joinOpen ? 'is-open' : ''}`}
        onClick={openJoin}
        disabled={loading}
        aria-expanded={signedIn ? joinOpen : undefined}
        aria-controls="hh-join-form"
      >
        <span className="hh-act__body hh-act__body--row">
          <span className="hh-act__icon">
            <Icon name="key" size={24} />
          </span>
          <span className="hh-act__text">
            <span className="hh-act__title">Join with Code</span>
            <span className="hh-act__sub">{signedIn ? 'Enter 6 characters' : 'Sign in to join'}</span>
          </span>
        </span>
      </button>

      {signedIn && (
        <div id="hh-join-form" className={`hh-collapse hh-join ${joinOpen ? 'is-open' : ''}`}>
          <div className="hh-collapse__inner" inert={!joinOpen}>
            <form className="hh-join__form" onSubmit={submitJoin} noValidate>
              <div className="hh-field">
                <label className="hh-field__label" htmlFor="hh-join-code">
                  Room code
                </label>
                <div className="hh-join__row">
                  <input
                    ref={input}
                    id="hh-join-code"
                    className="hh-input hh-input--code"
                    value={code}
                    placeholder="ABC234"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    aria-invalid={!!err}
                    aria-describedby={err ? 'hh-join-err' : undefined}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                      setErr('');
                    }}
                  />
                  <button type="submit" className="btn btn--primary" disabled={code.length < 6}>
                    Join <Icon name="chevR" size={18} />
                  </button>
                </div>
              </div>
              {err && (
                <p id="hh-join-err" className="hh-join__err" role="alert">
                  {err}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
