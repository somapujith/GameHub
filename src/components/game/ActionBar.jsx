// Context-driven action bar. Reads ONLY session.options + session.view/display, dispatches via session.dispatch.
import { useEffect, useMemo, useRef } from 'react';
import { Avatar } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { hasOpenSheet } from './ui/Sheet.jsx';
import { activePlayer } from './ui/helpers.js';

/** Work out what the bar should show. Pure; exported for testing. */
export function buildActionSpec(session) {
  const { options: o = {}, view, busy, me } = session;
  const upgrades = o.upgrade?.length || 0;
  const mine = view.players.find((p) => p.id === me);
  const turnP = view.players[view.turn];
  const myTurn = turnP?.id === me;
  const pend = view.pending;
  const spec = { kind: 'status', primary: null, secondaries: [], upgrades, canTrade: false, label: '', sr: '' };

  if (session.result || view.phase === 'over') {
    return { ...spec, label: 'Game over', sr: 'Game over', upgrades: 0 };
  }
  if (mine?.bankrupt) {
    return { ...spec, label: 'You are out – spectating', sr: 'You are bankrupt and out of the game', upgrades: 0 };
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
      spec.sr = `Buy ${tile?.name ?? 'this tile'} for ${formatINR(pend?.price ?? 0)}, or skip`;
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
    const single = view.cfg?.diceCount === 1;
    const jailed = (mine?.jailTurns || 0) > 0 && !again;
    spec.kind = 'roll';
    spec.primary = {
      key: 'roll', tone: 'gold', icon: 'dice', label: again ? 'Roll again' : 'Roll', kbd: 'Space',
      sub: jailed ? single ? 'Roll a 6 to break out' : 'Doubles to break out' : undefined, action: { type: 'ROLL' },
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
    spec.sr = again ? single ? 'Six! Roll again' : 'Doubles! Roll again' : jailed ? `You are in jail. ${single ? 'Roll a 6' : 'Roll for doubles'}, pay bail or use your card` : 'Your turn. Roll the die';
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
  spec.canTrade = !!(o.trade && o.trade.canOffer) && (spec.kind === 'roll' || spec.kind === 'end');
  return spec;
}

const isTyping = (t) => {
  if (!t || t === document.body || t === document.documentElement) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A'
    || t.isContentEditable || t.getAttribute?.('role') === 'button';
};

export default function ActionBar({ session, onOpenUpgrades, onOpenTrade, variant = 'bar' }) {
  const spec = useMemo(
    () => buildActionSpec(session),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.options, session.view, session.busy, session.me, session.result],
  );
  const specRef = useRef(spec);
  const dispatchRef = useRef(session.dispatch);
  specRef.current = spec;
  dispatchRef.current = session.dispatch;
  const lastFire = useRef(0);

  /* Space / Enter = primary action (not while a sheet is open, or when focus is on something interactive) */
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (hasOpenSheet() || isTyping(e.target)) return;
      const s = specRef.current;
      if (!s?.primary) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const now = performance.now();
      if (now - lastFire.current < 350) return;
      lastFire.current = now;
      dispatchRef.current?.(s.primary.action);
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

  const { primary, upgrades } = spec;
  // phones: two labelled buttons leave no room for the Trade icon (it stays reachable in My properties)
  const secondaries = variant === 'bar' ? spec.secondaries.slice(0, 2) : spec.secondaries;
  const crowded = variant === 'bar' && secondaries.length > 1;
  const showTrade = spec.canTrade && !!onOpenTrade && !crowded && session.view.owners?.some((owner) => owner != null);
  const showUpgradeButton = upgrades > 0 && !crowded; // still reachable via the menu / My properties
  const showSub = variant !== 'bar' || secondaries.length === 0;
  const upgradeAsIcon = showUpgradeButton && (secondaries.length > 0 || showTrade);

  return (
    <div className="hg-actions" data-variant={variant} data-kind={spec.kind} role="group" aria-label="Actions">
      <p className="hg-sr" role="status" aria-live="polite">{spec.sr}</p>
      <div className="hg-actions-row">
        <div className="hg-actions-extras">
        {showTrade ? (
          <Button variant="dark" className="hg-act-icon" onClick={onOpenTrade} aria-label="Propose a trade">
            <Icon name="swap" size={22} />
          </Button>
        ) : null}

        {showUpgradeButton && upgradeAsIcon ? (
          <Button variant="dark" className="hg-act-upg is-icon" onClick={onOpenUpgrades} aria-label={`Upgrade properties (${upgrades} available)`}>
            <Icon name="upgrade" size={22} />
            <span className="hg-badge">{upgrades}</span>
          </Button>
        ) : null}

        {secondaries.map((sec) => (
          <Button key={sec.key} variant="dark" className="hg-act-sec" onClick={fire(sec.action)}>
            <span className="hg-act-label">{sec.icon ? <Icon name={sec.icon} size={16} /> : null}{sec.label}</span>
            {sec.amount ? <span className="hg-act-amount is-small">{sec.amount}</span> : null}
          </Button>
        ))}

        {showUpgradeButton && !upgradeAsIcon ? (
          <Button variant="dark" className="hg-act-sec hg-act-upg" onClick={onOpenUpgrades}>
            <Icon name="upgrade" size={18} />
            <span className="hg-act-label">Upgrade&hellip;</span>
            <span className="hg-badge is-inline">{upgrades}</span>
          </Button>
        ) : null}
        </div>

        {primary ? (
          <Button
            variant={primary.tone}
            size="lg"
            className={`hg-act-primary is-${primary.key}`}
            onClick={fire(primary.action)}
            title={primary.label}
            aria-label={primary.amount ? `${primary.label} for ${primary.amount}` : primary.label}
          >
            <span className="hg-act-main">
              {primary.icon ? <Icon name={primary.icon} size={22} /> : null}
              <span className="hg-act-label">{variant === 'duel' && primary.key === 'buy' ? 'Buy' : primary.label}</span>
              {primary.amount ? <span className="hg-act-amount">{primary.amount}</span> : null}
            </span>
            {primary.sub && showSub ? <span className="hg-act-sub">{primary.sub}</span> : null}
            {primary.kbd ? <kbd className="hg-kbd" aria-hidden="true">{primary.kbd}</kbd> : null}
          </Button>
        ) : (
          <Button variant="dark" size="lg" className={`hg-act-primary is-wait is-${spec.kind}`} disabled sound={null}>
            {spec.kind === 'busy' ? (
              <span className="hg-dots" aria-hidden="true"><i /><i /><i /></span>
            ) : (
              <>
                {spec.waitFor ? (
                  <span className="hg-act-mini" style={{ '--pc': spec.waitFor.color }}><Avatar preset={spec.waitFor.avatar} size={26} /></span>
                ) : null}
                <span className="hg-act-label">{spec.label}</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Convenience for GameView: the currently active player's id. */
export const activeId = (session) => activePlayer(session)?.id ?? null;
