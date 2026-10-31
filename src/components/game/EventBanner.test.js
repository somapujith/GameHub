import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GROUPS } from '@shared/board.js';
import { createGame, getOptions } from '@shared/index.js';
import EventBanner, { EVENT_EMOJI, eventInfo } from './EventBanner.jsx';
import ControlPanel from './ControlPanel.jsx';

const html = (node) => renderToString(node).replaceAll('<!-- -->', '');
const banner = (event) => html(createElement(EventBanner, { session: { view: { event } } }));

const EVENTS = {
  monsoon: { id: 'monsoon', title: 'Monsoon rains', text: 'Pink rents are halved this round.', kind: 'group', group: 'pink', mult: 0.5, round: 5 },
  ipl: { id: 'ipl', title: 'IPL fever', text: 'Orange rents double this round.', kind: 'group', group: 'orange', mult: 2, round: 10 },
  metro_strike: { id: 'metro_strike', title: 'Metro strike', text: 'Stations pay no rent this round.', kind: 'transport', round: 15 },
  tax_holiday: { id: 'tax_holiday', title: 'Tax holiday', text: 'Property tax and the challan cost nothing.', kind: 'tax', round: 20 },
  bonalu: { id: 'bonalu', title: 'Bonalu', text: 'Everyone gets a festival gift.', kind: 'gift', amount: 500, round: 25 },
};

describe('<EventBanner>', () => {
  it('keeps an empty live region and no strip while there is no event', () => {
    const out = banner(null);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).not.toContain('cp-event__title');
    expect(banner(undefined)).not.toContain('cp-event__title');
  });

  for (const [id, ev] of Object.entries(EVENTS)) {
    it(`shows ${id} with its emoji, title and one-liner`, () => {
      const out = banner(ev);
      expect(out).toContain(`data-event="${id}"`);
      expect(out).toContain(EVENT_EMOJI[id]);
      expect(out).toContain(`>${ev.title}<`);
      expect(out).toContain(ev.text);
      expect(out).toContain('role="status"');
    });
  }

  it('has a distinct emoji per event id', () => {
    expect(new Set(Object.values(EVENT_EMOJI)).size).toBe(5);
    expect(Object.keys(EVENT_EMOJI).sort()).toEqual(Object.keys(EVENTS).sort());
  });

  it('adds a colour chip and the multiplier for group events only', () => {
    const rain = banner(EVENTS.monsoon);
    expect(rain).toContain('cp-event__chip');
    expect(rain).toContain(GROUPS.pink.color);
    expect(rain).toContain('x0.5');
    const ipl = banner(EVENTS.ipl);
    expect(ipl).toContain(GROUPS.orange.color);
    expect(ipl).toContain('x2');
    for (const id of ['metro_strike', 'tax_holiday', 'bonalu']) expect(banner(EVENTS[id])).not.toContain('cp-event__chip');
  });

  it('keys the strip by event id + round so a new event is announced once, and re-renders are not', () => {
    expect(eventInfo(EVENTS.ipl).key).toBe('ipl:10');
    expect(eventInfo({ ...EVENTS.ipl, round: 15 }).key).not.toBe(eventInfo(EVENTS.ipl).key);
    expect(eventInfo(EVENTS.ipl).key).toBe(eventInfo({ ...EVENTS.ipl }).key);
    expect(eventInfo(null)).toBeNull();
  });

  it('keeps the one-liner in the DOM (hidden visually, not removed) so the compact layout still announces it', () => {
    const out = banner(EVENTS.tax_holiday);
    expect(out).toContain('cp-event__text');
    expect(out).toContain('title="Tax holiday. Property tax and the challan cost nothing."');
  });

  it('sits in the control panel above the tabs while view.event is set, and is gone without one', () => {
    const s = createGame({ players: [{ id: 'me', name: 'Nithin' }, { id: 'rav', name: 'Ravi' }], seed: 7 });
    s.event = EVENTS.monsoon;
    const session = {
      mode: 'online', me: 'me', view: s, busy: false, rolling: false, result: null, options: getOptions(s, 'me'), log: [], dispatch: () => {},
      display: { players: s.players, owners: s.owners, levels: s.levels, mortgaged: s.mortgaged, turn: s.turn, round: s.round, dice: s.dice, phase: s.phase, cfg: s.cfg },
    };
    const out = html(createElement(ControlPanel, { session, onOpenTile: () => {}, onOpenTrade: () => {} }));
    expect(out.indexOf('Monsoon rains')).toBeGreaterThan(-1);
    expect(out.indexOf('Monsoon rains')).toBeLessThan(out.indexOf('role="tablist"'));
    delete session.view.event;
    expect(html(createElement(ControlPanel, { session }))).not.toContain('cp-event__title');
  });
});
