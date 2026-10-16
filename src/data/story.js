// Story intro, rival archetypes and loading/menu tips for Hyderabad Tycoon.
// All characters are fictional Hyderabad archetypes. None is based on a real person.

/** Five intro slides. scene: charminar | cyberabad | hussainsagar | golconda | banjara */
export const STORY_SLIDES = [
  {
    id: 'pearls',
    title: '1591: The City of Pearls',
    scene: 'charminar',
    body:
      'In 1591 a young Sultan raised four slender minarets at a busy crossroads and called it Charminar. ' +
      'Pearls, bangles and biryani soon followed. Hyderabad has been selling dreams, with second helpings, ever since.',
  },
  {
    id: 'cyberabad',
    title: 'Cyberabad Wakes Up',
    scene: 'cyberabad',
    body:
      'Four centuries later, glass towers rose beside the old lanes. Cyberabad now runs on code, filter coffee and ' +
      'Metro rides. Every stand-up meeting somehow ends with the words: "Biryani for lunch?"',
  },
  {
    id: 'arrival',
    title: 'One Scooter, One Dream',
    scene: 'hussainsagar',
    body:
      'You putter past the Buddha on Hussain Sagar and stop at Charminar Chowk with ₹15,000 and a borrowed scooter. ' +
      'Your dream is simple: own Banjara Hills. The chaiwala grins. "Big dream, small wallet. Perfect."',
  },
  {
    id: 'rivals',
    title: 'The Rivals Are Watching',
    scene: 'golconda',
    body:
      'Biryani Bhai counts his cash. Chai Uncle counts the odds. Techie Teja counts nothing and buys everything. ' +
      'They have seen newcomers before. They are all smiling politely, while quietly planning your rent bill.',
  },
  {
    id: 'hear',
    title: 'Let the City Hear You',
    scene: 'banjara',
    body:
      'Buy plots, build towers, collect rent and dodge the taxman. Reach the goal net worth before anyone else does. ' +
      'The lanes are listening and the film heroes are cheering. Let the city hear you!',
  },
];

/**
 * Eight computer rivals. `bot` feeds the engine: `reserve` is the cash cushion the bot refuses to dip below
 * (200..1500), `greed` multiplies how much it is willing to pay (0.7 = careful, 1.4 = reckless).
 * `avatar` is an Avatar preset 0..11. Ordered from gentlest to toughest.
 */
export const RIVALS = [
  {
    id: 'chai-uncle',
    name: 'Chai Uncle',
    tagline: 'Slow sips, slower spending',
    bio: 'Has watched the city change from the same stool for forty years. Plays very cautiously: keeps a huge cash cushion and only buys bargains. Safe, steady and a bit sleepy.',
    avatar: 1,
    bot: { reserve: 1500, greed: 0.7 },
  },
  {
    id: 'kirana-aunty',
    name: 'Kirana Aunty',
    tagline: 'Counts every rupee twice',
    bio: 'Runs the corner shop and never forgets a debt. Plays carefully and keeps a healthy reserve, but she does upgrade once she owns a full set.',
    avatar: 6,
    bot: { reserve: 1100, greed: 0.85 },
  },
  {
    id: 'biryani-bhai',
    name: 'Biryani Bhai',
    tagline: 'Dum cooking, dum thinking',
    bio: 'A balanced player: buys fair deals, keeps a sensible cushion and never rushes. Generous with biryani, not with rent discounts.',
    avatar: 0,
    bot: { reserve: 800, greed: 1.0 },
  },
  {
    id: 'debug-divya',
    name: 'Debug Divya',
    tagline: 'Finds the bug in your plan',
    bio: 'A calm, calculating coder. Plays a steady-but-sharp game: buys good tiles early, builds when it pays and bids with a cool head.',
    avatar: 9,
    bot: { reserve: 650, greed: 1.1 },
  },
  {
    id: 'auto-anna',
    name: 'Auto Anna',
    tagline: 'Knows every shortcut',
    bio: 'Fast, loud and fearless. Plays aggressively: buys almost everything he lands on and races the others to the goal with a thin cash cushion.',
    avatar: 4,
    bot: { reserve: 450, greed: 1.2 },
  },
  {
    id: 'techie-teja',
    name: 'Techie Teja',
    tagline: 'Scale first, profit later',
    bio: 'Burns cash like a start-up. Plays very aggressively: grabs tiles, upgrades fast and bids high. Brilliant when it works, broke when it does not.',
    avatar: 2,
    bot: { reserve: 350, greed: 1.25 },
  },
  {
    id: 'pearl-pasha',
    name: 'Pearl Pasha',
    tagline: 'Only buys the best',
    bio: 'An old-city dealer with deep pockets and bigger ambitions. Plays boldly: pays top rupee in auctions and builds towers early, with only a small reserve.',
    avatar: 3,
    bot: { reserve: 500, greed: 1.3 },
  },
  {
    id: 'blockbuster-bunty',
    name: 'Blockbuster Bunty',
    tagline: 'Every deal is a sequel',
    bio: 'A gambling film producer who always goes all in. Plays recklessly: almost no reserve, the highest bids in town and a loud celebration for every win.',
    avatar: 7,
    bot: { reserve: 200, greed: 1.4 },
  },
];

