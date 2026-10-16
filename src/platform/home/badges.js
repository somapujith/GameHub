// Profile badges: every rule lives in this one list. A badge is earned when `value >= target`; `value` is read
// from a context object (see `buildBadgeContext`). Add a badge by adding one entry; `needs` hides a badge
// until the data it depends on exists (e.g. the friends list, which only signed-in accounts have).
//
//   { id, label, desc, art, target, value(ctx) -> number, needs?: 'friends' }
//
// `art` is the id handed to the hub art kit's <BadgeIcon id=... />; ids the kit has no emblem for render a plain medal.
import { BRAND } from '@/platform/brand.js';

export const BADGES = [
  { id: 'rookie', label: 'Rookie', desc: 'Finish your first game', art: 'rookie', target: 1, value: (c) => c.games },
  { id: 'first-win', label: 'First Win', desc: 'Win a game', art: 'first-win', target: 1, value: (c) => c.wins },
  { id: 'ten-wins', label: '10 Wins', desc: 'Win 10 games', art: 'ten-wins', target: 10, value: (c) => c.wins },
  { id: 'regular', label: 'Regular', desc: 'Play 25 games', art: 'regular', target: 25, value: (c) => c.games },
  { id: 'hotel-tycoon', label: 'Hotel Tycoon', desc: 'Build 5 hotels', art: 'hotel-tycoon', target: 5, value: (c) => c.local.hotelsBuilt },
  { id: 'landlord', label: 'Landlord', desc: 'Collect ₹50,000 in rent', art: 'landlord', target: 50000, value: (c) => c.local.rentEarned },
  { id: 'social-butterfly', label: 'Social Butterfly', desc: 'Make 3 friends', art: 'social-butterfly', target: 3, value: (c) => c.friends ?? 0, needs: 'friends' },
  { id: 'explorer', label: 'Explorer', desc: 'Play 2 different games', art: 'explorer', target: 2, value: (c) => c.gamesTried },
  { id: 'streak-7', label: 'Week Streak', desc: 'Claim the daily reward 7 days in a row', art: 'daily-streak', target: 7, value: (c) => c.streak },
  { id: 'level-5', label: 'Level 5', desc: 'Reach level 5', art: 'level', target: 5, value: (c) => c.level },
];

/** Totals across games plus platform numbers, in the shape the rules above read. */
export function buildBadgeContext({ perGame = [], profile, level, friends = null }) {
  const played = perGame.filter((s) => s && s.games > 0);
  return {
    games: perGame.reduce((n, s) => n + (s?.games || 0), 0),
    wins: perGame.reduce((n, s) => n + (s?.wins || 0), 0),
    gamesTried: played.length,
    streak: Number(profile?.dailyStreak) || 0,
    level: Number(level) || 1,
    friends,
    // Counters only the offline Tycoon profile keeps (they are not part of the server's per-game stats).
    local: {
      hotelsBuilt: Number(profile?.stats?.hotelsBuilt) || 0,
      rentEarned: Number(profile?.stats?.rentEarned) || 0,
    },
    defaultGameId: BRAND.defaultGameId,
  };
}

/** Badges whose data exists, each with `earned`, `value` (clamped) and `pct` (0-100). */
export function evaluateBadges(ctx) {
  return BADGES.filter((b) => !(b.needs === 'friends' && ctx.friends == null)).map((b) => {
    const raw = Math.max(0, Number(b.value(ctx)) || 0);
    return { ...b, earned: raw >= b.target, value: Math.min(raw, b.target), pct: Math.round((Math.min(raw, b.target) / b.target) * 100) };
  });
}
