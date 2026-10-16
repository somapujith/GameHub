// Biryani Kismet deck. 17 cards, Hyderabad flavour. Tile targets never point at a kismet tile.
//
// effect types:
//   { type:'cash', amount }              +amount from the bank / -amount to the bank
//   { type:'moveTo', tile, collect }     travel clockwise to `tile`; `collect` = pay salary when passing/landing START
//   { type:'moveBy', n }                 n > 0 clockwise (salary applies), n < 0 backwards (never salary)
//   { type:'jail' }                      straight to Chanchalguda Jail
//   { type:'collectFromAll', amount }    every other active player pays you `amount`
//   { type:'payAll', amount }            you pay `amount` to every other active player
//   { type:'jailCard' }                   keep this card (player.jailCards++); USE_JAIL_CARD returns it to the deck

export const KISMET = [
  {
    id: 'it_hike', kind: 'good', title: 'IT Hike!',
    text: 'Your company finally gave that hike. Collect ₹1,000.',
    te: 'ఐటీ హైక్! కంపెనీ మీ జీతం పెంచింది. ₹1,000 తీసుకోండి.',
    effect: { type: 'cash', amount: 1000 },
  },
  {
    id: 'old_bike', kind: 'good', title: 'Old Bike Sold',
    text: 'Sold your old Splendor on OLX. Collect ₹400.',
    te: 'పాత బైక్ అమ్మేశారు. ₹400 తీసుకోండి.',
    effect: { type: 'cash', amount: 400 },
  },
  {
    id: 'bonalu_raffle', kind: 'good', title: 'Bonalu Raffle',
    text: 'You won the Bonalu jatara lucky draw! Collect ₹600.',
    te: 'బోనాల జాతరలో లక్కీ డ్రా గెలిచారు! ₹600 తీసుకోండి.',
    effect: { type: 'cash', amount: 600 },
  },
  {
    id: 'startup_funding', kind: 'good', title: 'Startup Funding',
    text: 'Your startup just closed a seed round. Collect ₹800.',
    te: 'మీ స్టార్టప్‌కి ఫండింగ్ వచ్చింది! ₹800 తీసుకోండి.',
    effect: { type: 'cash', amount: 800 },
  },
  {
    id: 'ghmc_rebate', kind: 'good', title: 'GHMC Rebate',
    text: 'GHMC gave a rare tax rebate. Collect ₹300.',
    te: 'జీహెచ్ఎంసీ పన్ను రాయితీ ఇచ్చింది. ₹300 తీసుకోండి.',
    effect: { type: 'cash', amount: 300 },
  },
  {
    id: 'paradise_party', kind: 'bad', title: 'Paradise Biryani Party',
    text: 'You treated the gang to Paradise biryani. Pay ₹300.',
    te: 'పారడైజ్‌లో బిర్యానీ పార్టీ ఇచ్చారు. ₹300 చెల్లించండి.',
    effect: { type: 'cash', amount: -300 },
  },
  {
    id: 'orr_challan', kind: 'bad', title: 'ORR Challan',
    text: 'Over-speeding on the ORR. Pay a ₹350 challan.',
    te: 'ఓఆర్ఆర్‌లో ఓవర్ స్పీడ్ చలాన్ పడింది. ₹350 చెల్లించండి.',
    effect: { type: 'cash', amount: -350 },
  },
  {
    id: 'metro_recharge', kind: 'bad', title: 'Metro Card Recharge',
    text: 'Your metro card ran out again. Pay ₹150.',
    te: 'మెట్రో కార్డ్ రీఛార్జ్ చేశారు. ₹150 చెల్లించండి.',
    effect: { type: 'cash', amount: -150 },
  },
  {
    id: 'water_tanker', kind: 'bad', title: 'Water Tanker',
    text: 'Summer is here and the tanker is late. Pay ₹250.',
    te: 'వేసవిలో వాటర్ ట్యాంకర్ తెప్పించారు. ₹250 చెల్లించండి.',
    effect: { type: 'cash', amount: -250 },
  },
  {
    id: 'first_metro', kind: 'good', title: 'First Metro to Charminar',
    text: 'You caught the first metro to Charminar. Advance to START and collect your salary.',
    te: 'మొదటి మెట్రోలో చార్మినార్ చేరారు. స్టార్ట్‌కి వెళ్లి జీతం తీసుకోండి.',
    effect: { type: 'moveTo', tile: 0, collect: true },
  },
  {
    id: 'rich_uncle', kind: 'neutral', title: 'Rich Uncle Calls',
    text: 'Your rich uncle invites you to Banjara Hills. Go there right away!',
    te: 'ధనవంతుడైన మామయ్య బంజారా హిల్స్‌కి పిలిచారు. వెంటనే వెళ్లండి!',
    effect: { type: 'moveTo', tile: 27, collect: false },
  },
  {
    id: 'ride_metro', kind: 'neutral', title: 'All Aboard the Metro',
    text: 'Advance to Hyderabad Metro. If you pass START, collect your salary.',
    te: 'హైదరాబాద్ మెట్రో వైపు ముందుకు వెళ్లండి. స్టార్ట్ దాటితే జీతం తీసుకోండి.',
    effect: { type: 'moveTo', tile: 3, collect: true },
  },
  {
    id: 'hitec_jam', kind: 'bad', title: 'HITEC City Traffic Jam',
    text: 'Stuck in a HITEC City traffic jam. Go back 3 tiles (no salary).',
    te: 'హైటెక్ సిటీ ట్రాఫిక్ జామ్! 3 అడుగులు వెనక్కి వెళ్లండి.',
    effect: { type: 'moveBy', n: -3 },
  },
  {
    id: 'naka_bandi', kind: 'bad', title: 'Police Naka-Bandi',
    text: 'Surprise naka-bandi! Go straight to Chanchalguda Jail.',
    te: 'పోలీసుల నాకాబందీ! నేరుగా చంచల్‌గూడ జైలుకి వెళ్లండి.',
    effect: { type: 'jail' },
  },
  {
    id: 'birthday', kind: 'good', title: 'Happy Birthday!',
    text: "It's your birthday! Collect ₹200 from every player.",
    te: 'ఈ రోజు మీ పుట్టినరోజు! ప్రతి ఆటగాడి నుంచి ₹200 తీసుకోండి.',
    effect: { type: 'collectFromAll', amount: 200 },
  },
  {
    id: 'biryani_promise', kind: 'bad', title: 'Biryani Promise',
    text: 'You promised biryani to everyone. Pay ₹150 to each player.',
    te: 'అందరికీ బిర్యానీ ఇస్తానని మాట ఇచ్చారు. ప్రతి ఆటగాడికి ₹150 చెల్లించండి.',
    effect: { type: 'payAll', amount: 150 },
  },
  {
    id: 'jail_free', kind: 'good', title: 'Get Out of Jail Free',
    text: 'Your lawyer friend from Banjara Hills has your back. Keep this card and skip jail once.',
    te: 'బంజారా హిల్స్ లాయర్ ఫ్రెండ్ అండగా ఉన్నాడు. ఈ కార్డ్ దాచుకోండి, ఒకసారి జైలు నుంచి ఉచితంగా బయటపడండి.',
    effect: { type: 'jailCard' },
  },
];
