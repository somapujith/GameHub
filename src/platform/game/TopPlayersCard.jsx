import { Link } from 'react-router-dom';
import { Avatar } from '@/components/art/index.js';
import { RankMedal, fmtNum } from '@/components/shell/ui.jsx';
import { paths } from '@/platform/paths.js';
import useTopPlayers from './useTopPlayers.js';

/** Per-game top 5 (GET /api/leaderboard?game=ID). Skeleton while loading, quiet message when the API is unreachable. */
export default function TopPlayersCard({ game }) {
  const { rows, loading, error, reload } = useTopPlayers(game.id, 5);
  return (
    <section className="hub-panel" aria-labelledby="hub-top-h">
      <div className="hub-panel__head">
        <h2 id="hub-top-h" className="hub-section__title">
          Top players
        </h2>
        <Link to={paths.leaderboard(game.id)} className="hub-section__more">
          See all
        </Link>
      </div>

      {loading && (
        <ul className="hub-ranklist" aria-busy="true" aria-label="Loading leaderboard">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="hub-ranklist__row">
              <span className="hub-skel hub-skel--dot" />
              <span className="hub-skel hub-skel--dot" />
              <span className="hub-skel hub-skel--line" style={{ width: `${60 - i * 6}%` }} />
            </li>
          ))}
        </ul>
      )}

      {!loading && error && (
        <div className="hub-note">
          <p>The leaderboard isn't reachable right now.</p>
          <button type="button" className="hub-btn hub-btn--soft hub-btn--sm" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rows && rows.length === 0 && <p className="hub-muted">No ranked games yet. Win one to take the first spot.</p>}

      {!loading && !error && rows && rows.length > 0 && (
        <ol className="hub-ranklist">
          {rows.map((r, i) => (
            <li key={`${r.rank ?? i}-${r.name}`} className="hub-ranklist__row">
              <RankMedal rank={Number(r.rank) || i + 1} size={30} />
              <Avatar preset={Number(r.avatar) || 0} size={34} />
              <span className="hub-ranklist__who">
                <b>{r.name}</b>
                {Number.isFinite(Number(r.level)) && <small>Lv {Number(r.level)}</small>}
              </span>
              <span className="hub-ranklist__val">
                <b>{fmtNum(r.wins)}</b>
                <small>{Number(r.wins) === 1 ? 'win' : 'wins'}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
