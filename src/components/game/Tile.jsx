import { memo } from 'react';
import { GROUPS, LEVEL_NAMES, MAX_LEVEL, PASS_START, tilePosition, tileSide } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import { TileIcon } from '@/components/art/index.js';
import '@/styles/board.css';

const SHY = '\u00ad';

// Hand-picked syllable breaks for the long Hyderabad names so they wrap on a 30px tile (a soft hyphen
// only breaks the word when it does not fit, so wide boards still show the whole name).
const BREAKS = {
  Dilsukhnagar: 'Dilsukh' + SHY + 'nagar',
  Mehdipatnam: 'Mehdi' + SHY + 'patnam',
  Kukatpally: 'Kukat' + SHY + 'pally',
  Gachibowli: 'Gachi' + SHY + 'bowli',
  Chowmahalla: 'Chow' + SHY + 'mahalla',
  Secunderabad: 'Secun' + SHY + 'derabad',
  Lingampally: 'Lingam' + SHY + 'pally',
  Kacheguda: 'Kache' + SHY + 'guda',
  Charminar: 'Char' + SHY + 'minar',
  Electricity: 'Electri' + SHY + 'city',
  Golconda: 'Gol' + SHY + 'conda',
  Madhapur: 'Madha' + SHY + 'pur',
  Kondapur: 'Konda' + SHY + 'pur',
  Malakpet: 'Malak' + SHY + 'pet',
  Nampally: 'Nam' + SHY + 'pally',
  Begumpet: 'Begum' + SHY + 'pet',
  Ameerpet: 'Ameer' + SHY + 'pet',
  District: 'Dis' + SHY + 'trict',
  Lumbini: 'Lum' + SHY + 'bini',
  Challan: 'Chal' + SHY + 'lan',
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
    .map((w) => (BREAKS[w] || w.length >= 9 ? hyphenate(w) : w))
    .join(' ');
}

// Outer corners of the board follow the frame's rounding: START bottom-right, Jail bottom-left,
// Chai Break top-left, Go to Jail top-right (see tilePosition).
const CORNER_CLASS = { 0: 'hb-tile--br', 10: 'hb-tile--bl', 20: 'hb-tile--tl', 30: 'hb-tile--tr' };

// Second line on the corner tiles (hidden on small boards).
const CORNER_SUB = {
  start: `Collect ${formatINR(PASS_START)}`,
  jail: 'Just visiting',
  parking: 'Take a break',
  gotojail: 'Straight to jail',
};

// ---- city event marks -------------------------------------------------------
// One frozen descriptor per effect, shared by every tile it touches, so a memoised Tile only re-renders
// when its own mark appears or disappears.
const MARKS = {
  monsoon: Object.freeze({ tone: 'rain', text: 'x0.5', note: 'rent halved this round' }),
  ipl: Object.freeze({ tone: 'star', text: 'x2', note: 'rent doubled this round' }),
  metro_strike: Object.freeze({ tone: 'closed', text: 'closed', note: 'closed, pays no rent this round' }),
  tax_holiday: Object.freeze({ tone: 'free', text: 'free', note: 'tax free this round' }),
};

/**
 * What the active city event (`view.event`) does to this tile, as a stable descriptor, or null.
 * monsoon / ipl hit every tile of `event.group`, metro_strike the stations, tax_holiday the tax squares;
 * bonalu and no event mark nothing.
 */
export function eventMark(event, tile) {
  if (!event || !tile) return null;
  switch (event.id) {
    case 'monsoon':
      return event.group && tile.group === event.group ? MARKS.monsoon : null;
    case 'ipl':
      return event.group && tile.group === event.group ? MARKS.ipl : null;
    case 'metro_strike':
      return tile.type === 'transport' ? MARKS.metro_strike : null;
    case 'tax_holiday':
      return tile.type === 'tax' ? MARKS.tax_holiday : null;
    default:
      return null;
  }
}

const EventIcon = ({ tone }) =>
  tone === 'rain' ? (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 2.5C9 7.4 6.5 10.4 6.5 14a5.5 5.5 0 0 0 11 0c0-3.6-2.5-6.6-5.5-11.5z" />
    </svg>
  ) : tone === 'star' ? (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z" />
    </svg>
  ) : null;

