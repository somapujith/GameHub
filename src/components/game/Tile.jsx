import { memo } from 'react';
import { GROUPS, LEVEL_NAMES, MAX_LEVEL, tilePosition } from '@shared/board.js';
import { compactINR, formatINR } from '@shared/format.js';
import { TileIcon } from '@/components/art/index.js';
import '@/styles/board.css';

const SHY = '­';

// Hand-picked syllable breaks for the long Hyderabad names so they wrap on 40px tiles.
const BREAKS = {
  Dilsukhnagar: 'Dilsukh' + SHY + 'nagar',
  Bachupally: 'Bachu' + SHY + 'pally',
  Kukatpally: 'Kukat' + SHY + 'pally',
  Gachibowli: 'Gachi' + SHY + 'bowli',
  Electricity: 'Electri' + SHY + 'city',
  Manikonda: 'Mani' + SHY + 'konda',
};
const VOWELS = 'aeiouAEIOU';

function hyphenate(word) {
  if (BREAKS[word]) return BREAKS[word];
  const mid = Math.round(word.length / 2);
  for (let d = 0; d <= 2; d++) {
    for (const i of [mid - d, mid + d]) {
      if (i > 2 && i < word.length - 2 && VOWELS.includes(word[i - 1]) && !VOWELS.includes(word[i])) {
        return word.slice(0, i) + SHY + word.slice(i);
      }
    }
  }
  return word.slice(0, mid) + SHY + word.slice(mid);
}

/** Insert soft hyphens into words that are too long for one line of a tile. */
export function softName(text) {
  return text
    .split(' ')
    .map((w) => (w.length >= 9 ? hyphenate(w) : w))
    .join(' ');
}

// Icon tiles keep their name on ONE short line under the icon (the icon carries the identity;
// the full name is in the tooltip, the accessible name and the property sheet).
const ICON_LABELS = {
  'Hussain Sagar': 'H. Sagar',
  'Water Board': 'Water',
  Electricity: 'Electric',
  'Property Tax': 'Tax',
};

/** Font size (in cqw of the board) that keeps the longest unbroken chunk inside the tile. */
export function fitSize(text, max = 2.8, min = 2.25, oneLine = false) {
  const longest = oneLine ? text.length : Math.max(1, ...text.split(/[\s­]+/).map((s) => s.length));
  return Math.max(min, Math.min(max, 11.2 / (longest * 0.56)));
}

function inkFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.42 ? '#1b1340' : '#ffffff';
}

// Clockwise from START: 0 bottom-left, 7 top-left, 14 top-right, 21 bottom-right (see tilePosition).
const CORNER_CLASS = { 0: 'hb-tile--bl', 7: 'hb-tile--tl', 14: 'hb-tile--tr', 21: 'hb-tile--br' };

/** Levels 1..MAX_LEVEL-1 are a tiny skyline of pips; MAX_LEVEL is the gold hotel badge. */
function Pips({ level }) {
  return (
    <span className="hb-pips" aria-hidden="true">
      {Array.from({ length: Math.min(level, MAX_LEVEL - 1) }, (_, i) => (
        <i key={i} style={{ '--k': i }} />
      ))}
    </span>
  );
}

function HotelBadge() {
  return (
    <span className="hb-hotel" aria-hidden="true">
      <svg viewBox="2 7 20 16" focusable="false">
        <path d="M5 22V11.5h14V22z" fill="#7a4a00" />
        <path d="M3.6 11.8L12 8.6l8.4 3.2z" fill="#a8680a" />
        <g fill="#ffe9a0">
          <rect x="7" y="13.4" width="2.3" height="2.3" rx=".4" />
          <rect x="10.85" y="13.4" width="2.3" height="2.3" rx=".4" />
          <rect x="14.7" y="13.4" width="2.3" height="2.3" rx=".4" />
          <rect x="7" y="17.2" width="2.3" height="2.3" rx=".4" />
          <rect x="14.7" y="17.2" width="2.3" height="2.3" rx=".4" />
        </g>
        <rect x="10.4" y="17.4" width="3.2" height="4.6" rx=".5" fill="#ffd36a" />
      </svg>
    </span>
  );
}

/**
 * One board tile. Pure/primitive props so React.memo can skip untouched tiles.
 *  ownerColor: hex or null. level: 0..MAX_LEVEL. active: the mover is standing here.
 *  setState: 'none' | 'partial' (owner holds 2 of a 3-tile colour) | 'full' (whole colour).
 *  mortgaged: greyed out with stripes and an M badge, no set glow.
 */
