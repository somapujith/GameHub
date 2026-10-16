import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AVATAR_PRESETS, Avatar, Logo, Scene } from '@/components/art/index.js';
import { errorMessage } from '@/lib/api.js';
import { GoogleButton, useAuth } from '@/lib/auth.jsx';
import { loadProfile } from '@/lib/storage.js';
import { safeNext } from '@/components/online/codes.js';
import { Loading } from '@/components/online/StatusPanel.jsx';
import '@/styles/online.css';

const NAME_MAX = 24;

function readProfile() {
  try {
    return loadProfile() || {};
  } catch {
    return {};
  }
}

export default function Login() {
  const { user, loading, configured, reachable, authError, clearAuthError, loginWithGoogle, loginGuest, logout, reloadConfig, refresh } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const profile = useMemo(readProfile, []);
  const [name, setName] = useState(profile.name && profile.name !== 'Guest' ? String(profile.name).slice(0, NAME_MAX) : '');
  const [avatar, setAvatar] = useState(Number.isInteger(profile.avatar) ? profile.avatar : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const prompted = useRef(false);

  // Google One Tap, once per visit, only when it can actually succeed
  useEffect(() => {
    if (loading || !configured || prompted.current) return;
    if (user && !user.isGuest) return;
    prompted.current = true;
    loginWithGoogle(undefined, { silent: true });
  }, [loading, configured, user, loginWithGoogle]);

  // Signed in with Google (or just became a guest here): go where the user was headed.
  // A guest who opened this page on purpose (to upgrade) stays and sees the Google option.
  if (!loading && user && (!user.isGuest || justLoggedIn)) return <Navigate to={next} replace />;

  const retry = async () => {
    setRetrying(true);
    await Promise.all([reloadConfig(), refresh()]);
    setRetrying(false);
  };

  const submitGuest = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    clearAuthError();
    try {
      await loginGuest(name, avatar);
      setJustLoggedIn(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not start a guest session'));
    } finally {
      setBusy(false);
    }
  };

  const isGuestUser = !!(user && user.isGuest);

  return (
    <div className="ho-page ho-login">
      <header className="ho-hero">
        <Scene name="charminar" className="ho-hero__scene" />
        <div className="ho-hero__shade" aria-hidden="true" />
        <div className="ho-hero__inner">
          <Logo size={56} />
          <p className="ho-hero__tag">
            Play with friends, anywhere in Hyderabad.
            <span lang="te"> స్నేహితులతో ఆడుకుందాం!</span>
          </p>
        </div>
      </header>

      <section className="ho-card ho-login__card" aria-labelledby="ho-login-title">
        {loading ? (
          <Loading text="Checking your session..." />
        ) : !reachable ? (
          <div className="ho-login__offline" role="alert">
            <h1 id="ho-login-title" className="ho-h1">
              Can&rsquo;t reach the game server
            </h1>
            <p className="ho-muted">Online rooms and friends need the server. Check your connection, or play offline against bots meanwhile.</p>
            <div className="ho-status__actions">
              <button type="button" className="ho-btn ho-btn--primary" onClick={retry} disabled={retrying}>
                {retrying ? 'Trying...' : 'Try again'}
              </button>
              <Link to="/play" className="ho-btn ho-btn--ghost">
                Play offline
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 id="ho-login-title" className="ho-h1">
              {isGuestUser ? 'Sign in with Google' : 'Sign in to play online'}
            </h1>
            <p className="ho-muted">
              {isGuestUser
                ? `You are playing as ${user.name} (guest). Sign in with Google to add friends and appear on the leaderboard.`
                : 'Save your progress, add friends and climb the leaderboard.'}
            </p>

            <div className="ho-login__google">
              <GoogleButton />
              {authError && (
                <p className="ho-inline-error" role="alert">
                  {authError}
                </p>
              )}
            </div>

            {isGuestUser ? (
              <div className="ho-status__actions ho-login__guestactions">
                <button type="button" className="ho-btn ho-btn--primary" onClick={() => navigate(next, { replace: true })}>
                  Continue as guest
                </button>
                <button type="button" className="ho-btn ho-btn--ghost" onClick={logout}>
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <div className="ho-or" role="separator">
                  <span>or</span>
                </div>

                <form className="ho-login__guest" onSubmit={submitGuest} noValidate>
                  <h2 className="ho-h2">Play as guest</h2>
                  <label className="ho-field__label" htmlFor="ho-guest-name">
                    Your name
                  </label>
                  <input
                    id="ho-guest-name"
                    className="ho-input"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                    maxLength={NAME_MAX}
                    placeholder="e.g. Biryani Bhai"
                    autoComplete="nickname"
                    enterKeyHint="go"
                  />

                  <fieldset className="ho-avatars">
                    <legend className="ho-field__label">Pick your character</legend>
                    <div className="ho-avatars__grid">
                      {AVATAR_PRESETS.map((p) => (
                        <label key={p.id} className={`ho-avatar-opt${avatar === p.id ? ' is-on' : ''}`} title={p.label}>
                          <input type="radio" name="avatar" value={p.id} checked={avatar === p.id} onChange={() => setAvatar(p.id)} className="ho-sr" />
                          <Avatar preset={p.id} size={48} />
                          <span className="ho-sr">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {error && (
                    <p className="ho-inline-error" role="alert">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="ho-btn ho-btn--primary ho-btn--block" disabled={busy}>
                    {busy ? 'Starting...' : 'Play as guest'}
                  </button>
                </form>

                <ul className="ho-guestnote" aria-label="What guests can and cannot do">
                  <li className="is-yes">Guests can host and join rooms, and play offline.</li>
                  <li className="is-no">Guests cannot add friends, get invites, appear on the leaderboard or keep progress on another device.</li>
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
