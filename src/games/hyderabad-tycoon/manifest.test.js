// The manifest is read eagerly by src/games/registry.js, so it has to stay small and well-formed.
import { afterEach, describe, expect, it, vi } from 'vitest';

// The art lives in other files (JSX); the manifest only needs something to point at.
vi.mock('@/components/art/hub/index.js', () => ({ TycoonCover: () => null, TycoonIcon: () => null }));

const { default: manifest } = await import('./manifest.js');
const { saveGame, clearGame } = await import('@/lib/storage.js');

afterEach(() => clearGame());

describe('hyderabad-tycoon manifest', () => {
  it('has the contract fields', () => {
    expect(manifest.id).toBe('hyderabad-tycoon');
    expect(manifest.name).toBe('Hyderabad Tycoon');
    expect(manifest.tagline.length).toBeLessThanOrEqual(48);
    expect(manifest.category).toBe('board');
    expect(manifest.status).toBe('live');
    expect(manifest.players).toEqual({ min: 2, max: 6 });
    expect(manifest.modes).toEqual({ bots: true, friends: true, open: true });
    expect(manifest.theme).toEqual(expect.objectContaining({ accent: expect.any(String), accent2: expect.any(String), bg: expect.any(String) }));
    expect(manifest.art.cover).toBeTypeOf('function');
    expect(manifest.art.icon).toBeTypeOf('function');
  });

  it('has 3-6 how-to-play steps with a title and body', () => {
    expect(manifest.howToPlay.length).toBeGreaterThanOrEqual(3);
    expect(manifest.howToPlay.length).toBeLessThanOrEqual(6);
    for (const s of manifest.howToPlay) {
      expect(s.title).toBeTruthy();
      expect(s.body).toBeTruthy();
    }
  });

  it('registers the story and campaign extras and all four loaders', () => {
    expect(manifest.extras.map((e) => e.path)).toEqual(['story', 'campaign']);
    for (const e of manifest.extras) expect(e.loader).toBeTypeOf('function');
    for (const k of ['offlineSetup', 'offlineGame', 'onlineGame', 'settingsPanel']) expect(manifest.loaders[k]).toBeTypeOf('function');
  });

  it('summarize() gives the one-line lobby summary', () => {
    expect(manifest.summarize({ goal: 70000, maxRounds: 50, startCash: 15000, dice: 'lucky' })).toBe(
      'Target ₹70,000 · 50 rounds · Start ₹15,000 · Lucky dice',
    );
  });

  it('savedGame() is null without a save and describes one when present', () => {
    expect(manifest.savedGame()).toBeNull();
    const state = { phase: 'play', round: 7, owners: [], players: [{ id: 'me', cash: 9000, isBot: false }, { id: 'bot1', cash: 1, isBot: true }] };
    saveGame(state, { me: 'me', round: 7, worth: 41200 });
    expect(manifest.savedGame()).toEqual({
      title: 'Hyderabad Tycoon',
      subtitle: 'Round 7 · ₹41,200 net worth',
      to: '/play/hyderabad-tycoon/offline',
    });
    // a save written by an older build has no worth: show the cash instead
    saveGame(state, { me: 'me', round: 7 });
    expect(manifest.savedGame().subtitle).toBe('Round 7 · ₹9,000 cash');
  });
});
