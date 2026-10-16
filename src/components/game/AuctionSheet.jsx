// Sealed-bid auction (Laad Bazaar). Opens by itself, can only be closed by bidding or passing.
import { useState } from 'react';
import { Avatar, TileIcon } from '@/components/art/index.js';
import { TILES } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { tileAccent, useHeld } from './ui/helpers.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round50 = (v) => Math.round(v / 50) * 50;

export default function AuctionSheet({ session }) {
  const { options, view, me } = session;
  const pend = view?.pending;
  const auction = view?.phase === 'auction' && pend?.type === 'auction' ? pend : null;
  const bidOpt = options?.bid || null;
  const tileKey = auction ? auction.tile : null;

  const [st, setSt] = useState({ key: null, amount: null, sent: null });
  const cur = st.key === tileKey ? st : { key: tileKey, amount: null, sent: null };
  const update = (patch) => setSt({ ...cur, ...patch, key: tileKey });

  const myRecorded = auction?.bids && Object.prototype.hasOwnProperty.call(auction.bids, me) ? auction.bids[me] : undefined;
  const waiting = !!auction && (myRecorded !== undefined || cur.sent !== null);
  const open = !!auction && (!!bidOpt || waiting);

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
    { key: 'mid', label: '1.2× min', amount: round50(min * 1.2) },
    { key: 'full', label: 'Full price', amount: tile?.price ?? min * 2 },
  ];

  const { color, ink } = tile ? tileAccent(tile) : { color: '#3b2d8f', ink: '#fff' };
  const others = (view?.players || []).filter((p) => !p.bankrupt && p.id !== me);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <Sheet
      open={open}
      onClose={() => {}}
      dismissible={false}
      ariaLabel={tile ? `Auction for ${tile.name}` : 'Auction'}
      className="hg-auction"
      desktop="modal"
      header={tile ? (
        <div className="hg-prop-band hg-auction-band" data-drag="" style={{ '--band': color, '--ink': ink }}>
          <span className="hg-prop-icon"><TileIcon tile={tile} size={44} /></span>
          <div className="hg-prop-titles">
            <p className="hg-kicker">Sealed-bid auction</p>
            <h2>{tile.name}</h2>
            <p lang="te">{tile.te}</p>
          </div>
          <span className="hg-prop-type">{formatINR(tile.price)}</span>
        </div>
      ) : null}
    >
      {tile ? (
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
              Waiting for others<span className="hg-dots" aria-hidden="true"><i /><i /><i /></span>
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
