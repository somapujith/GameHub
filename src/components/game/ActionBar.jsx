// The control panel's action row. Reads ONLY session.options + session.view, dispatches via session.dispatch.
//   buildActionSpec(session)  pure: what the row should offer right now
//   shortcutAction(spec, e)   pure: which action a Space / Enter key press fires (only primaries that advertise a kbd)
//   useActionSpec(session)    spec + a debounced `fire(action)` + the Space / Enter shortcut
//   <ActionBar spec fire session />  presentational: secondary buttons + the one big primary button
import { useEffect, useMemo, useRef } from 'react';
import { Avatar } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import { sfx } from '@/lib/sfx.js';
import Icon from './ui/Icon.jsx';
import { hasOpenSheet } from './ui/Sheet.jsx';
import { recordSnatch, snatchInfo, useSnatchClock } from './snatch.js';
import '@/styles/controlpanel.css';

/** Work out what the row should show. Pure; exported for testing. */
export function buildActionSpec(session) {
  const { options: o = {}, view, busy, me } = session;
  const upgrades = o.upgrade?.length || 0;
  const mine = view.players.find((p) => p.id === me);
  const turnP = view.players[view.turn];
  const myTurn = turnP?.id === me;
  const pend = view.pending;
  const spec = { kind: 'status', primary: null, secondaries: [], upgrades, label: '', sr: '' };

  if (session.result || view.phase === 'over') {
    return { ...spec, label: 'Game over', sr: 'Game over', upgrades: 0 };
  }
  if (mine?.bankrupt) {
    return { ...spec, label: 'You are out – spectating', sr: 'You are bankrupt and out of the game', upgrades: 0 };
  }
  // The snatch window is real time: it is read from the latest state and wins over `busy` (the presenter may
  // still be animating the purchase that opened it).
  const sn = snatchInfo(session);
  if (sn) {
    const what = `${sn.buyerName} bought ${sn.tile?.short ?? 'a tile'}`;
    const out = { ...spec, kind: 'snatch', upgrades: 0, meter: true };
    if (sn.canPress) {
      out.primary = {
        key: 'snatch', tone: 'red', icon: 'bolt', label: 'SNATCH!', sub: `free - ${sn.buyerName} still pays`,
        kbd: 'Space', meter: true, action: { type: 'SNATCH' },
      };
      out.sr = `${what} for ${formatINR(sn.price)}. Press Snatch to take ${sn.tile?.name ?? 'it'} for free. ${sn.buyerName} still pays.`;
    } else if (sn.pressed) {
      out.label = 'Snatch locked in';
      out.sub = `${what}. Waiting for the window to close`;
      out.sr = 'Snatch locked in. Waiting for the window to close';
    } else {
      out.label = what;
      out.sub = 'Snatch window…';
      out.sr = `${what}. The snatch window is open`;
    }
    return out;
  }
  if (busy) {
    return { ...spec, kind: 'busy', label: '', sr: 'Please wait', upgrades: 0 };
  }
  if (view.phase === 'auction') {
    return { ...spec, label: o.bid ? 'Place your bid' : 'Auction in progress…', sr: 'Auction in progress', upgrades: 0 };
  }

  if (o.buy || (o.skipBuy && pend?.type === 'buy')) {
    const tile = TILES[pend?.tile];
    if (o.buy) {
      spec.kind = 'buy';
      spec.primary = {
        key: 'buy', tone: 'green', label: `Buy ${tile?.short ?? 'tile'}`, amount: formatINR(pend?.price ?? 0), action: { type: 'BUY' },
      };
      if (o.skipBuy) spec.secondaries.push({ key: 'skip', label: 'Skip', action: { type: 'SKIP_BUY' } });
      // Shield: costs one Snatch token, nobody can snatch this purchase. Never a kbd (a deliberate click only).
      if (o.shield) {
        spec.secondaries.push({
          key: 'shield', wide: true, icon: 'shield', label: 'Buy + Shield', sub: '1 token - nobody can snatch it',
          action: { type: 'BUY', shield: true },
        });
      }
      spec.sr = `Buy ${tile?.name ?? 'this tile'} for ${formatINR(pend?.price ?? 0)}, or skip`
        + (o.shield ? '. Or buy and shield it with one Snatch token so nobody can snatch it' : '');
    } else {
      const short = Math.max(0, (pend?.price ?? 0) - (mine?.cash ?? 0));
      spec.kind = 'skip';
      spec.primary = {
        key: 'skip', tone: 'dark', label: 'Skip', sub: `Need ${formatINR(short)} more to buy`, action: { type: 'SKIP_BUY' },
      };
      spec.sr = `You cannot afford ${tile?.name ?? 'this tile'}. Skip.`;
    }
  } else if (o.roll) {
    const again = !!view.extraRoll;
    const jailed = (mine?.jailTurns || 0) > 0 && !again;
    spec.kind = 'roll';
    spec.primary = {
      key: 'roll', tone: 'gold', icon: 'dice', label: again ? 'Roll again' : 'Roll', kbd: 'Space',
      sub: jailed ? 'Roll a 6 to break out' : undefined, action: { type: 'ROLL' },
    };
    if (o.useJailCard) {
      spec.secondaries.push({ key: 'card', icon: 'ticket', label: 'Use card', amount: 'free', action: { type: 'USE_JAIL_CARD' } });
    }
    if (o.bail) {
      spec.secondaries.push({
        key: 'bail', label: 'Pay bail', amount: formatINR(view.cfg?.bailFine ?? 500), action: { type: 'PAY_BAIL' },
      });
    } else if (o.endTurn) {
      spec.secondaries.push({ key: 'end', label: 'End turn', action: { type: 'END_TURN' } });
    }
    // Trap: placing is possible before the roll; the deed sheet holds the button, this just says where to tap.
    if (o.trap) spec.hint = { key: 'trap', icon: 'warn', text: 'Tap any tile to set your trap', short: 'Set a trap' };
    spec.sr = again ? 'Six! Roll again' : jailed ? 'You are in jail. Roll a 6, pay bail or use your card' : 'Your turn. Roll the die';
  } else if (o.endTurn) {
    spec.kind = 'end';
    spec.primary = { key: 'end', tone: 'blue', icon: 'check', label: 'End turn', kbd: 'Space', action: { type: 'END_TURN' } };
    spec.sr = upgrades ? 'End your turn, or upgrade a property' : 'End your turn';
  } else if (view.phase === 'debt') {
    const debtor = view.players.find((p) => p.id === view.debt?.player);
    spec.label = debtor && debtor.id !== me ? `${debtor.name} is settling a debt` : 'Settle your debt';
    spec.sr = spec.label;
    spec.upgrades = 0;
  } else if (view.trade) {
    spec.label = 'Trade offer pending';
    spec.sr = 'A trade offer is waiting for an answer';
    spec.upgrades = 0;
  } else if (!myTurn) {
    spec.label = `Waiting for ${turnP?.name ?? 'others'}`;
    spec.waitFor = turnP;
    spec.sr = spec.label;
    spec.upgrades = 0;
  } else {
    spec.kind = 'busy';
    spec.sr = 'Please wait';
    spec.upgrades = 0;
  }
  return spec;
}

