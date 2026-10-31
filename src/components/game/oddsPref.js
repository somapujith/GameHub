import { useCallback, useSyncExternalStore } from 'react';
import * as shared from '@shared/index.js';

// The "landing odds" toggle: the Board paints the overlay, the control panel owns the button.
// Both read ONE remembered preference (localStorage `hb.odds`), kept in sync through this tiny store.
//
//   const [on, setOn] = useOddsPref();      // setOn(true | false | (prev) => next)
//   oddsSupported()                         // false on a build without shared `landingOdds`: hide the button
const ODDS_KEY = 'hb.odds';

/** `landingOdds` is written by the dice agent; it is looked up by name so a build without it still works. */
export const oddsSupported = () => typeof shared.landingOdds === 'function';

const listeners = new Set();
let memo = null; // last value when localStorage is unavailable (private mode)

function read() {
  try {
    return localStorage.getItem(ODDS_KEY) === '1';
  } catch {
    return memo === true;
  }
}

function write(on) {
  memo = on;
  try {
    localStorage.setItem(ODDS_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the toggle just isn't remembered across reloads */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key === ODDS_KEY) fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

export function useOddsPref() {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const setOn = useCallback((next) => write(typeof next === 'function' ? next(read()) : !!next), []);
  return [on, setOn];
}
