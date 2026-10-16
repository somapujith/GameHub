import { describe, expect, it } from 'vitest';
import { CATEGORIES, GAMES, comingSoonGames, featuredGame, getCategory, getGame, liveGames } from './registry.js';

describe('game registry', () => {
  it('lists the live game first, then the four teasers, with unique ids', () => {
    const ids = GAMES.map((g) => g.id);
    expect(ids[0]).toBe('hyderabad-tycoon');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['ludo-lanes', 'carrom-club', 'tambola-night', 'word-rush']));
  });

  it('getGame returns the manifest or null for unknown ids', () => {
    expect(getGame('hyderabad-tycoon')?.name).toBe('Hyderabad Tycoon');
    expect(getGame('nope')).toBeNull();
    expect(getGame(undefined)).toBeNull();
    expect(getGame('')).toBeNull();
  });

  it('splits live and coming-soon games without overlap', () => {
    const live = liveGames();
    const soon = comingSoonGames();
    expect(live.length + soon.length).toBe(GAMES.length);
    expect(live.every((g) => g.status !== 'coming_soon')).toBe(true);
    expect(soon.every((g) => g.status === 'coming_soon')).toBe(true);
    expect(soon).toHaveLength(4);
  });

  it('every game uses a known category and has the required teaser fields', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    expect([...cats]).toEqual(['board', 'card', 'arcade', 'social', 'word', 'sports']);
    for (const g of GAMES) {
      expect(cats.has(g.category)).toBe(true);
      expect(typeof g.name).toBe('string');
      expect(typeof g.tagline).toBe('string');
      expect(g.tagline.length).toBeLessThanOrEqual(48);
      expect(g.players.min).toBeLessThanOrEqual(g.players.max);
      expect(g.theme.accent).toMatch(/^#/);
      expect(['function', 'object']).toContain(typeof g.art.cover); // plain or memo() component
      expect(getCategory(g.category)).not.toBeNull();
    }
  });

  it('coming-soon teasers carry no loaders', () => {
    for (const g of comingSoonGames()) expect(g.loaders).toBeUndefined();
  });

  it('featuredGame is a live game', () => {
    const f = featuredGame();
    expect(f).not.toBeNull();
    expect(f.status).not.toBe('coming_soon');
    expect(f.id).toBe('hyderabad-tycoon');
  });
});
