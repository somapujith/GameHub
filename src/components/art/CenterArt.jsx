// Large isometric diorama for the centre of the board (one per tile art key; properties use the building ladder).
import { memo, useId } from 'react';
import { GROUPS, MAX_LEVEL, LEVEL_NAMES } from '@shared/board.js';
import { PAL } from './palette.js';
import { Slab, Shade, Tree, Bush, Grass, pt } from './iso.jsx';
import { BuildingModel } from './BuildingArt.jsx';
import { Charminar, Metro, Boat, Plane, Bulb } from './dioramas1.jsx';
import { Water, Tax, Film, Jail, Auction, Kismet } from './dioramas2.jsx';

const VB_W = 240;
const VB_H = 176;
const ORIGIN = [120, 56];
const PROP_SCALE = [1.3, 1.25, 1.1, 1.0, 0.88, 1.0];

const NAMES = {
  charminar: 'Charminar',
  metro: 'Hyderabad Metro',
  boat: 'Hussain Sagar with the Buddha statue',
  plane: 'Airport runway with aeroplane',
  bulb: 'Electricity bulb and pylon',
  water: 'Water drop and tanker',
  tax: 'Property tax papers and stamp',
  film: 'Film City clapperboard and camera',
  kismet: 'Biryani handi with a Kismet card',
  jail: 'Jail building',
  auction: 'Auction gavel with bangles and pearls',
};

function Property({ level, color }) {
  const L = Math.max(0, Math.min(MAX_LEVEL, level | 0));
  const s = PROP_SCALE[L] ?? 0.9;
  return (
    <Slab top="#6a62b4">
      <Grass x={7} y={7} w={12} d={12} />
      <Grass x={77} y={77} w={12} d={12} />
      {L >= 2 && <Tree x={13} y={13} s={0.9} />}
      {L >= 2 && <Bush x={83} y={83} s={0.9} />}
      <g transform={`translate(0 48) scale(${s})`}>
        <BuildingModel level={L} color={color} />
      </g>
    </Slab>
  );
}

function CenterArtBase({ tile, level = 0, color, size = 220, className, title }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const art = tile?.art || 'property';
  const gcol = color || (tile?.group && GROUPS[tile.group]?.color) || PAL.saffron;
  let body;
  let top = '#6a62b4';
  if (art === 'property') {
    body = <Property level={level} color={gcol} />;
  } else {
    const build = { charminar: Charminar, metro: Metro, boat: Boat, plane: Plane, bulb: Bulb, water: Water, tax: Tax, film: Film, jail: Jail, auction: Auction, kismet: Kismet }[art] || Charminar;
    const out = build({ gid });
    top = out.top;
    body = <Slab top={top}>{out.node}</Slab>;
  }
  const label =
    title === undefined ? undefined : title || (art === 'property' ? `${tile?.name || 'Property'} (${LEVEL_NAMES[Math.max(0, Math.min(MAX_LEVEL, level | 0))]})` : NAMES[art] || tile?.name);
  const numeric = typeof size === 'number';
  return (
    <svg
      className={className}
      width={size}
      height={numeric ? Math.round((size * VB_H) / VB_W) : undefined}
      style={numeric ? undefined : { width: size, height: 'auto' }}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      strokeWidth=".6"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]})`}>{body}</g>
    </svg>
  );
}

export const CenterArt = memo(CenterArtBase);
export default CenterArt;
