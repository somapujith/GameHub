import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from './HubIcon.jsx';

/** "just now", "4 min ago", "2 h ago" for an ISO timestamp; '' when unknown. */
export function ago(iso, now = Date.now()) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : 'earlier';
}

/** One public room: host, seats filled, settings summary and a Join button (-> /join/:code). */
export default function TableCard({ room, game }) {
  const full = room.players >= room.maxPlayers;
  const Icon = game?.art?.icon;
  const when = ago(room.createdAt);
  const seats = Array.from({ length: Math.min(room.maxPlayers, 8) }, (_, i) => i < room.players);
  return (
    <li className="hub-table">
      <span className="hub-table__icon" aria-hidden="true">
        {Icon ? <Icon size={48} /> : <HubIcon name="table" size={24} />}
      </span>
      <div className="hub-table__body">
        <b className="hub-table__host">{room.hostName}'s table</b>
        <span className="hub-table__sum">{room.summary || game?.tagline || ''}</span>
        <span className="hub-table__meta">
          <span className="hub-seats" role="img" aria-label={`${room.players} of ${room.maxPlayers} seats taken`}>
            {seats.map((on, i) => (
              <i key={i} className={on ? 'is-on' : ''} />
            ))}
          </span>
          <span>
            {room.players}/{room.maxPlayers}
          </span>
          {when && <span className="hub-table__when">· {when}</span>}
        </span>
      </div>
      <Link to={paths.join(room.code)} className={`hub-btn hub-btn--accent hub-btn--sm hub-table__join${full ? ' is-disabled' : ''}`} aria-disabled={full || undefined} aria-label={`Join ${room.hostName}'s table`}>
        Join
      </Link>
    </li>
  );
}
