// Trading. One default export that renders three states from the session:
//   composer  (opened from the ActionBar "Trade" button)      -> { type:'TRADE_OFFER', to, give, get }
//   waiting   (my offer is outstanding: view.trade.from === me) -> { type:'TRADE_CANCEL' }
//   incoming  (an offer awaits MY answer: view.trade.to === me) -> TRADE_ACCEPT / TRADE_REJECT (+30 s ring online)
// `give` is what the proposer hands over, `get` what the proposer receives (engine convention).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/art/index.js';
import { GROUPS, GROUP_TILES, TILES, isBuyable, mortgageValue } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import Pill from './ui/Pill.jsx';
import TileChip from './ui/TileChip.jsx';
import { useHeld } from './ui/helpers.js';

const OFFER_SECONDS = 30;

/* ------------------------------------------------------------------ pure helpers (exported for tests) */

/** Board value of one side: cash + tile prices (a mortgaged tile counts price minus its mortgage). */
export function sideValue(state, side) {
  let v = Number(side?.cash) || 0;
  for (const t of side?.tiles || []) {
    const tile = TILES[t];
    if (!tile) continue;
    v += state.mortgaged?.[t] ? tile.price - mortgageValue(tile) : tile.price;
  }
  return v;
}

/** What I give vs what I get -> { key, label, tone, hint }. */
export function fairness(giving, getting) {
  if (giving + getting === 0) return { key: 'empty', label: 'Add something to trade', tone: 'neutral', hint: '' };
  if (giving === 0) return { key: 'greedy', label: 'Greedy', tone: 'warn', hint: 'You give nothing. Expect a no.' };
  const r = getting / giving;
  if (r < 0.85) return { key: 'generous', label: 'Generous', tone: 'blue', hint: 'You give more than you get.' };
  if (r <= 1.2) return { key: 'fair', label: 'Looks fair', tone: 'good', hint: 'Values are close.' };
  return { key: 'greedy', label: 'Greedy', tone: 'warn', hint: 'You ask for much more than you give.' };
}

/** Groups that `playerId` would own completely after receiving `receive` tiles and handing over `hand` tiles. */
export function completedGroups(owners, playerId, receive, hand = []) {
  const out = [];
  const groups = new Set(receive.map((t) => TILES[t]?.group).filter(Boolean));
  for (const g of groups) {
    const full = GROUP_TILES[g].every((t) => (receive.includes(t) ? true : hand.includes(t) ? false : owners[t] === playerId));
    if (full) out.push(g);
  }
  return out;
}

const hasBuildings = (state, tileId) => {
  const tile = TILES[tileId];
  return tile?.type === 'property' && GROUP_TILES[tile.group].some((t) => (state.levels?.[t] || 0) > 0);
};
const tradeable = (state, tileId) => isBuyable(TILES[tileId]) && !hasBuildings(state, tileId);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const nameOf = (p) => (p ? p.name : 'Someone');

/* ------------------------------------------------------------------ small views */

function Who({ player, you }) {
  if (!player) return null;
  return (
    <span className="hg-trade-who" style={{ '--pc': player.color }}>
      <span className="hg-owner-av"><Avatar preset={player.avatar} size={24} /></span>
      <b>{you ? 'You' : player.name}</b>
    </span>
  );
}

function SideView({ title, side, state, tone }) {
  const tiles = side?.tiles || [];
  return (
    <div className={`hg-trade-side is-${tone}`}>
      <h4>{title}</h4>
      {side?.cash > 0 ? <p className="hg-trade-cash">{formatINR(side.cash)} cash</p> : null}
      {tiles.length ? (
        <div className="hg-chips">
          {tiles.map((t) => <TileChip key={t} tileId={t} mortgaged={!!state.mortgaged?.[t]} level={state.levels?.[t] || 0} />)}
        </div>
      ) : (
        side?.cash > 0 ? null : <p className="hg-empty">Nothing</p>
      )}
      <p className="hg-trade-val">Worth {formatINR(sideValue(state, side))}</p>
    </div>
  );
}

