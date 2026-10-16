import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from './api.js';
import { openUserSocket } from './socket.js';
import { InviteBanner } from '@/components/online/InviteBanner.jsx';

// Auth + the signed-in user's realtime socket.
//
//   const { user, loading, configured, loginWithGoogle, loginGuest, logout, refresh } = useAuth();
//
// The session itself is the httpOnly `hyd_session` cookie: nothing sensitive is kept in JS or localStorage.
// If the Worker is unreachable (plain `vite` dev), everything degrades to "signed out" without errors.

/** Exported so tests (and storybook-style harnesses) can provide a fake auth state. */
export const AuthContext = createContext(null);

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GIS_FAILED = "Couldn't load Google sign-in. Check your connection or disable the ad blocker for this site.";

// ---------------------------------------------------------------- Google Identity Services (lazy, once)

let gisPromise = null;
let gisInitFor = null;
const credentialHandler = { current: null };

function loadGis() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (g) => {
      if (settled) return;
      settled = true;
      if (!g) gisPromise = null; // allow a retry
      resolve(g);
    };
    let script = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => finish(window.google?.accounts?.id ? window.google : null), { once: true });
    script.addEventListener(
      'error',
      () => {
        script.remove();
        finish(null);
      },
      { once: true },
    );
    setTimeout(() => finish(window.google?.accounts?.id ? window.google : null), 12000);
  });
  return gisPromise;
}

function initGis(g, clientId) {
  if (gisInitFor === clientId) return;
  g.accounts.id.initialize({
    client_id: clientId,
    callback: (resp) => credentialHandler.current?.(resp),
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
  });
  gisInitFor = clientId;
}

// ---------------------------------------------------------------- provider

