// The Manage tab of the control panel: my properties grouped by colour set, with set progress + multiplier and
// per-tile actions Build, Sell building, Mortgage, Unmortgage (each shown only when session.options lists that tile,
// and disabled while the snatch window is open).
import { HOTEL_LEVEL, LEVEL_NAMES, MAX_LEVEL, TILES, mortgageValue, unmortgageCost } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import { PanelButton } from './ActionBar.jsx';
import { dieValue } from './Dice.jsx';
import { canUpgradeSafe, previewRentSafe, setProgress, useStateLike } from './ui/helpers.js';
import '@/styles/controlpanel.css';

const X = '×';

/** Building level as small squares (four houses, then a hotel). */
export function BuildPips({ level = 0 }) {
  return (
    <span className={`cp-pips${level >= HOTEL_LEVEL ? ' is-hotel' : ''}`} role="img" aria-label={LEVEL_NAMES[level] || ''}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < level ? 'is-on' : ''} />)}
    </span>
  );
}

export default function MyProperties({ session, onOpenTile }) {
  const state = useStateLike(session);
  const me = session.me;
  const o = session.options || {};
  const rows = setProgress(state.owners, me);
  const index = (list) => new Map((list || []).map((u) => [u.tile, u]));
  const build = index(o.upgrade);
  const sell = index(o.sellBuilding);
  const mort = index(o.mortgage);
  const unmort = index(o.unmortgage);
  const setInfo = new Map((o.sets || []).map((s) => [s.group, s]));
  const sum = dieValue(session);
  const locked = session.view?.phase === 'snatch'; // the engine rejects building and mortgages during a snatch window
  const off = session.busy || locked;
  const nameOfOwner = (id) => (state.owners[id] ? state.players.find((p) => p.id === state.owners[id])?.name : null);
  const act = (type, tile) => () => session.dispatch({ type, tile });

  if (rows.length === 0) {
    return (
      <div className="cp-empty">
        <b>No properties yet.</b>
        <span>Land on a free tile and buy it to start your empire.</span>
      </div>
    );
  }

  return (
    <>
      {locked ? <p className="cp-note" role="status">Snatch window open. Building and mortgages wait a moment.</p> : null}
      <ul className="cp-sets">
        {rows.map((r) => {
          const info = setInfo.get(r.set.id);
          return (
            <li key={r.set.id} className="cp-set" style={{ '--sc': r.set.color }}>
              <header className="cp-set__head">
                <i className="cp-set__chip" />
                <b>{r.owned.length}/{r.total} {r.set.name}</b>
                {info && info.multiplier > 1 ? <span className="cp-tag" title="Rent multiplier on empty plots">{X}{info.multiplier} rent</span> : null}
                {r.full ? <span className="cp-tag is-full">Full set</span> : null}
              </header>
              {!r.full && r.set.kind === 'property' ? (
                <p className="cp-set__missing">
                  Missing: {r.missing.map((t) => `${TILES[t].short}${nameOfOwner(t) ? ` (${nameOfOwner(t)})` : ''}`).join(', ')}
                </p>
              ) : null}
              <ul className="cp-props">
                {r.owned.map((id) => {
                  const tile = TILES[id];
                  const level = state.levels[id] || 0;
                  const isProp = tile.type === 'property';
                  const mortgaged = !!state.mortgaged?.[id];
                  const b = build.get(id);
                  const s = sell.get(id);
                  const m = mort.get(id);
                  const u = unmort.get(id);
                  const any = b || s || m || u;
                  let why = '';
                  if (!any) {
                    if (locked) {
                      why = 'Wait for the snatch window to close';
                    } else if (isProp && !mortgaged) {
                      const c = canUpgradeSafe(session.view, me, id);
                      why = level >= MAX_LEVEL ? 'Fully built' : c?.ok ? (session.busy ? 'Wait…' : 'Your turn only') : c?.reason || '';
                    } else if (mortgaged) {
                      why = 'Needs your turn and enough cash to unmortgage';
                    }
                  }
                  return (
                    <li key={id} className={`cp-prop${mortgaged ? ' is-mort' : ''}`}>
                      <button type="button" className="cp-prop__main" onClick={() => onOpenTile?.(id)}>
                        <span className="cp-prop__name">
                          {tile.name}
                          {mortgaged ? <em className="cp-flag">Mortgaged</em> : null}
                        </span>
                        <small className="cp-prop__meta">
                          {isProp ? (<><BuildPips level={level} /> {LEVEL_NAMES[level]}{' · '}</>) : null}
                          {mortgaged ? 'no rent' : `rent ${formatINR(previewRentSafe(state, id, sum))}`}
                          {' · '}
                          {mortgaged ? `lift for ${formatINR(unmortgageCost(tile))}` : `mortgage ${formatINR(mortgageValue(tile))}`}
                        </small>
                      </button>
                      {any ? (
                        <div className="cp-prop__acts">
                          {b ? (
                            <PanelButton
                              tone="gold"
                              size="sm"
                              disabled={off}
                              onClick={act('UPGRADE', id)}
                              aria-label={`Build ${LEVEL_NAMES[Math.min(MAX_LEVEL, level + 1)]} on ${tile.name} for ${formatINR(b.cost)}`}
                            >
                              {level + 1 === HOTEL_LEVEL ? 'Build hotel' : 'Build'} {formatINR(b.cost)}
                            </PanelButton>
                          ) : null}
                          {s ? (
                            <PanelButton
                              size="sm"
                              disabled={off}
                              onClick={act('SELL_BUILDING', id)}
                              aria-label={`Sell a building on ${tile.name} for ${formatINR(s.refund)}`}
                            >
                              Sell +{formatINR(s.refund)}
                            </PanelButton>
                          ) : null}
                          {m ? (
                            <PanelButton size="sm" disabled={off} onClick={act('MORTGAGE', id)}>
                              Mortgage +{formatINR(m.value)}
                            </PanelButton>
                          ) : null}
                          {u ? (
                            <PanelButton tone="green" size="sm" disabled={off} onClick={act('UNMORTGAGE', id)}>
                              Unmortgage {formatINR(u.cost)}
                            </PanelButton>
                          ) : null}
                        </div>
                      ) : why ? (
                        <p className="cp-prop__why">{why}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}
