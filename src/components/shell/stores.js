import { useMemo } from 'react';
import * as storage from '@/lib/storage.js';

/*
 * Thin, defensive wrappers around the lib/storage hooks. They normalise the shapes the
 * contract describes so every shell page can rely on complete objects (never undefined),
 * even for profiles saved by an older build.
 */
const noop = () => {};

export const DEFAULT_SETTINGS = {
  sfx: true,
  volume: 0.8,
  reducedMotion: false,
};

export const DEFAULT_PROFILE = {
  name: 'Guest',
  avatar: 0,
  xp: 0,
  level: 1,
  coins: 500,
  stats: { games: 0, wins: 0, rentEarned: 0, bestWorth: 0, propertiesBought: 0 },
  lastDailyClaim: null,
  dailyStreak: 0,
};

function pair(r) {
  return Array.isArray(r) ? [r[0], typeof r[1] === 'function' ? r[1] : noop] : [r, noop];
}

export function useSettings() {
  const [s, update] = pair(storage.useSettings?.());
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(s || {}) }), [s]);
  return [settings, update];
}

export function useProfile() {
  const [p, update] = pair(storage.useProfile?.());
  const profile = useMemo(
    () => ({ ...DEFAULT_PROFILE, ...(p || {}), stats: { ...DEFAULT_PROFILE.stats, ...(p?.stats || {}) } }),
    [p],
  );
  return [profile, update];
}

export function levelInfo(xp) {
  try {
    const li = storage.levelInfo?.(xp);
    if (li && typeof li.pct === 'number') return li;
  } catch {
    /* fall through */
  }
  const need = 200;
  const into = Math.max(0, Number(xp) || 0) % need;
  return { level: 1 + Math.floor((Number(xp) || 0) / need), into, need, pct: into / need };
}

/**
 * Level, XP and coins. A signed-in player (guests included) gets the server's numbers, which finished matches
 * write; the on-device profile is only the fallback while signed out. Returns `{ xp, coins, info, level }`.
 */
export function progressOf(user, profile) {
  const serverXp = Number(user?.xp);
  const serverCoins = Number(user?.coins);
  const xp = user && Number.isFinite(serverXp) ? serverXp : Number(profile?.xp) || 0;
  const coins = user && Number.isFinite(serverCoins) ? serverCoins : Number(profile?.coins) || 0;
  const info = levelInfo(xp);
  return { xp, coins, info, level: info.level };
}

export function claimDaily() {
  try {
    return storage.claimDaily?.() || { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Local calendar day as YYYY-MM-DD (the format profile.lastDailyClaim uses). */
export function todayKey(d = new Date()) {
  try {
    const k = storage.dayKey?.(d);
    if (typeof k === 'string') return k;
  } catch {
    /* fall through */
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Coins granted for a given streak day (mirrors lib/storage `dailyReward`). */
export function dailyRewardFor(streak) {
  try {
    const v = storage.dailyReward?.(streak);
    if (Number.isFinite(v)) return v;
  } catch {
    /* fall through */
  }
  return 100 + 50 * Math.min(Math.max(1, Math.floor(streak) || 1), 6);
}

/** XP bar percentage 0..100 (prefers into/need; `pct` may be 0..1 or 0..100). */
export function pctOf(li) {
  const into = Number(li?.into);
  const need = Number(li?.need);
  if (Number.isFinite(into) && need > 0) return Math.max(0, Math.min(100, (into / need) * 100));
  const v = Number(li?.pct) || 0;
  return Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
}