function CashStepper({ label, value, max, onChange }) {
  const set = (v) => onChange(clamp(v, 0, max));
  return (
    <div className="hg-cashstep">
      <span className="hg-cashstep-label">{label}</span>
      <div className="hg-cashstep-row">
        <Button variant="dark" size="sm" aria-label={`${label}: minus 500`} disabled={value <= 0} onClick={() => set(value - 500)}>{'−'}500</Button>
        <Button variant="dark" size="sm" aria-label={`${label}: minus 100`} disabled={value <= 0} onClick={() => set(value - 100)}>{'−'}100</Button>
        <output className="hg-cashstep-val" aria-live="polite">{formatINR(value)}</output>
        <Button variant="dark" size="sm" aria-label={`${label}: plus 100`} disabled={value >= max} onClick={() => set(value + 100)}>+100</Button>
        <Button variant="dark" size="sm" aria-label={`${label}: plus 500`} disabled={value >= max} onClick={() => set(value + 500)}>+500</Button>
      </div>
    </div>
  );
}

function TilePicker({ owner, ownerIsMe, state, selected, onToggle }) {
  const ids = TILES.filter((t) => state.owners[t.id] === owner.id && isBuyable(t)).map((t) => t.id);
  return (
    <div className="hg-picker">
      <div className="hg-picker-head"><Who player={owner} you={ownerIsMe} /><small>{ownerIsMe ? 'tiles you own' : 'tiles they own'}</small></div>
      {ids.length === 0 ? (
        <p className="hg-empty">{ownerIsMe ? 'You own no tiles yet.' : `${nameOf(owner)} owns no tiles yet.`}</p>
      ) : (
        <div className="hg-chips">
          {ids.map((id) => {
            const blocked = hasBuildings(state, id);
            return (
              <TileChip
                key={id}
                tileId={id}
                level={state.levels?.[id] || 0}
                mortgaged={!!state.mortgaged?.[id]}
                selected={selected.includes(id)}
                disabled={blocked}
                onClick={() => onToggle(id)}
                extra={blocked ? <Icon name="lock" size={12} /> : null}
              />
            );
          })}
        </div>
      )}
      {ids.some((id) => hasBuildings(state, id)) ? (
        <p className="hg-hint"><Icon name="lock" size={12} /> Locked tiles have buildings in their colour. Sell them first.</p>
      ) : null}
    </div>
  );
}

function Countdown({ seconds = OFFER_SECONDS, resetKey }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t0 = performance.now();
    setLeft(seconds);
    const id = setInterval(() => setLeft(Math.max(0, seconds - Math.floor((performance.now() - t0) / 1000))), 250);
    return () => clearInterval(id);
  }, [seconds, resetKey]);
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <span className={`hg-ring${left <= 8 ? ' is-low' : ''}`} role="timer" aria-label={`${left} seconds left to answer`}>
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={R} className="hg-ring-bg" />
        <circle cx="22" cy="22" r={R} className="hg-ring-fg" strokeDasharray={C} style={{ '--ring-c': C, animationDuration: `${seconds}s` }} />
      </svg>
      <b>{left}</b>
    </span>
  );
}

/* ------------------------------------------------------------------ composer + waiting */

