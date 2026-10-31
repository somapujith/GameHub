// The Hyderabad board: 40 tiles on an 11x11 ring, laid out like classic Monopoly (see hyderabad-monopoly.md).
// START is the bottom-right corner and play runs CLOCKWISE: left along the bottom row to the Jail corner,
// up the left column to the Irani Chai corner, right along the top row to the Go-to-Jail corner,
// then down the right column back to START.
// Prices are the original Monopoly values x10, in rupees.
// Pure data + tiny helpers. Shared by the browser and the Cloudflare Worker.

export const BOARD_SIZE = 40;
export const GRID = 11; // tiles per side, corners included
export const START_TILE = 0;
export const JAIL_TILE = 10; // Chanchalguda Jail (just visiting)
export const PARKING_TILE = 20; // Irani Chai & Biryani Break (free parking: nothing happens)
export const GO_TO_JAIL_TILE = 30; // caught at a signal without a helmet

// Building ladder (Monopoly: 4 houses, then a hotel). Level 5 = the Hotel capstone.
export const MAX_LEVEL = 5;
export const HOTEL_LEVEL = 5;
export const LEVEL_NAMES = ['Empty plot', 'Kirana shop', 'Apartments', 'Mall', 'Tower', 'Hotel'];

// Owning EVERY property of a colour group doubles the base rent of its unbuilt tiles and unlocks building.
export const SET_BONUS = { full: 2 };
export function setMultiplier(owned, size) {
  return size > 0 && owned >= size ? SET_BONUS.full : 1;
}

// Mortgage: the bank lends `tile.mortgage`; no building and no rent while mortgaged. Lifting it costs +10%.
export const UNMORTGAGE_INTEREST = 0.1;
export const mortgageValue = (tile) => tile.mortgage || 0;
export const unmortgageCost = (tile) => Math.round(mortgageValue(tile) * (1 + UNMORTGAGE_INTEREST));
export const TRANSPORT_RENT = [0, 250, 500, 1000, 2000]; // stations: rent by number of stations owned
export const UTILITY_MULT = [0, 40, 100]; // utilities: rent = this x the dice total, by number owned
export const SELL_RATIO = 0.5; // value recovered when the bank liquidates assets

export const START_CASH = 15000; // default starting cash per player
export const PASS_START = 2000; // salary for passing or landing on START
export const BAIL_FINE = 500; // Chanchalguda Jail bail
export const TOKEN_CAP = 3; // most Snatch tokens a player can hold (docs/GAME_RULES.md section 10)
export const LAPS_PER_TOKEN = 3; // every 3rd pass of START earns a token
export const TRAPS_EACH = 1; // traps every player starts with (docs/GAME_RULES.md section 13)

export const GROUPS = {
  brown: { id: 'brown', name: 'Brown', color: '#955436', ink: '#ffffff' },
  lightblue: { id: 'lightblue', name: 'Light Blue', color: '#aae0fa', ink: '#14303d' },
  pink: { id: 'pink', name: 'Pink', color: '#d93a96', ink: '#ffffff' },
  orange: { id: 'orange', name: 'Lakeside', color: '#f7941d', ink: '#2a1500' },
  red: { id: 'red', name: 'Heritage', color: '#ed1b24', ink: '#ffffff' },
  yellow: { id: 'yellow', name: 'IT Corridor', color: '#fef200', ink: '#2a2600' },
  green: { id: 'green', name: 'Elite', color: '#1fb25a', ink: '#ffffff' },
  darkblue: { id: 'darkblue', name: 'Dark Blue', color: '#0072bb', ink: '#ffffff' },
};

