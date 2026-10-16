import { useMemo } from 'react';
import { BadgeArt } from './GameArt.jsx';
import { buildBadgeContext, evaluateBadges } from './badges.js';
import { fmtStat, resolveGameStats } from './gameStats.js';
import { useApi, useApiReady } from './useApi.js';
import { useAccount } from '@/components/shell/hooks.js';

/** Badges derived from the player's stats (rules live in badges.js). */
export default function BadgeGrid({ games, user, profile, level }) {
  const { account } = useAccount();
  const ready = useApiReady();
  const friendsRes = useApi('/api/friends', { enabled: ready && account });
  const friends = friendsRes.status === 'ok' && Array.isArray(friendsRes.data?.friends) ? friendsRes.data.friends.length : null;

  const badges = useMemo(() => {
    const perGame = games.map((g) => resolveGameStats({ user, profile, gameId: g.id })).filter(Boolean);
    return evaluateBadges(buildBadgeContext({ perGame, profile, level, friends }));
  }, [games, user, profile, level, friends]);

  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="hub-section" aria-labelledby="hh2-badges-h">
      <div className="hub-section__head">
        <h2 id="hh2-badges-h" className="hub-section__title">
          Badges
          <span className="hub-pill">
            {earned}/{badges.length}
          </span>
        </h2>
      </div>
      <ul className="hh2-badges">
        {badges.map((b) => (
          <li key={b.id} className={`hh2-badge ${b.earned ? 'is-earned' : 'is-locked'}`}>
            <BadgeArt id={b.art} size={68} locked={!b.earned} />
            <b className="hh2-badge__name">{b.label}</b>
            <small className="hh2-badge__desc">{b.desc}</small>
            {b.earned ? (
              <span className="hh2-badge__state">Earned</span>
            ) : (
              <span className="hh2-badge__prog">
                <span className="hh2-badge__bar" aria-hidden="true">
                  <i style={{ width: `${b.pct}%` }} />
                </span>
                <span className="sr-only">Locked. </span>
                {fmtStat(b.value)} / {fmtStat(b.target)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
