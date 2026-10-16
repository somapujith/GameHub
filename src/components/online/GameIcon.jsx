import '@/styles/online.css';

/**
 * A game's square icon (`manifest.art.icon`) on its accent colours. Falls back to the initial when the game
 * (or its art) is unknown, so a room for a game this build does not know still looks intentional.
 */
export default function GameIcon({ game, name, size = 48, className = '' }) {
  const Icon = game && game.art && game.art.icon;
  const theme = (game && game.theme) || {};
  const label = (game && game.name) || name || '?';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) };
  if (theme.accent) style['--gi-a'] = theme.accent;
  if (theme.accent2) style['--gi-b'] = theme.accent2;
  if (theme.bg) style['--gi-bg'] = theme.bg;
  return (
    <span className={`ho-gameicon ${className}`.trim()} style={style} aria-hidden="true">
      {Icon ? <Icon size={size} /> : <span className="ho-gameicon__letter">{String(label).trim().charAt(0).toUpperCase() || '?'}</span>}
    </span>
  );
}
