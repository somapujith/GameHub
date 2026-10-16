// One player's card: avatar + colour ring + pawn dot, name, "₹cash (₹net worth)", turn pill, badges.
import { Avatar } from '@/components/art/index.js';
import { formatINR } from '@shared/format.js';
import Icon from './ui/Icon.jsx';
import Money from './ui/Money.jsx';
import Pill from './ui/Pill.jsx';

/** A little board pawn (white base, coloured head) like the reference screenshot. */
export function PawnDot({ color, size = 24 }) {
  return (
    <span className="hg-pawndot" style={{ '--pc': color, width: size, height: size }} aria-hidden="true">
      <i />
    </span>
  );
}

export default function PlayerCard({
  player, worth, isMe = false, isActive = false, isLeader = false, avatarSize = 46, onSelect,
}) {
  const jailed = (player.jailTurns || 0) > 0 && !player.bankrupt;
  const label = [
    `${player.name}${isMe ? ' (you)' : ''}`,
    player.bankrupt ? 'bankrupt' : `${formatINR(player.cash)} cash, ${formatINR(worth)} net worth`,
    isLeader ? 'leading' : '',
    isActive ? 'current turn' : '',
    jailed ? 'in jail' : '',
  ].filter(Boolean).join(', ');

  let status = null;
  if (player.bankrupt) status = <Pill tone="bad">Bankrupt</Pill>;
  else if (isActive && isMe) status = <Pill tone="blue" className="hg-pill--turn">Your Turn</Pill>;
  else if (isActive) status = <Pill tone="neutral" pulse className="hg-pill--turn">{player.name}&rsquo;s turn</Pill>;
  else if (jailed) status = <Pill tone="warn" icon={<Icon name="lock" size={12} />}>In jail</Pill>;

  return (
    <button
      type="button"
      className={`hg-pc${isActive ? ' is-active' : ''}${isMe ? ' is-me' : ''}${player.bankrupt ? ' is-out' : ''}`}
      style={{ '--pc': player.color }}
      onClick={() => onSelect?.(player.id)}
      aria-label={label}
    >
      <span className="hg-pc-avatar">
        <span className="hg-pc-ring">
          <Avatar preset={player.avatar} size={avatarSize} />
        </span>
        {jailed ? (
          <span className="hg-pc-jail" title="In jail"><Icon name="lock" size={12} strokeWidth={2.4} /></span>
        ) : null}
        <PawnDot color={player.color} />
      </span>
      <span className="hg-pc-info">
        <span className="hg-pc-name">
          {isLeader ? <Icon name="crown" size={14} className="hg-pc-crown" /> : null}
          {player.isBot ? (
            <span className="hg-pc-dot is-bot" title="Bot"><Icon name="bot" size={12} strokeWidth={2.2} /></span>
          ) : (
            <span className="hg-pc-dot is-human" title="Player" />
          )}
          <b>{player.name}</b>
        </span>
        <span className="hg-pc-money">
          <Money value={player.cash} flash className="hg-pc-cash" />
          <span className="hg-pc-worth">
            (<Money value={worth} />)
          </span>
        </span>
        <span className="hg-pc-status">{status}</span>
      </span>
    </button>
  );
}
