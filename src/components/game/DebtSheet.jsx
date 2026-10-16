// Debt phase: you owe more cash than you hold. Raise cash (mortgage / sell a building), then pay,
// or declare bankruptcy. Not dismissible. Opens by itself for the debtor only.
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/art/index.js';
import { LEVEL_NAMES, TILES, mortgageValue } from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import Money from './ui/Money.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import { LevelPips } from './ui/TileChip.jsx';
import { tileAccent, useHeld, useStateLike } from './ui/helpers.js';

const REASONS = { rent: 'Rent', tax: 'Property tax', card: 'Kismet card', bail: 'Bail', film: 'Film City fee', other: 'Payment' };

export default function DebtSheet({ session }) {
  const { view, options: o, me, busy } = session;
  const state = useStateLike(session);
  const debt = view?.debt && view.debt.player === me ? view.debt : null;
  const inDebt = view?.phase === 'debt' && !!debt;
  const [latched, setLatched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lists = useRef({ mortgage: [], sell: [] });

  useEffect(() => {
    if (!inDebt) { setLatched(false); setConfirm(false); } else if (o?.debt) setLatched(true);
  }, [inDebt, o?.debt]);

  if (inDebt && o?.debt) lists.current = { mortgage: o.mortgage || [], sell: o.sellBuilding || [] };
  const open = inDebt && (!!o?.debt || latched);

  const heldAmount = useHeld(debt ? debt.amount : null) ?? 0;
  const heldCreditor = useHeld(debt ? debt.creditor ?? '__bank__' : null);
  const heldReason = useHeld(debt ? debt.reason ?? 'other' : null) ?? 'other';
  const creditorId = heldCreditor === '__bank__' ? null : heldCreditor;
  const creditor = creditorId ? state.players.find((p) => p.id === creditorId) : null;
  const mine = view?.players?.find((p) => p.id === me);
  const cash = mine?.cash ?? 0;
  const shortfall = Math.max(0, heldAmount - cash);
  const canPay = !busy && (!!o?.payDebt || cash >= heldAmount) && cash >= heldAmount;
  const mortgages = lists.current.mortgage;
  const sells = lists.current.sell;
  const raisable = mortgages.reduce((n, m) => n + m.value, 0) + sells.reduce((n, s) => n + s.refund, 0);
  const pct = heldAmount > 0 ? Math.min(100, Math.round((cash / heldAmount) * 100)) : 100;
  const who = creditor ? creditor.name : 'the bank';

  const row = (tileId, key, label, value, onClick) => {
    const tile = TILES[tileId];
    const { color } = tileAccent(tile);
    return (
      <li key={key} className="hg-debt-row" style={{ '--tc': color }}>
        <span className="hg-debt-tile">
          <i className="hg-tilechip-dot" />
          <span>
            <b>{tile.name}</b>
            <small>
              {tile.type === 'property' && (state.levels[tileId] || 0) > 0
                ? <><LevelPips level={state.levels[tileId] || 0} color={color} /> {LEVEL_NAMES[state.levels[tileId] || 0]}</>
                : `Price ${formatINR(tile.price)}`}
            </small>
          </span>
        </span>
        <Button variant="dark" size="sm" disabled={busy} onClick={onClick}>{label} +{formatINR(value)}</Button>
      </li>
    );
  };

  return (
    <>
      <Sheet
        open={open}
        dismissible={false}
        onClose={() => {}}
        ariaLabel="You owe money"
        className="hg-debt"
        desktop="modal"
        header={(
          <div className="hg-debt-band" data-drag="">
            <span className="hg-debt-ico"><Icon name="warn" size={30} /></span>
            <div>
              <p className="hg-kicker">{REASONS[heldReason] || REASONS.other} due</p>
              <h2>You owe {formatINR(heldAmount)}</h2>
              <p className="hg-debt-to">
                to {creditor ? (
                  <span className="hg-debt-who"><span className="hg-owner-av" style={{ '--pc': creditor.color }}><Avatar preset={creditor.avatar} size={20} /></span>{creditor.name}</span>
                ) : (
                  <span className="hg-debt-who"><Icon name="bank" size={16} /> the bank</span>
                )}
              </p>
            </div>
          </div>
        )}
        footer={(
          <div className="hg-debt-actions">
            <Button variant="rose" size="sm" onClick={() => setConfirm(true)} disabled={busy}>Declare bankruptcy</Button>
            <Button variant="gold" size="lg" disabled={!canPay} onClick={() => session.dispatch({ type: 'PAY_DEBT' })}>
              Pay {formatINR(heldAmount)}
            </Button>
          </div>
        )}
      >
        <div className="hg-debt-meter" role="group" aria-label="Cash against debt">
          <div className="hg-debt-nums">
            <span>Your cash <b><Money value={cash} /></b></span>
            <span className={shortfall > 0 ? 'is-bad' : 'is-good'}>{shortfall > 0 ? <>Short by <b><Money value={shortfall} /></b></> : 'Covered'}</span>
          </div>
          <div className="hg-debt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={heldAmount} aria-valuenow={Math.min(cash, heldAmount)}>
            <i style={{ width: `${pct}%` }} className={shortfall > 0 ? '' : 'is-ok'} />
          </div>
          {shortfall > 0 ? (
            <p className="hg-hint">
              <span>Raise {formatINR(shortfall)} more. You can still raise up to <b>{formatINR(raisable)}</b> below.</span>
            </p>
          ) : (
            <p className="hg-hint is-ok"><Icon name="check" size={14} /> <span>You can pay now, or keep raising cash first.</span></p>
          )}
        </div>

        {mortgages.length ? (
          <>
            <h3 className="hg-h3">Mortgage a property <small>(keep it, stop collecting rent)</small></h3>
            <ul className="hg-debt-list">
              {mortgages.map((m) => row(m.tile, `m${m.tile}`, 'Mortgage', m.value ?? mortgageValue(TILES[m.tile]), () => session.dispatch({ type: 'MORTGAGE', tile: m.tile })))}
            </ul>
          </>
        ) : null}

        {sells.length ? (
          <>
            <h3 className="hg-h3">Sell a building <small>(refund half the build cost)</small></h3>
            <ul className="hg-debt-list">
              {sells.map((s) => row(s.tile, `s${s.tile}`, 'Sell', s.refund, () => session.dispatch({ type: 'SELL_BUILDING', tile: s.tile })))}
            </ul>
          </>
        ) : null}

        {!mortgages.length && !sells.length ? (
          <p className="hg-empty">Nothing left to sell or mortgage.</p>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirm && open}
        title="Declare bankruptcy?"
        text={`You will leave the game and all your properties go to ${who}. This cannot be undone.`}
        confirmLabel="Declare bankruptcy"
        cancelLabel="Keep fighting"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); session.dispatch({ type: 'RESIGN' }); }}
      />
    </>
  );
}