function TileImpl({
  tile,
  ownerColor = null,
  ownerName = '',
  level = 0,
  setState = 'none',
  mortgaged = false,
  highlight = false,
  active = false,
  onSelect,
}) {
  const { col, row } = tilePosition(tile.id);
  const group = tile.group ? GROUPS[tile.group] : null;
  const owned = !!ownerColor;
  const buyable = tile.price != null;
  const isProperty = tile.type === 'property';
  const hotel = isProperty && owned && level >= MAX_LEVEL;
  const set = mortgaged ? 'none' : setState;

  const style = { gridColumn: col + 1, gridRow: row + 1 };
  if (group) {
    style['--g'] = group.color;
    style['--gi'] = group.ink;
  }
  if (owned) {
    style['--o'] = ownerColor;
    style['--oi'] = inkFor(ownerColor);
  }

  const cls = ['hb-tile', `hb-tile--${tile.type}`];
  if (tile.corner) cls.push('hb-tile--corner', CORNER_CLASS[tile.id] || '');
  else if (buyable) cls.push('hb-tile--buy');
  else cls.push('hb-tile--plain');
  if (owned) cls.push('is-owned');
  if (set === 'full') cls.push('is-set');
  if (set === 'partial') cls.push('is-partial');
  if (mortgaged) cls.push('is-mortgaged');
  if (hotel) cls.push('is-hotel');
  const built = isProperty && owned && level > 0;
  if (built) cls.push('is-built');
  if (highlight) cls.push('is-hl');
  if (active) cls.push('is-active');

  const label = [tile.name];
  if (buyable) label.push(formatINR(tile.price));
  if (buyable) label.push(owned ? `owned by ${ownerName || 'a player'}` : 'for sale');
  if (mortgaged) label.push('mortgaged');
  if (isProperty && level > 0) label.push(LEVEL_NAMES[level] || `level ${level}`);
  if (set === 'full') label.push('full colour set');
  if (set === 'partial') label.push('two of three in the colour set');

  const iconTile = !isProperty && !tile.corner;
  const name = iconTile ? ICON_LABELS[tile.short] || tile.short : softName(tile.short);
  const fs = iconTile ? fitSize(name, 2.6, 2.0, true) : fitSize(name);
  const nameStyle = { '--fs': `${fs.toFixed(2)}cqw` };
  // a built tile has pips/badge under the name: two-line names get a compact, top-aligned layout
  if (built && (name.includes(' ') || name.includes(SHY))) cls.push('is-multi');

  let inner;
  if (tile.corner) {
    inner = (
      <>
        <span className="hb-tile__icon hb-tile__icon--corner">
          <TileIcon tile={tile} size={64} />
        </span>
        <span className="hb-pill">{tile.short}</span>
      </>
    );
  } else if (isProperty) {
    inner = (
      <>
        <span className="hb-tile__head">
          <span className="hb-tile__price">{compactINR(tile.price)}</span>
        </span>
        <span className="hb-tile__body">
          <span className="hb-tile__name" style={nameStyle}>
            {name}
          </span>
          {owned && level > 0 && (hotel ? <HotelBadge /> : <Pips level={level} />)}
        </span>
      </>
    );
  } else if (buyable) {
    inner = (
      <>
        <span className="hb-tile__head">
          <span className="hb-tile__price">{compactINR(tile.price)}</span>
        </span>
        <span className="hb-tile__body">
          <span className="hb-tile__icon">
            <TileIcon tile={tile} size={48} />
          </span>
          <span className="hb-tile__name hb-tile__name--sm" style={nameStyle}>
            {name}
          </span>
        </span>
      </>
    );
  } else {
    inner = (
      <>
        <span className="hb-tile__bar" />
        <span className="hb-tile__body">
          <span className="hb-tile__icon hb-tile__icon--lg">
            <TileIcon tile={tile} size={64} />
          </span>
          <span className="hb-tile__name hb-tile__name--sm" style={nameStyle}>
            {name}
          </span>
        </span>
      </>
    );
  }

  return (
    <button type="button" className={cls.join(' ')} style={style} aria-label={label.join(', ')} title={tile.name} data-tile={tile.id} onClick={() => onSelect?.(tile.id)}>
      {inner}
      {mortgaged && (
        <span className="hb-tile__m" aria-hidden="true">
          M
        </span>
      )}
    </button>
  );
}

export const Tile = memo(TileImpl);
export default Tile;
