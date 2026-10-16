// "Notify me" for coming-soon games: a purely local flag in localStorage under `hyd:notify:<gameId>`.
// Storage can be blocked (private windows, embedded previews), so every access is wrapped and a small
// in-memory map keeps the toggle working for the rest of the session.
import { useCallback, useSyncExternalStore } from 'react';

const key = (id) => `hyd:notify:${id}`;
const mem = new Map();
const subs = new Set();

export function isNotified(id) {
  try {
    const v = window.localStorage.getItem(key(id));
    if (v !== null) return v === '1';
  } catch {
    /* storage unavailable: fall through to memory */
  }
  return mem.get(id) === true;
}

export function setNotified(id, on) {
  mem.set(id, !!on);
  try {
    if (on) window.localStorage.setItem(key(id), '1');
    else window.localStorage.removeItem(key(id));
  } catch {
    /* ignore: the in-memory flag still applies */
  }
  subs.forEach((fn) => fn());
}

function subscribe(fn) {
  subs.add(fn);
  const onStorage = (e) => {
    if (!e.key || e.key.startsWith('hyd:notify:')) fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    subs.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** `[notified, toggle()]` for one game id. */
export function useNotify(id) {
  const on = useSyncExternalStore(
    subscribe,
    () => isNotified(id),
    () => false,
  );
  const toggle = useCallback(() => setNotified(id, !isNotified(id)), [id]);
  return [on, toggle];
}
