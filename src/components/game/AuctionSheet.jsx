// Sealed-bid auction of a property that a player skipped (when the host turned auctions on), or the bidding
// between snatchers (`pending.snatch`): there only the claimants get the bid form, everybody else (the buyer
// included) just watches. Opens by itself; a bidder can only close it by bidding or passing.
// Works for any buyable tile: plot, station or utility.
import { useEffect, useState } from 'react';
import { Avatar, TileIcon } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { tileAccent, tileTypeLabel, useHeld } from './ui/helpers.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round50 = (v) => Math.round(v / 50) * 50;

/** One id per auction: the same tile can be auctioned again later, and must not inherit the old "I passed". */
export const auctionInstance = (view, auction) =>
  auction ? `${auction.tile}:${view.round}:${view.turnCount ?? view.turn}:${auction.snatch ? 's' : 'a'}` : null;

export default function AuctionSheet({ session }) {
  const { options, view, me } = session;
  const pend = view?.pending;
  const auction = view?.phase === 'auction' && pend?.type === 'auction' ? pend : null;
  const bidOpt = options?.bid || null;
  const tileKey = auction ? auction.tile : null;
  // One auction = one instance. The local "I bid / I passed" memory is keyed by it and wiped when the auction ends,
  // so the next auction of the SAME tile (a skipped tile can come round again) never starts as "already answered".
  const instance = auctionInstance(view, auction);

  const [st, setSt] = useState({ key: null, amount: null, sent: null });
  const cur = st.key === instance ? st : { key: instance, amount: null, sent: null };
  const update = (patch) => setSt({ ...cur, ...patch, key: instance });
  const [hiddenKey, setHiddenKey] = useState(null); // an observer may close the snatch-bidding panel
  useEffect(() => {
    if (!auction) setSt({ key: null, amount: null, sent: null });
  }, [auction]);

  const myRecorded = auction?.bids && Object.prototype.hasOwnProperty.call(auction.bids, me) ? auction.bids[me] : undefined;
  const waiting = !!auction && (myRecorded !== undefined || cur.sent !== null);

  // Snatch bidding: the engine pre-fills a 0 bid for everyone who did not snatch, so "recorded 0" alone does not
  // make a claimant. Use the roster when the state has one, else: I can bid, I bid here, or I recorded a real bid.
  const snatch = !!auction?.snatch;
  const roster = Array.isArray(auction?.claimants) ? auction.claimants : Array.isArray(auction?.eligible) ? auction.eligible : null;
  const claimant = !snatch || (roster ? roster.includes(me) : !!bidOpt || cur.sent !== null || myRecorded > 0);
  const observer = snatch && !claimant;
  const open = !!auction && (!!bidOpt || waiting) && !(observer && hiddenKey === instance);

  const heldTile = useHeld(tileKey);
  const heldMin = useHeld(bidOpt?.min ?? auction?.minBid ?? null);
  const mineP = view?.players?.find((p) => p.id === me);
  const heldMax = useHeld(bidOpt?.max ?? mineP?.cash ?? null);

  const tile = heldTile != null ? TILES[heldTile] : null;
  const min = heldMin ?? 0;
  const max = heldMax ?? 0;
  const canBid = max >= min && max > 0;
  const value = clamp(cur.amount ?? min, min, Math.max(min, max));
  const sentAmount = cur.sent !== null ? cur.sent : myRecorded;

  const step = (d) => update({ amount: clamp(value + d, min, Math.max(min, max)) });
  const send = (amount) => {
    session.dispatch({ type: 'BID', amount });
    update({ sent: amount });
  };

  const presets = [
    { key: 'min', label: 'Min', amount: min },
    { key: 'mid', label: '1.2× min', amount: Math.max(min, round50(min * 1.2)) },
    { key: 'full', label: 'Full price', amount: tile?.price ?? min * 2 },
  ];

  const { color, ink } = tile ? tileAccent(tile) : { color: '#3b2d8f', ink: '#fff' };
  const others = (view?.players || []).filter((p) => !p.bankrupt && p.id !== me && (!snatch || (roster ? roster.includes(p.id) : false)));
  const buyer = snatch ? (view?.players || []).find((p) => p.id === auction.buyer) : null;
  const buyerName = buyer ? (buyer.id === me ? 'You' : buyer.name) : 'The buyer';
  const paid = auction?.price ?? tile?.price ?? 0;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <Sheet
      open={open}
      onClose={() => { if (observer) setHiddenKey(instance); }}
      dismissible={observer}
      ariaLabel={tile ? `${snatch ? 'Snatch bidding' : 'Auction'} for ${tile.name}` : 'Auction'}
      className="hg-auction"
      desktop="modal"
      header={tile ? (
        <div className="hg-prop-band hg-auction-band" data-drag="" style={{ '--band': color, '--ink': ink }}>
          <span className="hg-prop-icon"><TileIcon tile={tile} size={44} /></span>
          <div className="hg-prop-titles">
            <p className="hg-kicker">{snatch ? 'Snatch bidding' : <>Auction &middot; sealed bids</>}</p>
            <h2>{tile.name}</h2>
          </div>
          <span className="hg-prop-type">{tileTypeLabel(tile)} &middot; {formatINR(tile.price)}</span>
        </div>
      ) : null}
    >
      {tile && observer ? (
        <div className="hg-auction-wait" role="status">
          <p className="hg-auction-waiting">
            Snatchers are bidding for {tile.name}<span className="hg-dots" aria-hidden="true"><i /><i /><i /></span>
          </p>
          <p className="hg-hint">
            <Icon name="info" size={14} />
            <span>{buyerName} already paid {formatINR(paid)} and {buyer?.id === me ? 'keep' : 'keeps'} it if nobody bids.</span>
          </p>
        </div>
      ) : tile ? (
        waiting ? (
          <div className="hg-auction-wait" role="status">
            <div className="hg-auction-sealed">
              <Icon name="lock" size={22} />
              <div>
                <b>{sentAmount > 0 ? `Sealed bid: ${formatINR(sentAmount)}` : 'You passed'}</b>
                <small>Bids are secret until everyone has chosen.</small>
              </div>
            </div>
            <p className="hg-auction-waiting">
              Waiting for {snatch ? 'the other snatchers' : 'others'}<span className="hg-dots" aria-hidden="true"><i /><i /><i /></span>
            </p>
            <ul className="hg-auction-others">
              {others.map((p) => {
                const done = !!auction?.bids && Object.prototype.hasOwnProperty.call(auction.bids, p.id);
                return (
                  <li key={p.id} className={done ? 'is-done' : ''} style={{ '--pc': p.color }}>
                    <span className="hg-pc-ring"><Avatar preset={p.avatar} size={30} /></span>
                    <span className="hg-auction-oname">{p.name}</span>
                    <span className="hg-auction-ostate">{done ? <Icon name="check" size={16} /> : <Icon name="hourglass" size={16} />}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="hg-auction-form">
            {snatch ? (
              <p className="hg-hint">
                <Icon name="info" size={14} />
                <span>You snatched! {buyerName} already paid {formatINR(paid)} and {buyer?.id === me ? 'keep' : 'keeps'} it if nobody bids. The winner pays their bid and spends a Snatch.</span>
              </p>
            ) : null}
            <div className="hg-auction-facts">
              <div><span>Minimum bid</span><b>{formatINR(min)}</b></div>
              <div><span>Your cash</span><b className="is-gold">{formatINR(max)}</b></div>
            </div>

            {canBid ? (
              <>
                <div className="hg-auction-amount" aria-live="polite">
                  <span>Your bid</span>
                  <output>{formatINR(value)}</output>
                </div>

                <div className="hg-stepper" role="group" aria-label="Adjust bid">
                  <Button variant="dark" onClick={() => step(-500)} aria-label="Decrease by 500" disabled={value <= min}>&minus;500</Button>
                  <Button variant="dark" onClick={() => step(-100)} aria-label="Decrease by 100" disabled={value <= min}>&minus;100</Button>
                  <Button variant="dark" onClick={() => step(100)} aria-label="Increase by 100" disabled={value >= max}>+100</Button>
                  <Button variant="dark" onClick={() => step(500)} aria-label="Increase by 500" disabled={value >= max}>+500</Button>
                </div>

                <input
                  className="hg-range"
                  type="range"
                  min={min}
                  max={max}
                  step={10}
                  value={value}
                  onChange={(e) => update({ amount: Number(e.target.value) })}
                  aria-label="Bid amount"
                  style={{ '--pct': `${pct}%` }}
                />

                <div className="hg-presets" role="group" aria-label="Quick amounts">
                  {presets.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`hg-preset${value === clamp(p.amount, min, max) ? ' is-on' : ''}`}
                      disabled={p.amount > max}
                      onClick={() => update({ amount: clamp(p.amount, min, max) })}
                    >
                      <span>{p.label}</span>
                      <b>{formatINR(p.amount)}</b>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="hg-hint is-warn hg-auction-poor">
                <Icon name="info" size={16} /> You cannot afford the minimum bid of {formatINR(min)}.
              </p>
            )}

            <div className="hg-auction-actions">
              <Button variant="dark" size="lg" onClick={() => send(0)}>Pass</Button>
              <Button variant="gold" size="lg" disabled={!canBid} onClick={() => send(value)}>
                Place bid{canBid ? <> &middot; {formatINR(value)}</> : null}
              </Button>
            </div>
          </div>
        )
      ) : null}
    </Sheet>
  );
}
