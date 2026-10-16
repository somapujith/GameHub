import { getCategory } from '@/games/registry.js';
import HubIcon from './HubIcon.jsx';
import { CategoryIcon, FallbackCover } from './hubArt.jsx';
import { themeVars } from './color.js';

/** "2–6 players" / "4 players". */
export function playersLabel(players) {
  const min = Number(players?.min);
  const max = Number(players?.max);
  if (!Number.isFinite(max) || max < 1) return '';
  if (!Number.isFinite(min) || min === max) return `${max} player${max === 1 ? '' : 's'}`;
  return `${min}–${max} players`;
}

/** Game cover in a fixed 16:9 frame (the art component fills it). */
export function Cover({ game, className = '' }) {
  const Art = game?.art?.cover;
  return <div className={`hub-cover ${className}`.trim()}>{Art ? <Art /> : <FallbackCover />}</div>;
}

/**
 * Detail-page hero: cover on the left (stacked above on phones), then category / status chips, name,
 * tagline, description, quick facts and feature chips. Colours come from `game.theme`.
 */
export default function GameHero({ game, soon = false }) {
  const cat = getCategory(game.category);
  const players = playersLabel(game.players);
  const features = Array.isArray(game.features) ? game.features : [];
  return (
    <section className={`hub-hero${soon ? ' is-soon' : ''}`} style={themeVars(game.theme)} aria-labelledby="hub-hero-title">
      <div className="hub-hero__media">
        <Cover game={game} />
        {soon && <span className="hub-badge hub-badge--soon hub-hero__soon">Coming soon</span>}
      </div>
      <div className="hub-hero__info">
        <div className="hub-hero__chips">
          {cat && (
            <span className="hub-pill hub-pill--accent">
              <span className="hub-pill__icon" aria-hidden="true">
                <CategoryIcon id={cat.icon} />
              </span>
              {cat.label}
            </span>
          )}
          {!soon && <span className="hub-pill hub-pill--live">Live</span>}
        </div>
        <h1 id="hub-hero-title" className="hub-hero__title">
          {game.name}
        </h1>
        {game.tagline && <p className="hub-hero__tagline">{game.tagline}</p>}
        {game.description && <p className="hub-hero__desc">{game.description}</p>}
        <ul className="hub-facts">
          {players && (
            <li>
              <HubIcon name="users" size={18} /> {players}
            </li>
          )}
          {game.duration && (
            <li>
              <HubIcon name="clock" size={18} /> {game.duration}
            </li>
          )}
        </ul>
        {features.length > 0 && (
          <ul className="hub-chips" aria-label="Features">
            {features.map((f) => (
              <li key={f} className="hub-chip hub-chip--static">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
