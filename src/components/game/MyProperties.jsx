// The local player's properties grouped by colour set, with set progress + multiplier and per-tile actions:
// Build, Sell building, Mortgage, Unmortgage (each shown only when session.options lists that tile).
import { BuildingArt } from '@/components/art/index.js';
import { HOTEL_LEVEL, LEVEL_NAMES, MAX_LEVEL, TILES, mortgageValue, unmortgageCost } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import Pill from './ui/Pill.jsx';
import TileChip, { LevelPips, SetDots } from './ui/TileChip.jsx';
import { canUpgradeSafe, diceSum, ownedBy, previewRentSafe, setProgress, useStateLike } from './ui/helpers.js';

const X = '×';

export default function MyProperties({ session, open, onClose, onOpenTile, onOpenTrade }) {
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
  const sum = diceSum(session);
  const nameOfOwner = (id) => (state.owners[id] ? state.players.find((p) => p.id === state.owners[id])?.name : null);
  const act = (type, tile) => () => session.dispatch({ type, tile });

  return (
    <Sheet open={open} onClose={onClose} title="My properties" className="hg-myprops" desktop="drawer">
      {o.trade?.canOffer && onOpenTrade ? (
        <Button variant="dark" block className="hg-myprops-trade" icon={<Icon name="swap" size={18} />} onClick={onOpenTrade}>
          Propose a trade
        </Button>
      ) : null}

      {rows.length === 0 ? (
        <div className="hg-empty-state">
          <span aria-hidden="true">{'🏠'}</span>
          <p>No properties yet.</p>
          <small>Land on a free tile and buy it to start your empire.</small>
        </div>
      ) : (
        <ul className="hg-setlist">
          {rows.map((r) => {
            const info = setInfo.get(r.set.id);
            return (
              <li key={r.set.id} className="hg-setcard" style={{ '--sc': r.set.color }}>
                <div className="hg-setcard-head">
                  <i className="hg-setdot" />
                  <b>{r.owned.length}/{r.total} {r.set.name}</b>
                  <SetDots owned={r.owned.length} total={r.total} color={r.set.color} />
                  {info && info.multiplier > 1 ? (
                    <Pill tone="gold" title="Rent multiplier on empty plots">{X}{info.multiplier} rent</Pill>
                  ) : null}
                  {r.full ? <span className="hg-setprog is-full">Full set</span> : null}
                </div>
                {!r.full && r.set.kind === 'property' ? (
                  <p className="hg-hint">
                    Missing: {r.missing.map((t) => `${TILES[t].short}${nameOfOwner(t) ? ` (${nameOfOwner(t)})` : ''}`).join(', ')}
                  </p>
                ) : null}
                <ul className="hg-prows">
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
                      if (isProp && !mortgaged) {
                        const c = canUpgradeSafe(session.view, me, id);
                        why = level >= MAX_LEVEL ? 'Fully built' : c?.ok ? (session.busy ? 'Wait…' : 'Your turn only') : c?.reason || '';
                      } else if (mortgaged) {
                        why = 'Needs your turn and enough cash to unmortgage';
                      }
                    }
                    return (
                      <li key={id} className={`hg-prow${mortgaged ? ' is-mort' : ''}`}>
                        <button type="button" className="hg-prow-main" onClick={() => onOpenTile?.(id)}>
                          <span className="hg-prow-art">
                            {isProp ? <BuildingArt level={level} color={r.set.color} size={44} /> : <span className="hg-prow-emoji" aria-hidden="true">{tile.emoji}</span>}
                          </span>
                          <span className="hg-prow-txt">
                            <b>{tile.name}{mortgaged ? <em className="hg-mortflag">Mortgaged</em> : null}</b>
                            <small>
                              {isProp ? (<><LevelPips level={level} color={r.set.color} /> {LEVEL_NAMES[level]}{' · '}</>) : null}
                              {mortgaged ? 'no rent' : `rent ${formatINR(previewRentSafe(state, id, sum))}`}
                            </small>
                            <small className="hg-prow-mort">
                              {mortgaged ? `Unmortgage costs ${formatINR(unmortgageCost(tile))}` : `Mortgage value ${formatINR(mortgageValue(tile))}`}
                            </small>
                          </span>
                        </button>
                        {any ? (
                          <div className="hg-prow-actions">
                            {b ? (
                              <Button
                                variant="gold"
                                size="sm"
                                className={level + 1 === HOTEL_LEVEL ? 'hg-btn--hotel' : ''}
                                disabled={session.busy}
                                onClick={act('UPGRADE', id)}
                                aria-label={`Build ${LEVEL_NAMES[Math.min(MAX_LEVEL, level + 1)]} on ${tile.name} for ${formatINR(b.cost)}`}
                              >
                                <Icon name="upgrade" size={16} />
                                {level + 1 === HOTEL_LEVEL ? 'Build hotel' : 'Build'} {formatINR(b.cost)}
                              </Button>
                            ) : null}
                            {s ? (
                              <Button variant="dark" size="sm" disabled={session.busy} onClick={act('SELL_BUILDING', id)}>
                                Sell building +{formatINR(s.refund)}
                              </Button>
                            ) : null}
                            {m ? (
                              <Button variant="dark" size="sm" disabled={session.busy} onClick={act('MORTGAGE', id)}>
                                Mortgage +{formatINR(m.value)}
                              </Button>
                            ) : null}
                            {u ? (
                              <Button variant="green" size="sm" disabled={session.busy} onClick={act('UNMORTGAGE', id)}>
                                Unmortgage {formatINR(u.cost)}
                              </Button>
                            ) : null}
                          </div>
                        ) : why ? (
                          <p className="hg-prow-why">{why}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** Compact version for the desktop sidebar: chips + a "Manage" button. */
export function MyPropertiesStrip({ session, onOpenTile, onManage }) {
  const state = useStateLike(session);
  const owned = ownedBy(state.owners, session.me);
  return (
    <section className="hg-mystrip" aria-label="My properties">
      <header className="hg-log-head">
        <h2>My properties <span className="hg-count">{owned.length}</span></h2>
        <Button variant="ghost" size="sm" onClick={onManage}>Manage</Button>
      </header>
      {owned.length === 0 ? (
        <p className="hg-empty">None yet. Buy your first tile!</p>
      ) : (
        <div className="hg-chips">
          {owned.map((id) => (
            <TileChip key={id} tileId={id} level={state.levels[id] || 0} mortgaged={!!state.mortgaged?.[id]} onClick={onOpenTile} />
          ))}
        </div>
      )}
    </section>
  );
}
