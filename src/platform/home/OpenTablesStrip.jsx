import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { ago } from '@/platform/game/TableCard.jsx';
import { featured, gameById, liveList } from './catalog.js';
import { themeVars } from './gameTheme.js';
import { useApi, useApiGate } from './useApi.js';

/** One public table, using platform-core's `.hub-table` look; the whole row's Join button goes to /join/:code. */
function OpenTable({ room }) {
  const game = gameById(room.gameId);
  const Ico = game?.art?.icon;
  const host = room.hostName || 'A player';
  const max = Math.max(1, Number(room.maxPlayers) || 1);
  const players = Math.max(0, Number(room.players) || 0);
  const full = players >= max;
  const seats = Array.from({ length: Math.min(max, 8) }, (_, i) => i < players);
  const when = ago(room.createdAt);
  return (
    <li className="hub-table hh2-table" style={themeVars(game)}>
      <span className="hub-table__icon" aria-hidden="true">
        {Ico ? <Ico size={48} /> : <HubIcon name="table" size={24} />}
      </span>
      <div className="hub-table__body">
        <b className="hub-table__host">{host}&rsquo;s table</b>
        <span className="hub-table__sum">{[game?.name, room.summary].filter(Boolean).join(' · ') || 'Open table'}</span>
        <span className="hub-table__meta">
          <span className="hub-seats" role="img" aria-label={`${players} of ${max} seats taken`}>
            {seats.map((on, i) => (
              <i key={i} className={on ? 'is-on' : ''} />
            ))}
          </span>
          <span>
            {players}/{max}
          </span>
          {when && <span className="hub-table__when">&middot; {when}</span>}
        </span>
      </div>
      <Link
        to={paths.join(room.code)}
        className={`hub-btn hub-btn--accent hub-btn--sm${full ? ' is-disabled' : ''}`}
        aria-disabled={full || undefined}
        aria-label={`Join ${host}'s table${game ? ` of ${game.name}` : ''}`}
      >
        {full ? 'Full' : 'Join'}
      </Link>
    </li>
  );
}

/** "Open tables": public rooms across games (GET /api/rooms/open?limit=4). */
export default function OpenTablesStrip() {
  const { booting, ready, retry } = useApiGate();
  const { status, data, reload } = useApi('/api/rooms/open?limit=4', { enabled: ready });
  const rooms = Array.isArray(data?.rooms) ? data.rooms.filter((r) => r && r.code).slice(0, 4) : [];
  const live = liveList();
  const lead = featured();
  const state = booting ? 'loading' : !ready ? 'offline' : status === 'idle' ? 'loading' : status;

  let body;
  if (state === 'loading') {
    body = (
      <ul className="hh2-tables" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="hub-table hub-table--skel">
            <span className="hub-skel hub-skel--tile" />
            <div className="hub-table__body">
              <span className="hub-skel hub-skel--line" style={{ width: '58%' }} />
              <span className="hub-skel hub-skel--line" style={{ width: '38%', height: 10 }} />
            </div>
            <span className="hub-skel hub-skel--btn" />
          </li>
        ))}
      </ul>
    );
  } else if (state === 'ok' && rooms.length) {
    body = (
      <ul className="hh2-tables">
        {rooms.map((r) => (
          <OpenTable key={r.code} room={r} />
        ))}
      </ul>
    );
  } else if (state === 'ok') {
    body = (
      <div className="hh2-prompt">
        <span className="hh2-prompt__icon" aria-hidden="true">
          <HubIcon name="table" size={22} />
        </span>
        <p className="hh2-prompt__text">
          <b>No open tables right now</b>
          <span>Start a public table from any game and others can hop in.</span>
        </p>
        {lead && (
          <Link to={paths.game(lead.id)} className="hub-btn hub-btn--primary hub-btn--sm">
            <HubIcon name="plus" size={16} /> Start a table
          </Link>
        )}
      </div>
    );
  } else {
    body = (
      <div className="hh2-prompt hh2-prompt--quiet">
        <span className="hh2-prompt__icon" aria-hidden="true">
          <HubIcon name="wifiOff" size={22} />
        </span>
        <p className="hh2-prompt__text">
          <b>Tables need a connection</b>
          <span>We cannot reach the server right now. You can still play against bots.</span>
        </p>
        <button type="button" className="hub-btn hub-btn--soft hub-btn--sm" onClick={ready ? reload : retry}>
          <HubIcon name="refresh" size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <section className="hub-section hh2-opentables" aria-labelledby="hh2-tables-h" aria-busy={state === 'loading'}>
      <div className="hub-section__head">
        <h2 id="hh2-tables-h" className="hub-section__title">
          Open tables
          {state === 'ok' && rooms.length > 0 && <span className="hub-pill hub-pill--live hh2-pill-gap">Live</span>}
        </h2>
        {live.length === 1 && (
          <Link to={paths.tables(live[0].id)} className="hub-section__more">
            See all
          </Link>
        )}
      </div>
      {body}
    </section>
  );
}
