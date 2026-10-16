import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { liveList } from '@/platform/home/catalog.js';
import ProfileHeader from '@/platform/home/ProfileHeader.jsx';
import GameStatCards from '@/platform/home/GameStatCards.jsx';
import BadgeGrid from '@/platform/home/BadgeGrid.jsx';
import SettingsSection from '@/platform/home/SettingsSection.jsx';
import AccountSection from '@/platform/home/AccountSection.jsx';
import AboutSection from '@/platform/home/AboutSection.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { levelInfo, useProfile } from '@/components/shell/stores.js';
import '@/styles/hubhome.css';

/** `/profile` — avatar and name, level / XP / coins, per-game stats, badges, settings (the old Settings page) and account. */
export default function Profile() {
  const { hash } = useLocation();
  const [profile] = useProfile();
  const { user } = useAccount();
  const games = useMemo(liveList, []);
  const level = levelInfo(profile.xp).level;

  // `/profile#settings` (the old /settings link target) scrolls to the settings block.
  useEffect(() => {
    if (!hash) return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="hub-page hh2 hh2-profilepage">
      <h1 className="hub-sr">Your profile</h1>
      <ProfileHeader />
      <GameStatCards games={games} user={user} profile={profile} />
      <BadgeGrid games={games} user={user} profile={profile} level={level} />
      <SettingsSection />
      <div className="hh2-duo">
        <AccountSection />
        <AboutSection />
      </div>
    </div>
  );
}
