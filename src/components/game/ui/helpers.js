// Shared hooks + pure helpers for the game panels (gameui-panels owns this file).
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { TILES, GROUPS, GROUP_TILES, mortgageValue, upgradeCost } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import * as Engine from '@shared/index.js'; // namespace import: engine additions are probed, never assumed
import { useSettings } from '@/lib/storage.js';

const engineNetWorth = (...a) => Engine.netWorth(...a);

/* ------------------------------------------------------------------ media / motion */

export function useMedia(query, fallback = false) {
  const subscribe = useCallback(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const m = window.matchMedia(query);
      m.addEventListener?.('change', cb);
      return () => m.removeEventListener?.('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** True at >= 900px: board left, sidebar right. */
export const useIsWide = () => useMedia('(min-width: 900px)');

/** OS preference OR the in-game "reduce motion" switch. */
export function useReducedMotion() {
  const sys = useMedia('(prefers-reduced-motion: reduce)');
  const [settings] = useSettings();
  return !!(sys || settings?.reducedMotion);
}

/** Keeps showing the last non-null value (so a sheet can finish its exit animation). */
export function useHeld(value) {
  const [held, setHeld] = useState(value);
  if (value != null && value !== held) setHeld(value);
  return value != null ? value : held;
}

/* ------------------------------------------------------------------ tile / group metadata */

const transportIds = TILES.filter((t) => t.type === 'transport').map((t) => t.id);
const utilityIds = TILES.filter((t) => t.type === 'utility').map((t) => t.id);

/** Every "set" a player can own tiles in: the 6 colour groups + transport + utilities. */
export const SET_GROUPS = [
  ...Object.values(GROUPS).map((g) => ({
    id: g.id, kind: 'property', name: g.name, te: g.te, color: g.color, ink: g.ink, tiles: GROUP_TILES[g.id],
  })),
  { id: 'transport', kind: 'transport', name: 'Transport', te: 'రవాణా', color: '#14b8a6', ink: '#04201d', tiles: transportIds },
  { id: 'utility', kind: 'utility', name: 'Utilities', te: 'యుటిలిటీలు', color: '#eab308', ink: '#251c00', tiles: utilityIds },
];

export const setOfTile = (tile) =>
  SET_GROUPS.find((g) => (tile.group ? g.id === tile.group : g.id === tile.type)) || null;

const CORNER_COLORS = {
  start: ['#3b2d8f', '#ffffff'], jail: ['#4b5563', '#ffffff'], auction: ['#7c3aed', '#ffffff'],
  kismet: ['#be185d', '#ffffff'], tax: ['#b45309', '#ffffff'], film: ['#0e7490', '#ffffff'],
};

/** Header colour + readable ink for a tile. */
export function tileAccent(tile) {
  const set = setOfTile(tile);
  if (set) return { color: set.color, ink: set.ink };
  const [color, ink] = CORNER_COLORS[tile.type] || ['#3b2d8f', '#ffffff'];
  return { color, ink };
}

/** Tile ids owned by `playerId`. */
export function ownedBy(owners, playerId) {
  const out = [];
  for (let i = 0; i < TILES.length; i++) if (owners?.[i] === playerId) out.push(i);
  return out;
}

/** Per-set progress for a player: [{ set, owned:[ids], total, full, missing:[ids] }] (sets with >= 1 owned tile only). */
export function setProgress(owners, playerId) {
  const rows = [];
  for (const set of SET_GROUPS) {
    const owned = set.tiles.filter((t) => owners?.[t] === playerId);
    if (!owned.length) continue;
    rows.push({
      set, owned, total: set.tiles.length, full: owned.length === set.tiles.length,
      missing: set.tiles.filter((t) => owners?.[t] !== playerId),
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ session helpers */

/** An engine-state-like object that reflects what the board shows (display lags view while animating). */
export function useStateLike(session) {
  const { view, display } = session;
  return useMemo(
    () => ({
      ...view,
      players: display?.players ?? view?.players ?? [],
      owners: display?.owners ?? view?.owners ?? [],
      levels: display?.levels ?? view?.levels ?? [],
      mortgaged: display?.mortgaged ?? view?.mortgaged ?? [],
    }),
    [view, display],
  );
}

function fallbackWorth(state, id) {
  const p = state.players.find((x) => x.id === id);
  if (!p) return 0;
  let w = p.cash || 0;
  for (let i = 0; i < TILES.length; i++) {
    if (state.owners?.[i] !== id) continue;
    const t = TILES[i];
    w += (state.mortgaged?.[i] ? t.price - mortgageValue(t) : t.price || 0) + (state.levels?.[i] || 0) * upgradeCost(t);
  }
  return w;
}

/* ---- guarded engine calls (the UI must never crash because the engine moved) ---- */
export const DEFAULT_CFG = Engine.DEFAULT_SETTINGS || {};

export function canUpgradeSafe(state, playerId, tileId) {
  try { return Engine.canUpgrade(state, playerId, tileId); } catch { return null; }
}

export function previewRentSafe(state, tileId, sum = 7) {
  try { return Engine.previewRent(state, tileId, sum) || 0; } catch { return 0; }
}

/** number[28] landing probabilities for my next roll, or null when the engine can't say. */
export function landingOddsSafe(view, playerId) {
  try {
    if (typeof Engine.landingOdds !== 'function') return null;
    const odds = Engine.landingOdds(view, playerId, { previewRent: Engine.previewRent });
    return Array.isArray(odds) ? odds : null;
  } catch {
    return null;
  }
}

/** "🍀 Lucky dice" / "⚖️ Fair dice" from cfg.dice (default lucky). */
export const diceLabel = (cfg) => ((cfg?.dice ?? 'lucky') === 'fair' ? '⚖️ Fair dice' : '🍀 Lucky dice');

export const LUCKY_DICE_TEXT =
  'Lucky dice gently help whoever is behind: slightly better odds of landing on useful tiles, a little protection after big rent bills, and fewer long dry spells without a bonus roll. Nothing is guaranteed. The host can switch to Fair dice.';
export const FAIR_DICE_TEXT = 'Fair dice: every roll is pure chance, with no help for anyone.';

export function worthOf(state, id) {
  try {
    const w = engineNetWorth(state, id);
    return Number.isFinite(w) ? w : fallbackWorth(state, id);
  } catch {
    return fallbackWorth(state, id);
  }
}

/** { worths:{[id]:n}, leaderId|null } — leader only when strictly ahead of every other active player. */
export function useWorths(session) {
  const state = useStateLike(session);
  return useMemo(() => {
    const worths = {};
    for (const p of state.players) worths[p.id] = worthOf(state, p.id);
    const alive = state.players.filter((p) => !p.bankrupt).sort((a, b) => worths[b.id] - worths[a.id]);
    const leaderId = alive.length > 1 && worths[alive[0].id] > worths[alive[1].id] ? alive[0].id : null;
    return { worths, leaderId, state };
  }, [state]);
}

export const getPlayer = (session, id) =>
  session.display?.players?.find((p) => p.id === id) || session.view?.players?.find((p) => p.id === id) || null;

export const nameOf = (session, id) => (id === session.me ? 'You' : getPlayer(session, id)?.name || 'Someone');

/** The player whose turn it is (from the animated display; falls back to view). */
export function activePlayer(session) {
  const d = session.display;
  if (d?.players?.length && Number.isInteger(d.turn)) return d.players[d.turn] || null;
  const v = session.view;
  return v?.players?.[v.turn] || null;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export const ROUND_RULE_TEXT =
  "One round = every player plays once (bonus rolls don't count). The game ends when someone reaches the target, or when the rounds run out and the richest player wins.";

/** Round progress for the top bar: { round, max|null, left|null, final, soon, pct }. */
export function roundInfo(session) {
  const cfg = session.display?.cfg || session.view?.cfg || {};
  const round = session.display?.round ?? session.view?.round ?? 1;
  const max = Number.isFinite(cfg.maxRounds) ? cfg.maxRounds : null;
  const left = max == null ? null : Math.max(0, max - round);
  return {
    round,
    max,
    left,
    final: max != null && round >= max,
    soon: left != null && left >= 1 && left <= 3,
    pct: max != null ? Math.min(1, Math.max(0, round / max)) : 0,
  };
}

/** "Target ₹70,000 · 50 rounds · Start ₹15,000" (maxRounds null/undefined = unlimited). */
export function settingsSummary(cfg, goal) {
  const c = cfg || {};
  const target = goal ?? c.goal;
  const rounds = Number.isFinite(c.maxRounds) ? `${c.maxRounds} rounds` : 'Unlimited rounds';
  const parts = [];
  if (target != null) parts.push(`Target ${formatINR(target)}`);
  parts.push(rounds);
  if (c.startCash != null) parts.push(`Start ${formatINR(c.startCash)}`);
  parts.push(diceLabel(c));
  return parts.join(' · ');
}

export const diceSum = (session) => {
  const single = (session.display?.cfg || session.view?.cfg)?.diceCount === 1;
  const d = session.display?.dice || session.view?.dice || [];
  return d.reduce((sum, value) => sum + (Number(value) || 0), 0) || (single ? 4 : 7);
};
