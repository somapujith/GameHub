import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import * as shared from '@shared/index.js';
import { GROUP_TILES, TILES, tilePosition } from '@shared/board.js';
import Tile, { eventMark } from './Tile.jsx';
import Pawn from './Pawn.jsx';
import { oddsSupported, useOddsPref } from './oddsPref.js';
import '@/styles/board.css';

const NONE = [];
const NO_DISPLAY = {};

// ---- landing odds overlay ---------------------------------------------------
// `landingOdds` is written by the dice agent and `previewRent` by the engine; both are looked up
// by name so a build without them still works (the overlay simply stays hidden). The on/off
// preference lives in oddsPref.js: the control panel renders the button, this file paints the chips.
const ODDS_FN = 'landingOdds';
const RENT_FN = 'previewRent';
const MIN_CHIP = 0.005; // below 0.5% a tile gets no chip

/** cool (blue) to hot (red) */
const oddsHue = (t) => Math.round(215 * (1 - Math.max(0, Math.min(1, t))));

function computeOdds(view, me) {
  try {
    const fn = shared[ODDS_FN];
    if (typeof fn !== 'function' || !view || me == null) return null;
    const probs = fn(view, me, { previewRent: shared[RENT_FN] });
    if (!probs || typeof probs.length !== 'number') return null;
    let total = 0;
    let max = 0;
    const list = TILES.map((t) => {
      const p = Number(probs[t.id]) || 0;
      total += p;
      if (p > max) max = p;
      return p;
    });
    const top = new Set(
      list
        .map((p, id) => [p, id])
        .filter(([p]) => p >= MIN_CHIP)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 3)
        .map(([, id]) => id),
    );
    return { list, total, max, top };
  } catch {
    return null; // never let a stats helper take the board down
  }
}

/** What fills the middle until a control panel is passed in. */
const CenterBrand = memo(function CenterBrand() {
  return (
    <div className="hb-center__brand" aria-hidden="true">
      <div className="hb-center__banner">
        <span>Hyderabad</span>
        <b>Tycoon</b>
      </div>
    </div>
  );
});

