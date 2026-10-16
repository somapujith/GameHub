import { Link } from 'react-router-dom';
import HubIcon from './HubIcon.jsx';

/**
 * One way to play: a big tappable row/card (icon, title, one line, optional count badge).
 * Pass `to` for navigation or `onClick` for an action; `busy` shows a spinner and blocks double taps.
 * `variant="primary"` fills the card with the game's accent colour.
 */
export default function ModeCard({ icon, title, text, to, onClick, busy = false, badge, disabled = false, variant = 'default' }) {
  const cls = `hub-mode${variant === 'primary' ? ' hub-mode--primary' : ''}`;
  const inner = (
    <>
      <span className="hub-mode__icon">
        <HubIcon name={icon} size={24} />
      </span>
      <span className="hub-mode__body">
        <b className="hub-mode__title">{title}</b>
        {text && <small className="hub-mode__text">{text}</small>}
      </span>
      <span className="hub-mode__end">
        {busy ? <span className="hub-spinner" aria-hidden="true" /> : badge ? <span className="hub-mode__badge">{badge}</span> : null}
        <HubIcon name="chevR" size={18} className="hub-mode__chev" />
      </span>
    </>
  );
  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined}>
      {inner}
      {busy && <span className="hub-sr">Working…</span>}
    </button>
  );
}
