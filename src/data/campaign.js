// Story-mode chapters. Rival ids come from ./story.js (RIVALS). `settings` are engine settings that
// override DEFAULT_SETTINGS (valid keys: startCash, goal, passStart, jailTurns, bailFine, taxAmount,
// filmFee, maxRounds). scene: charminar | cyberabad | hussainsagar | golconda | banjara

export const CHAPTERS = [
  {
    id: 'ch1',
    title: 'Miyapur Metro Morning',
    te: 'మియాపూర్ మెట్రో ఉదయం',
    blurb: 'Your first morning in the city. One friendly rival, a generous salary and a long Metro ride to your first ₹30,000.',
    scene: 'charminar',
    rivals: ['chai-uncle'],
    settings: { startCash: 12000, goal: 30000, passStart: 2000 },
    reward: { xp: 120, coins: 150 },
  },
  {
    id: 'ch2',
    title: 'Kukatpally Chai Rush',
    te: 'కూకట్‌పల్లి చాయ్ రష్',
    blurb: 'Busy bus stops, endless malls and two sharp shopkeepers. Prove that your bargaining is as good as their chai.',
    scene: 'hussainsagar',
    rivals: ['kirana-aunty', 'biryani-bhai'],
    settings: { startCash: 12500, goal: 40000, passStart: 1800 },
    reward: { xp: 200, coins: 250 },
  },
  {
    id: 'ch3',
    title: 'HITEC Hustle',
    te: 'హైటెక్ సిటీ హడావుడి',
    blurb: 'The IT corridor never sleeps and neither do your rivals. A sharp coder and a spend-it-all techie want the same towers as you.',
    scene: 'cyberabad',
    rivals: ['debug-divya', 'techie-teja'],
    settings: { startCash: 13000, goal: 50000 },
    reward: { xp: 300, coins: 400 },
  },
  {
    id: 'ch4',
    title: 'Jubilee Hills Spotlight',
    te: 'జూబ్లీ హిల్స్ స్పాట్‌లైట్',
    blurb: 'Film-star country. Three bold players, a louder crowd and a goal of ₹60,000. Cameras are rolling, so play like a lead actor.',
    scene: 'golconda',
    rivals: ['auto-anna', 'debug-divya', 'pearl-pasha'],
    settings: { startCash: 14000, goal: 60000 },
    reward: { xp: 420, coins: 600 },
  },
  {
    id: 'ch5',
    title: 'Banjara Hills Baron',
    te: 'బంజారా హిల్స్ బారన్',
    blurb: 'The final climb. Three of the toughest rivals in town and ₹70,000 to claim the crown of Banjara Hills. Let the city hear you!',
    scene: 'banjara',
    rivals: ['techie-teja', 'pearl-pasha', 'blockbuster-bunty'],
    settings: { startCash: 15000, goal: 70000 },
    reward: { xp: 600, coins: 1000 },
  },
];

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) || null;
