// The control panel that sits in the CENTRE of the board (like intrepidcoder/monopoly's #control):
//   top row   the player whose turn it is (token, name, cash) + the dice
//   tabs      Buy (alert log + the tile you landed on) | Manage (my properties) | Trade
//   bottom    the action row: Roll / Buy / Skip / End turn / Pay bail / Use card / SNATCH!, or a waiting status
// Contract: <ControlPanel session onOpenTile={(tileId) => void} onOpenTrade={() => void} />
//   The landing-odds toggle beside the dice is the shared preference from ./oddsPref.js (the Board paints the overlay).
// The root fills its parent and is a size container, so everything scales with cqmin and the narrow
// layout (< 420px wide) is a pure container query.
import { useEffect, useId, useRef, useState } from 'react';
import { PASS_START, TILES, isBuyable } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Dice, { LuckyBadge, dieValue } from './Dice.jsx';
import EventBanner from './EventBanner.jsx';
import ActionBar, { PanelButton, useActionSpec } from './ActionBar.jsx';
import { LogList } from './LogPanel.jsx';
import MyProperties from './MyProperties.jsx';
import { oddsSupported, useOddsPref } from './oddsPref.js';
import { snatchInfo } from './snatch.js';
import Icon from './ui/Icon.jsx';
import { activePlayer, previewRentSafe, roundInfo, tileAccent, useStateLike } from './ui/helpers.js';
import '@/styles/controlpanel.css';

const TABS = [
  { id: 'buy', label: 'Buy', icon: 'coin' },
  { id: 'manage', label: 'Manage', icon: 'home' },
  { id: 'trade', label: 'Trade', icon: 'swap' },
];

/**
 * What the "landed on" line says about the tile `player` stands on. Pure; exported for testing.
 * `state` is an engine-state-like object (owners / levels / mortgaged as the board shows them).
 * -> { tile, color, tone: 'free'|'mine'|'rent'|'plain', detail }
 */
export function landedInfo(state, player, me, sum = 7) {
  const tile = TILES[player?.pos];
  if (!tile) return null;
  const { color } = tileAccent(tile);
  const out = (tone, detail) => ({ tile, color, tone, detail });

  if (isBuyable(tile)) {
    const ownerId = state.owners?.[tile.id];
    const owner = ownerId != null ? state.players.find((p) => p.id === ownerId) : null;
    if (!owner) return out('free', `For sale ${formatINR(tile.price)}`);
    const mine = ownerId === me;
    const who = mine ? 'Yours' : `Owned by ${owner.name}`;
    if (state.mortgaged?.[tile.id]) return out(mine ? 'mine' : 'plain', `${who} · mortgaged, no rent`);
    return out(mine ? 'mine' : 'rent', `${who} · rent ${formatINR(previewRentSafe(state, tile.id, sum))}`);
  }
  switch (tile.type) {
    case 'tax':
      return out('plain', tile.taxPercent
        ? `Pay ${formatINR(tile.taxFlat)}, or ${tile.taxPercent}% of your worth if that is less`
        : `Pay ${formatINR(tile.taxFlat)}`);
    case 'kismet':
      return out('plain', `Draw a ${tile.short} card`);
    case 'start':
      return out('plain', `Collect ${formatINR(state.cfg?.passStart ?? PASS_START)} salary`);
    case 'jail':
      return out('plain', (player.jailTurns || 0) > 0 ? 'In jail' : 'Just visiting');
    case 'gotojail':
      return out('plain', 'Straight to jail');
    default:
      return out('plain', 'A free rest. Nothing happens.');
  }
}

/** The "landed on" line while a snatch window is open: the contested tile and what the buyer paid for it. */
function snatchLanded(sn) {
  if (!sn.tile) return null;
  const detail = `${sn.buyerName} paid ${formatINR(sn.price)}. ${sn.canPress ? 'Snatch it free!' : 'Snatch window open'}`;
  return { tile: sn.tile, color: tileAccent(sn.tile).color, tone: 'snatch', detail };
}

