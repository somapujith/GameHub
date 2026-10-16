import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { featured, gameById, liveList } from '@/platform/home/catalog.js';
import { fmtStat, resolveGameStats, statDefs } from '@/platform/home/gameStats.js';
import { useApi, useApiGate } from '@/platform/home/useApi.js';
import PageHead from '@/platform/home/PageHead.jsx';
import LeaderTabs from '@/platform/home/LeaderTabs.jsx';
import Podium from '@/platform/home/Podium.jsx';
import RankRow from '@/platform/home/RankRow.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { levelInfo, useProfile } from '@/components/shell/stores.js';
import { fmtNum } from '@/components/shell/ui.jsx';
import '@/styles/hubhome.css';

const OVERALL_COLS = [
  { key: 'wins', label: 'Wins' },
  { key: 'games', label: 'Games' },
];
const PANEL_ID = 'hh2-lb-panel';

function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="hh2-podium hh2-podium--skel">
        {[2, 1, 3].map((p) => (
          <div key={p} className="hh2-podium__slot" style={{ gridColumn: p === 1 ? 2 : p === 2 ? 1 : 3 }}>
            <span className="hub-skel hub-skel--dot" style={{ width: p === 1 ? 76 : 60, height: p === 1 ? 76 : 60 }} />
            <span className="hub-skel hub-skel--line" style={{ width: '70%', height: 12 }} />
            <span className="hub-skel" style={{ width: '100%', height: p === 1 ? 84 : 60, borderRadius: '14px 14px 0 0' }} />
          </div>
        ))}
      </div>
      <ul className="hh2-lb__list">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="hh2-lb__row">
            <span className="hub-skel hub-skel--line" style={{ width: 24 }} />
            <span className="hub-skel hub-skel--dot" style={{ width: 44, height: 44 }} />
            <span className="hh2-lb__who">
              <span className="hub-skel hub-skel--line" style={{ width: '55%' }} />
              <span className="hub-skel hub-skel--line" style={{ width: '30%', height: 10, marginTop: 8 }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ icon, title, children, action }) {
  return (
    <div className="hub-empty">
      <span className="hub-empty__icon" aria-hidden="true">
        <HubIcon name={icon} size={28} />
      </span>
      <p className="hub-empty__title">{title}</p>
      <p className="hub-empty__text">{children}</p>
      {action && <div className="hub-empty__actions">{action}</div>}
    </div>
  );
}

