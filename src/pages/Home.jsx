import { useMemo, useState } from 'react';
import { BRAND } from '@/platform/brand.js';
import { groupByCategory } from '@/platform/home/catalog.js';
import Hero from '@/platform/home/Hero.jsx';
import ContinueRow from '@/platform/home/ContinueRow.jsx';
import CategoryChips from '@/platform/home/CategoryChips.jsx';
import CategoryRow from '@/platform/home/CategoryRow.jsx';
import OpenTablesStrip from '@/platform/home/OpenTablesStrip.jsx';
import TopPlayers from '@/platform/home/TopPlayers.jsx';
import FriendsStrip from '@/components/shell/home/FriendsStrip.jsx';
import DailyReward from '@/components/shell/home/DailyReward.jsx';
import '@/styles/hubhome.css';

/** `/` — the Games home: hero, continue playing, friends, browse by category, open tables, top players, daily reward. */
export default function Home() {
  const groups = useMemo(groupByCategory, []);
  const [cat, setCat] = useState('all');
  const active = groups.some((g) => g.id === cat) ? cat : 'all';
  const shown = active === 'all' ? groups : groups.filter((g) => g.id === active);

  return (
    <div className="hub-page hh2 hh2-home">
      <h1 className="hub-sr">{BRAND.name} games</h1>
      <Hero />
      <ContinueRow />
      <FriendsStrip />

      <section className="hub-section hh2-browse" aria-labelledby="hh2-browse-h">
        <div className="hub-section__head">
          <h2 id="hh2-browse-h" className="hub-section__title">
            Browse games
          </h2>
        </div>
        {groups.length > 1 && <CategoryChips cats={groups} value={active} onChange={setCat} />}
        {groups.length === 0 ? (
          <p className="hub-muted">New games are on the way. Check back soon.</p>
        ) : (
          <div className="hh2-cats" data-single={shown.length === 1 ? 'true' : 'false'}>
            {shown.map((g) => (
              <CategoryRow key={g.id} cat={g} games={g.games} />
            ))}
          </div>
        )}
      </section>

      <OpenTablesStrip />

      <div className="hh2-duo">
        <TopPlayers />
        <DailyReward />
      </div>
    </div>
  );
}