// Tile fields
//   type     start | property | transport (station) | utility | kismet (card square) | tax | jail | parking | gotojail
//   corner   true on the four corners
//   property: group, price, rent [base, 1 house, 2, 3, 4, hotel], houseCost, mortgage
//   transport / utility: price, mortgage (rent comes from TRANSPORT_RENT / UTILITY_MULT)
//   kismet: deck 'chance' (Nawab ka Farman) | 'chest' (Hyderabadi Khazana)
//   tax: taxFlat (pay this) and optional taxPercent (pay the LOWER of the flat amount and that % of total worth)
// art keys: property | metro | bulb | water | tax | kismet | jail | plane | parking | gotojail
export const TILES = [
  { id: 0, type: 'start', corner: true, name: 'Rajiv Gandhi Airport', short: 'START', art: 'plane', emoji: '✈️',
    lore: 'Where every Hyderabad dream begins. Pass START and collect your salary.' },

  // ---- bottom row (right -> left)
  { id: 1, type: 'property', name: 'Dilsukhnagar', short: 'Dilsukhnagar', group: 'brown', price: 600,
    rent: [20, 100, 300, 900, 1600, 2500], houseCost: 500, mortgage: 300, art: 'property', emoji: '🏠',
    lore: 'Shopping lanes that never sleep and the famous bus-stand rush.' },
  { id: 2, type: 'kismet', deck: 'chest', name: 'Hyderabadi Khazana', short: 'Khazana', art: 'kismet', emoji: '🎴',
    lore: 'Draw a Khazana card. Treasure, or a bill?' },
  { id: 3, type: 'property', name: 'Malakpet', short: 'Malakpet', group: 'brown', price: 600,
    rent: [40, 200, 600, 1800, 3200, 4500], houseCost: 500, mortgage: 300, art: 'property', emoji: '🏠',
    lore: 'Busy markets, the old race course and a wholesale crowd from dawn.' },
  { id: 4, type: 'tax', name: 'GHMC Property Tax', short: 'Property Tax', taxFlat: 2000, taxPercent: 10, art: 'tax', emoji: '🧾',
    lore: 'The only thing as certain as Hyderabad traffic. Pay 2,000, or 10% of your worth if that is less.' },
  { id: 5, type: 'transport', name: 'Secunderabad Junction', short: 'Secunderabad', price: 2000, mortgage: 1000, art: 'metro', emoji: '🚉',
    lore: 'The grand old junction where half the country changes trains.' },
  { id: 6, type: 'property', name: 'Koti', short: 'Koti', group: 'lightblue', price: 1000,
    rent: [60, 300, 900, 2700, 4000, 5500], houseCost: 500, mortgage: 500, art: 'property', emoji: '🏠',
    lore: 'Sultan Bazaar, book stalls and a never-ending pedestrian crush.' },
  { id: 7, type: 'kismet', deck: 'chance', name: 'Nawab ka Farman', short: 'Farman', art: 'kismet', emoji: '🎴',
    lore: 'The Nawab has issued a decree. Draw a Farman card.' },
  { id: 8, type: 'property', name: 'Abids', short: 'Abids', group: 'lightblue', price: 1000,
    rent: [60, 300, 900, 2700, 4000, 5500], houseCost: 500, mortgage: 500, art: 'property', emoji: '🏠',
    lore: 'The old shopping street where bargains and bookshops share a footpath.' },
  { id: 9, type: 'property', name: 'Mehdipatnam', short: 'Mehdipatnam', group: 'lightblue', price: 1200,
    rent: [80, 400, 1000, 3000, 4500, 6000], houseCost: 500, mortgage: 600, art: 'property', emoji: '🏠',
    lore: 'A bus hub, a flyover and a haleem stall on every corner.' },
  { id: 10, type: 'jail', corner: true, name: 'Chanchalguda Jail', short: 'Jail', art: 'jail', emoji: '🚔',
    lore: 'Just visiting, or serving time? Roll a six or pay bail to get out.' },

  // ---- left column (bottom -> top)
  { id: 11, type: 'property', name: 'Ameerpet', short: 'Ameerpet', group: 'pink', price: 1400,
    rent: [100, 500, 1500, 4500, 6250, 7500], houseCost: 1000, mortgage: 700, art: 'property', emoji: '🏠',
    lore: 'The coaching-centre capital. Software dreams are sold here by the hour.' },
  { id: 12, type: 'utility', name: 'TGSPDCL (Electricity)', short: 'Electricity', price: 1500, mortgage: 750, art: 'bulb', emoji: '💡',
    lore: 'Power cut or not, the bill always arrives. Rent depends on your dice.' },
  { id: 13, type: 'property', name: 'Kukatpally', short: 'Kukatpally', group: 'pink', price: 1400,
    rent: [100, 500, 1500, 4500, 6250, 7500], houseCost: 1000, mortgage: 700, art: 'property', emoji: '🏠',
    lore: 'KPHB, the malls and endless auto-rickshaws. Everyone passes through.' },
  { id: 14, type: 'property', name: 'Begumpet', short: 'Begumpet', group: 'pink', price: 1600,
    rent: [120, 600, 1800, 5000, 7000, 9000], houseCost: 1000, mortgage: 800, art: 'property', emoji: '🏠',
    lore: 'Old airport, new money. Heritage meets high-rise.' },
  { id: 15, type: 'transport', name: 'Kacheguda Station', short: 'Kacheguda', price: 2000, mortgage: 1000, art: 'metro', emoji: '🚉',
    lore: 'A handsome Gothic station that has seen a century of journeys.' },
  { id: 16, type: 'property', name: 'Tank Bund', short: 'Tank Bund', group: 'orange', price: 1800,
    rent: [140, 700, 2000, 5500, 7500, 9500], houseCost: 1000, mortgage: 900, art: 'property', emoji: '🏠',
    lore: 'The lakeside promenade and the giant Buddha in the water.' },
  { id: 17, type: 'kismet', deck: 'chest', name: 'Hyderabadi Khazana', short: 'Khazana', art: 'kismet', emoji: '🎴',
    lore: 'Draw a Khazana card. Treasure, or a bill?' },
  { id: 18, type: 'property', name: 'Necklace Road', short: 'Necklace Rd', group: 'orange', price: 1800,
    rent: [140, 700, 2000, 5500, 7500, 9500], houseCost: 1000, mortgage: 900, art: 'property', emoji: '🏠',
    lore: 'A curve of lights around Hussain Sagar, best at sunset.' },
  { id: 19, type: 'property', name: 'Lumbini Park', short: 'Lumbini Park', group: 'orange', price: 2000,
    rent: [160, 800, 2200, 6000, 8000, 10000], houseCost: 1000, mortgage: 1000, art: 'property', emoji: '🏠',
    lore: 'Lake breeze, boat rides and a laser show after dark.' },
  { id: 20, type: 'parking', corner: true, name: 'Irani Chai & Biryani Break', short: 'Chai Break', art: 'parking', emoji: '☕',
    lore: 'Sit back with an Irani chai and a plate of biryani. Nothing happens, and that is the point.' },

  // ---- top row (left -> right)
  { id: 21, type: 'property', name: 'Charminar', short: 'Charminar', group: 'red', price: 2200,
    rent: [180, 900, 2500, 7000, 8750, 10500], houseCost: 1500, mortgage: 1100, art: 'property', emoji: '🏠',
    lore: 'Four minarets, bangle lanes and the heart of the old city.' },
  { id: 22, type: 'kismet', deck: 'chance', name: 'Nawab ka Farman', short: 'Farman', art: 'kismet', emoji: '🎴',
    lore: 'The Nawab has issued a decree. Draw a Farman card.' },
  { id: 23, type: 'property', name: 'Chowmahalla Palace', short: 'Chowmahalla', group: 'red', price: 2200,
    rent: [180, 900, 2500, 7000, 8750, 10500], houseCost: 1500, mortgage: 1100, art: 'property', emoji: '🏠',
    lore: 'The Nizams\' grand durbar, with courtyards and a vintage car collection.' },
  { id: 24, type: 'property', name: 'Golconda Fort', short: 'Golconda', group: 'red', price: 2400,
    rent: [200, 1000, 3000, 7500, 9250, 11000], houseCost: 1500, mortgage: 1200, art: 'property', emoji: '🏠',
    lore: 'Clap at the gate and hear it echo all the way to the top.' },
  { id: 25, type: 'transport', name: 'Hyderabad Deccan (Nampally) Station', short: 'Nampally', price: 2000, mortgage: 1000, art: 'metro', emoji: '🚉',
    lore: 'The Deccan\'s classic terminus, a short walk from Public Gardens.' },
  { id: 26, type: 'property', name: 'Madhapur', short: 'Madhapur', group: 'yellow', price: 2600,
    rent: [220, 1100, 3300, 8000, 9750, 11500], houseCost: 1500, mortgage: 1300, art: 'property', emoji: '🏠',
    lore: 'The heart of HITEC City: cyber towers, cafe culture and hustle.' },
  { id: 27, type: 'property', name: 'Gachibowli', short: 'Gachibowli', group: 'yellow', price: 2600,
    rent: [220, 1100, 3300, 8000, 9750, 11500], houseCost: 1500, mortgage: 1300, art: 'property', emoji: '🏠',
    lore: 'Stadium, skyscrapers and the business school: the new Hyderabad.' },
  { id: 28, type: 'utility', name: 'HMWSSB (Water Board)', short: 'Water Board', price: 1500, mortgage: 750, art: 'water', emoji: '💧',
    lore: 'Krishna and Godavari water, delivered by pipe or by tanker. Rent depends on your dice.' },
  { id: 29, type: 'property', name: 'Kondapur', short: 'Kondapur', group: 'yellow', price: 2800,
    rent: [240, 1200, 3600, 8500, 10250, 12000], houseCost: 1500, mortgage: 1400, art: 'property', emoji: '🏠',
    lore: 'IT parks, PG hostels and Sunday biryani queues.' },
  { id: 30, type: 'gotojail', corner: true, name: 'Go to Jail', short: 'Go to Jail', art: 'gotojail', emoji: '🚨',
    lore: 'Caught at a signal without a helmet. Straight to Chanchalguda Jail, no salary.' },

  // ---- right column (top -> bottom)
  { id: 31, type: 'property', name: 'Jubilee Hills', short: 'Jubilee Hills', group: 'green', price: 3000,
    rent: [260, 1300, 3900, 9000, 11000, 12750], houseCost: 2000, mortgage: 1500, art: 'property', emoji: '🏠',
    lore: 'The film stars\' neighbourhood. Tollywood lives here.' },
  { id: 32, type: 'property', name: 'Banjara Hills', short: 'Banjara Hills', group: 'green', price: 3000,
    rent: [260, 1300, 3900, 9000, 11000, 12750], houseCost: 2000, mortgage: 1500, art: 'property', emoji: '🏠',
    lore: 'Hyderabad\'s most prestigious address: Road No. 12, boutiques and billionaires.' },
  { id: 33, type: 'kismet', deck: 'chest', name: 'Hyderabadi Khazana', short: 'Khazana', art: 'kismet', emoji: '🎴',
    lore: 'Draw a Khazana card. Treasure, or a bill?' },
  { id: 34, type: 'property', name: 'Film Nagar', short: 'Film Nagar', group: 'green', price: 3200,
    rent: [280, 1500, 4500, 10000, 12000, 14000], houseCost: 2000, mortgage: 1600, art: 'property', emoji: '🏠',
    lore: 'Studios, star homes and chai stalls where scripts are born.' },
  { id: 35, type: 'transport', name: 'Lingampally Station', short: 'Lingampally', price: 2000, mortgage: 1000, art: 'metro', emoji: '🚉',
    lore: 'The western gateway where commuters meet the IT corridor.' },
  { id: 36, type: 'kismet', deck: 'chance', name: 'Nawab ka Farman', short: 'Farman', art: 'kismet', emoji: '🎴',
    lore: 'The Nawab has issued a decree. Draw a Farman card.' },
  { id: 37, type: 'property', name: 'HITEC City', short: 'HITEC City', group: 'darkblue', price: 3500,
    rent: [350, 1750, 5000, 11000, 13000, 15000], houseCost: 2000, mortgage: 1750, art: 'property', emoji: '🏠',
    lore: 'Cyber Towers and the glass skyline that put Hyderabad on the tech map.' },
  { id: 38, type: 'tax', name: 'ORR Toll / Traffic Challan', short: 'ORR Challan', taxFlat: 1000, art: 'tax', emoji: '🚧',
    lore: 'Toll gate, speed camera, challan. Pay 1,000.' },
  { id: 39, type: 'property', name: 'Financial District', short: 'Fin. District', group: 'darkblue', price: 4000,
    rent: [500, 2000, 6000, 14000, 17000, 20000], houseCost: 2000, mortgage: 2000, art: 'property', emoji: '🏠',
    lore: 'Glass towers and the global offices of Nanakramguda. The priciest tile in town.' },
];