const pct = (p) => (p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

/** Translucent probability chips over every tile (pointer-events: none, so taps still reach the tiles). */
const OddsLayer = memo(function OddsLayer({ odds }) {
  return (
    <div className="hb-odds" aria-hidden="true">
      {TILES.map((tile) => {
        const p = odds.list[tile.id];
        const { col, row } = tilePosition(tile.id);
        const shown = p >= MIN_CHIP;
        const t = odds.max > 0 ? p / odds.max : 0;
        return (
          <span
            key={tile.id}
            className={`hb-odds__cell${shown ? ' has-chip' : ''}${odds.top.has(tile.id) ? ' is-top' : ''}`}
            style={{ gridColumn: col + 1, gridRow: row + 1, '--h': oddsHue(t) }}
          >
            {shown && <span className="hb-odds__chip">{pct(p)}</span>}
          </span>
        );
      })}
    </div>
  );
});

/**
 * The whole square board: 40 tiles on an 11x11 ring (corner tracks 1.4x an edge track), the 9x9 middle
 * for the control panel and the pawn layer. All sizes are container-query units of this component's
 * own width, so the parent only decides how wide it is. `--hb-u` (one edge tile) is set on the grid and
 * inherited by everything inside, including `center`.
 *
 * <Board session onTileClick={(tileId) => …} highlightTile={tileId|null} center={ReactNode} />
 *
 * `center` fills `div.hb-center` (position: relative, exactly the 9x9 region the ring encloses); it is
 * the caller's to lay out. Landing odds: toggle with `useOddsPref()` from ./oddsPref.js.
 */
export function Board({ session, onTileClick, highlightTile = null, center = null }) {
  const d = session?.display || session?.view || NO_DISPLAY;
  const players = d.players || NONE;
  const owners = d.owners || NONE;
  const levels = d.levels || NONE;
  const mortgaged = d.mortgaged || NONE;

  // Stable tile callback: tiles are memoised, so an inline onTileClick must not re-render them all.
  const clickRef = useRef(onTileClick);
  useEffect(() => {
    clickRef.current = onTileClick;
  });
  const onSelect = useCallback((id) => clickRef.current?.(id), []);

  const turnPlayer = players[d.turn];
  const activeTile = turnPlayer && !turnPlayer.bankrupt ? turnPlayer.pos : -1;

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // ---- snatch window: the contested tile pulses and shows its buyer. Read from the LATEST authoritative
  // state (`session.view`), never from the animation `display`, which can lag behind the real-time window.
  const view = session?.view;
  const snatch = view?.phase === 'snatch' && view.pending?.type === 'snatch' ? view.pending : null;
  const snatchBuyer = snatch ? (view.players || NONE).find((p) => p.id === snatch.buyer) || byId.get(snatch.buyer) : null;

  // ---- city event: public state, read from the latest view like the snatch ring
  const cityEvent = view?.event || null;

  // ---- traps: view.traps is already redacted to the viewer's own; never read from the delayed display
  const myTraps = useMemo(() => {
    const mine = new Set();
    for (const t of view?.traps || NONE) if (t && t.owner === session?.me) mine.add(t.tile);
    return mine;
  }, [view?.traps, session?.me]);

  // ---- odds: computed only while the toggle is on and it is my moment to roll
  const [oddsOn] = useOddsPref();
  const me = session?.me;
  const canRoll = !!session?.options?.roll;
  const myPos = view?.players?.find?.((p) => p.id === me)?.pos;
  const oddsActive = oddsOn && canRoll && oddsSupported();
  const odds = useMemo(
    () => (oddsActive ? computeOdds(view, me) : null),
    // memoised per turn / position / phase (view itself changes on every presenter step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oddsActive, view?.turn, view?.turnCount, myPos, view?.phase, me],
  );

  const tiles = TILES.map((tile) => {
    const contested = snatch?.tile === tile.id;
    // the buyer already owns the tile in the live state; the delayed display may not show it yet
    const ownerId = contested && snatchBuyer ? snatchBuyer.id : owners[tile.id];
    const owner = contested && snatchBuyer ? snatchBuyer : ownerId != null ? byId.get(ownerId) : null;
    // whole colour held by this owner = glow ring (there is no "two of three" state any more)
    let setState = 'none';
    if (owner && tile.group) {
      const ids = GROUP_TILES[tile.group];
      if (ids.every((t) => owners[t] === ownerId)) setState = 'full';
    }
    return (
      <Tile
        key={tile.id}
        tile={tile}
        ownerColor={owner ? owner.color : null}
        ownerName={owner ? owner.name : ''}
        level={owner ? levels[tile.id] || 0 : 0}
        setState={setState}
        mortgaged={!!(owner && mortgaged[tile.id])}
        snatch={contested}
        event={eventMark(cityEvent, tile)}
        trap={myTraps.has(tile.id)}
        highlight={highlightTile === tile.id}
        active={activeTile === tile.id}
        onSelect={onSelect}
      />
    );
  });

  // Pawns sharing a tile fan out by their order in the players list.
  const crowd = new Map();
  players.forEach((p) => {
    if (p.bankrupt) return;
    const list = crowd.get(p.pos) || [];
    list.push(p.id);
    crowd.set(p.pos, list);
  });

  return (
    <div className={`hb-board${odds ? ' has-odds' : ''}`}>
      <div className="hb-frame">
        <div className="hb-grid">
          {tiles}
          <div className="hb-center">{center ?? <CenterBrand />}</div>
          {odds && <OddsLayer odds={odds} />}
          <div className="hb-pawns" style={{ '--hb-step': `${Math.max(60, Math.round(session?.display?.stepMs ?? 260))}ms` }}>
            {players.map((p, i) => {
              const mates = crowd.get(p.pos) || NONE;
              return (
                <Pawn
                  key={p.id}
                  name={p.name}
                  color={p.color}
                  pos={p.pos}
                  slot={Math.max(0, mates.indexOf(p.id))}
                  count={mates.length || 1}
                  isTurn={i === d.turn && d.phase !== 'over'}
                  jailed={(p.jailTurns || 0) > 0}
                  bankrupt={!!p.bankrupt}
                  tileName={TILES[p.pos]?.name}
                />
              );
            })}
          </div>
        </div>
        <span className="hb-frame__sheen" aria-hidden="true" />
      </div>
    </div>
  );
}

export default Board;