/** Short loading/menu tips: game rules advice plus accurate Hyderabad trivia. */
export const TIPS = [
  'Own 2 of a 3-tile colour for x1.5 rent on empty plots, or the full colour for x2. The bonus only applies before you build.',
  'You can only build on a full colour. Build evenly: raise the tile that sits at the group\'s lowest level.',
  'The Hotel is the top tier. You can only build one once every tile in that colour is already a Tower.',
  'Need a cash boost? Mortgage a tile to get half its price from the bank. It earns no rent until you unmortgage it.',
  'Unmortgaging costs the bank\'s loan plus 10% extra, and you can only mortgage tiles whose colour has no buildings.',
  'Trades let you swap tiles and cash with a rival. Finishing your colour is worth a lot, but tiles with buildings on their colour cannot be traded.',
  'Lucky dice are a small, disclosed nudge for players who are falling behind. Fair dice treat all 36 rolls equally.',
  'Decline a tile and it goes to a sealed auction where everyone, including you, may bid.',
  'Passing or landing on Charminar Chowk pays your salary every lap.',
  'Roll doubles to go again, but three doubles in a row sends you straight to jail.',
  'In jail, roll doubles or pay the bail fine to get out. Sometimes paying is cheaper than waiting.',
  'Laad Bazaar auctions a free tile with sealed bids. Bid what it is worth to you, not just the minimum.',
  'Metro, Hussain Sagar boating and the Airport pay more rent the more of them you own.',
  'Electricity and Water Board charge your dice total times 40, or times 100 if the same owner has both.',
  'Cannot pay a bill? Raise cash by mortgaging tiles or selling buildings (at half their cost). If you still fall short, you are bankrupt.',
  'Net worth is cash plus property plus buildings. A big bank balance alone will not win the game.',
  'Charminar was built in 1591, the same year Hyderabad was founded, and it still stands in the old city.',
  'Hussain Sagar lake has a giant Buddha statue, about 18 metres tall, installed in 1992.',
  'Laad Bazaar, right beside Charminar, is famous for its sparkling lac bangles.',
  'The Hyderabad Metro Red Line runs from Miyapur all the way to LB Nagar.',
  'Ramoji Film City is one of the largest film studio complexes in the world, spread over 1,600 acres.',
  'Golconda Fort is famous for its acoustics: a clap at the entrance can be heard at the top of the hill.',
  'Hyderabad is nicknamed the City of Pearls. Its biryani is cooked "dum" style, sealed and slow-steamed.',
  'Rajiv Gandhi International Airport is at Shamshabad, on the southern edge of the city.',
  'Watch the rivals: a bot with a tiny cash reserve can be bankrupted by one big rent.',
  'Emote buttons are free. A well-timed laugh or taunt makes every match more fun.',
];
