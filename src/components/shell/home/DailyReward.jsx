import { useEffect, useRef, useState } from 'react';
import { CoinIcon, Icon } from '../icons.jsx';
import { fmtNum } from '../ui.jsx';
import { claimDaily, dailyRewardFor, todayKey, useProfile } from '../stores.js';
import { useReducedMotion } from '../hooks.js';
import { playSfx } from '../audio.js';
import { useToast } from '../Toast.jsx';

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

const rand = (a, b) => a + Math.random() * (b - a);

function makeParts() {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    dx: Math.round(rand(-110, 110)),
    dy: Math.round(rand(-150, -60)),
    rot: Math.round(rand(-240, 240)),
    delay: Math.round(rand(0, 160)),
    size: Math.round(rand(14, 22)),
  }));
}

/** Daily reward with a 7-day streak ladder and a coin-burst claim animation (hub styling, `.hh2-daily*`). */
export default function DailyReward() {
  const [profile] = useProfile();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [burst, setBurst] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const streak = Number(profile.dailyStreak) || 0;
  const claimedToday = profile.lastDailyClaim === todayKey();
  const continues = profile.lastDailyClaim === yesterdayKey();
  const cycle = streak > 0 ? ((streak - 1) % 7) + 1 : 0;
  const nextDay = claimedToday ? cycle : continues ? (streak % 7) + 1 : 1;

  const claim = () => {
    if (busy || claimedToday) return;
    setBusy(true);
    const r = claimDaily();
    if (r?.ok) {
      playSfx('coin');
      setBurst({ id: Date.now(), gain: r.coins, streak: r.streak, parts: reduced ? [] : makeParts() });
      toast(`+${fmtNum(r.coins)} coins · ${r.streak}-day streak`, { tone: 'gold', icon: 'gift' });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBurst(null), 2600);
    } else {
      toast('Already claimed today. Come back tomorrow!', { tone: 'info' });
    }
    setBusy(false);
  };

  // Real streak number behind the pip being claimed (or just claimed) lets every pip show its coins.
  const curPip = claimedToday ? cycle : nextDay;
  const curStreak = claimedToday ? streak : continues ? streak + 1 : 1;
  const days = [1, 2, 3, 4, 5, 6, 7].map((n) => {
    const done = claimedToday ? n <= cycle : n < nextDay;
    const current = !claimedToday && n === nextDay;
    return { n, done, current, coins: dailyRewardFor(Math.max(1, curStreak + (n - curPip))) };
  });
  const todaysCoins = dailyRewardFor(curStreak);

  return (
    <section className={`hub-panel hh2-daily ${claimedToday ? 'is-claimed' : 'is-ready'}`} aria-labelledby="hh2-daily-h">
      <div className="hh2-daily__glow" aria-hidden="true" />
      <div className="hh2-daily__head">
        <span className="hh2-daily__gift" aria-hidden="true">
          <Icon name="gift" size={26} />
        </span>
        <div className="hh2-daily__titles">
          <h2 id="hh2-daily-h" className="hub-section__title">
            Daily reward
          </h2>
          <p className="hh2-daily__sub">{claimedToday ? 'Claimed. See you tomorrow!' : continues || streak === 0 ? 'Your coins are waiting.' : 'Streak lost. Start a new one today.'}</p>
        </div>
        <span className="hh2-daily__streak" title="Day streak">
          <Icon name="flame" size={18} />
          <b>{streak}</b>
          <small>day{streak === 1 ? '' : 's'}</small>
        </span>
      </div>

      <ol className="hh2-daily__days" aria-label="7-day streak">
        {days.map((d) => (
          <li key={d.n} className={`hh2-daypip ${d.done ? 'is-done' : ''} ${d.current ? 'is-current' : ''} ${d.n === 7 ? 'is-big' : ''}`}>
            <span className="hh2-daypip__dot">{d.done ? <Icon name="check" size={14} strokeWidth={3.2} /> : d.n === 7 ? <Icon name="gift" size={14} /> : <CoinIcon size={14} />}</span>
            <span className="hh2-daypip__label">{d.coins}</span>
            <span className="sr-only">
              Day {d.n}, {d.coins} coins, {d.done ? 'claimed' : d.current ? 'ready to claim' : 'upcoming'}
            </span>
          </li>
        ))}
      </ol>

      <div className="hh2-daily__action">
        <button type="button" className={`hub-btn hub-btn--lg hub-btn--block ${claimedToday ? 'hub-btn--soft' : 'hub-btn--accent'}`} disabled={claimedToday || busy} onClick={claim}>
          {claimedToday ? (
            <>
              <Icon name="check" size={20} /> Claimed today
            </>
          ) : (
            <>
              <CoinIcon size={22} /> Claim +{fmtNum(todaysCoins)}
            </>
          )}
        </button>
      </div>

      {burst && (
        <div className="hh2-burst" key={burst.id} aria-hidden="true">
          {burst.parts.map((p) => (
            <i key={p.id} className="hh2-burst__coin" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`, '--delay': `${p.delay}ms`, '--sz': `${p.size}px` }}>
              <CoinIcon size={p.size} />
            </i>
          ))}
          <span className="hh2-burst__gain">+{fmtNum(burst.gain)}</span>
        </div>
      )}
    </section>
  );
}
