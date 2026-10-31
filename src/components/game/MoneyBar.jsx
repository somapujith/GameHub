// The scoreboard (like the reference game's money bar): one row per player with a turn arrow on whoever is
// playing, their cash, net worth and Snatch tokens, and a "View stats" button. Click a row -> onSelect(playerId).
// While a snatch window is open the buyer is tagged "Buying" and every eligible player "Can snatch".
import { formatINR } from '@shared/format.js';
import * as shared from '@shared/index.js';
import Icon from './ui/Icon.jsx';
import Money from './ui/Money.jsx';
import { activePlayer, settingsSummary, useWorths } from './ui/helpers.js';

/** The open snatch window (`pending`), read from the AUTHORITATIVE view, never the delayed display; else null. */
export function snatchWindow(session) {
  const v = session.view;
  return v?.phase === 'snatch' && v.pending?.type === 'snatch' ? v.pending : null;
}

/**
 * A player's Snatch token count from the AUTHORITATIVE view (tokens are real-time information; `session.display`
 * lags behind the presenter queue). Falls back to the displayed player's own count when the view has none.
 */
export function liveSnatches(session, player) {
  const v = session?.view?.players?.find((x) => x.id === player.id);
  return Number.isFinite(v?.snatches) ? v.snatches : player.snatches;
}

const TOKEN_CAP = Number(shared.TOKEN_CAP) > 0 ? Number(shared.TOKEN_CAP) : 3;

/** Lightning icon + "x1": a player's Snatch tokens (public). Dimmed at 0. Renders nothing if the count is unknown. */
export function SnatchTokens({ count, className = '' }) {
  if (!Number.isFinite(count)) return null;
  return (
    <span className={`hg-snatch${count > 0 ? '' : ' is-zero'}${count >= TOKEN_CAP ? ' is-max' : ''} ${className}`} role="img" aria-label={`Snatch tokens: ${count}${count >= TOKEN_CAP ? ' (max)' : ''}`} title={`Snatch tokens: ${count}${count >= TOKEN_CAP ? ' (max)' : ''}`}>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M13.5 2L4.5 13.6h6.2L9.6 22l9-12h-6.3z" />
      </svg>
      <span aria-hidden="true">x{count}</span>
    </span>
  );
}

/** Small warning triangle while a player still holds their trap (public; where it goes is secret). Nothing otherwise. */
export function TrapReady({ count, className = '' }) {
  if (!(count > 0)) return null;
  return (
    <span className={`hg-trapready ${className}`} role="img" aria-label="Trap ready" title="Trap ready">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M12 2.5L22.5 21h-21L12 2.5zm-1 7.5v5h2v-5h-2zm0 6.5v2h2v-2h-2z" fillRule="evenodd" />
      </svg>
    </span>
  );
}

/** A little board pawn (white base, coloured head): the player's colour swatch. */
export function PawnDot({ color, size = 24 }) {
  return (
    <span className="hg-pawndot" style={{ '--pc': color, width: size, height: size }} aria-hidden="true">
      <i />
    </span>
  );
}

function Row({ player, tokens, worth, isMe, isTurn, isLeader, snatch, onSelect }) {
  const jailed = (player.jailTurns || 0) > 0 && !player.bankrupt;
  const label = [
    `${player.name}${isMe ? ' (you)' : ''}`,
    player.bankrupt ? 'bankrupt' : `${formatINR(player.cash)} cash, ${formatINR(worth)} net worth`,
    isLeader ? 'leading' : '',
    isTurn ? 'current turn' : '',
    jailed ? 'in jail' : '',
    snatch === 'buying' ? 'buying, snatch window open' : '',
    snatch === 'can' ? 'can snatch' : '',
    Number.isFinite(tokens) && !player.bankrupt ? `Snatch tokens: ${tokens}` : '',
  ].filter(Boolean).join(', ');

  return (
    <li className={`hg-mb-row${isTurn ? ' is-turn' : ''}${isMe ? ' is-me' : ''}${player.bankrupt ? ' is-out' : ''}`} style={{ '--pc': player.color }}>
      <button type="button" className="hg-mb-btn" onClick={() => onSelect?.(player.id)} aria-label={label}>
        <svg className="hg-mb-arrow" viewBox="0 0 12 16" width="12" height="16" aria-hidden="true" focusable="false">
          <path d="M1.5 1.2L10.5 8l-9 6.8z" />
        </svg>
        <PawnDot color={player.color} size={26} />
        <span className="hg-mb-who">
          <span className="hg-mb-name">
            {isLeader ? <Icon name="crown" size={14} className="hg-mb-crown" /> : null}
            <b>{player.name}</b>
            {isMe ? <small className="hg-mb-you">YOU</small> : null}
          </span>
          <span className="hg-mb-sub">
            {player.bankrupt ? (
              <span className="hg-mb-tag is-bad">Bankrupt</span>
            ) : (
              <>
                {snatch === 'buying' ? <span className="hg-mb-tag is-buy">Buying</span> : null}
                {snatch === 'can' ? (
                  <span className="hg-mb-tag is-snatch">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.5 2L4.5 13.6h6.2L9.6 22l9-12h-6.3z" /></svg>
                    Can snatch
                  </span>
                ) : null}
                {jailed ? <span className="hg-mb-tag is-warn"><Icon name="lock" size={11} strokeWidth={2.4} />Jail</span> : null}
                {snatch ? null : <span className="hg-mb-worth">Worth {formatINR(worth)}</span>}
              </>
            )}
          </span>
        </span>
        <span className="hg-mb-end">
          {player.bankrupt ? <span className="hg-mb-cash">&mdash;</span> : <Money value={player.cash} flash className="hg-mb-cash" />}
          {player.bankrupt ? null : <SnatchTokens count={tokens} />}
          {player.bankrupt ? null : <TrapReady count={player.traps} />}
        </span>
      </button>
    </li>
  );
}

/**
 * <MoneyBar session onSelect={(playerId) => void} onOpenStats={() => void} compact />
 * `compact` = the stacked phone layout (tighter rows).
 */
export default function MoneyBar({ session, onSelect, onOpenStats, compact = false }) {
  const { worths, leaderId, state } = useWorths(session);
  const active = session.view?.phase === 'over' ? null : activePlayer(session);
  const summary = settingsSummary(session.display?.cfg || session.view?.cfg, session.display?.goal);
  const snatching = snatchWindow(session);

  return (
    <section className={`hg-mb${compact ? ' hg-mb--compact' : ''}`} aria-label="Scoreboard">
      <header className="hg-mb-head">
        <h2>Scoreboard</h2>
        <p className="hg-mb-sum">{summary}</p>
      </header>
      <ul className="hg-mb-list">
        {state.players.map((p) => (
          <Row
            key={p.id}
            player={p}
            tokens={liveSnatches(session, p)}
            worth={worths[p.id] ?? p.cash}
            isMe={p.id === session.me}
            isTurn={!!active && active.id === p.id && !p.bankrupt}
            isLeader={leaderId === p.id}
            snatch={snatching && !p.bankrupt ? (snatching.buyer === p.id ? 'buying' : snatching.eligible?.includes(p.id) ? 'can' : null) : null}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {onOpenStats ? (
        <button type="button" className="hg-mb-stats" onClick={onOpenStats}>
          <Icon name="list" size={16} />
          View stats
        </button>
      ) : null}
    </section>
  );
}
