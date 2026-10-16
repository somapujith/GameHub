// Tap a player card: their cash, net worth, stats and properties (grouped by set).
import { Avatar } from '@/components/art/index.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Pill from './ui/Pill.jsx';
import Icon from './ui/Icon.jsx';
import TileChip from './ui/TileChip.jsx';
import { activePlayer, setProgress, useHeld, useWorths } from './ui/helpers.js';

export default function PlayerSheet({ session, playerId, onClose, onOpenTile }) {
  const id = useHeld(playerId);
  const { worths, state } = useWorths(session);
  const p = id != null ? state.players.find((x) => x.id === id) : null;
  const full = id != null ? session.view?.players?.find((x) => x.id === id) : null;
  const rows = id != null ? setProgress(state.owners, id) : [];
  const count = rows.reduce((n, r) => n + r.owned.length, 0);
  const stats = full?.stats;

  return (
    <Sheet open={playerId != null} onClose={onClose} ariaLabel={p ? `${p.name} details` : 'Player details'} className="hg-playersheet"
      header={p ? (
        <div className="hg-ps-head" data-drag="" style={{ '--pc': p.color }}>
          <span className="hg-pc-ring"><Avatar preset={p.avatar} size={56} /></span>
          <div className="hg-ps-who">
            <h2>{p.name}{p.id === session.me ? <small> (you)</small> : null}</h2>
            <div className="hg-ps-tags">
              {p.isBot ? <Pill tone="neutral" icon={<Icon name="bot" size={12} />}>Bot</Pill> : null}
              {p.bankrupt ? <Pill tone="bad">Bankrupt</Pill> : null}
              {!p.bankrupt && p.jailTurns > 0 ? <Pill tone="warn" icon={<Icon name="lock" size={12} />}>In jail</Pill> : null}
              {activePlayer(session)?.id === p.id && !p.bankrupt ? <Pill tone="blue">Turn</Pill> : null}
            </div>
          </div>
        </div>
      ) : null}
    >
      {p ? (
        <>
          <dl className="hg-stats">
            <div><dt>Cash</dt><dd>{formatINR(p.cash)}</dd></div>
            <div><dt>Net worth</dt><dd className="is-good">{formatINR(worths[p.id] ?? p.cash)}</dd></div>
            <div><dt>Properties</dt><dd>{count}</dd></div>
            {stats ? <div><dt>Rent earned</dt><dd>{formatINR(stats.rentEarned)}</dd></div> : null}
            {stats ? <div><dt>Rent paid</dt><dd>{formatINR(stats.rentPaid)}</dd></div> : null}
            {stats ? <div><dt>Biggest rent</dt><dd>{formatINR(stats.biggestRent)}</dd></div> : null}
          </dl>

          <h3 className="hg-h3">Properties</h3>
          {rows.length === 0 ? (
            <p className="hg-empty">{p.bankrupt ? 'All assets went back to the bank.' : 'No properties yet.'}</p>
          ) : (
            <ul className="hg-setlist">
              {rows.map((r) => (
                <li key={r.set.id} className="hg-setcard" style={{ '--sc': r.set.color }}>
                  <div className="hg-setcard-head">
                    <i className="hg-setdot" />
                    <b>{r.set.name}</b>
                    <span className={`hg-setprog${r.full ? ' is-full' : ''}`}>{r.owned.length}/{r.total}{r.full ? ' full set' : ''}</span>
                  </div>
                  <div className="hg-chips">
                    {r.owned.map((t) => (
                      <TileChip key={t} tileId={t} level={state.levels[t] || 0} onClick={onOpenTile} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Sheet>
  );
}
