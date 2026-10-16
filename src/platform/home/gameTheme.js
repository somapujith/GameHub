// Per-game colour variables and small formatting helpers shared by the hub cards.
import { themeVars as themeVarsFromTheme } from '@/platform/game/color.js';

/** Inline CSS variables (--g-accent, --g-accent-2, --g-bg, --g-on, --g-soft, --g-line, --g-glow) for a manifest. */
export const themeVars = (game) => themeVarsFromTheme(game && game.theme);

/** "2–6 players", "4 players", "Solo". */
export function playersLabel(players) {
  const min = Number(players?.min) || 0;
  const max = Number(players?.max) || 0;
  if (!min && !max) return '';
  if (!max || min === max) return min === 1 ? 'Solo' : `${min || max} players`;
  return `${min}–${max} players`;
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