/** "Your record" under the board: the selected game's numbers, or platform totals on the Overall tab. */
function YourRecord({ game, user, profile, liveGames }) {
  const li = levelInfo(profile.xp);
  let tiles;
  let title;
  let note = null;
  if (!game) {
    const per = liveGames.map((g) => resolveGameStats({ user, profile, gameId: g.id })).filter(Boolean);
    title = 'Your record';
    tiles = [
      { label: 'Level', value: fmtNum(li.level) },
      { label: 'Games', value: fmtNum(per.reduce((n, s) => n + s.games, 0)) },
      { label: 'Wins', value: fmtNum(per.reduce((n, s) => n + s.wins, 0)) },
      { label: 'Coins', value: fmtNum(profile.coins) },
    ];
  } else {
    const stats = resolveGameStats({ user, profile, gameId: game.id });
    title = `Your ${game.name} record`;
    tiles = stats ? statDefs(game, 4).map((d) => ({ label: d.label, value: fmtStat(stats[d.key] ?? (d.key === 'bestScore' ? stats.bestScore : null), d) })) : null;
    if (!tiles) {
      note = (
        <p className="hub-muted">
          No {game.name} games yet.{' '}
          <Link to={paths.game(game.id)} className="hh2-textlink">
            Play your first one
          </Link>
        </p>
      );
    }
  }
  return (
    <section className="hub-panel hh2-record" aria-labelledby="hh2-rec-h">
      <h2 id="hh2-rec-h" className="hub-section__title">
        {title}
      </h2>
      {tiles && (
        <dl className="hub-stats">
          {tiles.map((t) => (
            <div key={t.label} className="hub-stats__tile">
              <dt>{t.label}</dt>
              <dd>{t.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note}
    </section>
  );
}

/** `/leaderboard` — Overall + one tab per live game (`?game=`), podium for the top three, rows for the rest. */
export default function Leaderboard() {
  const [params, setParams] = useSearchParams();
  const [profile] = useProfile();
  const { account, guest, signedIn, user } = useAccount();
  const { booting, ready, retry } = useApiGate();
  const live = useMemo(liveList, []);

  const wanted = params.get('game') || 'overall';
  const gameId = wanted !== 'overall' && live.some((g) => g.id === wanted) ? wanted : 'overall';
  const game = gameId === 'overall' ? null : gameById(gameId);
  const cols = game ? statDefs(game, 3) : OVERALL_COLS;

  const remote = useApi(`/api/leaderboard?game=${encodeURIComponent(gameId)}`, { enabled: ready });
  const state = booting ? 'loading' : !ready ? 'offline' : remote.status === 'idle' ? 'loading' : remote.status;
  const rows = useMemo(() => (Array.isArray(remote.data?.rows) ? remote.data.rows.filter((r) => r && typeof r.name === 'string') : []), [remote.data]);

  const pick = useCallback((id) => setParams(id === 'overall' ? {} : { game: id }, { replace: true }), [setParams]);
  const isMe = useCallback(
    (r) => account && !!user?.name && r.name === user.name && (r.avatar === undefined || Number(r.avatar) === Number(user.avatar)),
    [account, user],
  );
  const mine = rows.find(isMe);
  const lead = game || featured();

  let body;
  if (state === 'loading') body = <Skeleton />;
  else if (state === 'auth') {
    body = (
      <Notice
        icon="trophy"
        title={guest ? 'Rankings are for signed-in players' : 'Sign in to see the rankings'}
        action={
          <Link to={paths.login(paths.leaderboard(game?.id))} className="hub-btn hub-btn--primary">
            {guest ? 'Sign in with Google' : 'Sign in'}
          </Link>
        }
      >
        The leaderboard ranks players by their results in online games. You can still play offline.
      </Notice>
    );
  } else if (state === 'offline' || state === 'error') {
    body = (
      <Notice
        icon="wifiOff"
        title="Cannot reach the server"
        action={
          <button type="button" className="hub-btn hub-btn--primary" onClick={ready ? remote.reload : retry}>
            <HubIcon name="refresh" size={18} /> Try again
          </button>
        }
      >
        The rankings need a connection. Offline games still work, and your own record is below.
      </Notice>
    );
  } else if (!rows.length) {
    body = (
      <Notice
        icon="trophy"
        title="No champions yet"
        action={
          lead ? (
            <Link to={paths.game(lead.id)} className="hub-btn hub-btn--primary">
              <HubIcon name="play" size={16} /> Play {lead.name}
            </Link>
          ) : null
        }
      >
        Win an online match to claim the first spot on the board.
      </Notice>
    );
  } else {
    body = (
      <>
        {!account && (
          <div className="hh2-banner">
            <HubIcon name="user" size={20} />
            <p>{signedIn && guest ? 'Guests are not ranked. Sign in with Google to get on the board.' : 'Sign in to get on the board and see where you stand.'}</p>
            <Link to={paths.login(paths.leaderboard(game?.id))} className="hub-btn hub-btn--primary hub-btn--sm">
              Sign in
            </Link>
          </div>
        )}
        <Podium rows={rows} cols={cols} isMe={isMe} />
        {rows.length > 3 && (
          <ol className="hh2-lb__list" start={4} aria-label="Ranks 4 and below">
            {rows.slice(3).map((r) => (
              <RankRow key={`${r.rank}-${r.name}`} row={r} cols={cols} me={isMe(r)} />
            ))}
          </ol>
        )}
        {account && (
          <p className="hh2-lb__standing" aria-live="polite">
            {mine ? (
              <>
                You are <b>#{mine.rank}</b> {game ? `in ${game.name}` : 'overall'}.
              </>
            ) : (
              <>You are not in the top {rows.length} yet. Win online matches to climb the board.</>
            )}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="hub-page hh2 hh2-lbpage">
      <PageHead title="Leaderboard" sub="See who is winning across every game." icon={<HubIcon name="podium" size={26} />} />
      <LeaderTabs games={live} value={gameId} onChange={pick} panelId={PANEL_ID} />
      <div className="hh2-lbgrid">
        <section id={PANEL_ID} role="tabpanel" aria-labelledby={`hh2-tab-${gameId}`} aria-busy={state === 'loading'} className="hh2-lb">
          {body}
        </section>
        <YourRecord game={game} user={user} profile={profile} liveGames={live} />
      </div>
    </div>
  );
}
