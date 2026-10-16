import { compactINR } from '@shared/format.js';
import { Icon } from '../icons.jsx';
import { fmtNum } from '../ui.jsx';
import { useProfile } from '../stores.js';

const GOAL_REF = 70000;

function Ring({ pct }) {
  const p = Math.max(0, Math.min(100, pct));
  return <span className="hh-ring" style={{ '--p': `${p * 3.6}deg` }} aria-hidden="true" />;
}

/** Six compact stat tiles with tiny visuals (ring, progress, bars). */
export default function StatTiles() {
  const [profile] = useProfile();
  const s = profile.stats;
  const games = Number(s.games) || 0;
  const wins = Number(s.wins) || 0;
  const rate = games ? Math.round((wins / games) * 100) : 0;
  const best = Number(s.bestWorth) || 0;
  const bestPct = Math.min(100, (best / GOAL_REF) * 100);

  const tiles = [
    { key: 'games', tone: 'sky', icon: 'dice', value: fmtNum(games), label: 'Games', visual: <Bars n={games} /> },
    { key: 'wins', tone: 'gold', icon: 'trophy', value: fmtNum(wins), label: 'Wins', visual: <Bars n={wins} /> },
    { key: 'rate', tone: 'good', icon: 'target', value: `${rate}%`, label: 'Win rate', visual: <Ring pct={rate} /> },
    {
      key: 'best',
      tone: 'violet',
      icon: 'crown',
      value: best ? compactINR(best) : '—',
      label: 'Best net worth',
      visual: (
        <span className="hh-meter" aria-hidden="true">
          <i style={{ width: `${bestPct}%` }} />
        </span>
      ),
    },
    {
      key: 'rent',
      tone: 'saffron',
      icon: 'rupee',
      value: Number(s.rentEarned) ? compactINR(s.rentEarned) : '—',
      label: 'Rent earned',
      visual: <Bars n={Math.ceil((Number(s.rentEarned) || 0) / 1500)} />,
    },
    {
      key: 'props',
      tone: 'teal',
      icon: 'building',
      value: fmtNum(s.propertiesBought),
      label: 'Properties',
      visual: <Bars n={Number(s.propertiesBought) || 0} />,
    },
  ];

  return (
    <section aria-labelledby="hh-stats-h" className="hh-stats">
      <h2 id="hh-stats-h" className="hh-h2">
        Your record
      </h2>
      <ul className="hh-stats__grid">
        {tiles.map((t) => (
          <li key={t.key} className={`hh-stat hh-stat--${t.tone}`}>
            <span className="hh-stat__icon">
              <Icon name={t.icon} size={18} />
            </span>
            <span className="hh-stat__value">{t.value}</span>
            <span className="hh-stat__label">{t.label}</span>
            <span className="hh-stat__visual">{t.visual}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Six tiny bars, the first `n` lit. */
function Bars({ n }) {
  const lit = Math.max(0, Math.min(6, Number(n) || 0));
  return (
    <span className="hh-bars" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i < lit ? 'is-lit' : ''} style={{ height: `${40 + i * 12}%` }} />
      ))}
    </span>
  );
}
