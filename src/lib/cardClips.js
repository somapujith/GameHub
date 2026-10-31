// Recorded clips that belong to a Farman / Khazana card, played as a plain sound effect.
// The players who are PAID by the card hear the clip; the player who drew it does not.
//
// The audio file lives in public/sfx/ and is played with an <audio> element, so it follows the
// "sound effects" switch and the volume from the app settings. Never throws.

import { loadSettings } from './storage.js';

export const PAYTM_100_CLIP = '/sfx/paytm-karo-100.mp3';

/** Card id -> the clip that plays for the players who receive money from it. */
export const CARD_CLIPS = {
  paytm_100: PAYTM_100_CLIP,
};

/** Plays the clip of a card (if it has one) and returns true when playback was started. */
export function playCardClip(cardId) {
  const src = CARD_CLIPS[cardId];
  if (!src || typeof Audio === 'undefined') return false;
  try {
    const s = loadSettings();
    if (s.sfx === false) return false;
    const audio = new Audio(src);
    const volume = Number(s.volume);
    audio.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8;
    const started = audio.play();
    if (started && typeof started.catch === 'function') started.catch(() => {});
    return true;
  } catch {
    return false; // sound is never worth a crash
  }
}
