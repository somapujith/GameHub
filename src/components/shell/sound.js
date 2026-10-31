import * as sfxMod from '@/lib/sfx.js';

/* Null-safe, never-throwing wrappers around the sound-effects lib (it may be absent or blocked). */
const sfx = () => sfxMod.sfx ?? sfxMod.default;

export function playSfx(name) {
  try {
    sfx()?.play?.(name);
  } catch {
    /* audio is optional */
  }
}

export function unlockAudio() {
  try {
    sfx()?.unlock?.();
  } catch {
    /* ignore */
  }
}
