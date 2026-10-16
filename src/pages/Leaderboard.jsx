import { Link } from 'react-router-dom';
import { compactINR, formatINR } from '@shared/format.js';
import PageHeader from '@/components/shell/PageHeader.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { AvatarRing, EmptyState, RankMedal, Skeleton, fmtNum } from '@/components/shell/ui.jsx';
import { useRemote } from '@/components/shell/net.js';
import { useAccount } from '@/components/shell/hooks.js';
import { levelInfo, useProfile } from '@/components/shell/stores.js';

/** `/leaderboard` — global standings (signed-in accounts), with graceful fallbacks. */
export default function Leaderboard() {
  const [profile] = useProfile();
  const { account, guest, loading, user } = useAccount();
  const { status, data, reload } = useRemote('/api/leaderboard', { enabled: account });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const mine = (r) => account && user?.name && r.name === user.name;

  let body;
  if (loading || (account && status === 'loading')) {
    body = (
      <ul className="hh-lb__list" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="hh-lb__row">
            <Skeleton w={34} h={34} r={17} />
            <Skeleton w={46} h={46} r={23} />
            <Skeleton w="50%" h={16} />
          </li>
        ))}
      </ul>
    );
  } else if (!account) {
    body = (
      <EmptyState
        icon="trophy"
        title={guest ? 'Rankings are for signed-in players' : 'Sign in to see the rankings'}
        action={
          <Link to="/login?next=/leaderboard" className="btn btn--primary">
            <Icon name="login" size={18} /> {guest ? 'Sign in with Google' : 'Sign in'}
          </Link>
        }
      >
        The leaderboard ranks online players by wins and best net worth. Your offline record is below.
      </EmptyState>
    );
  } else if (status !== 'ok') {
    body = (
      <EmptyState
        icon={status === 'auth' ? 'lock' : 'wifiOff'}
        title={status === 'auth' ? 'Please sign in again' : 'Cannot reach the server'}
        action={
          status === 'auth' ? (
            <Link to="/login?next=/leaderboard" className="btn btn--primary">
              Sign in
            </Link>
          ) : (
            <button type="button" className="btn btn--primary" onClick={reload}>
              <Icon name="refresh" size={18} /> Try again
            </button>
          )
        }
      >
        {status === 'auth' ? 'Your session has expired.' : 'The rankings need a connection. Offline games still work and count toward your local record.'}
      </EmptyState>
    );
  } else if (!rows.length) {
    body = (
      <EmptyState
        icon="trophy"
        title="No champions yet"
        action={
          <Link to="/friends" className="btn btn--primary">
            <Icon name="users" size={18} /> Play online
          </Link>
        }
      >
        Win an online match to claim the first spot on the board.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <ol className="hh-podium" aria-label="Top three">
          {[top[1], top[0], top[2]].map((r, idx) => {
            if (!r) return <li key={`gap${idx}`} className="hh-podium__slot hh-podium__slot--gap" aria-hidden="true" />;
            const place = r.rank;
            return (
              <li key={`${r.rank}-${r.name}`} className={`hh-podium__slot hh-podium__slot--${place} ${mine(r) ? 'is-me' : ''}`}>
                {place === 1 && <Icon name="crown" size={24} className="hh-podium__crown" />}
                <AvatarRing preset={r.avatar} size={place === 1 ? 72 : 56} tone={place === 1 ? 'gold' : 'dim'} />
                <b className="hh-podium__name">{r.name}</b>
                <span className="hh-podium__worth">{compactINR(r.bestWorth)}</span>
                <span className="hh-podium__block">
                  <RankMedal rank={place} size={place === 1 ? 40 : 34} />
                  <small>
                    {fmtNum(r.wins)} win{r.wins === 1 ? '' : 's'}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>

        {rest.length > 0 && (
          <ol className="hh-lb__list" start={4}>
            <li className="hh-lb__head" aria-hidden="true">
              <span>#</span>
              <span>Player</span>
              <span>Wins</span>
              <span>Best worth</span>
            </li>
            {rest.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={`hh-lb__row ${mine(r) ? 'is-me' : ''}`}>
                <RankMedal rank={r.rank} size={34} />
                <span className="hh-lb__who">
                  <AvatarRing preset={r.avatar} size={42} tone="dim" />
                  <span>
                    <b>{r.name}</b>
                    <small>
                      Lv {r.level}
                      <span className="hh-only-sm"> · {fmtNum(r.wins)} wins</span>
                      <span className="hh-only-lg"> · {fmtNum(r.games)} games</span>
                    </small>
                  </span>
                </span>
                <span className="hh-lb__wins">{fmtNum(r.wins)}</span>
                <span className="hh-lb__worth">{compactINR(r.bestWorth)}</span>
              </li>
            ))}
          </ol>
        )}
      </>
    );
  }

  const li = levelInfo(profile.xp);
  const s = profile.stats;
  const rate = s.games ? Math.round((s.wins / s.games) * 100) : 0;

  return (
    <div className="hh-lb">
      <PageHeader back="/" title="Leaderboard" te="లీడర్‌బోర్డ్" subtitle="The richest tycoons in Hyderabad." icon="trophy" />

      <section className="hh-card hh-block hh-lb__card" aria-label="Standings" aria-busy={status === 'loading'}>
        {body}
      </section>

      <section className="hh-card hh-block hh-lb__me" aria-labelledby="hh-me-h">
        <h2 id="hh-me-h" className="hh-h2">
          Your local record
        </h2>
        <div className="hh-lb__me-row">
          <AvatarRing preset={profile.avatar} size={52} />
          <div className="hh-lb__me-id">
            <b>{profile.name}</b>
            <small>Level {li.level}</small>
          </div>
          <dl className="hh-lb__me-stats">
            <div>
              <dt>Games</dt>
              <dd>{fmtNum(s.games)}</dd>
            </div>
            <div>
              <dt>Wins</dt>
              <dd>{fmtNum(s.wins)}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{rate}%</dd>
            </div>
            <div>
              <dt>Best worth</dt>
              <dd title={formatINR(s.bestWorth)}>{s.bestWorth ? compactINR(s.bestWorth) : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
