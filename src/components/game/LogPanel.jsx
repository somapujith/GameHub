// Game log pieces: the scrolling `LogList` (terminal style in the control panel, icon rows in the full-log sheet) and `LogSheet`.
import { useEffect, useRef } from 'react';
import { TileIcon } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import Sheet from './ui/Sheet.jsx';
import '@/styles/controlpanel.css';

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

/**
 * Scrolling list that sticks to the bottom unless the user scrolled up.
 * variant 'rows' = icon rows for the dark log sheet; 'mono' = the terminal-style alert log of the control panel.
 */
export function LogList({ log, className = '', variant = 'rows' }) {
  const ref = useRef(null);
  const stick = useRef(true);
  const initial = useRef(log.length);
  const lastId = log.length ? log[log.length - 1].id : null;
  const mono = variant === 'mono';

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, log.length]);

  return (
    <ol
      ref={ref}
      className={mono ? `cp-log ${className}`.trim() : `hg-log-list ${className}`}
      role="log"
      aria-label="Game log"
      tabIndex={mono ? 0 : undefined}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {log.length === 0 ? <li className={mono ? 'cp-log__empty' : 'hg-log-empty'}>Your story starts with a roll.</li> : null}
      {log.map((entry, i) => (mono ? (
        <li key={entry.id ?? i} className={`cp-log__line is-${entry.tone || 'info'}${i >= initial.current ? ' is-fresh' : ''}`}>{entry.text}</li>
      ) : (
        <LogItem key={entry.id ?? i} entry={entry} fresh={i >= initial.current} />
      )))}
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
