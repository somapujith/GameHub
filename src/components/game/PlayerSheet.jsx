// Tap a scoreboard row: that player's cash, net worth, stats and properties (grouped by colour set).
// StatsSheet ("View stats") shows the same for every player at once, like the reference game's stats popup.
import { Avatar } from '@/components/art/index.js';
import { formatINR } from '@shared/format.js';
import * as shared from '@shared/index.js';
import Sheet from './ui/Sheet.jsx';
import Pill from './ui/Pill.jsx';
import Icon from './ui/Icon.jsx';
import TileChip from './ui/TileChip.jsx';
import { SnatchTokens, TrapReady, liveSnatches } from './MoneyBar.jsx';
import { activePlayer, setProgress, settingsSummary, useHeld, useWorths } from './ui/helpers.js';

const LAPS_PER_TOKEN = Number(shared.LAPS_PER_TOKEN) > 0 ? Number(shared.LAPS_PER_TOKEN) : 3;

/** "2/3 laps to a token": progress towards the next lap bonus (hidden when laps are unknown). */
function LapProgress({ laps }) {
  if (!Number.isFinite(laps)) return null;
  const n = laps % LAPS_PER_TOKEN;
  return <span className="hg-lapprog" style={{ fontSize: 12, opacity: 0.75, alignSelf: 'center' }} title="Passing START three times earns a Snatch token">{n}/{LAPS_PER_TOKEN} laps to a token</span>;
}

/** One card per colour set the player has a tile in: set name, n/total, tile chips with their building level. */
function SetCards({ rows, state, onOpenTile }) {
  return (
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
              <TileChip key={t} tileId={t} level={state.levels[t] || 0} mortgaged={!!state.mortgaged?.[t]} onClick={onOpenTile} />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PlayerTags({ session, p }) {
  const tokens = liveSnatches(session, p);
  return (
    <div className="hg-ps-tags">
      {p.bankrupt ? <Pill tone="bad">Bankrupt</Pill> : null}
      {!p.bankrupt && p.jailTurns > 0 ? <Pill tone="warn" icon={<Icon name="lock" size={12} />}>In jail</Pill> : null}
      {activePlayer(session)?.id === p.id && !p.bankrupt && session.view?.phase !== 'over' ? <Pill tone="blue">Turn</Pill> : null}
      {p.bankrupt ? null : <SnatchTokens count={tokens} />}
      {p.bankrupt ? null : <TrapReady count={p.traps} />}
      {p.bankrupt || !Number.isFinite(tokens) ? null : <LapProgress laps={p.laps} />}
    </div>
  );
}

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
            <PlayerTags session={session} p={p} />
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
            <SetCards rows={rows} state={state} onOpenTile={onOpenTile} />
          )}
        </>
      ) : null}
    </Sheet>
  );
}

/** Every player at a glance: cash, net worth and properties grouped by colour set (richest first). */
export function StatsSheet({ session, open, onClose, onOpenTile }) {
  const { worths, leaderId, state } = useWorths(session);
  const summary = settingsSummary(session.display?.cfg || session.view?.cfg, session.display?.goal);
  const list = state.players
    .map((p) => ({ p, worth: worths[p.id] ?? p.cash, rows: setProgress(state.owners, p.id) }))
    .sort((a, b) => (Number(!!a.p.bankrupt) - Number(!!b.p.bankrupt)) || (b.worth - a.worth));

  return (
    <Sheet open={open} onClose={onClose} title="Player stats" className="hg-statssheet" desktop="modal">
      <p className="hg-summary hg-st-sum">{summary}</p>
      <ol className="hg-st-list">
        {list.map(({ p, worth, rows }) => {
          const count = rows.reduce((n, r) => n + r.owned.length, 0);
          return (
            <li key={p.id} className={`hg-st-player${p.bankrupt ? ' is-out' : ''}`} style={{ '--pc': p.color }}>
              <div className="hg-st-head">
                <span className="hg-pc-ring"><Avatar preset={p.avatar} size={40} /></span>
                <div className="hg-st-who">
                  <h3>
                    {leaderId === p.id ? <Icon name="crown" size={16} className="hg-mb-crown" /> : null}
                    {p.name}{p.id === session.me ? <small> (you)</small> : null}
                  </h3>
                  <PlayerTags session={session} p={p} />
                </div>
              </div>
              <dl className="hg-stats">
                <div><dt>Cash</dt><dd>{formatINR(p.cash)}</dd></div>
                <div><dt>Net worth</dt><dd className="is-good">{formatINR(worth)}</dd></div>
                <div><dt>Properties</dt><dd>{count}</dd></div>
              </dl>
              {rows.length === 0 ? (
                <p className="hg-empty">{p.bankrupt ? 'All assets went back to the bank.' : 'No properties yet.'}</p>
              ) : (
                <SetCards rows={rows} state={state} onOpenTile={onOpenTile} />
              )}
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
