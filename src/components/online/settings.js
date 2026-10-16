// Host-settings model for the lobby, driven ENTIRELY by the game's `manifest.settings` schema
// (docs/MARKETPLACE.md section 4). Nothing here knows about a particular game. Pure and unit-tested.
//
// Field: { key, label, type: 'segmented'|'stepper'|'toggle', options?: [{value,label}], min?, max?, step?,
//          default, format?: 'inr'|'number'|'text', help? }
//   - segmented: pick one of `options` (a value may be null, e.g. "unlimited")
//   - stepper:   a number with -/+ buttons (`min`/`max`/`step`); optional `options` become quick-pick chips
//   - toggle:    on/off
// The server (adapter.validateSettings) is the source of truth; the client only ever sends the FULL set of
// schema keys, so a partial echo from the server can never leave gaps.
import { compactINR, formatINR } from '@shared/format.js';

const TYPES = new Set(['segmented', 'stepper', 'toggle']);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** The usable fields of a schema (unknown types / keyless entries are skipped, never thrown on). */
export function schemaFields(schema) {
  return (Array.isArray(schema) ? schema : []).filter((f) => f && typeof f.key === 'string' && f.key && TYPES.has(f.type));
}

export function fieldOptions(field) {
  return Array.isArray(field && field.options) ? field.options.filter((o) => o && 'value' in o) : [];
}

export function clampField(field, v) {
  let n = Number(v);
  if (!Number.isFinite(n)) return field.default;
  if (num(field.min)) n = Math.max(field.min, n);
  if (num(field.max)) n = Math.min(field.max, n);
  return n;
}

/** `{ [key]: default }` for every field. */
export function defaultSettings(schema) {
  const out = {};
  for (const f of schemaFields(schema)) out[f.key] = f.default;
  return out;
}

/**
 * Server settings (possibly partial / missing / with extra keys) -> one value per schema field.
 * Missing keys get the default; a stepper is clamped; a segmented value is kept even when it is not one of the
 * options (the server may know more presets than the client), so nothing is silently rewritten.
 */
export function resolveSettings(schema, raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const f of schemaFields(schema)) {
    const v = s[f.key];
    if (v === undefined) out[f.key] = f.default;
    else if (f.type === 'toggle') out[f.key] = typeof v === 'boolean' ? v : f.default;
    else if (f.type === 'stepper') out[f.key] = typeof v === 'number' ? clampField(f, v) : f.default;
    else out[f.key] = v;
  }
  return out;
}

/** The exact message for a host change: always the full set with explicit values (`null` stays `null`). */
export function settingsMessage(schema, current, patch) {
  return { t: 'settings', settings: resolveSettings(schema, { ...(current || {}), ...(patch || {}) }) };
}

/** A stable string of the resolved values (cheap change detection for effects). */
export function settingsKey(schema, raw) {
  return JSON.stringify(resolveSettings(schema, raw));
}

/**
 * One -/+ press on a stepper: moves by `step`, snapped to the grid that starts at `min`, clamped to [min, max].
 * With 70,000 and step 5,000 you get 75,000; from 12,000 (min 10,000) one press up is 15,000 and one down is 10,000.
 */
export function stepValue(field, value, dir) {
  const step = num(field.step) && field.step > 0 ? field.step : 1;
  const base = num(field.min) ? field.min : 0;
  const cur = clampField(field, value);
  const k = (cur - base) / step;
  const next = dir > 0 ? (Math.floor(k + 1e-9) + 1) * step + base : (Math.ceil(k - 1e-9) - 1) * step + base;
  return clampField(field, next);
}

/** Text for a value: the matching option's label, else formatted by `field.format`. */
export function formatValue(field, value, { compact = false } = {}) {
  const opt = fieldOptions(field).find((o) => Object.is(o.value, value));
  if (opt && typeof opt.label === 'string') return opt.label;
  if (field.type === 'toggle') return value ? 'On' : 'Off';
  if (value === null || value === undefined) return 'None';
  if (field.format === 'inr') return compact ? compactINR(value) : formatINR(value);
  if (field.format === 'number' && num(Number(value))) return Number(value).toLocaleString('en-IN');
  return String(value);
}

/** Short read-only chips for non-hosts: ["Winning target ₹70k", "Rounds 50", "Auction skipped properties", ...]. */
export function settingsChips(schema, raw) {
  const s = resolveSettings(schema, raw);
  return schemaFields(schema).map((f) => {
    if (f.type === 'toggle') return s[f.key] ? f.label : `${f.label}: Off`;
    return `${f.label} ${formatValue(f, s[f.key], { compact: true })}`;
  });
}

/** One line for the lobby: the game's own `summarize(settings)`, or the chips joined when it is missing or throws. */
export function summarizeSettings(game, raw) {
  const settings = raw && typeof raw === 'object' ? raw : {};
  if (game && typeof game.summarize === 'function') {
    try {
      const line = game.summarize(settings);
      if (typeof line === 'string' && line.trim()) return line;
    } catch {
      /* a broken summarize must never break the lobby */
    }
  }
  return settingsChips(game && game.settings, settings).join(' · ');
}

/** Seat limits for the host's "Max players" stepper: never below the people already in, never outside the game's range. */
export function seatBounds(game, playerCount = 0) {
  const gmin = game && game.players && num(game.players.min) ? game.players.min : 2;
  const gmax = game && game.players && num(game.players.max) ? game.players.max : 6;
  return { min: Math.min(gmax, Math.max(gmin, playerCount || 0)), max: gmax };
}

/** `{ t:'settings', settings:{ maxPlayers } }`: the room's seat count travels beside the game settings. */
export function seatsMessage(n) {
  return { t: 'settings', settings: { maxPlayers: n } };
}

/** `{ t:'visibility', visibility }` (host, lobby only). */
export function visibilityMessage(visibility) {
  return { t: 'visibility', visibility: visibility === 'public' ? 'public' : 'private' };
}

export const VISIBILITY_HELP = {
  public: 'Public rooms appear in Open tables, so anyone can find and join them.',
  private: 'Private rooms need the code or link. Only people you share it with can join.',
};
