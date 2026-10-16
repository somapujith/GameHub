// The Hyderabad board: 28 tiles on an 8x8 ring. START is bottom-left and play runs CLOCKWISE:
// up the left side, along the top, down the right side and back along the bottom. So AUCTION is
// the top-left corner, JAIL the top-right and the KISMET corner the bottom-right.
// Pure data + tiny helpers. Shared by the browser and the Cloudflare Worker.

export const BOARD_SIZE = 28;
export const START_TILE = 0;
export const AUCTION_TILE = 7;
export const JAIL_TILE = 14;
export const KISMET_CORNER = 21;

// Building ladder (Monopoly: 4 houses, then a hotel). Level 5 = the Hotel capstone.
export const MAX_LEVEL = 5;
export const HOTEL_LEVEL = 5;
export const LEVEL_NAMES = ['Empty plot', 'Kirana shop', 'Apartments', 'Mall', 'Tower', 'Hotel'];
export const LEVEL_NAMES_TE = ['ఖాళీ స్థలం', 'కిరాణా షాప్', 'అపార్ట్‌మెంట్లు', 'మాల్', 'టవర్', 'హోటల్'];

// Rent = price * RENT_RATE[level]; building one level costs price * UPGRADE_RATIO.
export const RENT_RATE = [0.08, 0.2, 0.4, 0.7, 1.0, 1.5];
export const UPGRADE_RATIO = 0.5;

// Colour-set bonus on UNBUILT (level 0) tiles, like Monopoly's doubled rent on a full set:
// own 2 of a 3-tile colour -> x1.5; own the whole colour (2 of 2 or 3 of 3) -> x2 and building rights.
export const SET_BONUS = { partial: 1.5, full: 2 };
export function setMultiplier(owned, size) {
  if (size > 0 && owned >= size) return SET_BONUS.full;
  if (size === 3 && owned === 2) return SET_BONUS.partial;
  return 1;
}

// Mortgage: borrow half the price from the bank (no building allowed, no rent collected).
export const MORTGAGE_RATIO = 0.5;
export const UNMORTGAGE_INTEREST = 0.1;
export const mortgageValue = (tile) => Math.round((tile.price * MORTGAGE_RATIO) / 10) * 10;
export const unmortgageCost = (tile) => Math.round((mortgageValue(tile) * (1 + UNMORTGAGE_INTEREST)) / 10) * 10;
export const TRANSPORT_RENT = [0, 150, 350, 700]; // by number of transport tiles owned
export const UTILITY_MULT = [0, 40, 100]; // x dice total, by number of utilities owned
export const SELL_RATIO = 0.5; // value recovered when the bank liquidates assets

export const GROUPS = {
  west: { id: 'west', name: 'Starter Belt', te: 'స్టార్టర్ బెల్ట్', color: '#22a06b', ink: '#ffffff' },
  east: { id: 'east', name: 'Everyday Hyderabad', te: 'ఎవ్రీడే హైదరాబాద్', color: '#3b82f6', ink: '#ffffff' },
  core: { id: 'core', name: 'City Core', te: 'సిటీ కోర్', color: '#f08a24', ink: '#ffffff' },
  tech: { id: 'tech', name: 'IT Corridor', te: 'ఐటీ కారిడార్', color: '#8b5cf6', ink: '#ffffff' },
  prime: { id: 'prime', name: 'Prime West', te: 'ప్రైమ్ వెస్ట్', color: '#e5484d', ink: '#ffffff' },
  elite: { id: 'elite', name: 'Elite Hills', te: 'ఎలైట్ హిల్స్', color: '#f2b705', ink: '#2a1d00' },
};

