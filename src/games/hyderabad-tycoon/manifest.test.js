// The manifest is read eagerly by src/games/registry.js, so it has to stay small and well-formed.
import { describe, expect, it, vi } from 'vitest';

// The art lives in other files (JSX); the manifest only needs something to point at.
vi.mock('@/components/art/hub/index.js', () => ({ TycoonCover: () => null, TycoonIcon: () => null }));

const { default: manifest } = await import('./manifest.js');

describe('hyderabad-tycoon manifest', () => {
  it('has the contract fields', () => {
    expect(manifest.id).toBe('hyderabad-tycoon');
    expect(manifest.name).toBe('Hyderabad Tycoon');
    expect(manifest.tagline).toBe('Buy Dilsukhnagar to Banjara Hills');
    expect(manifest.tagline.length).toBeLessThanOrEqual(48);
    expect(manifest.description).toMatch(/one die/i);
    expect(manifest.description).toMatch(/snatch/i);
    expect(manifest.category).toBe('board');
    expect(manifest.status).toBe('live');
    expect(manifest.players).toEqual({ min: 2, max: 6 });
    expect(manifest.modes).toEqual({ friends: true, open: false });
    expect(manifest.theme).toEqual(expect.objectContaining({ accent: expect.any(String), accent2: expect.any(String), bg: expect.any(String) }));
    expect(manifest.art.cover).toBeTypeOf('function');
    expect(manifest.art.icon).toBeTypeOf('function');
  });

  it('is an online-only game: no extras, no offline screens, no saved game, no voice settings', () => {
    expect(manifest.extras).toBeUndefined();
    expect(manifest.savedGame).toBeUndefined();
    expect(manifest.howToPlay).toBeUndefined();
    expect(Object.keys(manifest.loaders)).toEqual(['onlineGame']);
    expect(manifest.loaders.onlineGame).toBeTypeOf('function');
    expect(JSON.stringify(manifest.features)).not.toMatch(/voice|bots|story/i);
  });

  it('shows only the end-cash limit in the lobby, with a one-line summary', () => {
    expect(manifest.lobbySettings).toEqual(['goal']);
    expect(manifest.tableRules).toBe('Single die - 1 Snatch each - sealed bidding on a tie');
    for (const k of manifest.lobbySettings) expect(manifest.settings.some((f) => f.key === k)).toBe(true);
    expect(manifest.summarize({ goal: 70000, maxRounds: 50, startCash: 15000, dice: 'lucky' })).toBe('First to reach ₹70,000 wins');
  });
});
