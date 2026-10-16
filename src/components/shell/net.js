import { useCallback, useEffect, useState } from 'react';
import * as apiMod from '@/lib/api.js';

/* Everything that talks to the Worker goes through lib/api.js; these helpers add safety. */
const client = () => apiMod.api ?? apiMod.default ?? apiMod;

export const apiGet = (path) => client().get(path);
export const apiPost = (path, body) => client().post(path, body);
export const apiPatch = (path, body) => client().patch(path, body);

/** 'auth' (needs sign-in) or 'offline' (unreachable / server trouble). */
export function errKind(e) {
  const s = Number(e?.status);
  return s === 401 || s === 403 ? 'auth' : 'offline';
}

const inflight = new Map();

/**
 * Fetch JSON once per mount; returns { status:'idle'|'loading'|'ok'|'auth'|'offline', data, reload }.
 * Never throws: network failures become the 'offline' status so the UI can degrade gracefully.
 */
export function useRemote(path, { enabled = true } = {}) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', data: null });
      return undefined;
    }
    let alive = true;
    setState((s) => (s.status === 'ok' ? s : { status: 'loading', data: null }));
    let p = inflight.get(path);
    if (!p || nonce) {
      p = Promise.resolve().then(() => apiGet(path));
      inflight.set(path, p);
      const clear = () => setTimeout(() => inflight.get(path) === p && inflight.delete(path), 4000);
      p.then(clear, clear);
    }
    p.then(
      (data) => alive && setState({ status: 'ok', data }),
      (e) => alive && setState({ status: errKind(e), data: null }),
    );
    return () => {
      alive = false;
    };
  }, [path, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
