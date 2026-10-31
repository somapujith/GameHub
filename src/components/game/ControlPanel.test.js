import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame, getOptions } from '@shared/index.js';
import ControlPanel, { TradePane, landedInfo } from './ControlPanel.jsx';
import { buildActionSpec, shortcutAction } from './ActionBar.jsx';
import ActionBar from './ActionBar.jsx';
import MyProperties from './MyProperties.jsx';
import { LogList } from './LogPanel.jsx';
import { recordSnatch, snatchInfo, useSnatchClock } from './snatch.js';

/** renderToString separates adjacent text nodes with comment markers; drop them so text assertions read naturally. */
const html = (node) => renderToString(node).replaceAll('<!-- -->', '');

const mkState = () => createGame({ players: [{ id: 'me', name: 'Nithin' }, { id: 'rav', name: 'Ravi' }], seed: 7 });

/** A session shaped like useOnlineGame's: display mirrors view, options come from the engine. */
function mkSession(state, extra = {}) {
  const me = extra.me || 'me';
  const display = {
    players: state.players, owners: state.owners, levels: state.levels, mortgaged: state.mortgaged,
    turn: state.turn, round: state.round, dice: state.dice, phase: state.phase, cfg: state.cfg,
  };
  return {
    mode: 'online', me, view: state, display, busy: false, rolling: false, result: null,
    options: getOptions(state, me), log: [], dispatch: () => {}, ...extra,
  };
}

/** Ravi has just bought tile 1 (Dilsukhnagar, 600); `eligible` may snatch it. Options are set by hand: the engine is not under test. */
function mkSnatch({ me = 'me', eligible = ['me'], claims = [], busy = false, snatched, ms = 3000 } = {}) {
  const s = mkState();
  s.owners[1] = 'rav';
  s.turn = 1;
  s.phase = 'snatch';
  s.turnCount = 4;
  s.pending = { type: 'snatch', tile: 1, buyer: 'rav', price: 600, eligible, claims, ms, returnPhase: 'manage' };
  const canPress = eligible.includes(me) && !claims.includes(me);
  return mkSession(s, { me, busy, options: { snatch: canPress ? { tile: 1, ms } : null, snatched } });
}

describe('buildActionSpec', () => {
  it('offers Roll on my turn, with End turn nowhere yet', () => {
    const spec = buildActionSpec(mkSession(mkState()));
    expect(spec.kind).toBe('roll');
    expect(spec.primary.action).toEqual({ type: 'ROLL' });
    expect(spec.secondaries).toEqual([]);
  });

  it('shows a waiting status while another player is on turn', () => {
    const spec = buildActionSpec(mkSession(mkState(), { me: 'rav' }));
    expect(spec.primary).toBeNull();
    expect(spec.label).toBe('Waiting for Nithin');
  });

  it('offers Buy with the tile name and price, and Skip beside it', () => {
    const s = mkState();
    s.phase = 'buy';
    s.players[0].pos = 1;
    s.pending = { type: 'buy', tile: 1, price: 600 };
    const spec = buildActionSpec(mkSession(s));
    expect(spec.kind).toBe('buy');
    expect(spec.primary.label).toBe('Buy Dilsukhnagar');
    expect(spec.primary.amount).toBe('₹600');
    expect(spec.secondaries.map((x) => x.key)).toContain('skip');
  });

  it('describes a six as rolling again, never as doubles', () => {
    const s = mkState();
    s.phase = 'manage';
    s.extraRoll = true;
    const spec = buildActionSpec(mkSession(s));
    expect(spec.primary.label).toBe('Roll again');
    expect(spec.sr).toBe('Six! Roll again');
  });
});

/** A buy-phase session; `shield` mirrors options.shield (the engine is not under test). */
function mkBuy({ shield = false } = {}) {
  const s = mkState();
  s.phase = 'buy';
  s.players[0].pos = 1;
  s.pending = { type: 'buy', tile: 1, price: 600 };
  const session = mkSession(s);
  session.options = { ...session.options, shield: shield || undefined };
  return session;
}

/** Depth-first find of the element whose className includes `cls` in an unrendered tree (ActionBar has no hooks). */
function findByClass(node, cls) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findByClass(n, cls);
      if (f) return f;
    }
    return null;
  }
  if (typeof node.props?.className === 'string' && node.props.className.includes(cls)) return node;
  return findByClass(node.props?.children, cls);
}

