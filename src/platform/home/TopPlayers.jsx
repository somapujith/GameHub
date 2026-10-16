import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { fmtNum } from '@/components/shell/ui.jsx';
import Ava from './Ava.jsx';
import { useApi, useApiGate } from './useApi.js';

const MEDAL = ['#ffd24d', '#d9deea', '#e09a5b'];

/** "Top players" teaser: the overall top 3, linking to the leaderboard. */
export default function TopPlayers() {
  const { booting, ready, retry } = useApiGate();
  const { status, data, reload } = useApi('/api/leaderboard?game=overall', { enabled: ready });
  const rows = Array.isArray(data?.rows) ? data.rows.slice(0, 3) : [];
  const state = booting ? 'loading' : !ready ? 'offline' : status === 'idle' ? 'loading' : status;

  let body;
  if (state === 'loading') {
    body = (
      <ul className="hh2-top" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="hh2-top__item">
            <span className="hub-skel hub-skel--dot" style={{ width: 56, height: 56 }} />
            <span className="hub-skel hub-skel--line" style={{ width: '64%', height: 12 }} />
            <span className="hub-skel hub-skel--line" style={{ width: '40%', height: 10 }} />
          </li>
        ))}
      </ul>
    );
  } else if (state === 'ok' && rows.length) {
    body = (
      <ol className="hh2-top">
        {rows.map((r, i) => (
          <li key={`${r.rank}-${r.name}`} className="hh2-top__item">
            <Link to={paths.leaderboard()} className="hh2-top__link" aria-label={`Rank ${r.rank}: ${r.name}, level ${r.level}, ${r.wins} wins`}>
              <span className="hh2-top__av">
                <Ava preset={r.avatar} size={56} ring={MEDAL[i]} />
                <i className="hh2-top__rank" style={{ '--mc': MEDAL[i] }}>
                  {r.rank}
                </i>
              </span>
              <b className="hh2-top__name">{r.name}</b>
              <small>
                Lv {r.level} &middot; {fmtNum(r.wins)} win{r.wins === 1 ? '' : 's'}
              </small>
            </Link>
          </li>
        ))}
      </ol>
    );
  } else if (state === 'ok') {
    body = (
      <p className="hub-muted">No champions yet. Win an online match to take the first spot.</p>
    );
  } else if (state === 'auth') {
    body = (
      <div className="hub-note">
        <p>Rankings are for signed-in players. Sign in to see the leaderboard and climb it.</p>
        <Link to={paths.login(paths.leaderboard())} className="hub-btn hub-btn--primary hub-btn--sm">
          Sign in
        </Link>
      </div>
    );
  } else {
    body = (
      <div className="hub-note">
        <p>The rankings are offline right now. They come back as soon as the server does.</p>
        <button type="button" className="hub-btn hub-btn--soft hub-btn--sm" onClick={ready ? reload : retry}>
          <HubIcon name="refresh" size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <section className="hub-panel hh2-topplayers" aria-labelledby="hh2-top-h" aria-busy={state === 'loading'}>
      <div className="hub-panel__head">
        <h2 id="hh2-top-h" className="hub-section__title">
          Top players
        </h2>
        <Link to={paths.leaderboard()} className="hub-section__more">
          Leaderboard
        </Link>
      </div>
      {body}
    </section>
  );
}
