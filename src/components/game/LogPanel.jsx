// Game log: scrolling panel (desktop sidebar) or a collapsible drawer showing the last lines (mobile).
import { useEffect, useRef, useState } from 'react';
import { TileIcon } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import Sheet from './ui/Sheet.jsx';
import Icon from './ui/Icon.jsx';

export function LogItem({ entry, fresh = false }) {
  const tile = Number.isInteger(entry.tile) ? TILES[entry.tile] : null;
  return (
    <li className={`hg-log-item is-${entry.tone || 'info'}${fresh ? ' is-fresh' : ''}`}>
      <span className="hg-log-ico" aria-hidden="true">
        {tile ? <TileIcon tile={tile} size={18} /> : <i className="hg-log-dot" />}
      </span>
      <span className="hg-log-text">{entry.text}</span>
    </li>
  );
}

/** Scrolling list that sticks to the bottom unless the user scrolled up. */
export function LogList({ log, className = '' }) {
  const ref = useRef(null);
  const stick = useRef(true);
  const initial = useRef(log.length);
  const lastId = log.length ? log[log.length - 1].id : null;

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, log.length]);

  return (
    <ol
      ref={ref}
      className={`hg-log-list ${className}`}
      role="log"
      aria-label="Game log"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {log.length === 0 ? <li className="hg-log-empty">Your story starts with a roll.</li> : null}
      {log.map((entry, i) => (
        <LogItem key={entry.id ?? i} entry={entry} fresh={i >= initial.current} />
      ))}
    </ol>
  );
}

/** The full log as a sheet (also reachable from the menu on short screens). */
export function LogSheet({ session, open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Game log" className="hg-logsheet">
      <LogList log={session.log || []} className="is-sheet" />
    </Sheet>
  );
}

export default function LogPanel({ session, variant = 'drawer' }) {
  const log = session.log || [];
  const [open, setOpen] = useState(false);

  if (variant === 'panel') {
    return (
      <section className="hg-log hg-log--panel" aria-label="Game log">
        <header className="hg-log-head">
          <h2>Game log</h2>
        </header>
        <LogList log={log} />
      </section>
    );
  }

  const last = log.slice(-3);
  const latest = last[last.length - 1];
  return (
    <>
      <button
        type="button"
        className="hg-log hg-log--drawer"
        onClick={() => setOpen(true)}
        aria-label={`Open game log${latest ? `. Latest: ${latest.text}` : ''}`}
      >
        <ol className="hg-logdrawer-list" aria-hidden="true">
          {last.length === 0 ? <li className="hg-log-empty">Your story starts with a roll.</li> : null}
          {last.map((entry, i) => (
            <LogItem key={entry.id ?? i} entry={entry} />
          ))}
        </ol>
        <span className="hg-logdrawer-more" aria-hidden="true">
          <Icon name="chevronUp" size={18} />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Game log" className="hg-logsheet">
        <LogList log={log} className="is-sheet" />
      </Sheet>
    </>
  );
}
