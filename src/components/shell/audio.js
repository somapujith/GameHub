import * as sfxMod from '@/lib/sfx.js';
import * as voiceMod from '@/lib/voice.js';
import * as linesMod from '@/lib/voiceLines.js';

/* Null-safe, never-throwing wrappers around the sound libs (they may be absent or blocked). */
const sfx = () => sfxMod.sfx ?? sfxMod.default;
const voice = () => voiceMod.voice ?? voiceMod.default;

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
    voice()?.init?.();
  } catch {
    /* ignore */
  }
}

export function pickLine(trigger, opts) {
  try {
    return linesMod.pickLine?.(trigger, opts) ?? null;
  } catch {
    return null;
  }
}

export async function speak(line, opts) {
  try {
    if (line) await voice()?.speak?.(line, opts);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  try {
    voice()?.stop?.();
  } catch {
    /* ignore */
  }
}

/** Subscribe to spoken lines; returns an unsubscribe function (always callable). */
export function onVoiceLine(cb) {
  try {
    const off = voice()?.onLine?.(cb);
    return typeof off === 'function' ? off : () => {};
  } catch {
    return () => {};
  }
}

export function ttsAvailable() {
  try {
    return !!voice()?.ttsAvailable?.();
  } catch {
    return false;
  }
}
