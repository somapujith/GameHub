// Art wrappers for the hub screens: a game's 16:9 cover, its square icon, category + badge icons.
// Everything degrades to a themed placeholder, so a missing art piece never breaks a card.
import { BadgeIcon as KitBadgeIcon, CategoryIcon as KitCategoryIcon } from '@/platform/game/hubArt.jsx';
import { initials, themeVars } from './gameTheme.js';

/** 16:9 cover (`.hub-cover`: the art crops like `object-fit: cover`). Decorative. Needs --g-* vars from an ancestor. */
export function GameCover({ game, className = '' }) {
  const Cover = game?.art?.cover;
  return (
    <div className={`hub-cover ${className}`.trim()} aria-hidden="true">
      {Cover ? (
        <Cover />
      ) : (
        <div className="hh2-cover__ph">
          <span>{initials(game?.name)}</span>
        </div>
      )}
    </div>
  );
}

/** Square game icon, `size` px. */
export function GameIcon({ game, size = 48, className = '' }) {
  const Ico = game?.art?.icon;
  return (
    <span className={`hh2-gicon ${className}`.trim()} style={{ ...themeVars(game), '--sz': `${size}px` }} aria-hidden="true">
      {Ico ? <Ico size={size} /> : <span className="hh2-gicon__ph">{initials(game?.name)}</span>}
    </span>
  );
}

/** Category glyph. `cat` is a registry category `{ id, label, icon }`. */
export function CatIcon({ cat, size = 20 }) {
  if (!cat) return null;
  return (
    <span className="hh2-cat-ico" style={{ '--sz': `${size}px` }} aria-hidden="true">
      <KitCategoryIcon id={cat.icon || cat.id} size={size} />
    </span>
  );
}

/** Profile badge art. */
export function BadgeArt({ id, size = 64, locked = false }) {
  return (
    <span className={`hh2-badge-art ${locked ? 'is-locked' : ''}`} style={{ '--sz': `${size}px` }} aria-hidden="true">
      <KitBadgeIcon id={id} size={size} />
    </span>
  );
}
