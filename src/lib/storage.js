// localStorage persistence: sound/motion settings, the local profile (XP, coins, daily reward). Every access
// is wrapped in try/catch (private mode, quota, SSR) and falls back to an in-memory Map, so the app always
// works. A tiny subscribe/notify layer lets React hooks (useSyncExternalStore) follow changes, including
// changes made in another tab.
//
// This module must NOT import sfx.js (it imports this).

import { useSyncExternalStore } from 'react';

const KEYS = {
  settings: 'hyd.settings.v1',
  profile: 'hyd.profile.v1',
};

/** Keys of features that no longer exist (offline game, campaign): removed on load so they stop taking space. */
const RETIRED_KEYS = ['hyd.game.v1', 'hyd.campaign.v1'];

// ---------------------------------------------------------------------------------------------
// Raw storage with in-memory fallback
// ---------------------------------------------------------------------------------------------

/** Holds values that could not be written to localStorage (they win over stale persisted data). */
const mem = new Map();

function rawGet(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch {
    /* blocked */
  }
  return null;
}

function rawSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      mem.delete(key);
      return true;
    }
  } catch {
    /* quota / private mode */
  }
  mem.set(key, value);
  return false;
}

function rawRemove(key) {
  mem.delete(key);
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A cached, subscribable JSON-backed value. `read()` returns a stable reference until it changes. */
function createStore(key, normalize) {
  let cur = null;
  const subs = new Set();
  const notify = () => subs.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a bad subscriber must not break the others */
    }
  });
  return {
    key,
    read() {
      if (cur) return cur;
      let parsed = null;
      try {
        const raw = rawGet(key);
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      cur = normalize(parsed);
      return cur;
    },
    write(next) {
      cur = next;
      try {
        rawSet(key, JSON.stringify(next));
      } catch {
        /* unserialisable: keep the cached value only */
      }
      notify();
      return cur;
    },
    /** Forget the cache (another tab changed the value) and tell subscribers. */
    invalidate() {
      cur = null;
      notify();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

export const DEFAULT_APP_SETTINGS = Object.freeze({
  sfx: true,
  volume: 0.8,
  reducedMotion: false,
});

/** Unknown keys (e.g. the voice/subtitle settings of older builds) are ignored, never an error. */
function normalizeSettings(p) {
  const src = isObj(p) ? p : {};
  return {
    sfx: src.sfx === undefined ? DEFAULT_APP_SETTINGS.sfx : !!src.sfx,
    volume: clamp(num(src.volume, DEFAULT_APP_SETTINGS.volume), 0, 1),
    reducedMotion: !!src.reducedMotion,
  };
}

const settingsStore = createStore(KEYS.settings, normalizeSettings);

export const loadSettings = () => settingsStore.read();

/** Merge a patch (object or `(current) => patch`) into the settings. Returns the new settings. */
export function saveSettings(patch) {
  const cur = settingsStore.read();
  const p = typeof patch === 'function' ? patch(cur) : patch;
  if (!isObj(p)) return cur;
  return settingsStore.write(normalizeSettings({ ...cur, ...p }));
}

export const subscribeSettings = (cb) => settingsStore.subscribe(cb);

export function useSettings() {
  const s = useSyncExternalStore(settingsStore.subscribe, settingsStore.read, settingsStore.read);
  return [s, saveSettings];
}

// ---------------------------------------------------------------------------------------------
// Level curve and profile
// ---------------------------------------------------------------------------------------------

/** Total XP at which `level` starts (level 1 = 0, 2 = 100, 3 = 300, 4 = 600, ...). */
export const xpForLevel = (level) => 50 * level * (level - 1);
/** XP needed to go from `level` to `level + 1`. */
export const xpNeeded = (level) => 100 * level;

/** `pct` is 0..100 (progress inside the current level). */
export function levelInfo(xp) {
  const x = Math.max(0, Math.floor(num(xp, 0)));
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * x) / 50)) / 2));
  while (xpForLevel(level + 1) <= x) level += 1;
  while (level > 1 && xpForLevel(level) > x) level -= 1;
  const into = x - xpForLevel(level);
  const need = xpNeeded(level);
  return { level, into, need, pct: Math.min(100, Math.round((into / need) * 1000) / 10) };
}

