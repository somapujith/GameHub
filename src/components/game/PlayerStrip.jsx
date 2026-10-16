// The row/grid (mobile) or list (desktop sidebar) of PlayerCards.
import { useEffect, useRef } from 'react';
import PlayerCard from './PlayerCard.jsx';
import { activePlayer, settingsSummary, useReducedMotion, useWorths } from './ui/helpers.js';

export default function PlayerStrip({ session, onSelect, variant = 'strip' }) {
  const { worths, leaderId, state } = useWorths(session);
  const players = state.players;
  const active = session.view?.phase === 'over' ? null : activePlayer(session);
  const reduced = useReducedMotion();
  const listRef = useRef(null);
  const activeId = active ? active.id : null;
  const scrolls = players.length >= 5 && variant !== 'list';

  /* 5-6 players scroll sideways on phones: keep the player whose turn it is in view */
  useEffect(() => {
    if (!scrolls || !listRef.current) return;
    const cell = listRef.current.querySelector('[data-active]');
    if (cell && cell.scrollIntoView) cell.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [activeId, scrolls, reduced]);
  const summary = settingsSummary(session.display?.cfg || session.view?.cfg, session.display?.goal);

  return (
    <section className="hg-strip-wrap" data-variant={variant} aria-label="Players">
      {variant === 'list' ? (
        <header className="hg-strip-head">
          <h2>Players</h2>
          <p className="hg-summary">{summary}</p>
        </header>
      ) : null}
      <div className="hg-strip" data-n={players.length} data-variant={variant} role="list" ref={listRef}>
        {players.map((p) => (
          <div role="listitem" className="hg-strip-cell" key={p.id} data-active={active && active.id === p.id ? '' : undefined}>
            <PlayerCard
              player={p}
              worth={worths[p.id] ?? p.cash}
              isMe={p.id === session.me}
              isActive={!!active && active.id === p.id && !p.bankrupt}
              isLeader={leaderId === p.id}
              avatarSize={variant === 'list' ? 40 : players.length > 2 ? 40 : 52}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