/** Tab strip: arrow keys / Home / End move between tabs (roving tabindex). */
function Tabs({ tab, onTab, badges, ids }) {
  const refs = useRef({});
  const onKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onTab(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };
  return (
    <div className="cp-tabs" role="tablist" aria-label="Control panel" onKeyDown={onKey}>
      {TABS.map((t) => {
        const on = t.id === tab;
        const badge = badges[t.id];
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`${ids}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${ids}-pane`}
            tabIndex={on ? 0 : -1}
            className={`cp-tab${on ? ' is-on' : ''}`}
            onClick={() => onTab(t.id)}
          >
            <Icon name={t.icon} size={16} />
            <span className="cp-tab__label">{t.label}</span>
            {badge ? <span className="cp-badge" aria-label={badge.label}>{badge.text}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Buy tab: the scrolling alert log, then the tile the current player stands on. */
function BuyPane({ session, landed, buying, onOpenTile }) {
  return (
    <div className="cp-buy">
      <LogList log={session.log || []} variant="mono" />
      {landed ? (
        <button
          type="button"
          className={`cp-landed is-${landed.tone}${buying ? ' is-buying' : ''}`}
          style={{ '--tc': landed.color }}
          onClick={() => onOpenTile?.(landed.tile.id)}
          aria-label={`${landed.tile.name}. ${landed.detail}. Open details`}
        >
          <i className="cp-landed__chip" aria-hidden="true" />
          <span className="cp-landed__txt">
            <b>{landed.tile.name}</b>
            <small>{landed.detail}</small>
          </span>
          <Icon name="info" size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** Trade tab: what trading is, the pending-offer banner, and the entry to the trade sheet. */
export function TradePane({ session, onOpenTrade, snatching }) {
  const { view, me } = session;
  const canOffer = !!session.options?.trade?.canOffer;
  const t = view.trade;
  const nameOf = (id) => (id === me ? 'You' : view.players.find((p) => p.id === id)?.name || 'Someone');
  const myTurn = view.players[view.turn]?.id === me;

  let banner = null;
  if (t) {
    if (t.to === me) banner = { tone: 'in', text: `${nameOf(t.from)} offered you a trade. Answer it to carry on.` };
    else if (t.from === me) banner = { tone: 'out', text: `Waiting for ${nameOf(t.to)} to answer your offer…` };
    else banner = { tone: 'info', text: `${nameOf(t.from)} and ${nameOf(t.to)} are making a deal.` };
  }
  let why = '';
  if (snatching) why = 'Trading waits until the snatch window closes.';
  else if (!canOffer && !t) why = myTurn ? 'Settle the current purchase or bid first, then you can trade.' : 'You can propose a trade on your own turn.';

  return (
    <div className="cp-trade">
      {banner ? <p className={`cp-banner is-${banner.tone}`} role="status">{banner.text}</p> : null}
      <p>Swap properties and cash with another player. Buildings must be sold first. The other side can accept or reject.</p>
      <PanelButton tone="dark" size="lg" className="cp-trade__go" disabled={!canOffer || snatching || session.busy} onClick={onOpenTrade}>
        <Icon name="swap" size={20} />
        Propose a trade
      </PanelButton>
      {why ? <small className="cp-trade__why">{why}</small> : null}
    </div>
  );
}

export default function ControlPanel({ session, onOpenTile, onOpenTrade }) {
  const ids = useId();
  const { spec, fire } = useActionSpec(session);
  const state = useStateLike(session);
  const [tab, setTab] = useState('buy');
  const [oddsOn, setOddsOn] = useOddsPref();

  /* a fresh decision (buy / roll / snatch window) pulls the Buy tab forward; transient `busy` states never count */
  const stableKind = useRef(spec.kind);
  useEffect(() => {
    if (spec.kind === 'busy') return;
    if (spec.kind !== stableKind.current && (spec.kind === 'buy' || spec.kind === 'roll' || spec.kind === 'snatch')) setTab('buy');
    stableKind.current = spec.kind;
  }, [spec.kind]);

  const player = activePlayer(session);
  const isMe = !!player && player.id === session.me;
  const over = (session.display?.phase ?? session.view?.phase) === 'over';
  const r = roundInfo(session);
  const sn = snatchInfo(session); // from the latest state, not the animated display
  const landed = sn ? snatchLanded(sn) : player && !player.bankrupt ? landedInfo(state, player, session.me, dieValue(session)) : null;
  const tradeOpen = !!session.view.trade;

  const badges = {
    manage: spec.upgrades > 0 ? { text: spec.upgrades, label: `${spec.upgrades} can be built` } : null,
    trade: tradeOpen ? { text: '!', label: 'A trade offer is open' } : null,
  };

  return (
    <section className="cp" aria-label="Game controls">
      <div className="cp__in" data-kind={spec.kind} data-tab={tab}>
        <header className="cp-top">
          <div className={`cp-who${player?.bankrupt ? ' is-out' : ''}`} style={{ '--pc': player?.color || '#8aa09b' }}>
            <span className="cp-token" aria-hidden="true" />
            <div className="cp-who__txt">
              <span className="cp-who__row">
                <b className="cp-who__name">{player ? (isMe ? 'You' : player.name) : '—'}</b>
                <span className="cp-who__turn">{over ? 'Final' : isMe ? 'your turn' : 'playing'}</span>
              </span>
              <span className="cp-who__cash">{formatINR(player?.cash ?? 0)}</span>
              <small className="cp-who__meta">
                Round {r.round}{r.max != null ? ` / ${r.max}` : ' · ∞'}
              </small>
              <span className="cp-who__tags">
                <LuckyBadge session={session} />
                {oddsSupported() ? (
                  <button
                    type="button"
                    className={`cp-odds${oddsOn ? ' is-on' : ''}`}
                    aria-pressed={oddsOn}
                    title="Show where your next roll is likely to land"
                    onClick={() => setOddsOn((on) => !on)}
                  >
                    Odds
                  </button>
                ) : null}
              </span>
            </div>
          </div>
          <Dice session={session} />
        </header>

        <EventBanner session={session} />

        <Tabs tab={tab} onTab={setTab} badges={badges} ids={ids} />

        <div className="cp-pane" role="tabpanel" id={`${ids}-pane`} aria-labelledby={`${ids}-tab-${tab}`}>
          {tab === 'buy' ? <BuyPane session={session} landed={landed} buying={spec.kind === 'buy'} onOpenTile={onOpenTile} /> : null}
          {tab === 'manage' ? <div className="cp-scroll"><MyProperties session={session} onOpenTile={onOpenTile} /></div> : null}
          {tab === 'trade' ? <div className="cp-scroll"><TradePane session={session} onOpenTrade={onOpenTrade} snatching={!!sn} /></div> : null}
        </div>

        <ActionBar spec={spec} fire={fire} session={session} />
      </div>
    </section>
  );
}
