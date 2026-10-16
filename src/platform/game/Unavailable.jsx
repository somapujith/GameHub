import { Link } from 'react-router-dom';
import { BRAND } from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';
import { HubMark } from './hubArt.jsx';
import HubIcon from './HubIcon.jsx';
import useDocTitle from './useDocTitle.js';

const COPY = {
  unknown: {
    title: 'This game is not available',
    text: "We couldn't find that game. The link may be old, or the game may have moved.",
  },
  soon: {
    title: 'Coming soon',
    text: "This game isn't open yet. Check its page and tap Notify me.",
  },
  missing: {
    title: 'This game is not available',
    text: "This part of the game isn't ready yet. Try again a little later.",
  },
};

/**
 * Friendly stand-in for an unknown id, a coming-soon game, or a manifest without the requested loader.
 * `reason`: 'unknown' | 'soon' | 'missing'. `fullscreen` is for routes rendered without the hub chrome.
 */
export default function Unavailable({ reason = 'unknown', game = null, fullscreen = false }) {
  const copy = COPY[reason] || COPY.unknown;
  const title = game && reason === 'soon' ? `${game.name} is coming soon` : copy.title;
  useDocTitle(`${title} · ${BRAND.name}`);
  return (
    <section className={`hub-unavail${fullscreen ? ' hub-unavail--full' : ''}`} aria-labelledby="hub-unavail-title">
      <div className="hub-unavail__card">
        <span className="hub-unavail__art" aria-hidden="true">
          <HubMark size={64} />
        </span>
        <h1 id="hub-unavail-title" className="hub-h1">
          {title}
        </h1>
        <p className="hub-lead">{copy.text}</p>
        <div className="hub-unavail__actions">
          {game && (
            <Link to={paths.game(game.id)} className="hub-btn hub-btn--soft">
              {game.name}
            </Link>
          )}
          <Link to={paths.hub()} className="hub-btn hub-btn--primary">
            <HubIcon name="gamepad" size={18} /> Browse games
          </Link>
        </div>
      </div>
    </section>
  );
}
