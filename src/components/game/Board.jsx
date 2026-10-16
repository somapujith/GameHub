import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as shared from '@shared/index.js';
import { GROUP_TILES, TILES, tilePosition } from '@shared/board.js';
import Tile from './Tile.jsx';
import Pawn from './Pawn.jsx';
import Dice from './Dice.jsx';
import CenterStage from './CenterStage.jsx';
import '@/styles/board.css';

const NONE = [];
const NO_DISPLAY = {};

// ---- landing odds overlay ---------------------------------------------------
// `landingOdds` is written by the dice agent and `previewRent` by the engine; both are looked up
// by name so a build without them still works (the overlay and its toggle simply stay hidden).
const ODDS_FN = 'landingOdds';
const RENT_FN = 'previewRent';
const ODDS_KEY = 'hb.odds';
const MIN_CHIP = 0.005; // below 0.5% a tile gets no chip

const hasOddsFn = () => typeof shared[ODDS_FN] === 'function';

function readOddsPref() {
  try {
    return localStorage.getItem(ODDS_KEY) === '1';
  } catch {
    return false;
  }
}
function writeOddsPref(on) {
  try {
    localStorage.setItem(ODDS_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the toggle just isn't remembered */
  }
}

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
 * The whole square board: 28 tiles on an 8x8 grid, the 6x6 centre stage and the pawn layer.
 * All sizes are container-query units of this component's own width, so the parent only
 * decides how wide it is.
 *
 * <Board session onTileClick={(tileId) => …} highlightTile={tileId|null} />
 */
export function Board({ session, onTileClick, highlightTile = null }) {
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

  // ---- odds: computed only while the toggle is on and it is my moment to roll
  const [oddsOn, setOddsOn] = useState(readOddsPref);
  const toggleOdds = useCallback(() => {
    setOddsOn((v) => {
      writeOddsPref(!v);
      return !v;
    });
  }, []);
  const view = session?.view;
  const me = session?.me;
  const canRoll = !!session?.options?.roll;
  const myPos = view?.players?.find?.((p) => p.id === me)?.pos;
  const oddsActive = oddsOn && canRoll;
  const odds = useMemo(
    () => (oddsActive ? computeOdds(view, me) : undefined),
    // memoised per turn / position / phase (view itself changes on every presenter step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [oddsActive, view?.turn, view?.turnCount, myPos, view?.phase, me],
  );
  const oddsFailed = odds === null; // computed and failed: hide everything
  const oddsAvailable = hasOddsFn() && !oddsFailed;
  const oddsShowing = !!odds;
  const oddsUi = useMemo(
    () => ({
      available: oddsAvailable,
      on: oddsOn,
      showing: oddsShowing,
      total: odds ? odds.total : 0,
      onToggle: toggleOdds,
    }),
    [oddsAvailable, oddsOn, oddsShowing, odds, toggleOdds],
  );

  const tiles = TILES.map((tile) => {
    const ownerId = owners[tile.id];
    const owner = ownerId != null ? byId.get(ownerId) : null;
    // colour-set state for the owner: whole colour = glow ring, 2 of 3 = thin dotted ring
    let setState = 'none';
    if (owner && tile.group) {
      const ids = GROUP_TILES[tile.group];
      const held = ids.filter((t) => owners[t] === ownerId).length;
      if (held >= ids.length) setState = 'full';
      else if (ids.length === 3 && held === 2) setState = 'partial';
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
    <div className={`hb-board${oddsShowing ? ' has-odds' : ''}`}>
      <div className="hb-frame">
        <div className="hb-grid">
          {tiles}
          <CenterStage session={session} odds={oddsUi} />
          {odds && <OddsLayer odds={odds} />}
          <div className="hb-pawns">
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

export { Tile, Pawn, Dice, CenterStage };
export default Board;