describe('Buy + Shield', () => {
  it('is absent without options.shield', () => {
    const session = mkBuy();
    const spec = buildActionSpec(session);
    expect(spec.secondaries.map((x) => x.key)).toEqual(['skip']);
    const out = html(createElement(ActionBar, { spec, fire: () => () => {}, session }));
    expect(out).not.toContain('Buy + Shield');
  });

  it('appears beside Buy with options.shield, and Buy stays the primary', () => {
    const session = mkBuy({ shield: true });
    const spec = buildActionSpec(session);
    expect(spec.primary.action).toEqual({ type: 'BUY' });
    const shield = spec.secondaries.find((x) => x.key === 'shield');
    expect(shield).toMatchObject({ label: 'Buy + Shield', sub: '1 token - nobody can snatch it', icon: 'shield', action: { type: 'BUY', shield: true } });
    expect(shield.kbd).toBeUndefined();
    const out = html(createElement(ActionBar, { spec, fire: () => () => {}, session }));
    expect(out).toContain('Buy + Shield');
    expect(out).toContain('1 token - nobody can snatch it');
    expect(out).toContain('cp-wide is-shield');
    expect(out).toContain('>Skip<');
    expect(spec.sr).toContain('shield');
  });

  it('dispatches { type: BUY, shield: true } when pressed', () => {
    const session = mkBuy({ shield: true });
    const spec = buildActionSpec(session);
    const fired = [];
    const tree = ActionBar({ spec, fire: (a) => () => fired.push(a), session });
    findByClass(tree, 'is-shield').props.onClick();
    expect(fired).toEqual([{ type: 'BUY', shield: true }]);
    findByClass(tree, 'cp-primary').props.onClick();
    expect(fired[1]).toEqual({ type: 'BUY' });
  });

  it('is not fired by Space or Enter', () => {
    const spec = buildActionSpec(mkBuy({ shield: true }));
    expect(shortcutAction(spec, { key: ' ', target: null })).toBeNull();
    expect(shortcutAction(spec, { key: 'Enter', target: null })).toBeNull();
  });

  it('is not offered when the buyer cannot afford the tile (Skip becomes primary)', () => {
    const session = mkBuy({ shield: true });
    session.view.players[0].cash = 100;
    session.options = { ...session.options, buy: false };
    const spec = buildActionSpec(session);
    expect(spec.secondaries.some((x) => x.key === 'shield')).toBe(false);
  });
});

describe('trap hint', () => {
  const withTrap = (trap) => {
    const session = mkSession(mkState());
    session.options = { ...session.options, trap };
    return session;
  };

  it('shows under Roll while options.trap is true and is gone when it is false', () => {
    const on = buildActionSpec(withTrap(true));
    expect(on.hint).toMatchObject({ key: 'trap', text: 'Tap any tile to set your trap' });
    const outOn = html(createElement(ActionBar, { spec: on, fire: () => () => {}, session: withTrap(true) }));
    expect(outOn).toContain('cp-hint is-trap');
    expect(outOn).toContain('Tap any tile to set your trap');
    expect(outOn).toContain('Set a trap');
    expect(outOn.indexOf('cp-primary')).toBeLessThan(outOn.indexOf('cp-hint'));
    const off = buildActionSpec(withTrap(false));
    expect(off.hint).toBeUndefined();
    expect(html(createElement(ActionBar, { spec: off, fire: () => () => {}, session: withTrap(false) }))).not.toContain('cp-hint');
  });

  it('keeps Roll the primary and Space / Enter firing only Roll', () => {
    const spec = buildActionSpec(withTrap(true));
    expect(spec.kind).toBe('roll');
    expect(spec.primary.action).toEqual({ type: 'ROLL' });
    expect(spec.secondaries.some((x) => x.action?.type === 'PLACE_TRAP')).toBe(false);
    expect(shortcutAction(spec, { key: ' ', target: null })).toEqual({ type: 'ROLL' });
    expect(shortcutAction(spec, { key: 'Enter', target: null })).toEqual({ type: 'ROLL' });
  });

  it('has no hint outside the roll state', () => {
    expect(buildActionSpec(mkBuy({ shield: true })).hint).toBeUndefined();
  });
});