export const TILE_TYPES = ['start', 'property', 'transport', 'utility', 'kismet', 'tax', 'jail', 'parking', 'gotojail'];

/** groupId -> array of tile ids */
export const GROUP_TILES = Object.fromEntries(
  Object.keys(GROUPS).map((g) => [g, TILES.filter((t) => t.group === g).map((t) => t.id)]),
);

export const isBuyable = (t) => t.type === 'property' || t.type === 'transport' || t.type === 'utility';

/** Rent of a property tile at a building level (0 = empty plot, 5 = Hotel), before the full-set bonus. */
export function rentFor(tile, level = 0) {
  const table = tile.rent || [];
  return table[Math.max(0, Math.min(table.length - 1, level))] || 0;
}

/** Cost of building ONE more level on a property tile. */
export function upgradeCost(tile) {
  return tile.houseCost || 0;
}

/**
 * Tax due on a tax tile: the flat amount, or the LOWER of the flat amount and `taxPercent`% of
 * `worth` when the tile has a percentage option.
 */
export function taxDue(tile, worth = 0) {
  const flat = tile.taxFlat || 0;
  if (!tile.taxPercent) return flat;
  return Math.min(flat, Math.round(((Number(worth) || 0) * tile.taxPercent) / 100 / 10) * 10);
}

/**
 * Cell on the 11x11 board grid (col,row both 0..10, row 0 = top) for a tile index.
 * Tile ids ascend CLOCKWISE from START at the bottom-RIGHT corner.
 */
export function tilePosition(i) {
  if (i <= 10) return { col: 10 - i, row: 10 }; // bottom row, right -> left
  if (i <= 20) return { col: 0, row: 20 - i }; // left column, bottom -> top
  if (i <= 30) return { col: i - 20, row: 0 }; // top row, left -> right
  return { col: 10, row: i - 30 }; // right column, top -> bottom
}

/** Which side of the board a tile sits on: 'bottom' | 'left' | 'top' | 'right' (corners belong to the row they end). */
export function tileSide(i) {
  if (i <= 10) return 'bottom';
  if (i <= 20) return 'left';
  if (i <= 30) return 'top';
  return 'right';
}
