// Little tile chips + building level pips, used by player/property sheets.
import { TILES, MAX_LEVEL, LEVEL_NAMES } from '@shared/board.js';
import { tileAccent } from './helpers.js';

export function LevelPips({ level = 0, color }) {
  return (
    <span
      className={`hg-pips${level >= MAX_LEVEL ? ' is-hotel' : ''}`}
      role="img"
      aria-label={LEVEL_NAMES[level] || ''}
      style={color ? { '--pip': color } : undefined}
    >
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <i key={i} className={i < level ? 'is-on' : ''} />
      ))}
    </span>
  );
}

/** Set progress dots: "●●○". */
export function SetDots({ owned, total, color }) {
  return (
    <span className="hg-setdots" style={{ '--sc': color }} role="img" aria-label={`${owned} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < owned ? 'is-on' : ''} />)}
    </span>
  );
}

export default function TileChip({ tileId, level = 0, mortgaged = false, selected, disabled = false, onClick, extra }) {
  const tile = TILES[tileId];
  if (!tile) return null;
  const { color } = tileAccent(tile);
  const Tag = onClick ? 'button' : 'span';
  const btn = onClick
    ? { type: 'button', onClick: () => onClick(tileId), disabled, ...(selected !== undefined ? { 'aria-pressed': !!selected } : {}) }
    : {};
  return (
    <Tag
      {...btn}
      className={`hg-tilechip${onClick ? ' is-btn' : ''}${mortgaged ? ' is-mort' : ''}${selected ? ' is-sel' : ''}`}
      style={{ '--tc': color }}
      title={mortgaged ? `${tile.name} (mortgaged)` : tile.name}
    >
      <i className="hg-tilechip-dot" />
      <span className="hg-tilechip-name">{tile.short}</span>
      {mortgaged ? <span className="hg-tilechip-m" aria-label="mortgaged">M</span> : null}
      {tile.type === 'property' && level > 0 ? <LevelPips level={level} color={color} /> : null}
      {extra}
    </Tag>
  );
}
