// Recorded clips that belong to a Kismet card. The players who are PAID by the card hear the clip;
// the player who drew it does not (they get the normal "bad card" line instead).
//
// The audio lives in public/voices/sfx/ and is registered in public/voices/manifest.json under the
// line id, so voice.speak() plays the file and shows the subtitle. If the file ever fails to load,
// voice.js falls back to reading the text aloud.

export const PAYTM_100_LINE = {
  id: 'sfx_paytm_100',
  actor: 'kismet',
  // Shown in the subtitle toast instead of an actor monogram.
  badge: { name: 'Kismet', short: 'Kismet', initials: '₹', color: '#2ec4b6', accent: '#06202a' },
  te: 'పేటీఎం కరో! ₹100',
  tn: 'Paytm karo! 100 rupees',
  en: 'Paytm karo: ₹100 to everyone!',
  mood: 'comedy',
};

/** Kismet card id -> the clip that plays for the players who receive money from it. */
export const CARD_CLIPS = {
  paytm_100: PAYTM_100_LINE,
};
