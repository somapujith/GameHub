// Built-in rival roster for server-side bots (lobby "Add bot"). Names/avatars follow the
// 12 avatar presets; `bot` is the engine personality ({reserve, greed}).
export const RIVALS = [
  { name: 'Chai Uncle', avatar: 1, bot: { reserve: 900, greed: 0.8 } },
  { name: 'Techie Teja', avatar: 2, bot: { reserve: 600, greed: 1.1 } },
  { name: 'Biryani Bhai', avatar: 0, bot: { reserve: 400, greed: 1.3 } },
  { name: 'Pearl Pasha', avatar: 3, bot: { reserve: 1200, greed: 0.9 } },
  { name: 'Auto Anna', avatar: 4, bot: { reserve: 500, greed: 1.0 } },
  { name: 'Mass Hero', avatar: 5, bot: { reserve: 300, greed: 1.4 } },
  { name: 'Kirana Aunty', avatar: 6, bot: { reserve: 1000, greed: 0.7 } },
  { name: 'Film Producer', avatar: 7, bot: { reserve: 700, greed: 1.2 } },
  { name: 'Cricket Fan', avatar: 8, bot: { reserve: 500, greed: 1.0 } },
  { name: 'Coder Girl', avatar: 9, bot: { reserve: 800, greed: 1.0 } },
  { name: 'Shopkeeper', avatar: 10, bot: { reserve: 1100, greed: 0.8 } },
  { name: 'Netaji', avatar: 11, bot: { reserve: 350, greed: 1.3 } },
];

/** Pick a rival whose name is not already taken (falls back to a numbered duplicate). */
export function pickRival(takenNames, rnd = Math.random) {
  const taken = new Set(takenNames);
  const free = RIVALS.filter((r) => !taken.has(r.name));
  if (free.length) return free[Math.floor(rnd() * free.length)];
  const base = RIVALS[Math.floor(rnd() * RIVALS.length)];
  let n = 2;
  while (taken.has(`${base.name} ${n}`)) n += 1;
  return { ...base, name: `${base.name} ${n}` };
}
