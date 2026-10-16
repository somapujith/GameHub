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
  voice: true,
  tts: true,
  volume: 0.8,
  subtitles: 'te',
  reducedMotion: false,
  actors: {},
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
  seenStory: false,
};

function pair(r) {
  return Array.isArray(r) ? [r[0], typeof r[1] === 'function' ? r[1] : noop] : [r, noop];
}

export function useSettings() {
  const [s, update] = pair(storage.useSettings?.());
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(s || {}), actors: { ...(s?.actors || {}) } }), [s]);
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

export function useCampaign() {
  const r = storage.useCampaign?.();
  const c = Array.isArray(r) ? r[0] : r;
  return useMemo(
    () => ({ unlocked: Number(c?.unlocked) || 1, completed: Array.isArray(c?.completed) ? c.completed : [] }),
    [c],
  );
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

export function safeLoadGame() {
  try {
    const g = storage.loadGame?.();
    return g && g.state ? g : null;
  } catch {
    return null;
  }
}

export function safeClearGame() {
  try {
    storage.clearGame?.();
  } catch {
    /* ignore */
  }
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
