// City events (docs/GAME_RULES.md section 11). Every EVENT_EVERY-th round one event is drawn with the game's seeded
// rng and stays active until the next round starts. Rent / tax effects are applied by the engine (rentOf and the tax
// landing), so previewRent, the odds overlay and the UI always agree.
//
//   kind   'rent' (changes what tiles ask), 'tax' (changes what the city asks) or 'cash' (a one-off payout)
//   group  true when the draw also picks a colour group (state.event.group)
//   mult   rent multiplier for that group
//   amount one-off payout per active player

export const EVENT_EVERY = 5;

export const CITY_EVENTS = [
  { id: 'monsoon', title: 'Monsoon Floods', text: 'Heavy rain empties the streets: one colour group pays half rent this round.', kind: 'rent', group: true, mult: 0.5 },
  { id: 'ipl', title: 'IPL Night at Uppal', text: 'The crowds are in town: one colour group pays double rent this round.', kind: 'rent', group: true, mult: 2 },
  { id: 'metro_strike', title: 'Metro Strike', text: 'The metro is shut down: stations collect no rent this round.', kind: 'rent' },
  { id: 'tax_holiday', title: 'GHMC Tax Holiday', text: 'Property tax and the ORR challan cost nothing this round.', kind: 'tax' },
  { id: 'bonalu', title: 'Bonalu Festival', text: 'The city celebrates: everyone receives a festival gift.', kind: 'cash', amount: 500 },
];

export const cityEventById = (id) => CITY_EVENTS.find((e) => e.id === id) || null;