describe('Space / Enter shortcut', () => {
  const key = (k = ' ', extra = {}) => ({ key: k, target: null, ...extra });
  const spec = (session) => buildActionSpec(session);

  it('fires Roll and End turn, which advertise a kbd', () => {
    expect(shortcutAction(spec(mkSession(mkState())), key())).toEqual({ type: 'ROLL' });
    expect(shortcutAction(spec(mkSession(mkState())), key('Enter'))).toEqual({ type: 'ROLL' });
    const s = mkState();
    s.phase = 'manage';
    expect(shortcutAction(spec(mkSession(s)), key())).toEqual({ type: 'END_TURN' });
  });

  it('never fires Buy or Skip', () => {
    const s = mkState();
    s.phase = 'buy';
    s.pending = { type: 'buy', tile: 1, price: 600 };
    const buy = spec(mkSession(s));
    expect(buy.primary.action).toEqual({ type: 'BUY' });
    expect(shortcutAction(buy, key())).toBeNull();
    // too poor to buy: the primary becomes Skip, which must not be a keypress either
    s.players[0].cash = 100;
    const skip = spec(mkSession(s));
    expect(skip.primary.action).toEqual({ type: 'SKIP_BUY' });
    expect(shortcutAction(skip, key())).toBeNull();
  });

  it('fires Snatch for an eligible player', () => {
    expect(shortcutAction(spec(mkSnatch()), key())).toEqual({ type: 'SNATCH' });
  });

  it('stands down for sheets, typing, modifiers, repeats and other keys', () => {
    const roll = spec(mkSession(mkState()));
    expect(shortcutAction(roll, key(), true)).toBeNull();
    expect(shortcutAction(roll, key(' ', { target: { tagName: 'BUTTON' } }))).toBeNull();
    expect(shortcutAction(roll, key(' ', { target: { tagName: 'INPUT' } }))).toBeNull();
    expect(shortcutAction(roll, key(' ', { ctrlKey: true }))).toBeNull();
    expect(shortcutAction(roll, key(' ', { repeat: true }))).toBeNull();
    expect(shortcutAction(roll, key('a'))).toBeNull();
    expect(shortcutAction(null, key())).toBeNull();
  });
});

describe('snatch window', () => {
  it('reads the window from the latest state, even while the presenter is busy', () => {
    const session = mkSnatch({ busy: true });
    const sn = snatchInfo(session);
    expect(sn).toMatchObject({ tileId: 1, price: 600, buyerName: 'Ravi', eligible: true, pressed: false, canPress: true, ms: 3000 });
    expect(buildActionSpec(session).kind).toBe('snatch'); // not 'busy'
  });

  it('is eligible from pending.eligible even when options are blanked', () => {
    const session = mkSnatch();
    session.options = { snatch: null, snatched: false };
    expect(snatchInfo(session).canPress).toBe(true);
  });

  it('gives an eligible player a big SNATCH! primary that is free', () => {
    const spec = buildActionSpec(mkSnatch());
    expect(spec.kind).toBe('snatch');
    expect(spec.primary).toMatchObject({ key: 'snatch', label: 'SNATCH!', kbd: 'Space', action: { type: 'SNATCH' } });
    expect(spec.primary.sub).toBe('free - Ravi still pays');
    expect(spec.secondaries).toEqual([]);
  });

  it('shows "Snatch locked in" with no button after pressing (from claims or options.snatched)', () => {
    for (const session of [mkSnatch({ claims: ['me'] }), mkSnatch({ snatched: true })]) {
      const spec = buildActionSpec(session);
      expect(spec.primary).toBeNull();
      expect(spec.label).toBe('Snatch locked in');
      expect(snatchInfo(session)).toMatchObject({ pressed: true, canPress: false });
    }
  });

  it('shows the buyer and everyone without a token a plain status, no button', () => {
    const watcher = buildActionSpec(mkSnatch({ eligible: [] }));
    expect(watcher.primary).toBeNull();
    expect(watcher.label).toBe('Ravi bought Dilsukhnagar');
    expect(watcher.sub).toBe('Snatch window…');
    const buyer = buildActionSpec(mkSnatch({ me: 'rav', eligible: ['me'] }));
    expect(buyer.primary).toBeNull();
    expect(buyer.label).toBe('You bought Dilsukhnagar');
  });

  it('counts down from when the window first showed up', () => {
    const session = mkSnatch();
    const Probe = () => {
      const c = useSnatchClock(session);
      return createElement('p', null, c ? `${c.seconds}s ${Math.round(c.fraction * 100)}%` : 'none');
    };
    expect(html(createElement(Probe))).toContain('3s 100%');
    expect(html(createElement(Probe))).toContain('3s'); // a re-render of the same window does not restart it
    recordSnatch(null);
    const none = mkSession(mkState());
    const Idle = () => createElement('p', null, String(useSnatchClock(none)));
    expect(html(createElement(Idle))).toContain('null');
  });

  it('renders SNATCH! with its seconds and a drain bar, and locks the other tabs', () => {
    const session = mkSnatch();
    const spec = buildActionSpec(session);
    const out = html(createElement(ActionBar, { spec, fire: () => () => {}, session }));
    expect(out).toContain('cp-primary is-snatch');
    expect(out).toContain('SNATCH!');
    expect(out).toContain('3s');
    expect(out).toContain('cp-meter');
    expect(out).toContain('free - Ravi still pays');
  });

  it('puts the contested tile and price on the Buy tab and disables building and trading', () => {
    const session = mkSnatch();
    session.view.owners[3] = 'me';
    session.display.owners = session.view.owners;
    const panel = html(createElement(ControlPanel, { session, onOpenTile: () => {}, onOpenTrade: () => {} }));
    expect(panel).toContain('Dilsukhnagar');
    expect(panel).toContain('Ravi paid ₹600. Snatch it free!');
    expect(panel).toContain('data-kind="snatch"');
    const manage = html(createElement(MyProperties, { session, onOpenTile: () => {} }));
    expect(manage).toContain('Snatch window open');
    // even if the engine still said trades were fine, the Trade tab holds still until the window closes
    session.options = { ...session.options, trade: { canOffer: true } };
    const trade = html(createElement(TradePane, { session, onOpenTrade: () => {}, snatching: true }));
    expect(trade).toMatch(/<button[^>]*disabled[^>]*>.*Propose a trade/);
    expect(trade).toContain('Trading waits until the snatch window closes.');
  });
});

