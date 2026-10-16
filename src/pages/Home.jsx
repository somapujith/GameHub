import { Navigate, useLocation } from 'react-router-dom';
import Hero from '@/components/shell/home/Hero.jsx';
import ResumeCard from '@/components/shell/home/ResumeCard.jsx';
import QuickActions from '@/components/shell/home/QuickActions.jsx';
import DailyReward from '@/components/shell/home/DailyReward.jsx';
import ProfileCard from '@/components/shell/home/ProfileCard.jsx';
import StatTiles from '@/components/shell/home/StatTiles.jsx';
import FriendsStrip from '@/components/shell/home/FriendsStrip.jsx';
import LeaderboardTeaser from '@/components/shell/home/LeaderboardTeaser.jsx';
import TipCard from '@/components/shell/home/TipCard.jsx';
import { useProfile } from '@/components/shell/stores.js';

/** `/` — the dashboard. First visit sends new players through the story intro. */
export default function Home() {
  const [profile] = useProfile();
  const location = useLocation();

  if (!profile.seenStory && !location.state?.fromStory) return <Navigate to="/story" replace />;

  return (
    <div className="hh-home">
      {/* Two columns on desktop; on phones the wrappers dissolve and `order` sequences the cards. */}
      <div className="hh-home__main">
        <Hero name={profile.name} />
        <div className="hh-slot hh-slot--resume">
          <ResumeCard />
        </div>
        <div className="hh-slot hh-slot--actions">
          <QuickActions />
        </div>
        <div className="hh-slot hh-slot--stats">
          <StatTiles />
        </div>
        <div className="hh-slot hh-slot--board">
          <LeaderboardTeaser />
        </div>
      </div>
      <div className="hh-home__side">
        <div className="hh-slot hh-slot--daily">
          <DailyReward />
        </div>
        <div className="hh-slot hh-slot--profile">
          <ProfileCard />
        </div>
        <div className="hh-slot hh-slot--friends">
          <FriendsStrip />
        </div>
        <div className="hh-slot hh-slot--tip">
          <TipCard />
        </div>
      </div>
    </div>
  );
}
