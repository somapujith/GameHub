import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getGame } from '@/games/registry.js';
import { BRAND } from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import TableCard from '@/platform/game/TableCard.jsx';
import Unavailable from '@/platform/game/Unavailable.jsx';
import { themeVars } from '@/platform/game/color.js';
import useDocTitle from '@/platform/game/useDocTitle.js';
import useHostRoom from '@/platform/game/useHostRoom.js';
import useOpenRooms from '@/platform/game/useOpenRooms.js';

const POLL_MS = 10000;

/** "Live · updated 4 s ago": ticks every second on its own, so the list below does not re-render. */
function LiveLine({ error, hasRooms, updatedAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  let text = 'Looking for tables…';
  if (error) text = hasRooms ? 'Connection lost. Showing the last list.' : error;
  else if (secs !== null) text = `Live · updated ${secs < 3 ? 'just now' : `${secs} s ago`} · refreshes every ${POLL_MS / 1000} s`;
  return (
    <p className="hub-live" role="status">
      <span className={`hub-live__dot${error ? ' is-off' : ''}`} aria-hidden="true" />
      {text}
    </p>
  );
}

function Tables({ game }) {
  const { rooms, loading, refreshing, error, refresh, updatedAt } = useOpenRooms(game.id, { poll: POLL_MS, limit: 30 });
  const { host, busy } = useHostRoom(game);
  const empty = rooms && rooms.length === 0;

  return (
    <div className="hub-page hub-tables" style={themeVars(game.theme)}>
      <Link to={paths.game(game.id)} className="hub-back">
        <HubIcon name="chevL" size={18} /> {game.name}
      </Link>

      <header className="hub-tables__head">
        <div>
          <p className="hub-eyebrow">{game.name}</p>
          <h1 className="hub-h1">Open tables</h1>
          <p className="hub-lead">Public rooms waiting for players. Jump in, or host your own.</p>
        </div>
        <div className="hub-tables__actions">
          <button type="button" className="hub-btn hub-btn--soft" onClick={refresh} disabled={refreshing} aria-busy={refreshing || undefined}>
            <HubIcon name="refresh" size={18} className={refreshing ? 'hub-spin' : ''} /> Refresh
          </button>
          <button type="button" className="hub-btn hub-btn--accent" onClick={() => host('public')} disabled={busy} aria-busy={busy || undefined}>
            <HubIcon name="plus" size={18} /> Host a table
          </button>
        </div>
      </header>

      <LiveLine error={error} hasRooms={!!rooms} updatedAt={updatedAt} />

      {loading && (
        <ul className="hub-tables__list" aria-busy="true" aria-label="Loading tables">
          {[0, 1, 2].map((i) => (
            <li key={i} className="hub-table hub-table--skel">
              <span className="hub-skel hub-skel--tile" />
              <span className="hub-table__body">
                <span className="hub-skel hub-skel--line" style={{ width: '55%' }} />
                <span className="hub-skel hub-skel--line" style={{ width: '80%' }} />
              </span>
              <span className="hub-skel hub-skel--btn" />
            </li>
          ))}
        </ul>
      )}

      {!loading && !rooms && error && (
        <div className="hub-empty">
          <span className="hub-empty__icon" aria-hidden="true">
            <HubIcon name="wifiOff" size={28} />
          </span>
          <h2 className="hub-empty__title">Can't reach the tables</h2>
          <p className="hub-empty__text">Check your connection and try again. You can still play with bots.</p>
          <div className="hub-empty__actions">
            <button type="button" className="hub-btn hub-btn--primary" onClick={refresh}>
              <HubIcon name="refresh" size={18} /> Try again
            </button>
            <Link to={paths.game(game.id)} className="hub-btn hub-btn--ghost">
              Back to {game.name}
            </Link>
          </div>
        </div>
      )}

      {empty && (
        <div className="hub-empty">
          <span className="hub-empty__icon" aria-hidden="true">
            <HubIcon name="table" size={28} />
          </span>
          <h2 className="hub-empty__title">No open tables right now</h2>
          <p className="hub-empty__text">Be the first: host a public table and other players can join you in seconds.</p>
          <div className="hub-empty__actions">
            <button type="button" className="hub-btn hub-btn--accent" onClick={() => host('public')} disabled={busy}>
              <HubIcon name="plus" size={18} /> Host a table
            </button>
            <Link to={paths.game(game.id)} className="hub-btn hub-btn--ghost">
              Back to {game.name}
            </Link>
          </div>
        </div>
      )}

      {rooms && rooms.length > 0 && (
        <ul className="hub-tables__list" aria-label={`Open ${game.name} tables`}>
          {rooms.map((r) => (
            <TableCard key={r.code} room={r} game={game} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** /games/:gameId/tables: public rooms for one game, auto-refreshing while the tab is visible. */
export default function GameTables() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  useDocTitle(game ? `Open tables · ${game.name} · ${BRAND.name}` : `Game not available · ${BRAND.name}`);
  if (!game) return <Unavailable reason="unknown" />;
  if (game.status === 'coming_soon') return <Unavailable reason="soon" game={game} />;
  return <Tables game={game} />;
}
