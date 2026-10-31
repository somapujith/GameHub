// Kismet deck: the one shuffled deck that BOTH card squares draw from - Nawab ka Farman (tiles 7, 22, 36)
// and Hyderabadi Khazana (tiles 2, 17, 33). 24 cards, Hyderabad flavour. Tile targets never point at a kismet tile.
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
    text: 'Your company finally gave that hike. Collect ₹1,500.',
    effect: { type: 'cash', amount: 1500 },
  },
  {
    id: 'old_bike', kind: 'good', title: 'Old Bike Sold',
    text: 'Sold your old Splendor on OLX. Collect ₹500.',
    effect: { type: 'cash', amount: 500 },
  },
  {
    id: 'bonalu_raffle', kind: 'good', title: 'Bonalu Raffle',
    text: 'You won the Bonalu jatara lucky draw! Collect ₹1,000.',
    effect: { type: 'cash', amount: 1000 },
  },
  {
    id: 'startup_funding', kind: 'good', title: 'Startup Funding',
    text: 'Your startup just closed a seed round. Collect ₹1,200.',
    effect: { type: 'cash', amount: 1200 },
  },
  {
    id: 'ghmc_rebate', kind: 'good', title: 'GHMC Rebate',
    text: 'GHMC gave a rare tax rebate. Collect ₹500.',
    effect: { type: 'cash', amount: 500 },
  },
  {
    id: 'cricket_bet', kind: 'good', title: 'Cricket Bet',
    text: 'Won a cricket bet at the Uppal stadium. Collect ₹1,500.',
    effect: { type: 'cash', amount: 1500 },
  },
  {
    id: 'haleem_profit', kind: 'good', title: 'Haleem Season',
    text: 'Haleem season: your stall made a profit. Collect ₹2,000.',
    effect: { type: 'cash', amount: 2000 },
  },
  {
    id: 'paradise_party', kind: 'bad', title: 'Paradise Biryani Party',
    text: 'You treated the gang to Paradise biryani. Pay ₹500.',
    effect: { type: 'cash', amount: -500 },
  },
  {
    id: 'orr_challan', kind: 'bad', title: 'ORR Challan',
    text: 'Over-speeding on the ORR. Pay a ₹500 challan.',
    effect: { type: 'cash', amount: -500 },
  },
  {
    id: 'metro_recharge', kind: 'bad', title: 'Metro Card Recharge',
    text: 'Your metro card ran out again. Pay ₹200.',
    effect: { type: 'cash', amount: -200 },
  },
  {
    id: 'water_tanker', kind: 'bad', title: 'Water Tanker',
    text: 'Summer is here and the tanker is late. Pay ₹400.',
    effect: { type: 'cash', amount: -400 },
  },
  {
    id: 'pearl_market', kind: 'bad', title: 'Pearl Market Spree',
    text: 'Pay ₹1,000 for a Pearl Market shopping spree.',
    effect: { type: 'cash', amount: -1000 },
  },
  {
    id: 'airport_dash', kind: 'good', title: 'Catch the Flight',
    text: 'Running late for your flight at Rajiv Gandhi Airport. Advance to START and collect your salary.',
    effect: { type: 'moveTo', tile: 0, collect: true },
  },
  {
    id: 'charminar_trip', kind: 'neutral', title: 'Charminar Trip',
    text: 'Advance to Charminar. If you pass START, collect ₹2,000.',
    effect: { type: 'moveTo', tile: 21, collect: true },
  },
  {
    id: 'film_audition', kind: 'neutral', title: 'Tollywood Audition',
    text: 'Your Tollywood audition is at Film Nagar. Advance there. If you pass START, collect your salary.',
    effect: { type: 'moveTo', tile: 34, collect: true },
  },
  {
    id: 'rich_uncle', kind: 'neutral', title: 'Rich Uncle Calls',
    text: 'Your rich uncle invites you to Banjara Hills. Go there right away! If you pass START, collect your salary.',
    effect: { type: 'moveTo', tile: 32, collect: true },
  },
  {
    id: 'ride_metro', kind: 'neutral', title: 'All Aboard',
    text: 'Advance to Secunderabad Junction. If you pass START, collect your salary.',
    effect: { type: 'moveTo', tile: 5, collect: true },
  },
  {
    id: 'metro_smooth', kind: 'good', title: 'Metro Runs Smooth',
    text: 'The metro is running smoothly. Move forward 3 spaces.',
    effect: { type: 'moveBy', n: 3 },
  },
  {
    id: 'gachibowli_jam', kind: 'bad', title: 'Gachibowli Flyover Jam',
    text: 'Stuck in Gachibowli flyover traffic. Go back 3 spaces (no salary).',
    effect: { type: 'moveBy', n: -3 },
  },
  {
    id: 'naka_bandi', kind: 'bad', title: 'Police Naka-Bandi',
    text: 'Surprise naka-bandi! Go directly to Chanchalguda Jail.',
    effect: { type: 'jail' },
  },
  {
    id: 'birthday', kind: 'good', title: 'Happy Birthday!',
    text: "It's your birthday! Collect ₹300 from every player.",
    effect: { type: 'collectFromAll', amount: 300 },
  },
  {
    id: 'biryani_late', kind: 'bad', title: 'Biryani Delay',
    text: 'Your biryani order arrived late. Pay ₹500 to each player.',
    effect: { type: 'payAll', amount: 500 },
  },
  {
    id: 'paytm_100', kind: 'bad', title: 'Paytm Karo!',
    text: 'Everyone is waiting: Paytm ₹100 to each player.',
    effect: { type: 'payAll', amount: 100 },
  },
  {
    id: 'jail_free', kind: 'good', title: 'Get Out of Jail Free',
    text: 'Your cousin knows the inspector. Keep this card and skip jail once.',
    effect: { type: 'jailCard' },
  },
];