/** Levels 1..MAX_LEVEL-1 are little houses; MAX_LEVEL is a single red hotel, as on a real board. */
function Pips({ level }) {
  if (level >= MAX_LEVEL) return <span className="hb-pips is-hotel" aria-hidden="true"><i /></span>;
  return (
    <span className="hb-pips" aria-hidden="true">
      {Array.from({ length: Math.min(level, MAX_LEVEL - 1) }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/**
 * One board tile. Pure/primitive props so React.memo can skip untouched tiles.
 *  ownerColor: hex or null. level: 0..MAX_LEVEL. active: the mover is standing here.
 *  setState: 'none' | 'full' (the owner holds the whole colour: glow ring).
 *  mortgaged: greyed out with stripes and an M badge, no set glow.
 *  snatch: this tile is contested in the open snatch window (pulsing ring + lightning badge).
 *  trap: the viewer has a (secret) trap here: small amber warning badge.
 *  event: null or the frozen descriptor from eventMark() (ring + badge in the event's colour).
 */
function TileImpl({
  tile,
  ownerColor = null,
  ownerName = '',
  level = 0,
  setState = 'none',
  mortgaged = false,
  snatch = false,
  event = null,
  trap = false,
  highlight = false,
  active = false,
  onSelect,
}) {
  const side = tileSide(tile.id);
  const group = tile.group ? GROUPS[tile.group] : null;
  const owned = !!ownerColor;
  const buyable = tile.price != null;
  const isProperty = tile.type === 'property';
  const hotel = isProperty && owned && level >= MAX_LEVEL;
  const built = isProperty && owned && level > 0;
  const full = !mortgaged && setState === 'full';

  const { col, row } = tilePosition(tile.id);
  const style = { gridColumn: col + 1, gridRow: row + 1 };
  if (group) {
    style['--g'] = group.color;
    style['--gi'] = group.ink;
  }
  if (owned) style['--o'] = ownerColor;

  const cls = ['hb-tile', `hb-tile--${tile.type}`, `hb-side--${side}`];
  if (tile.corner) cls.push('hb-tile--corner', CORNER_CLASS[tile.id] || '');
  if (tile.type === 'kismet') cls.push(`hb-tile--${tile.deck}`);
  if (owned) cls.push('is-owned');
  if (full) cls.push('is-set');
  if (mortgaged) cls.push('is-mortgaged');
  if (hotel) cls.push('is-hotel');
  if (snatch) cls.push('is-snatch');
  if (trap) cls.push('has-trap');
  if (event) cls.push('is-event', `is-ev--${event.tone}`);
  if (built) cls.push('is-built');
  if (highlight) cls.push('is-hl');
  if (active) cls.push('is-active');

  const amount =
    tile.type === 'tax' ? (
      <>
        {formatINR(tile.taxFlat)}
        {tile.taxPercent ? <span className="hb-tile__or"> or {tile.taxPercent}%</span> : null}
      </>
    ) : null;

  const label = [tile.name];
  if (buyable) label.push(formatINR(tile.price), owned ? `owned by ${ownerName || 'a player'}` : 'for sale');
  if (tile.type === 'tax') label.push(`pay ${formatINR(tile.taxFlat)}${tile.taxPercent ? ` or ${tile.taxPercent}% of your worth, whichever is less` : ''}`);
  if (tile.type === 'start') label.push(`collect ${formatINR(PASS_START)}`);
  if (mortgaged) label.push('mortgaged');
  if (isProperty && level > 0) label.push(LEVEL_NAMES[level] || `level ${level}`);
  if (full) label.push('full colour set');
  if (snatch) label.push('snatch window open');
  if (event) label.push(event.note);
  if (trap) label.push('your trap');

  // the short name is on the tile; the full one is in the tooltip, the accessible name and the sheet
  const name = softName(tile.short);

  // "M" badge: sits in the colour band of a property, in the corner of any other tile
  const mBadge = (
    <span className="hb-tile__m" aria-hidden="true">
      M
    </span>
  );

  let inner;
  if (tile.corner) {
    inner = (
      <>
        <span className="hb-tile__icon hb-tile__icon--corner">
          <TileIcon tile={tile} size={64} />
        </span>
        <span className="hb-pill">{tile.short}</span>
        <span className="hb-tile__sub">{CORNER_SUB[tile.type]}</span>
      </>
    );
  } else if (isProperty) {
    inner = (
      <>
        <span className="hb-tile__band">{mortgaged ? mBadge : built && <Pips level={level} />}</span>
        <span className="hb-tile__body">
          <span className="hb-tile__name">{name}</span>
          <span className="hb-tile__price">{formatINR(tile.price)}</span>
        </span>
      </>
    );
  } else if (tile.type === 'kismet') {
    // a card back: tinted face, pattern frame, the deck's symbol and its name
    inner = (
      <span className="hb-tile__card">
        <span className="hb-tile__icon">
          <TileIcon tile={tile} size={48} />
        </span>
        <span className="hb-tile__name">{name}</span>
      </span>
    );
  } else {
    // station / utility / tax: the icon, then the name and the price (or tax amount) beside or under it
    inner = (
      <span className="hb-tile__body hb-tile__body--icon">
        <span className="hb-tile__icon">
          <TileIcon tile={tile} size={48} />
        </span>
        <span className="hb-tile__txt">
          <span className="hb-tile__name">{name}</span>
          <span className="hb-tile__price">{buyable ? formatINR(tile.price) : amount}</span>
        </span>
      </span>
    );
  }

  return (
    <button type="button" className={cls.join(' ')} style={style} aria-label={label.join(', ')} title={[tile.name, event && event.note, trap && 'your trap'].filter(Boolean).join(' - ')} data-tile={tile.id} onClick={() => onSelect?.(tile.id)}>
      {inner}
      {event?.tone === 'closed' && <i className="hb-tile__evx" aria-hidden="true" />}
      {trap && (
        <span className="hb-tile__trap" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3.2 22 20.5H2zM11 9.5h2v6h-2zM11 16.6h2v2h-2z" />
          </svg>
        </span>
      )}
      {event && (
        <span className="hb-tile__ev" aria-hidden="true">
          <EventIcon tone={event.tone} />
          <b className="hb-tile__ev-t">{event.text}</b>
        </span>
      )}
      {owned && <i className="hb-tile__own" aria-hidden="true" />}
      {mortgaged && !isProperty && mBadge}
      {snatch && (
        <span className="hb-tile__snatch" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M13.5 2 5 13.5h5.6L9.6 22 19 9.8h-5.7z" />
          </svg>
        </span>
      )}
    </button>
  );
}

export const Tile = memo(TileImpl);
export default Tile;
