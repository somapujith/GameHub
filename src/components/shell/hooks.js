import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth.jsx';
import { useSettings } from './stores.js';
import { playSfx, unlockAudio } from './audio.js';

/** True when the user asked for reduced motion (OS preference or the in-app setting). */
export function useReducedMotion() {
  const [settings] = useSettings();
  const [os, setOs] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setOs(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return !!settings.reducedMotion || os;
}

/** Normalised auth view: { user, loading, signedIn, account (signed in AND not a guest), auth }. */
export function useAccount() {
  const auth = useAuth() || {};
  const user = auth.user || null;
  return {
    user,
    loading: !!auth.loading,
    signedIn: !!user,
    account: !!user && !user.isGuest,
    guest: !!user && !!user.isGuest,
    auth,
  };
}

/**
 * Wrap a click handler so it plays the 'click' sfx. Inside AppShell a global listener already
 * plays it for every button/link, so this is only for chrome-less screens (the game routes).
 */
export function useSfxClick(handler) {
  return useCallback(
    (e) => {
      if (e?.nativeEvent) e.nativeEvent.__hhSfx = true;
      playSfx('click');
      handler?.(e);
    },
    [handler],
  );
}

const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary';

/** One delegated listener: sfx 'click' on any tap of a button/link/tab/switch (opt out: data-nosfx). */
export function useGlobalClickSfx() {
  useEffect(() => {
    const onClick = (e) => {
      if (e.__hhSfx) return;
      const el = e.target?.closest?.(CLICKABLE);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-nosfx')) return;
      playSfx('click');
    };
    const unlock = () => unlockAudio();
    document.addEventListener('click', onClick);
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);
}
