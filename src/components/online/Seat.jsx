import { Avatar } from '@/components/art/index.js';
import '@/styles/online.css';

export function CrownIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" />
    </svg>
  );
}

/** A taken seat in the lobby. `player` = { id, name, avatar, connected }. `canRemove` shows the host's remove button. */
export default function Seat({ player, isHost, isMe, canRemove, onRemove, color }) {
  const { name, avatar, connected } = player;
  const label = connected === false ? 'Disconnected' : 'Connected';
  return (
    <li className={`ho-seat${isMe ? ' is-me' : ''}`} style={color ? { '--ho-seat': color } : undefined}>
      <span className="ho-seat__avatar">
        <Avatar preset={Number.isInteger(avatar) ? avatar : 0} size={46} />
        <span className={`ho-dot ho-seat__dot ${connected === false ? 'is-off' : 'is-on'}`} role="img" aria-label={label} />
      </span>
      <span className="ho-seat__name">{name || 'Player'}</span>
      <span className="ho-seat__tags">
        {isHost && (
          <span className="ho-tag ho-tag--host" title="Host">
            <CrownIcon size={13} /> Host
          </span>
        )}
        {isMe && <span className="ho-tag ho-tag--me">You</span>}
        {connected === false && <span className="ho-seat__away">Reconnecting...</span>}
      </span>
      {canRemove && (
        <button type="button" className="ho-iconbtn ho-seat__remove" onClick={onRemove} aria-label={`Remove ${name} from the room`}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}
    </li>
  );
}

/** A seat nobody has taken yet. */
export function EmptySeat() {
  return (
    <li className="ho-seat ho-seat--empty" aria-label="Open seat">
      <span className="ho-seat__avatar ho-seat__avatar--empty" aria-hidden="true">
        +
      </span>
      <span className="ho-seat__name ho-muted">Waiting for player...</span>
    </li>
  );
}