describe('landedInfo', () => {
  const state = () => {
    const s = mkState();
    return { ...s, players: s.players.map((p) => ({ ...p })) };
  };
  const at = (s, pos) => ({ ...s.players[0], pos });

  it('says what an unowned property costs', () => {
    const s = state();
    expect(landedInfo(s, at(s, 1), 'me').detail).toBe('For sale ₹600');
  });

  it('shows rent for a rival-owned property and "Yours" for mine', () => {
    const s = state();
    s.owners[1] = 'rav';
    const rival = landedInfo(s, at(s, 1), 'me');
    expect(rival.tone).toBe('rent');
    expect(rival.detail).toMatch(/^Owned by Ravi · rent ₹\d/);
    s.owners[1] = 'me';
    expect(landedInfo(s, at(s, 1), 'me').tone).toBe('mine');
  });

  it('describes mortgaged, tax, card and corner tiles', () => {
    const s = state();
    s.owners[1] = 'rav';
    s.mortgaged[1] = true;
    expect(landedInfo(s, at(s, 1), 'me').detail).toBe('Owned by Ravi · mortgaged, no rent');
    expect(landedInfo(s, at(s, 4), 'me').detail).toContain('₹2,000');
    expect(landedInfo(s, at(s, 2), 'me').detail).toMatch(/^Draw a/);
    expect(landedInfo(s, at(s, 10), 'me').detail).toBe('Just visiting');
    expect(landedInfo(s, { ...at(s, 10), jailTurns: 1 }, 'me').detail).toBe('In jail');
    expect(landedInfo(s, at(s, 0), 'me').detail).toMatch(/^Collect ₹/);
  });
});

describe('<ControlPanel>', () => {
  it('renders the three tabs, the log, the landed line and the Roll button', () => {
    const s = mkState();
    const session = mkSession(s, { log: [{ id: 1, text: 'Nithin rolled 4', tone: 'info' }] });
    const out = html(createElement(ControlPanel, { session, onOpenTile: () => {}, onOpenTrade: () => {} }));
    for (const label of ['Buy', 'Manage', 'Trade']) expect(out).toContain(`>${label}<`);
    expect(out).toContain('role="tablist"');
    expect(out).toContain('Nithin rolled 4');
    expect(out).toContain('Rajiv Gandhi Airport'); // the START tile the first player stands on
    expect(out).toContain('cp-primary is-roll');
    expect(out).toContain('>Roll<');
    expect((out.match(/class="cp-cube"/g) || []).length).toBe(1); // one die
  });

  it('shows the waiting state instead of a button when it is not my turn', () => {
    const session = mkSession(mkState(), { me: 'rav' });
    const out = html(createElement(ControlPanel, { session }));
    expect(out).toContain('Waiting for Nithin');
    expect(out).toContain('is-wait');
  });

  it('keeps the log empty-state friendly', () => {
    const out = html(createElement(LogList, { log: [], variant: 'mono' }));
    expect(out).toContain('Your story starts with a roll.');
  });
});

describe('<MyProperties> (Manage tab)', () => {
  it('lists a full colour set with Build and Mortgage actions gated by session.options', () => {
    const s = mkState();
    s.owners[1] = 'me';
    s.owners[3] = 'me';
    const session = mkSession(s);
    const out = html(createElement(MyProperties, { session, onOpenTile: () => {} }));
    expect(out).toContain('2/2 Brown');
    expect(out).toContain('Full set');
    expect(out).toContain('Dilsukhnagar');
    expect(out).toContain('Malakpet');
    expect(out).toMatch(/Build[^<]*₹500/);
    expect(out).toContain('Mortgage +₹300');
  });

  it('shows an empty state with nothing owned', () => {
    const out = html(createElement(MyProperties, { session: mkSession(mkState()) }));
    expect(out).toContain('No properties yet.');
  });

  it('offers Unmortgage and no Build for a mortgaged tile', () => {
    const s = mkState();
    s.owners[1] = 'me';
    s.mortgaged[1] = true;
    const out = html(createElement(MyProperties, { session: mkSession(s) }));
    expect(out).toContain('Mortgaged');
    expect(out).toContain('Unmortgage ₹330');
    expect(out).not.toMatch(/>Build /);
  });
});
