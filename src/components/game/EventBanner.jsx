// The current city event (docs/GAME_RULES.md section 11/12), shown at the top of the control panel while
// `session.view.event` is set. Reads the LATEST state (session.view), never the animated display.
//   <EventBanner session />   -> a live region that is always mounted (so screen readers pick up insertions);
//   the banner inside is keyed by event id + round, so a new event is announced once and re-renders are silent.
// On the compact layout (< 420px container) the one-liner is visually hidden (still read aloud) and only the title shows.
import { GROUPS } from '@shared/board.js';
import '@/styles/controlpanel.css';

export const EVENT_EMOJI = {
  monsoon: '🌧️',
  ipl: '🏏',
  metro_strike: '🚇',
  tax_holiday: '🧾',
  bonalu: '🌸',
};

const fmtMult = (m) => `x${Number(m)}`;

/** What the banner shows for an event. Pure; exported for testing. -> null | { key, emoji, title, text, chip } */
export function eventInfo(event) {
  if (!event || !event.id) return null;
  const grp = event.group ? GROUPS[event.group] : null;
  return {
    key: `${event.id}:${event.round ?? ''}`,
    id: event.id,
    emoji: EVENT_EMOJI[event.id] || '🎉',
    title: event.title || event.id,
    text: event.text || '',
    chip: grp ? { color: grp.color, name: grp.name, mult: event.mult != null ? fmtMult(event.mult) : null } : null,
  };
}

export default function EventBanner({ session }) {
  const info = eventInfo(session?.view?.event);
  return (
    <div className="cp-event-wrap" role="status" aria-live="polite" aria-atomic="true">
      {info ? (
        <div key={info.key} className="cp-event" data-event={info.id} title={info.text ? `${info.title}. ${info.text}` : info.title}>
          <span className="cp-event__emoji" aria-hidden="true">{info.emoji}</span>
          <span className="cp-event__body">
            <b className="cp-event__title">{info.title}</b>
            {info.text ? <span className="cp-event__text">{info.text}</span> : null}
          </span>
          {info.chip ? (
            <span className="cp-event__chip" style={{ '--gc': info.chip.color }}>
              <i aria-hidden="true" />
              <small>{info.chip.name}</small>
              {info.chip.mult ? <span>{info.chip.mult}</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