function ComposerSheet({ session, open, onClose }) {
  const view = session.view;
  const me = session.me;
  const o = session.options || {};
  const myP = view.players.find((p) => p.id === me);
  const others = view.players.filter((p) => p.id !== me && !p.bankrupt);
  const trade = view.trade && view.trade.from === me ? view.trade : null;
  const waiting = !!trade;
  const lastTrade = useRef(null);
  if (trade) lastTrade.current = trade;
  const modeRef = useRef('compose'); // keep the same content while the sheet animates out
  if (waiting) modeRef.current = 'wait';
  else if (open) modeRef.current = 'compose';
  const showWait = modeRef.current === 'wait' && !!lastTrade.current;
  const tradeShown = trade || lastTrade.current;

  const [to, setTo] = useState(null);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);
  const [giveTiles, setGiveTiles] = useState([]);
  const [getTiles, setGetTiles] = useState([]);
  const wasOpen = useRef(false);

  /* fresh composer every time it opens */
  useEffect(() => {
    if (open && !wasOpen.current && !waiting) {
      setTo(others[0]?.id ?? null);
      setGiveCash(0); setGetCash(0); setGiveTiles([]); setGetTiles([]);
    }
    wasOpen.current = open;
  }, [open, waiting, others]);

  const partner = view.players.find((p) => p.id === (trade ? trade.to : to)) || null;
  const waitPartner = tradeShown ? view.players.find((p) => p.id === tradeShown.to) || null : null;

  const pick = (id) => { setTo(id); setGetCash(0); setGetTiles([]); };
  const toggle = (list, set) => (id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const give = { cash: giveCash, tiles: giveTiles };
  const get = { cash: getCash, tiles: getTiles };
  const giving = sideValue(view, give);
  const getting = sideValue(view, get);
  const fair = fairness(giving, getting);
  const myDone = partner ? completedGroups(view.owners, me, getTiles, giveTiles) : [];
  const theirDone = partner ? completedGroups(view.owners, partner.id, giveTiles, getTiles) : [];
  const valid = !!partner && giving + getting > 0 && giveCash <= (myP?.cash || 0) && getCash <= (partner?.cash || 0);

  const send = () => {
    if (!valid) return;
    session.dispatch({ type: 'TRADE_OFFER', to: partner.id, give: { cash: giveCash, tiles: giveTiles }, get: { cash: getCash, tiles: getTiles } });
    onClose?.();
  };

  return (
    <Sheet
      open={open || waiting}
      onClose={onClose}
      dismissible={!waiting}
      title={showWait ? 'Trade offer sent' : 'Propose a trade'}
      className="hg-trade"
      desktop="modal"
      footer={showWait ? (
        <div className="hg-trade-actions">
          <Button variant="rose" size="lg" disabled={session.busy} onClick={() => session.dispatch({ type: 'TRADE_CANCEL' })}>Cancel offer</Button>
        </div>
      ) : (
        <div className="hg-trade-actions">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="gold" size="lg" disabled={!valid || session.busy} onClick={send}>Send offer</Button>
        </div>
      )}
    >
      {showWait && waitPartner ? (
        <div className="hg-trade-wait" role="status">
          <p className="hg-trade-waiting">
            Waiting for {waitPartner.name}<span className="hg-dots" aria-hidden="true"><i /><i /><i /></span>
          </p>
          <div className="hg-trade-sides">
            <SideView title="You give" side={tradeShown.give} state={view} tone="give" />
            <SideView title="You get" side={tradeShown.get} state={view} tone="get" />
          </div>
          <p className="hg-hint">Nobody can move until the offer is answered or cancelled.</p>
        </div>
      ) : (
        <>
          <h3 className="hg-h3">Trade with</h3>
          <div className="hg-partners" role="radiogroup" aria-label="Trade partner">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={to === p.id}
                className={`hg-partner${to === p.id ? ' is-on' : ''}`}
                style={{ '--pc': p.color }}
                onClick={() => pick(p.id)}
              >
                <span className="hg-pc-ring"><Avatar preset={p.avatar} size={36} /></span>
                <b>{p.name}</b>
                <small>{formatINR(p.cash)}</small>
              </button>
            ))}
          </div>

          {partner ? (
            <>
              <section className="hg-trade-panel is-give" aria-label="You give">
                <h3 className="hg-h3">You give</h3>
                <TilePicker owner={myP} ownerIsMe state={view} selected={giveTiles} onToggle={toggle(giveTiles, setGiveTiles)} />
                <CashStepper label="Cash you give" value={giveCash} max={myP?.cash || 0} onChange={setGiveCash} />
              </section>

              <section className="hg-trade-panel is-get" aria-label="You get">
                <h3 className="hg-h3">You get</h3>
                <TilePicker owner={partner} state={view} selected={getTiles} onToggle={toggle(getTiles, setGetTiles)} />
                <CashStepper label={`Cash from ${partner.name}`} value={getCash} max={partner.cash || 0} onChange={setGetCash} />
              </section>

              <section className={`hg-fair is-${fair.key}`} aria-label="Fairness" role="status">
                <div className="hg-fair-nums">
                  <span>You give <b>{formatINR(giving)}</b></span>
                  <Pill tone={fair.tone}>{fair.label}</Pill>
                  <span>You get <b>{formatINR(getting)}</b></span>
                </div>
                {fair.hint ? <p className="hg-hint">{fair.hint} Values use board prices.</p> : null}
                {myDone.map((g) => <p key={`m${g}`} className="hg-hint is-ok"><Icon name="check" size={14} /> Completes {GROUPS[g].name} for you</p>)}
                {theirDone.map((g) => <p key={`t${g}`} className="hg-hint is-warn"><Icon name="info" size={14} /> Completes {GROUPS[g].name} for {partner.name}, they may refuse or value it highly</p>)}
              </section>
            </>
          ) : (
            <p className="hg-empty">No other active players to trade with.</p>
          )}
          {o.trade && !o.trade.canOffer ? <p className="hg-hint is-warn">You can only offer a trade on your own turn, before rolling or after.</p> : null}
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ incoming offer */

function IncomingSheet({ session }) {
  const view = session.view;
  const me = session.me;
  const o = session.options || {};
  const offer = view.trade && view.trade.to === me ? view.trade : null;
  const [latched, setLatched] = useState(false);

  useEffect(() => {
    if (!offer) setLatched(false);
    else if (o.tradeOffer) setLatched(true);
  }, [offer, o.tradeOffer]);

  const open = !!offer && (!!o.tradeOffer || latched);
  const heldOffer = useHeld(offer);
  const from = heldOffer ? view.players.find((p) => p.id === heldOffer.from) : null;
  const sig = heldOffer ? heldOffer.id : null;
  const iGet = heldOffer?.give; // proposer gives -> I receive
  const iGive = heldOffer?.get;
  const getting = heldOffer ? sideValue(view, iGet) : 0;
  const giving = heldOffer ? sideValue(view, iGive) : 0;
  const fair = useMemo(() => fairness(giving, getting), [giving, getting]);
  const label = fair.key === 'fair' ? 'Looks fair' : fair.key === 'generous' ? 'In their favour' : fair.key === 'greedy' ? 'In your favour' : fair.label;
  const myDone = heldOffer ? completedGroups(view.owners, me, iGet?.tiles || [], iGive?.tiles || []) : [];
  const theirDone = heldOffer && from ? completedGroups(view.owners, from.id, iGive?.tiles || [], iGet?.tiles || []) : [];
  const online = session.mode === 'online';

  return (
    <Sheet
      open={open}
      dismissible={false}
      onClose={() => {}}
      ariaLabel={from ? `${from.name} offers you a trade` : 'Trade offer'}
      className="hg-trade hg-trade--incoming"
      desktop="modal"
      header={heldOffer && from ? (
        <div className="hg-trade-band" data-drag="">
          <span className="hg-pc-ring" style={{ '--pc': from.color }}><Avatar preset={from.avatar} size={48} /></span>
          <div>
            <p className="hg-kicker">Trade offer</p>
            <h2>{from.name} wants to trade</h2>
          </div>
          {online ? <Countdown resetKey={sig} /> : null}
        </div>
      ) : null}
      footer={(
        <div className="hg-trade-actions">
          <Button variant="dark" size="lg" disabled={session.busy} onClick={() => session.dispatch({ type: 'TRADE_REJECT' })}>Reject</Button>
          <Button variant="green" size="lg" disabled={session.busy} onClick={() => session.dispatch({ type: 'TRADE_ACCEPT' })}>Accept</Button>
        </div>
      )}
    >
      {heldOffer ? (
        <>
          <div className="hg-trade-sides">
            <SideView title="You get" side={iGet} state={view} tone="get" />
            <span className="hg-trade-swap" aria-hidden="true"><Icon name="swap" size={22} /></span>
            <SideView title="You give" side={iGive} state={view} tone="give" />
          </div>
          <section className={`hg-fair is-${fair.key}`} role="status" aria-label="Fairness">
            <div className="hg-fair-nums">
              <span>You get <b>{formatINR(getting)}</b></span>
              <Pill tone={fair.tone}>{label}</Pill>
              <span>You give <b>{formatINR(giving)}</b></span>
            </div>
            {myDone.map((g) => <p key={`m${g}`} className="hg-hint is-ok"><Icon name="check" size={14} /> Completes {GROUPS[g].name} for you</p>)}
            {theirDone.map((g) => <p key={`t${g}`} className="hg-hint is-warn"><Icon name="info" size={14} /> Completes {GROUPS[g].name} for {nameOf(from)}</p>)}
            {online ? <p className="hg-hint">If you do not answer in {OFFER_SECONDS} seconds the offer is rejected.</p> : null}
          </section>
        </>
      ) : null}
    </Sheet>
  );
}

export default function TradeSheet({ session, open, onClose }) {
  return (
    <>
      <ComposerSheet session={session} open={open} onClose={onClose} />
      <IncomingSheet session={session} />
    </>
  );
}
