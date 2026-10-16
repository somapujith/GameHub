import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { useNotify } from '@/platform/game/notify.js';
import { GameCover } from './GameArt.jsx';
import { playersLabel, themeVars } from './gameTheme.js';

/**
 * Image-led game card (built on platform-core's `.hub-gamecard`): 16:9 cover, title, tagline, player count,
 * "Play" pill and an accent glow from the game's theme. The whole card is one link (stretched title link);
 * coming-soon cards are dimmed, carry a "Soon" badge and a local "Notify me" toggle that sits above the link.
 */
export default function GameCard({ game }) {
  const soon = game.status !== 'live';
  const [notify, toggleNotify] = useNotify(game.id);
  const players = playersLabel(game.players);

  return (
    <article className={`hub-gamecard hh2-gcard ${soon ? 'is-soon' : ''}`} style={themeVars(game)}>
      <div className="hh2-gcard__media">
        <GameCover game={game} className="hub-gamecard__cover" />
        {soon ? (
          <span className="hub-badge hub-badge--soon hh2-gcard__badge">Soon</span>
        ) : (
          game.duration && (
            <span className="hub-badge hh2-gcard__badge">
              <HubIcon name="clock" size={11} strokeWidth={2.6} />
              &nbsp;{game.duration}
            </span>
          )
        )}
      </div>
      <div className="hub-gamecard__body">
        <h4 className="hub-gamecard__title">
          <Link to={paths.game(game.id)} className="hh2-gcard__link">
            {game.name}
          </Link>
        </h4>
        {game.tagline && <p className="hub-gamecard__tag">{game.tagline}</p>}
        <div className="hub-gamecard__meta">
          {players && (
            <span className="hh2-gcard__players">
              <HubIcon name="users" size={14} /> {players}
            </span>
          )}
          {soon ? (
            <button
              type="button"
              className={`hh2-notify ${notify ? 'is-on' : ''}`}
              aria-pressed={notify}
              onClick={toggleNotify}
              aria-label={`${notify ? 'Stop notifying me about' : 'Notify me about'} ${game.name}`}
            >
              <span className="hh2-notify__pill">
                <HubIcon name={notify ? 'check' : 'bell'} size={13} strokeWidth={2.6} /> {notify ? 'On the list' : 'Notify me'}
              </span>
            </button>
          ) : (
            <span className="hub-gamecard__play" aria-hidden="true">
              Play
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