// art keys: charminar | property | metro | boat | plane | bulb | water | tax | film | kismet | jail | auction
export const TILES = [
  { id: 0, type: 'start', corner: true, name: 'Charminar Chowk', te: 'చార్మినార్ చౌక్', short: 'START', art: 'charminar', emoji: '🕌',
    lore: 'Where every Hyderabad dream begins. Pass by and collect your salary.' },

  // ---- bottom row (left → right)
  { id: 1, type: 'property', name: 'Miyapur', te: 'మియాపూర్', short: 'Miyapur', group: 'west', price: 500, art: 'property', emoji: '🏠',
    lore: 'Last stop of the Metro Red Line. Rents are friendly and chai is cheaper.' },
  { id: 2, type: 'property', name: 'Bachupally', te: 'బాచుపల్లి', short: 'Bachupally', group: 'west', price: 500, art: 'property', emoji: '🏠',
    lore: 'Gated colonies, engineering colleges and a whole lot of pani puri.' },
  { id: 3, type: 'transport', name: 'Hyderabad Metro', te: 'హైదరాబాద్ మెట్రో', short: 'Metro', price: 1500, art: 'metro', emoji: '🚇',
    lore: 'Ride the Red, Blue and Green lines. Own more stations, earn more per ride.' },
  { id: 4, type: 'property', name: 'Nizampet', te: 'నిజాంపేట్', short: 'Nizampet', group: 'west', price: 600, art: 'property', emoji: '🏠',
    lore: 'A fast-growing neighbourhood where flats now outnumber trees.' },
  { id: 5, type: 'kismet', name: 'Biryani Kismet', te: 'బిర్యానీ కిస్మత్', short: 'Kismet', art: 'kismet', emoji: '🎴',
    lore: 'Draw a card. It could be a promotion, or a traffic challan.' },
  { id: 6, type: 'property', name: 'Kukatpally', te: 'కూకట్‌పల్లి', short: 'Kukatpally', group: 'east', price: 700, art: 'property', emoji: '🏠',
    lore: 'KPHB, the malls and endless auto-rickshaws. Everyone passes through.' },
  { id: 7, type: 'auction', corner: true, name: 'Laad Bazaar Auction', te: 'లాడ్ బజార్ వేలం', short: 'Auction', art: 'auction', emoji: '🔨',
    lore: 'Bangles, pearls and the loudest bargaining in town. A free property goes under the hammer!' },

  // ---- right column (bottom → top)
  { id: 8, type: 'property', name: 'Dilsukhnagar', te: 'దిల్‌సుఖ్‌నగర్', short: 'Dilsukhnagar', group: 'east', price: 700, art: 'property', emoji: '🏠',
    lore: 'Shopping lanes that never sleep and the famous bus-stand rush.' },
  { id: 9, type: 'utility', name: 'Electricity Board', te: 'విద్యుత్ బోర్డు', short: 'Electricity', price: 1200, art: 'bulb', emoji: '💡',
    lore: 'Power cut or not, the bill always arrives. Rent depends on your dice.' },
  { id: 10, type: 'property', name: 'LB Nagar', te: 'ఎల్‌బీ నగర్', short: 'LB Nagar', group: 'east', price: 800, art: 'property', emoji: '🏠',
    lore: 'The eastern gateway of the city: a giant flyover and a giant crowd.' },
  { id: 11, type: 'transport', name: 'Hussain Sagar Boating', te: 'హుస్సేన్ సాగర్ బోటింగ్', short: 'Hussain Sagar', price: 1500, art: 'boat', emoji: '⛵',
    lore: 'Sail past the giant Buddha standing in the middle of the lake.' },
  { id: 12, type: 'property', name: 'Ameerpet', te: 'అమీర్‌పేట్', short: 'Ameerpet', group: 'core', price: 1200, art: 'property', emoji: '🏠',
    lore: 'The coaching-centre capital. Software dreams are sold here by the hour.' },
  { id: 13, type: 'property', name: 'Begumpet', te: 'బేగంపేట్', short: 'Begumpet', group: 'core', price: 1500, art: 'property', emoji: '🏠',
    lore: 'Old airport, new money. Heritage meets high-rise.' },
  { id: 14, type: 'jail', corner: true, name: 'Chanchalguda Jail', te: 'చంచల్‌గూడ జైలు', short: 'Jail', art: 'jail', emoji: '🚔',
    lore: 'Just visiting, or serving time? Roll doubles or pay bail to get out.' },

  // ---- top row (right → left)
  { id: 15, type: 'property', name: 'Kondapur', te: 'కొండాపూర్', short: 'Kondapur', group: 'tech', price: 1800, art: 'property', emoji: '🏠',
    lore: 'IT parks, PG hostels and Sunday biryani queues.' },
  { id: 16, type: 'tax', name: 'GHMC Property Tax', te: 'జీహెచ్ఎంసీ ఆస్తి పన్ను', short: 'Property Tax', art: 'tax', emoji: '🧾',
    lore: 'The only thing as certain as Hyderabad traffic. Pay up.' },
  { id: 17, type: 'property', name: 'Gachibowli', te: 'గచ్చిబౌలి', short: 'Gachibowli', group: 'tech', price: 2200, art: 'property', emoji: '🏠',
    lore: 'Stadium, skyscrapers and the business school: the new Hyderabad.' },
  { id: 18, type: 'film', name: 'Ramoji Film City', te: 'రామోజీ ఫిల్మ్ సిటీ', short: 'Film City', art: 'film', emoji: '🎬',
    lore: 'Lights, camera, action! Land here for a cameo and collect your fee.' },
  { id: 19, type: 'property', name: 'Madhapur', te: 'మాదాపూర్', short: 'Madhapur', group: 'prime', price: 2800, art: 'property', emoji: '🏠',
    lore: 'The heart of HITEC City: cyber towers, café culture and hustle.' },
  { id: 20, type: 'utility', name: 'Water Board', te: 'వాటర్ బోర్డు', short: 'Water Board', price: 1200, art: 'water', emoji: '💧',
    lore: 'Krishna and Godavari water, delivered by pipe or by tanker. Rent depends on your dice.' },
  { id: 21, type: 'kismet', corner: true, name: 'Biryani Kismet', te: 'బిర్యానీ కిస్మత్', short: 'Kismet', art: 'kismet', emoji: '🎴',
    lore: 'Draw a card. Hyderabad luck is a plate of biryani: sometimes hot, sometimes cold.' },

  // ---- left column (top → bottom)
  { id: 22, type: 'property', name: 'Manikonda', te: 'మణికొండ', short: 'Manikonda', group: 'prime', price: 3000, art: 'property', emoji: '🏠',
    lore: 'Premium homes beside the Financial District, and the price tags show it.' },
  { id: 23, type: 'property', name: 'Kokapet', te: 'కోకాపేట్', short: 'Kokapet', group: 'prime', price: 3400, art: 'property', emoji: '🏠',
    lore: 'Record-breaking land auctions made this one of the hottest zones in India.' },
  { id: 24, type: 'transport', name: 'RGI Airport, Shamshabad', te: 'శంషాబాద్ విమానాశ్రయం', short: 'Airport', price: 1500, art: 'plane', emoji: '✈️',
    lore: 'Your gateway to the world, via Rajiv Gandhi International Airport.' },
  { id: 25, type: 'property', name: 'Financial District', te: 'ఫైనాన్షియల్ డిస్ట్రిక్ట్', short: 'Fin. District', group: 'elite', price: 3800, art: 'property', emoji: '🏠',
    lore: 'Glass towers and the global offices of Nanakramguda.' },
  { id: 26, type: 'property', name: 'Jubilee Hills', te: 'జూబ్లీ హిల్స్', short: 'Jubilee Hills', group: 'elite', price: 4500, art: 'property', emoji: '🏠',
    lore: 'The film stars\' neighbourhood. Tollywood lives here.' },
  { id: 27, type: 'property', name: 'Banjara Hills', te: 'బంజారా హిల్స్', short: 'Banjara Hills', group: 'elite', price: 5000, art: 'property', emoji: '🏠',
    lore: 'Hyderabad\'s most prestigious address: Road No. 12, boutiques and billionaires.' },
];

