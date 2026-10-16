import { Avatar } from '@/components/art/index.js';
import '@/styles/online.css';

export function CrownIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One seat in the lobby. `player` = { id, name, avatar, ready, connected, isBot }. */
export default function PlayerRow({ player, isHost, isMe, canRemove, onRemove, color }) {
  const { name, avatar, ready, connected, isBot } = player;
  const label = isBot ? 'Bot' : connected === false ? 'Disconnected' : 'Connected';
  return (
    <li className={`ho-player${isMe ? ' is-me' : ''}`} style={color ? { '--ho-seat': color } : undefined}>
      <span className="ho-player__avatar">
        <Avatar preset={Number.isInteger(avatar) ? avatar : 0} size={46} />
        {!isBot && <span className={`ho-dot ho-player__dot ${connected === false ? 'is-off' : 'is-on'}`} role="img" aria-label={label} />}
      </span>
      <span className="ho-player__main">
        <span className="ho-player__name">
          {name || 'Player'}
          {isMe && <span className="ho-tag ho-tag--me">You</span>}
          {isHost && (
            <span className="ho-tag ho-tag--host" title="Host">
              <CrownIcon size={13} /> Host
            </span>
          )}
          {isBot && <span className="ho-tag ho-tag--bot">Bot</span>}
        </span>
        <span className="ho-player__sub">{isBot ? 'Plays automatically' : connected === false ? 'Reconnecting...' : ready || isHost ? 'Ready to play' : 'Not ready yet'}</span>
      </span>
      <span className="ho-player__end">
        {(ready || isBot || isHost) && !isBot ? (
          <span className="ho-ready is-ready" title="Ready">
            <CheckIcon size={16} />
            <span className="ho-sr">Ready</span>
          </span>
        ) : !isBot ? (
          <span className="ho-ready" title="Not ready">
            <span className="ho-sr">Not ready</span>
          </span>
        ) : null}
        {canRemove && (
          <button type="button" className="ho-iconbtn" onClick={onRemove} aria-label={isBot ? `Remove bot ${name}` : `Remove ${name} from the room`}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        )}
      </span>
    </li>
  );
}