const isTyping = (t) => {
  if (!t) return false;
  if (typeof document !== 'undefined' && (t === document.body || t === document.documentElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A'
    || t.isContentEditable || t.getAttribute?.('role') === 'button';
};

/**
 * The action a key press should fire through the Space / Enter shortcut, or null. Pure; exported for testing.
 * Only a primary that advertises a `kbd` qualifies (Roll, End turn, Snatch): Buy and Skip must be a deliberate click.
 */
export function shortcutAction(spec, e, sheetOpen = false) {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key !== ' ' && e.key !== 'Enter') return null;
  if (sheetOpen || isTyping(e.target)) return null;
  return spec?.primary?.kbd ? spec.primary.action : null;
}

/** The spec for this session, a debounced dispatcher, and the Space / Enter shortcut for Roll / End turn / Snatch. */
export function useActionSpec(session) {
  const spec = useMemo(
    () => buildActionSpec(session),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.options, session.view, session.busy, session.me, session.result],
  );
  recordSnatch(snatchInfo(session)); // note when a window first shows up, even before anything renders its clock
  const specRef = useRef(spec);
  const dispatchRef = useRef(session.dispatch);
  specRef.current = spec;
  dispatchRef.current = session.dispatch;
  const lastFire = useRef(0);

  /* Space / Enter (not while a sheet is open, or when focus is on something interactive) */
  useEffect(() => {
    const onKey = (e) => {
      const action = shortcutAction(specRef.current, e, hasOpenSheet());
      if (!action) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastFire.current < 350) return;
      lastFire.current = now;
      dispatchRef.current?.(action);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const fire = (action) => () => {
    const now = performance.now();
    if (now - lastFire.current < 250) return;
    lastFire.current = now;
    session.dispatch(action);
  };

  return { spec, fire };
}

/**
 * Panel button with the click sound. tone: gold | green | blue | red | dark | paper; size: sm | md | lg.
 * Plain <button>, styled by controlpanel.css (`.cp-btn`).
 */
export function PanelButton({ tone = 'paper', size = 'md', className = '', onClick, sound = 'click', type = 'button', children, ...rest }) {
  const handle = (e) => {
    if (sound) {
      try { sfx.play(sound); } catch { /* sound is optional */ }
    }
    onClick?.(e);
  };
  return (
    <button type={type} className={`cp-btn cp-btn--${tone} cp-btn--${size} ${className}`.trim()} onClick={handle} {...rest}>
      {children}
    </button>
  );
}

/** Lightning bolt for the Snatch button (the shared icon set has none). */
function Bolt({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" className="hg-icon">
      <path d="M13.5 2.5L5 13.5h5.5L9.5 21.5 19 10h-5.8z" />
    </svg>
  );
}

/** Shield for the Buy + Shield button (the shared icon set has none). */
function ShieldGlyph({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false" className="hg-icon">
      <path d="M12 3.2l7 2.6v5.6c0 4.4-2.9 7.7-7 9.4-4.1-1.7-7-5-7-9.4V5.8z" />
      <path d="M8.8 12l2.4 2.4 4-4.4" />
    </svg>
  );
}

const Glyph = ({ name, size }) => {
  if (name === 'bolt') return <Bolt size={size} />;
  if (name === 'shield') return <ShieldGlyph size={size} />;
  return <Icon name={name} size={size} />;
};

/** Seconds left + a bar along the button's bottom edge that drains over the snatch window. */
function SnatchMeter({ session }) {
  const clock = useSnatchClock(session);
  if (!clock) return null;
  return (
    <>
      <span className="cp-btn__amount cp-meter__secs" aria-hidden="true">{clock.seconds}s</span>
      <i className="cp-meter" aria-hidden="true" style={{ transform: `scaleX(${clock.fraction})` }} />
    </>
  );
}

export default function ActionBar({ spec, fire, session }) {
  const { primary } = spec;
  const secondaries = spec.secondaries.filter((sec) => !sec.wide);
  const wide = spec.secondaries.filter((sec) => sec.wide);
  return (
    <div className="cp-actions" data-kind={spec.kind} data-sec={secondaries.length} data-wide={wide.length || (spec.hint ? 1 : 0)} role="group" aria-label="Actions">
      <p className="cp-sr" role="status" aria-live="polite">{spec.sr}</p>

      {secondaries.length > 0 ? (
        <div className="cp-actions__sec">
          {secondaries.map((sec) => (
            <PanelButton key={sec.key} tone="paper" onClick={fire(sec.action)}>
              <span className="cp-btn__label">{sec.icon ? <Glyph name={sec.icon} size={16} /> : null}{sec.label}</span>
              {sec.amount ? <span className="cp-btn__amount is-small">{sec.amount}</span> : null}
            </PanelButton>
          ))}
        </div>
      ) : null}

      {primary ? (
        <PanelButton
          tone={primary.tone}
          size="lg"
          className={`cp-primary is-${primary.key}`}
          onClick={fire(primary.action)}
          title={primary.label}
          aria-label={primary.amount ? `${primary.label} for ${primary.amount}` : primary.label}
        >
          <span className="cp-btn__main">
            {primary.icon ? <Glyph name={primary.icon} size={22} /> : null}
            <span className="cp-btn__label">{primary.label}</span>
            {primary.amount ? <span className="cp-btn__amount">{primary.amount}</span> : null}
            {primary.meter ? <SnatchMeter session={session} /> : null}
          </span>
          {primary.sub ? <span className="cp-btn__sub">{primary.sub}</span> : null}
          {primary.kbd ? <kbd className="cp-kbd" aria-hidden="true">{primary.kbd}</kbd> : null}
        </PanelButton>
      ) : (
        <PanelButton tone="dark" size="lg" className={`cp-primary is-wait is-${spec.kind}`} disabled sound={null}>
          {spec.kind === 'busy' ? (
            <span className="cp-dots" aria-hidden="true"><i /><i /><i /></span>
          ) : (
            <>
              <span className="cp-btn__main">
                {spec.waitFor ? (
                  <span className="cp-btn__mini" style={{ '--pc': spec.waitFor.color }}><Avatar preset={spec.waitFor.avatar} size={24} /></span>
                ) : null}
                <span className="cp-btn__label">{spec.label}</span>
                {spec.meter ? <SnatchMeter session={session} /> : null}
              </span>
              {spec.sub ? <span className="cp-btn__sub">{spec.sub}</span> : null}
            </>
          )}
        </PanelButton>
      )}

      {wide.map((sec) => (
        <PanelButton
          key={sec.key}
          tone="paper"
          size="sm"
          className={`cp-wide is-${sec.key}`}
          onClick={fire(sec.action)}
          title={`${sec.label}: ${sec.sub}`}
          aria-label={`${sec.label}. ${sec.sub}`}
        >
          <span className="cp-btn__label">{sec.icon ? <Glyph name={sec.icon} size={16} /> : null}{sec.label}</span>
          {sec.sub ? <span className="cp-wide__sub">{sec.sub}</span> : null}
        </PanelButton>
      ))}

      {spec.hint ? (
        <p className={`cp-hint is-${spec.hint.key}`}>
          <Glyph name={spec.hint.icon} size={14} />
          <span className="cp-hint__txt">{spec.hint.text}</span>
          {spec.hint.short ? <span className="cp-hint__short" aria-hidden="true">{spec.hint.short}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