export const TILE_TYPES = ['start', 'property', 'transport', 'utility', 'kismet', 'tax', 'film', 'jail', 'auction'];

/** groupId -> array of tile ids */
export const GROUP_TILES = Object.fromEntries(
  Object.keys(GROUPS).map((g) => [g, TILES.filter((t) => t.group === g).map((t) => t.id)]),
);

export const isBuyable = (t) => t.type === 'property' || t.type === 'transport' || t.type === 'utility';

/** Rent of a property tile at a building level (before the full-set bonus). */
export function rentFor(tile, level = 0) {
  return Math.round((tile.price * RENT_RATE[level]) / 10) * 10;
}

/** Cost of building ONE more level on a property tile. */
export function upgradeCost(tile) {
  return Math.max(50, Math.round((tile.price * UPGRADE_RATIO) / 50) * 50);
}

/**
 * Cell on the 8x8 board grid (col,row both 0..7, row 0 = top) for a tile index.
 * Tile ids ascend CLOCKWISE from START at the bottom-left corner.
 */
export function tilePosition(i) {
  if (i <= 7) return { col: 0, row: 7 - i }; // left column, bottom -> top
  if (i <= 14) return { col: i - 7, row: 0 }; // top row, left -> right
  if (i <= 21) return { col: 7, row: i - 14 }; // right column, top -> bottom
  return { col: 7 - (i - 21), row: 7 }; // bottom row, right -> left
}