const NOTICE_MAX = 4;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [reachable, setReachable] = useState(true); // false when neither /api/config nor /api/me answered
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [socketStatus, setSocketStatus] = useState('closed');
  const [notices, setNotices] = useState([]);
  const userRef = useRef(null);
  const listeners = useRef(new Map()); // type | '*' -> Set<fn>

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const reloadConfig = useCallback(async () => {
    try {
      const cfg = await api.get('/api/config');
      const id = cfg && typeof cfg.googleClientId === 'string' && cfg.googleClientId ? cfg.googleClientId : null;
      setGoogleClientId(id);
      setReachable(true);
      return !!id;
    } catch {
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/api/me');
      const u = r && r.user ? r.user : null;
      setUser(u);
      setReachable(true);
      return u;
    } catch (e) {
      // Offline blips must not sign a signed-in user out in the UI; a real 401 does.
      if (e && e.status === 401) setUser(null);
      return userRef.current;
    }
  }, []);

  // Initial load: config + current user. Never throws, never crashes the app.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [cfg, me] = await Promise.allSettled([api.get('/api/config'), api.get('/api/me')]);
      if (!alive) return;
      setReachable(cfg.status === 'fulfilled' || me.status === 'fulfilled');
      if (cfg.status === 'fulfilled' && cfg.value && typeof cfg.value.googleClientId === 'string' && cfg.value.googleClientId) {
        setGoogleClientId(cfg.value.googleClientId);
      }
      if (me.status === 'fulfilled' && me.value && me.value.user) setUser(me.value.user);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- login / logout

  const handleCredential = useCallback(
    async (resp) => {
      const credential = typeof resp === 'string' ? resp : resp && resp.credential;
      if (!credential) return null;
      setAuthError(null);
      setSigningIn(true);
      try {
        await api.post('/api/auth/google', { credential });
        const u = await refresh();
        if (!u) throw new Error('Signed in, but the session cookie was not accepted. Check that cookies are enabled.');
        return u;
      } catch (e) {
        setAuthError(errorMessage(e, 'Google sign-in failed. Please try again.'));
        return null;
      } finally {
        setSigningIn(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    credentialHandler.current = handleCredential;
    return () => {
      if (credentialHandler.current === handleCredential) credentialHandler.current = null;
    };
  }, [handleCredential]);

  /**
   * No argument: shows the Google One Tap prompt (sign-in completes through the credential callback and
   * updates `user`). With a credential string: posts it straight away. `{silent:true}` suppresses the error
   * state when the prompt cannot be shown (used for the automatic One Tap). Never rejects.
   */
  const loginWithGoogle = useCallback(
    async (credential, { silent = false } = {}) => {
      if (typeof credential === 'string' && credential) return handleCredential(credential);
      const fail = (msg) => {
        if (!silent) setAuthError(msg);
        return null;
      };
      if (!silent) setAuthError(null);
      if (!googleClientId) return fail('Google login is not configured yet.');
      const g = await loadGis();
      if (!g) return fail(GIS_FAILED);
      try {
        initGis(g, googleClientId);
        g.accounts.id.prompt();
      } catch {
        return fail(GIS_FAILED);
      }
      return null;
    },
    [googleClientId, handleCredential],
  );

  /** Throws `{status,message}` when the Worker rejects the name or is unreachable. */
  const loginGuest = useCallback(
    async (name, avatar) => {
      const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Guest';
      setAuthError(null);
      const body = { name: clean };
      if (Number.isInteger(avatar) && avatar >= 0 && avatar <= 11) body.avatar = avatar;
      await api.post('/api/auth/guest', body);
      const u = await refresh();
      if (!u) {
        const err = new Error('Could not start a guest session. Check that cookies are enabled.');
        err.status = 0;
        throw err;
      }
      return u;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* offline: still sign out locally */
    }
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch {
      /* GIS not loaded */
    }
    setNotices([]);
    setUser(null);
  }, []);

  /** PATCH /api/me {name?, avatar?}; resolves to the updated user. Throws `{status,message}`. */
  const updateProfile = useCallback(
    async (patch) => {
      await api.patch('/api/me', patch);
      return refresh();
    },
    [refresh],
  );

  // ---- user socket (signed-in, non-guest)

  const subscribe = useCallback((types, fn) => {
    const list = Array.isArray(types) ? types : [types || '*'];
    for (const t of list) {
      if (!listeners.current.has(t)) listeners.current.set(t, new Set());
      listeners.current.get(t).add(fn);
    }
    return () => list.forEach((t) => listeners.current.get(t)?.delete(fn));
  }, []);

  const dismissNotice = useCallback((key) => setNotices((cur) => cur.filter((n) => n.key !== key)), []);

  const pushNotice = useCallback((n) => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/game/')) return; // never cover a running game
    if (n.kind !== 'invite' && path.startsWith('/friends')) return; // that page already updates live
    if (n.kind === 'invite' && n.code && path === `/lobby/${n.code}`) return;
    const key = `${n.kind}:${n.from?.id ?? ''}:${n.code ?? ''}`;
    setNotices((cur) => [...cur.filter((x) => x.key !== key), { ...n, key }].slice(-NOTICE_MAX));
  }, []);

  const uid = user && !user.isGuest ? String(user.id) : null;
  useEffect(() => {
    if (!uid) {
      setSocketStatus('closed');
      return undefined;
    }
    const sock = openUserSocket();
    const deliver = (msg) => {
      if (!msg || typeof msg.t !== 'string') return;
      for (const key of [msg.t, '*']) {
        for (const fn of [...(listeners.current.get(key) || [])]) {
          try {
            fn(msg);
          } catch {
            /* a bad subscriber must not break the socket */
          }
        }
      }
      if (msg.t === 'invite' && typeof msg.code === 'string') pushNotice({ kind: 'invite', from: msg.from, code: msg.code });
      else if (msg.t === 'friend_request') pushNotice({ kind: 'friend_request', from: msg.from });
      else if (msg.t === 'friend_accepted') pushNotice({ kind: 'friend_accepted', from: msg.by });
    };
    const offs = [sock.on('status', (s) => setSocketStatus(s)), sock.on('message', deliver)];
    return () => {
      offs.forEach((off) => off());
      sock.close();
      setSocketStatus('closed');
    };
  }, [uid, pushNotice]);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: !!googleClientId,
      googleClientId,
      reachable,
      authError,
      clearAuthError: () => setAuthError(null),
      signingIn,
      loginWithGoogle,
      loginGuest,
      logout,
      refresh,
      reloadConfig,
      updateProfile,
      subscribe,
      userSocketStatus: socketStatus,
    }),
    [user, loading, googleClientId, reachable, authError, signingIn, loginWithGoogle, loginGuest, logout, refresh, reloadConfig, updateProfile, subscribe, socketStatus],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <InviteBanner items={notices} onDismiss={dismissNotice} />
    </AuthContext.Provider>
  );
}

