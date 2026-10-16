import { Link } from 'react-router-dom';
import { compactINR } from '@shared/format.js';
import { Icon } from '../icons.jsx';
import { AvatarRing, EmptyState, RankMedal, Skeleton } from '../ui.jsx';
import { useRemote } from '../net.js';
import { useAccount } from '../hooks.js';

/** Top-3 teaser. Needs a signed-in account; every other state degrades quietly. */
export default function LeaderboardTeaser() {
  const { account, loading } = useAccount();
  const { status, data, reload } = useRemote('/api/leaderboard', { enabled: account });
  const rows = Array.isArray(data?.rows) ? data.rows.slice(0, 3) : [];

  let body;
  if (loading || (account && status === 'loading')) {
    body = (
      <ul className="hh-lbt__list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="hh-lbt__row">
            <Skeleton w={30} h={30} r={15} />
            <Skeleton w={40} h={40} r={20} />
            <Skeleton w="45%" h={14} />
          </li>
        ))}
      </ul>
    );
  } else if (!account) {
    body = (
      <EmptyState
        icon="trophy"
        title="Climb the rankings"
        action={
          <Link to="/login?next=/leaderboard" className="btn btn--ghost btn--sm">
            <Icon name="login" size={16} /> Sign in
          </Link>
        }
      >
        Sign in to see the richest tycoons in Hyderabad.
      </EmptyState>
    );
  } else if (status !== 'ok') {
    body = (
      <EmptyState
        icon="wifiOff"
        title="Rankings are offline"
        action={
          <button type="button" className="btn btn--ghost btn--sm" onClick={reload}>
            <Icon name="refresh" size={16} /> Retry
          </button>
        }
      >
        Connect to the server to see the standings.
      </EmptyState>
    );
  } else if (!rows.length) {
    body = (
      <EmptyState icon="trophy" title="No champions yet">
        Win an online match to claim the first spot.
      </EmptyState>
    );
  } else {
    body = (
      <ol className="hh-lbt__list">
        {rows.map((r) => (
          <li key={`${r.rank}-${r.name}`} className="hh-lbt__row">
            <RankMedal rank={r.rank} size={30} />
            <AvatarRing preset={r.avatar} size={40} tone={r.rank === 1 ? 'gold' : 'dim'} />
            <span className="hh-lbt__who">
              <b>{r.name}</b>
              <small>
                Lv {r.level} · {r.wins} win{r.wins === 1 ? '' : 's'}
              </small>
            </span>
            <span className="hh-lbt__worth">{compactINR(r.bestWorth)}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section className="hh-card hh-lbt" aria-labelledby="hh-lbt-h">
      <div className="hh-card__head">
        <h2 id="hh-lbt-h" className="hh-h2">
          Top players
        </h2>
        <Link to="/leaderboard" className="hh-link hh-card__more">
          See all <Icon name="chevR" size={16} />
        </Link>
      </div>
      {body}
    </section>
  );
}
