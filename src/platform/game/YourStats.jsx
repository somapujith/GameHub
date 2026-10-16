import { Link } from 'react-router-dom';
import { fmtNum } from '@/components/shell/ui.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { paths } from '@/platform/paths.js';

const DEFAULT_STATS = [
  { key: 'games', label: 'Played' },
  { key: 'wins', label: 'Wins' },
  { key: 'bestScore', label: 'Best score' },
  { key: 'rating', label: 'Rating' },
];

function show(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return fmtNum(v);
  if (typeof v === 'string' && v) return v;
  return '–';
}

/** "Your stats" from `useAuth().user.gameStats[gameId]`, using `manifest.stats` to pick the highlighted fields. */
export default function YourStats({ game }) {
  const { user, loading } = useAccount();
  const defs = Array.isArray(game.stats) && game.stats.length ? game.stats.slice(0, 4) : DEFAULT_STATS;
  const mine = user?.gameStats?.[game.id];
  const played = Number(mine?.games) > 0;

  return (
    <section className="hub-panel" aria-labelledby="hub-stats-h">
      <h2 id="hub-stats-h" className="hub-section__title">
        Your stats
      </h2>
      {!user && !loading && (
        <div className="hub-note">
          <p>Sign in or play as a guest to keep your {game.name} record.</p>
          <Link to={paths.login(paths.game(game.id))} className="hub-btn hub-btn--soft hub-btn--sm">
            Sign in
          </Link>
        </div>
      )}
      {loading && !user && <div className="hub-skel hub-skel--block" style={{ height: 76 }} aria-hidden="true" />}
      {user && (
        <>
          <dl className="hub-stats">
            {defs.map((d) => (
              <div key={d.key} className="hub-stats__tile">
                <dt>{d.label}</dt>
                <dd>{show(mine?.[d.key] ?? mine?.extra?.[d.key])}</dd>
              </div>
            ))}
          </dl>
          {!played && <p className="hub-muted hub-stats__hint">Play your first game to start your record.</p>}
        </>
      )}
    </section>
  );
}
