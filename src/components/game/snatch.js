// Snatch window (docs/GAME_RULES.md section 9) as the control panel sees it.
//   snatchInfo(session)      pure: the open window from the LATEST state, or null
//   useSnatchClock(session)  { remainingMs, fraction, seconds, totalMs } counting down from when the state arrived
//
// Everything here reads `session.view` (the newest authoritative state), never the animated `session.display`:
// the window is real time and must not wait behind the presenter's queue. Eligibility comes from
// `pending.eligible` / `pending.claims` (the server redacts claims to [] or [me]); `options.snatch` /
// `options.snatched` are honoured too, but they are blanked while the presenter is busy, so they are not required.
import { useEffect, useState } from 'react';
import { TILES } from '@shared/board.js';
import { useReducedMotion } from './ui/helpers.js';

const DEFAULT_MS = 3000;

/** The open snatch window, or null. Pure; exported for testing. */
export function snatchInfo(session) {
  const view = session?.view;
  const pend = view?.pending;
  if (!view || view.phase !== 'snatch' || pend?.type !== 'snatch') return null;
  const me = session.me;
  const o = session.options || {};
  const mine = view.players?.find((p) => p.id === me);
  const claims = Array.isArray(pend.claims) ? pend.claims : [];
  const eligible = Array.isArray(pend.eligible) && pend.eligible.includes(me) && !mine?.bankrupt;
  const pressed = eligible && (!!o.snatched || claims.includes(me));
  const buyer = view.players?.find((p) => p.id === pend.buyer) || null;
  return {
    key: `${view.turnCount ?? 0}:${pend.tile}`, // one window per tile per turn, like the server's deadline key
    tileId: pend.tile,
    tile: TILES[pend.tile] || null,
    price: pend.price ?? 0,
    ms: o.snatch?.ms ?? pend.ms ?? DEFAULT_MS,
    remainingMs: Number.isFinite(pend.remainingMs) ? pend.remainingMs : null, // server's clock, set when we reload mid-window
    buyerId: pend.buyer,
    buyerName: pend.buyer === me ? 'You' : buyer?.name || 'Someone',
    eligible,
    pressed,
    canPress: eligible && !pressed,
  };
}

// When did the client first see this window? Module-level so every consumer counts from the same instant.
let started = { key: null, at: 0 };

/** Remember when a window first appeared (call every render; idempotent). Clears when no window is open. */
export function recordSnatch(info) {
  if (!info) {
    if (started.key !== null) started = { key: null, at: 0 };
    return;
  }
  if (started.key !== info.key) {
    // count from when the window really opened: a page that reloaded mid-window gets the time already used
    const used = info.remainingMs != null ? Math.max(0, info.ms - info.remainingMs) : 0;
    started = { key: info.key, at: performance.now() - used };
  }
}

/** Countdown for the open window, or null when there is none. Re-renders per frame (per 250 ms with reduced motion). */
export function useSnatchClock(session) {
  const info = snatchInfo(session);
  recordSnatch(info);
  const key = info ? info.key : null;
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!key) return undefined;
    let raf = 0;
    let timer = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      setNow(performance.now());
      if (reduced) timer = setTimeout(tick, 250);
      else raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [key, reduced]);

  if (!info) return null;
  const elapsed = Math.max(0, Math.max(now, started.at) - started.at);
  const remainingMs = Math.max(0, info.ms - elapsed);
  return {
    totalMs: info.ms,
    remainingMs,
    fraction: info.ms > 0 ? remainingMs / info.ms : 0,
    seconds: Math.ceil(remainingMs / 1000),
  };
}
