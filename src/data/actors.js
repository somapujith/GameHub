// The 12 voice "actors" of Hyderabad Tycoon.
//
// IMPORTANT: this is stylised, fan-made flavour. There are no photos, likenesses or
// recordings of real people anywhere in the game: each actor is a monogram badge
// (initials on a colour) plus a text-to-speech pitch/rate so the voices sound different.
// The lines themselves are original; they only borrow the general on-screen "vibe".
//
// Fields
//   id        stable key used by settings, the manifest and the audio folder (public/voices/<id>/)
//   code      2-letter code used inside voice-line ids, e.g. "bk" -> bk_t27_1
//   name      full display name
//   short     short name for tight UI (chips, toggles)
//   color     main badge colour (bright enough for a dark indigo UI)
//   accent    secondary colour (monogram text / ring)
//   initials  monogram letters
//   tts       { pitch: 0.6..1.3, rate: 0.8..1.2 } passed to speechSynthesis

export const ACTORS = [
  { id: 'balakrishna', code: 'bk', name: 'Balakrishna', short: 'Balayya', color: '#ff7a1a', accent: '#ffe08a', initials: 'BK', tts: { pitch: 0.6, rate: 0.82 } },
  { id: 'chiranjeevi', code: 'ch', name: 'Chiranjeevi', short: 'Chiru', color: '#ffd23f', accent: '#3b2a00', initials: 'CH', tts: { pitch: 0.85, rate: 1.0 } },
  { id: 'pawankalyan', code: 'pk', name: 'Pawan Kalyan', short: 'Pawan', color: '#22d3ee', accent: '#06303a', initials: 'PK', tts: { pitch: 0.78, rate: 0.9 } },
  { id: 'maheshbabu', code: 'mb', name: 'Mahesh Babu', short: 'Mahesh', color: '#7aa2ff', accent: '#0d1f4d', initials: 'MB', tts: { pitch: 0.92, rate: 0.95 } },
  { id: 'alluarjun', code: 'aa', name: 'Allu Arjun', short: 'Bunny', color: '#d35cff', accent: '#fbe3ff', initials: 'AA', tts: { pitch: 1.0, rate: 1.1 } },
  { id: 'prabhas', code: 'pr', name: 'Prabhas', short: 'Prabhas', color: '#e6c8a0', accent: '#5a3513', initials: 'PR', tts: { pitch: 0.68, rate: 0.88 } },
  { id: 'ntr', code: 'nt', name: 'NTR', short: 'Tarak', color: '#ef233c', accent: '#ffd9de', initials: 'NT', tts: { pitch: 0.75, rate: 1.05 } },
  { id: 'ramcharan', code: 'rc', name: 'Ram Charan', short: 'Charan', color: '#9b8cff', accent: '#ece9ff', initials: 'RC', tts: { pitch: 0.95, rate: 1.05 } },
  { id: 'nagarjuna', code: 'ng', name: 'Nagarjuna', short: 'King', color: '#2dd4bf', accent: '#04332d', initials: 'NG', tts: { pitch: 0.88, rate: 0.92 } },
  { id: 'venkatesh', code: 'vk', name: 'Venkatesh', short: 'Venky', color: '#4ade80', accent: '#073b1a', initials: 'VK', tts: { pitch: 1.05, rate: 1.0 } },
  { id: 'raviteja', code: 'rt', name: 'Ravi Teja', short: 'Raviteja', color: '#b4f03c', accent: '#263d00', initials: 'RT', tts: { pitch: 1.12, rate: 1.2 } },
  { id: 'brahmanandam', code: 'bm', name: 'Brahmanandam', short: 'Brahmi', color: '#ff8fd0', accent: '#fff0a0', initials: 'BM', tts: { pitch: 1.3, rate: 1.1 } },
];

const BY_ID = new Map(ACTORS.map((a) => [a.id, a]));

/** Look an actor up by id. Returns undefined for an unknown id. */
export const actorById = (id) => BY_ID.get(id);

// One-line style notes for human maintainers writing new lines. Not used by the game UI.
export const ACTOR_STYLE = {
  balakrishna: 'Thunderous roaring mass: deep, slow, grand declarations. Best on Banjara/Jubilee Hills, Charminar, Jail, Film City.',
  chiranjeevi: 'Megastar swagger and dance: "mega" entries, steps, showmanship, a warm grin.',
  pawankalyan: 'Cool understated "Power Star" attitude: few words, calm, a quiet punch. Power puns are fine.',
  maheshbabu: 'Suave and calm, a little English mixed in: clean, classy, smart-investor tone.',
  alluarjun: 'Stylish swagger: fashion, entries, "my style" confidence, a playful smirk.',
  prabhas: 'Humble gentle giant: soft-spoken, big-hearted, grand scale (Golconda-sized courage).',
  ntr: 'Fiery, powerful diction: roars, tigers, oceans, sharp rhythmic punch.',
  ramcharan: 'Polished mega-energy: upbeat, athletic, focused, team-captain vibe.',
  nagarjuna: 'The cool romantic King: smooth, relaxed, charming, evening-breeze mood.',
  venkatesh: 'Warm family man: homely humour, chai, festivals, gentle advice with a smile.',
  raviteja: 'Fast, funny, mass-maharaja energy: quick patter, jokes, hustle, high spirits.',
  brahmanandam: 'Exaggerated comedy: panic over bills, taxes, jail and utilities; squeaky and dramatic.',
};