const DEFAULT_PROFILE = Object.freeze({
  name: 'Guest',
  avatar: 0,
  xp: 0,
  level: 1,
  coins: 500,
  stats: Object.freeze({ games: 0, wins: 0, rentEarned: 0, bestWorth: 0, propertiesBought: 0, hotelsBuilt: 0 }),
  lastDailyClaim: null,
  dailyStreak: 0,
});

function normalizeProfile(p) {
  const src = isObj(p) ? p : {};
  const st = isObj(src.stats) ? src.stats : {};
  const xp = Math.max(0, Math.floor(num(src.xp, 0)));
  return {
    name: typeof src.name === 'string' && src.name.trim() ? src.name.slice(0, 24) : DEFAULT_PROFILE.name,
    avatar: clamp(Math.floor(num(src.avatar, 0)), 0, 11),
    xp,
    level: levelInfo(xp).level,
    coins: Math.max(0, Math.floor(num(src.coins, DEFAULT_PROFILE.coins))),
    stats: {
      games: Math.max(0, Math.floor(num(st.games, 0))),
      wins: Math.max(0, Math.floor(num(st.wins, 0))),
      rentEarned: Math.max(0, Math.floor(num(st.rentEarned, 0))),
      bestWorth: Math.max(0, Math.floor(num(st.bestWorth, 0))),
      propertiesBought: Math.max(0, Math.floor(num(st.propertiesBought, 0))),
      hotelsBuilt: Math.max(0, Math.floor(num(st.hotelsBuilt, 0))), // absent in older saves
    },
    lastDailyClaim: typeof src.lastDailyClaim === 'string' ? src.lastDailyClaim : null,
    dailyStreak: Math.max(0, Math.floor(num(src.dailyStreak, 0))),
  };
}

const profileStore = createStore(KEYS.profile, normalizeProfile);

export const loadProfile = () => profileStore.read();
export const subscribeProfile = (cb) => profileStore.subscribe(cb);

/** Merge a patch (object or `(current) => patch`; `stats` is merged shallowly). Returns the profile. */
export function saveProfile(patch) {
  const cur = profileStore.read();
  const p = typeof patch === 'function' ? patch(cur) : patch;
  if (!isObj(p)) return cur;
  return profileStore.write(normalizeProfile({ ...cur, ...p, stats: { ...cur.stats, ...(isObj(p.stats) ? p.stats : {}) } }));
}

export function useProfile() {
  const p = useSyncExternalStore(profileStore.subscribe, profileStore.read, profileStore.read);
  return [p, saveProfile];
}

// ---- daily reward -----------------------------------------------------------------------------

/** Local calendar date as 'YYYY-MM-DD'. */
export function dayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Coins for a given streak day: 150, 200, ... capped at 400. */
export const dailyReward = (streak) => 100 + 50 * Math.min(Math.max(1, streak | 0), 6);

export function canClaimDaily(profile = loadProfile(), now = new Date()) {
  return profile.lastDailyClaim !== dayKey(now);
}

/** What the streak would be if claimed now (resets to 1 when a day was skipped). */
export function nextDailyStreak(profile = loadProfile(), now = new Date()) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return profile.lastDailyClaim === dayKey(yesterday) ? profile.dailyStreak + 1 : 1;
}

export function claimDaily(now = new Date()) {
  const p = profileStore.read();
  const today = dayKey(now);
  if (p.lastDailyClaim === today) return { ok: false };
  const streak = nextDailyStreak(p, now);
  const coins = dailyReward(streak);
  saveProfile({ coins: p.coins + coins, lastDailyClaim: today, dailyStreak: streak });
  return { ok: true, coins, streak };
}

// ---------------------------------------------------------------------------------------------
// Cross-tab sync
// ---------------------------------------------------------------------------------------------

try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
      if (e.key === null) {
        // storage.clear()
        [settingsStore, profileStore].forEach((s) => s.invalidate());
        return;
      }
      if (e.key === KEYS.settings) settingsStore.invalidate();
      else if (e.key === KEYS.profile) profileStore.invalidate();
    });
  }
} catch {
  /* ignore */
}

// One-time tidy-up of what retired features left behind.
RETIRED_KEYS.forEach(rawRemove);
