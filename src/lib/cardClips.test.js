import { afterEach, describe, expect, it, vi } from 'vitest';

const settings = { sfx: true, volume: 0.5 };
vi.mock('./storage.js', () => ({ loadSettings: () => settings }));

const { CARD_CLIPS, PAYTM_100_CLIP, playCardClip } = await import('./cardClips.js');

afterEach(() => {
  vi.unstubAllGlobals();
  settings.sfx = true;
});

function stubAudio({ rejects = false } = {}) {
  const made = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      made.push(this);
    }

    play() {
      this.played = true;
      return rejects ? Promise.reject(new Error('blocked')) : Promise.resolve();
    }
  }
  vi.stubGlobal('Audio', FakeAudio);
  return made;
}

describe('playCardClip', () => {
  it('plays the Paytm clip as a plain sound effect at the saved volume', () => {
    const made = stubAudio();
    expect(CARD_CLIPS.paytm_100).toBe('/sfx/paytm-karo-100.mp3');
    expect(playCardClip('paytm_100')).toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ src: PAYTM_100_CLIP, volume: 0.5, played: true });
  });

  it('stays silent for other cards and when sound effects are off', () => {
    const made = stubAudio();
    expect(playCardClip('biryani_promise')).toBe(false);
    settings.sfx = false;
    expect(playCardClip('paytm_100')).toBe(false);
    expect(made).toHaveLength(0);
  });

  it('never throws when the browser blocks playback or has no Audio', async () => {
    stubAudio({ rejects: true });
    expect(playCardClip('paytm_100')).toBe(true);
    await Promise.resolve();
    vi.stubGlobal('Audio', undefined);
    expect(playCardClip('paytm_100')).toBe(false);
  });
});
