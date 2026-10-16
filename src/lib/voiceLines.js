// Lookup over the voice-line data (tiles + events). Picks lines that were not used recently, skips
// actors the player switched off, and never throws (unknown triggers return null).
//
//   pickLine(trigger, { avoid = [], actor? }) -> Line | null
//   lineForTile(tileId, { avoid = [], actor? }) -> Line | null
//   lineById(id) -> Line | null
//   allLines() -> Line[]
//
// Line = { id, actor, te, tn, en, mood }

import tileLines from '@/data/voices.tiles.js';
import eventLines from '@/data/voices.events.js';
import { loadSettings } from './storage.js';

const RECENT_MAX = 14;
/** Ids handed out recently, oldest first. */
const recent = [];
let lastActor = null;
let index = null;

function buildIndex() {
  if (index) return index;
  const byId = new Map();
  const all = [];
  const add = (l) => {
    if (l && l.id && !byId.has(l.id)) {
      byId.set(l.id, l);
      all.push(l);
    }
  };
  for (const src of [tileLines, eventLines]) {
    if (!src || typeof src !== 'object') continue;
    for (const list of Object.values(src)) if (Array.isArray(list)) list.forEach(add);
  }
  index = { byId, all };
  return index;
}

function disabledActors() {
  try {
    return loadSettings().actors || {};
  } catch {
    return {};
  }
}

function remember(line) {
  const i = recent.indexOf(line.id);
  if (i !== -1) recent.splice(i, 1);
  recent.push(line.id);
  if (recent.length > RECENT_MAX) recent.shift();
  lastActor = line.actor || null;
}

/** Pick from `pool`: unused lines first, else the one used longest ago; varies the actor when it can. */
function choose(pool, { avoid = [], actor } = {}) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const off = disabledActors();
  const enabled = pool.filter((l) => l && l.id && off[l.actor] !== false);
  if (enabled.length === 0) return null;
  let cands = enabled.filter((l) => !avoid.includes(l.id));
  if (cands.length === 0) cands = enabled; // `avoid` excluded everything: relax it
  if (actor) {
    const mine = cands.filter((l) => l.actor === actor);
    if (mine.length) cands = mine;
  }
  // Higher score = better candidate: never used (Infinity) > used long ago > used just now.
  const score = (l) => {
    const i = recent.indexOf(l.id);
    return i === -1 ? Infinity : recent.length - 1 - i;
  };
  let top = -1;
  for (const l of cands) top = Math.max(top, score(l));
  let best = cands.filter((l) => score(l) === top);
  if (!actor && best.length > 1) {
    const other = best.filter((l) => l.actor !== lastActor);
    if (other.length) best = other;
  }
  const line = best[Math.floor(Math.random() * best.length)];
  remember(line);
  return line;
}

export function pickLine(trigger, opts = {}) {
  try {
    const pool = eventLines && eventLines[trigger];
    return choose(pool, opts || {});
  } catch {
    return null;
  }
}

export function lineForTile(tileId, opts = {}) {
  try {
    const pool = tileLines && tileLines[tileId];
    return choose(pool, opts || {});
  } catch {
    return null;
  }
}

export function lineById(id) {
  try {
    return buildIndex().byId.get(id) || null;
  } catch {
    return null;
  }
}

export function allLines() {
  try {
    return buildIndex().all.slice();
  } catch {
    return [];
  }
}

/** Forget the recent-history (tests, new game). */
export function resetLineHistory() {
  recent.length = 0;
  lastActor = null;
}
