import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { GameIcon } from './GameArt.jsx';
import { fmtStat, resolveGameStats, statDefs, statValue } from './gameStats.js';
import { themeVars } from './gameTheme.js';

/** One card per live game with the player's numbers (server per-game stats, else the offline record). */
export default function GameStatCards({ games, user, profile }) {
  if (!games.length) return null;
  return (
    <section className="hub-section" aria-labelledby="hh2-stats-h">
      <div className="hub-section__head">
        <h2 id="hh2-stats-h" className="hub-section__title">
          Your games
        </h2>
      </div>
      <ul className="hh2-statcards">
        {games.map((g) => {
          const stats = resolveGameStats({ user, profile, gameId: g.id });
          const defs = statDefs(g, 3);
          return (
            <li key={g.id}>
              <article className="hh2-statcard" style={themeVars(g)}>
                <header className="hh2-statcard__head">
                  <GameIcon game={g} size={48} />
                  <div>
                    <h3>{g.name}</h3>
                    <p>
                      {stats
                        ? stats.source === 'local'
                          ? 'Offline record on this device'
                          : 'Your record'
                        : 'Not played yet'}
                    </p>
                  </div>
                </header>
                {stats ? (
                  <dl className="hub-stats">
                    {defs.map((d) => (
                      <div key={d.key} className="hub-stats__tile">
                        <dt>{d.label}</dt>
                        <dd>{fmtStat(statValue(stats, d.key), d)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="hh2-statcard__empty">Play a game to start your record.</p>
                )}
                <footer className="hh2-statcard__foot">
                  <Link to={paths.game(g.id)} className="hub-btn hub-btn--accent hub-btn--sm">
                    <HubIcon name="play" size={14} /> Play
                  </Link>
                  <Link to={paths.leaderboard(g.id)} className="hub-btn hub-btn--soft hub-btn--sm">
                    <HubIcon name="podium" size={16} /> Rank
                  </Link>
                </footer>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