const NOOP_AUTH = {
  user: null,
  loading: false,
  configured: false,
  googleClientId: null,
  reachable: false,
  authError: null,
  clearAuthError: () => {},
  signingIn: false,
  loginWithGoogle: async () => null,
  loginGuest: async () => {
    const err = new Error('Sign-in is unavailable');
    err.status = 0;
    throw err;
  },
  logout: async () => {},
  refresh: async () => null,
  reloadConfig: async () => false,
  updateProfile: async () => null,
  subscribe: () => () => {},
  userSocketStatus: 'closed',
};

/** `{ user|null, loading, configured, loginWithGoogle, loginGuest, logout, refresh, … }`. Safe without a provider. */
export function useAuth() {
  return useContext(AuthContext) || NOOP_AUTH;
}

/** `{ status, subscribe(types, fn) → unsubscribe }` for the signed-in user's socket (status: connecting | open | reconnecting | closed). */
export function useUserSocket() {
  const { subscribe, userSocketStatus } = useAuth();
  return { status: userSocketStatus, subscribe };
}

/**
 * Subscribe to user-socket messages: `useUserEvents(handler, ['friend_request','presence'])`.
 * `types` omitted = every message. Message types: friend_request, friend_accepted, invite, presence.
 */
export function useUserEvents(handler, types) {
  const { subscribe } = useAuth();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const key = Array.isArray(types) ? types.join(',') : types || '*';
  useEffect(() => subscribe(key.split(','), (msg) => ref.current?.(msg)), [subscribe, key]);
}

// ---------------------------------------------------------------- Google button

const quantise = (w) => Math.max(200, Math.min(400, Math.round(w / 10) * 10));

/**
 * The official Google button (rendered by GIS into our div), themed and as wide as its container (200-400px).
 * Not configured => a clear explanatory note instead (guest login still works elsewhere on the page).
 */
export function GoogleButton({ theme = 'outline', text = 'continue_with', shape = 'pill', size = 'large', className = '' }) {
  const { configured, googleClientId, signingIn } = useAuth();
  const boxRef = useRef(null);
  const slotRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    let t = null;
    const measure = () => {
      clearTimeout(t);
      t = setTimeout(() => setWidth(quantise(el.getBoundingClientRect().width || 0)), 60);
    };
    setWidth(quantise(el.getBoundingClientRect().width || 0));
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => {
        clearTimeout(t);
        ro.disconnect();
      };
    }
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [configured]);

  useEffect(() => {
    if (!configured || !googleClientId || !width) return undefined;
    let cancelled = false;
    loadGis().then((g) => {
      if (cancelled) return;
      if (!g) {
        setState('failed');
        return;
      }
      try {
        initGis(g, googleClientId);
        const slot = slotRef.current;
        if (!slot) return;
        slot.replaceChildren();
        g.accounts.id.renderButton(slot, { type: 'standard', theme, size, text, shape, logo_alignment: 'left', width });
        setState('ready');
      } catch {
        setState('failed');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, googleClientId, width, theme, size, text, shape, attempt]);

  if (!configured) {
    return (
      <div className={`ho-gbtn ho-gbtn--off ${className}`} role="note">
        <strong>Google login is not configured yet</strong>
        <span>The game host still needs to add a Google client ID. You can play as a guest meanwhile.</span>
      </div>
    );
  }

  return (
    <div className={`ho-gbtn ${className}`} ref={boxRef}>
      {state === 'failed' ? (
        <div className="ho-gbtn__fail" role="alert">
          <span>{GIS_FAILED}</span>
          <button
            type="button"
            className="ho-btn ho-btn--ghost ho-btn--sm"
            onClick={() => {
              setState('loading');
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="ho-gbtn__frame">
          <div ref={slotRef} className="ho-gbtn__slot" />
          {state === 'loading' && <div className="ho-gbtn__skeleton ho-skel" aria-hidden="true" />}
          {signingIn && (
            <div className="ho-gbtn__busy" role="status">
              <span className="ho-spinner" aria-hidden="true" /> Signing you in...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AuthProvider;
