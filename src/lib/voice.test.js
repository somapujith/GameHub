import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fake browser speech engine: records every utterance handed to speak().
function installFakeBrowser(voices) {
  const spoken = [];
  class Utter {
    constructor(text) {
      this.text = text;
    }
  }
  const synth = {
    getVoices: () => voices,
    speak: (u) => spoken.push(u),
    cancel: () => {},
    addEventListener: () => {},
  };
  globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: Utter, localStorage: undefined };
  globalThis.fetch = async () => ({ ok: false });
  return spoken;
}

const LINE = { id: 'bk_t27_1', actor: 'balakrishna', te: 'బంజారా హిల్స్!', tn: 'Banjara Hills!', en: 'Banjara Hills!', mood: 'mass' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const load = async () => {
  vi.resetModules();
  return (await import('./voice.js')).voice;
};

describe('voice: Telugu voice or Tenglish fallback', () => {
  beforeEach(() => {
    delete globalThis.window;
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.fetch;
  });

  it('speaks the Telugu script when a Telugu voice is installed', async () => {
    const te = { lang: 'te-IN', name: 'Telugu' };
    const spoken = installFakeBrowser([{ lang: 'en-IN', name: 'English' }, te]);
    const voice = await load();
    expect(voice.ttsMode()).toBe('telugu');
    voice.speak(LINE, { priority: 'high' });
    await wait(150);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe(LINE.te);
    expect(spoken[0].lang).toBe('te-IN');
    expect(spoken[0].voice).toBe(te);
    voice.stop();
  });

  it('reads the Tenglish text with an English (India) voice when there is no Telugu voice', async () => {
    const enIN = { lang: 'en-IN', name: 'English India' };
    const spoken = installFakeBrowser([{ lang: 'en-US', name: 'US' }, enIN]);
    const voice = await load();
    expect(voice.ttsMode()).toBe('tenglish');
    expect(voice.ttsAvailable()).toBe(true);
    voice.speak(LINE, { priority: 'high' });
    await wait(150);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe(LINE.tn);
    expect(spoken[0].lang).toBe('en-IN');
    expect(spoken[0].voice).toBe(enIN);
    voice.stop();
  });

  it('falls back to any English voice, then to the browser default', async () => {
    const us = { lang: 'en-US', name: 'US' };
    let spoken = installFakeBrowser([us]);
    let voice = await load();
    voice.speak(LINE, { priority: 'high' });
    await wait(150);
    expect(spoken[0].text).toBe(LINE.tn);
    expect(spoken[0].voice).toBe(us);
    voice.stop();

    // An empty voice list is treated as "still loading": the player waits up to 1.5 s once, then speaks.
    spoken = installFakeBrowser([]);
    voice = await load();
    voice.speak(LINE, { priority: 'high' });
    await wait(1800);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe(LINE.tn);
    expect(spoken[0].lang).toBe('en-IN');
    expect(spoken[0].voice).toBeUndefined();
    voice.stop();
  });

  it('still emits the subtitle event for every line', async () => {
    installFakeBrowser([]);
    const voice = await load();
    const seen = [];
    voice.onLine((e) => seen.push(e.phase));
    voice.speak(LINE, { priority: 'high' });
    await wait(100);
    expect(seen).toContain('start');
    voice.stop();
    expect(seen).toContain('end');
  });
});
