// Tap any tile: a Monopoly-style TITLE DEED. Property: rent by building level, mortgage value, building prices and the
// full-set note. Station / utility: rent by number owned. Corners, cards and taxes: the rule in a line or two.
// Also the owner and set progress, landing odds, the mortgaged face, and the owner's Build / Sell / Mortgage
// actions (+ Buy/Skip when the purchase is pending).
import '@/styles/deed.css';
import { Avatar, TileIcon } from '@/components/art/index.js';
import {
  BAIL_FINE, GROUPS, GROUP_TILES, HOTEL_LEVEL, LEVEL_NAMES, MAX_LEVEL, PASS_START, SET_BONUS, TILES, TRANSPORT_RENT, UTILITY_MULT,
  isBuyable, mortgageValue, rentFor, setMultiplier, taxDue, unmortgageCost, upgradeCost,
} from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { LevelPips, SetDots } from './ui/TileChip.jsx';
import {
  DEFAULT_CFG, KISMET_DECKS, canUpgradeSafe, diceSum, landingOddsSafe, previewRentSafe, tileAccent, tileTypeLabel, useHeld,
  useStateLike, worthOf,
} from './ui/helpers.js';

const X = '×';
const GO_TO_JAIL = 30;

/** One line of a deed table: label (+ optional dim note) on the left, amount on the right. */
function DeedRow({ label, note, value, small, current = false, hotel = false }) {
  return (
    <tr className={`${current ? 'is-current' : ''}${hotel ? ' is-hotel' : ''}`}>
      <th scope="row">{label}{note ? <em>{note}</em> : null}</th>
      <td>{value}{small ? <small>{small}</small> : null}</td>
    </tr>
  );
}

/** The loan line at the bottom of every buyable deed. */
function MortgageLine({ tile, mine }) {
  return (
    <p className="hg-deed-line">
      <span>Mortgage value</span>
      <b>{formatINR(mortgageValue(tile))}</b>
      {mine ? <small>unmortgage {formatINR(unmortgageCost(tile))}</small> : null}
    </p>
  );
}

/** What a non-buyable square does, as a headline rule plus an optional second sentence. */
function specialText(tile, cfg, state, me) {
  const passStart = cfg.passStart ?? PASS_START;
  const bail = cfg.bailFine ?? BAIL_FINE;
  switch (tile.type) {
    case 'start':
      return { rule: `Collect ${formatINR(passStart)} each time you pass.`, note: 'Landing exactly on START pays it too.' };
    case 'tax': {
      if (!tile.taxPercent) return { rule: `Pay ${formatINR(tile.taxFlat)}.`, note: 'Toll gate, speed camera, challan: the money goes to the bank.' };
      const mine = state.players?.find((p) => p.id === me && !p.bankrupt);
      const worth = mine ? worthOf(state, me) : null;
      return {
        rule: `Pay ${formatINR(tile.taxFlat)}, or ${tile.taxPercent}% of your total worth if that is less.`,
        note: worth != null ? `Your worth is ${formatINR(worth)}, so this square would cost you ${formatINR(taxDue(tile, worth))} right now.` : null,
      };
    }
    case 'kismet': {
      const deck = KISMET_DECKS[tile.deck] || KISMET_DECKS.chance;
      return { rule: `Draw a ${deck.name} card.`, note: 'Cards can pay you, bill you, move your pawn or send you straight to jail.' };
    }
    case 'jail':
      return {
        rule: 'Just visiting: nothing happens.',
        note: `If you are sent here you leave by rolling a six, paying ${formatINR(bail)} bail or using a Get Out of Jail Free card.`,
      };
    case 'parking':
      return { rule: 'Rest stop: nothing happens.', note: 'No rent, no fine, no prize. Just chai and biryani.' };
    case 'gotojail':
      return { rule: 'Go straight to Chanchalguda Jail.', note: 'Do not pass START and do not collect the salary.' };
    default:
      return { rule: tile.lore || '', note: null };
  }
}

export default function PropertySheet({ session, tileId, onClose }) {
  const heldId = useHeld(tileId);
  const state = useStateLike(session);
  const tile = heldId != null ? TILES[heldId] : null;
  const o = session.options || {};
  const me = session.me;

  let body = null;
  let footer = null;
  let trapBlock = null;
  let header = null;

  if (tile) {
    const { color, ink } = tileAccent(tile);
    const cfg = { ...DEFAULT_CFG, ...(session.view?.cfg || {}) };
    const group = tile.group ? GROUPS[tile.group] : null;
    const buyable = isBuyable(tile);
    const ownerId = buyable ? state.owners[tile.id] : null;
    const owner = ownerId ? state.players.find((p) => p.id === ownerId) : null;
    const level = state.levels[tile.id] || 0;
    const mine = ownerId === me;
    const mortgaged = buyable && !!state.mortgaged?.[tile.id];
    const pend = session.view?.pending;
    const buyingThis = !!o.buy && pend?.type === 'buy' && pend.tile === tile.id;
    const skippingThis = !!o.skipBuy && pend?.type === 'buy' && pend.tile === tile.id;

    const setIds = group ? GROUP_TILES[tile.group] : tile.type === 'transport' || tile.type === 'utility'
      ? TILES.filter((t) => t.type === tile.type).map((t) => t.id) : [];
    const size = setIds.length;
    const ownedInSet = owner ? setIds.filter((t) => state.owners[t] === owner.id).length : 0;
    const fullSet = !!owner && size > 0 && ownedInSet === size;
    const mult = owner && tile.type === 'property' ? setMultiplier(ownedInSet, size) : 1;
    const youOrName = owner ? (owner.id === me ? 'You' : owner.name) : '';

    const rentNow = buyable && ownerId && !mortgaged ? previewRentSafe(state, tile.id, diceSum(session)) : 0;
    const nextLevel = Math.min(MAX_LEVEL, level + 1);
    const buildOpt = o.upgrade?.find((u) => u.tile === tile.id);
    const sellOpt = o.sellBuilding?.find((u) => u.tile === tile.id);
    const mortOpt = o.mortgage?.find((u) => u.tile === tile.id);
    const unmortOpt = o.unmortgage?.find((u) => u.tile === tile.id);
    const up = mine && tile.type === 'property' ? canUpgradeSafe(session.view, me, tile.id) : null;
    const canBuild = !!buildOpt && !session.busy;
    const isHotelStep = nextLevel === HOTEL_LEVEL && level < MAX_LEVEL;

    const odds = o.roll ? landingOddsSafe(session.view, me) : null;
    const p = odds ? odds[tile.id] : null;
    const oddsPct = p == null ? null : p > 0 && p < 0.005 ? '<1' : String(Math.round(p * 100));

    const typeLabel = tileTypeLabel(tile);
    const unit = tile.type === 'transport' ? 'station' : 'utility';

    header = (
      <div className="hg-prop-band" data-drag="" style={{ '--band': color, '--ink': ink }}>
        <span className="hg-prop-icon"><TileIcon tile={tile} size={44} /></span>
        <div className="hg-prop-titles">
          <p className="hg-kicker hg-deed-kicker">{buyable ? 'Title deed' : tile.corner ? 'Corner' : 'Square'}</p>
          <h2>{tile.name}</h2>
        </div>
        <span className="hg-prop-type">{typeLabel}</span>
      </div>
    );

    /* ---- the deed card itself ---- */
    let deed = null;
    if (buyable && mortgaged) {
      deed = (
        <div className="hg-deed hg-deed--mortgaged" style={{ '--band': color }}>
          <b className="hg-deed-mname">{tile.name}</b>
          <span className="hg-deed-dot" aria-hidden="true">&bull;</span>
          <b className="hg-deed-stamp">Mortgaged</b>
          <p>for {formatINR(mortgageValue(tile))}</p>
          <span className="hg-deed-dot" aria-hidden="true">&bull;</span>
          <em>
            Collects no rent{tile.type === 'property' ? ' and cannot be built on' : ''}.
            {mine ? ` Pay ${formatINR(unmortgageCost(tile))} to unmortgage.` : ''}
          </em>
        </div>
      );
    } else if (tile.type === 'property') {
      deed = (
        <div className="hg-deed" style={{ '--band': color }}>
          <table className="hg-deed-table" aria-label="Rent by building">
            <tbody>
              {Array.from({ length: MAX_LEVEL + 1 }, (_, i) => (
                <DeedRow
                  key={i}
                  label={i === 0 ? 'RENT' : i === HOTEL_LEVEL ? 'With HOTEL' : `With ${i} house${i > 1 ? 's' : ''}`}
                  note={i > 0 && i < HOTEL_LEVEL ? `(${LEVEL_NAMES[i]})` : null}
                  value={formatINR(rentFor(tile, i))}
                  small={i === 0 && mult > 1 && level === 0 ? `${X}${mult} as a full set` : null}
                  current={!!owner && level === i}
                  hotel={i === HOTEL_LEVEL}
                />
              ))}
            </tbody>
          </table>
          <div className="hg-deed-foot">
            <MortgageLine tile={tile} mine={mine} />
            <p className="hg-deed-line"><span>Houses cost</span><b>{formatINR(upgradeCost(tile))}</b><span>each</span></p>
            <p className="hg-deed-line"><span>Hotel costs</span><b>{formatINR(upgradeCost(tile))}</b><span>plus 4 houses</span></p>
            <p className="hg-deed-note">
              If a player owns ALL the lots of a colour group, the rent is doubled ({X}{SET_BONUS.full}) on unimproved lots in that group.
              Only a full set can build.
            </p>
          </div>
        </div>
      );
    } else if (tile.type === 'transport') {
      deed = (
        <div className="hg-deed" style={{ '--band': color }}>
          <table className="hg-deed-table" aria-label="Rent by stations owned">
            <tbody>
              {TRANSPORT_RENT.slice(1).map((rent, i) => (
                <DeedRow
                  key={i}
                  label={i === 0 ? 'RENT' : `If ${i + 1} stations are owned`}
                  note={i === 0 ? '(1 station owned)' : null}
                  value={formatINR(rent)}
                  current={!!owner && ownedInSet === i + 1}
                />
              ))}
            </tbody>
          </table>
          <div className="hg-deed-foot">
            <MortgageLine tile={tile} mine={mine} />
          </div>
        </div>
      );
    } else if (tile.type === 'utility') {
      deed = (
        <div className="hg-deed" style={{ '--band': color }}>
          <table className="hg-deed-table" aria-label="Rent by utilities owned">
            <tbody>
              {[1, 2].map((n) => (
                <DeedRow
                  key={n}
                  label={n === 1 ? '1 utility owned' : 'Both utilities owned'}
                  note={`(dice ${X} ${UTILITY_MULT[n]})`}
                  value={`${X} ${UTILITY_MULT[n]}`}
                  small={`${formatINR(UTILITY_MULT[n])} to ${formatINR(6 * UTILITY_MULT[n])} for a roll of 1 to 6`}
                  current={!!owner && ownedInSet === n}
                />
              ))}
            </tbody>
          </table>
          <div className="hg-deed-foot">
            <p className="hg-deed-note">
              If one utility is owned, the rent is {UTILITY_MULT[1]} times the amount shown on the dice. If both are owned, it is {UTILITY_MULT[2]} times.
            </p>
            <MortgageLine tile={tile} mine={mine} />
          </div>
        </div>
      );
    } else {
      const sp = specialText(tile, cfg, state, me);
      deed = (
        <div className="hg-deed hg-deed--special" style={{ '--band': color }}>
          <p className="hg-deed-rule">{sp.rule}</p>
          {sp.note ? <p className="hg-deed-note">{sp.note}</p> : null}
        </div>
      );
    }

    body = (
      <>
        <p className="hg-lore">{tile.lore}</p>

        {deed}

        {buyable ? (
          <div className="hg-prop-facts">
            <div><span>Price</span><b>{formatINR(tile.price)}</b></div>
            <div>
              <span>Owner</span>
              {owner ? (
                <b className="hg-owner" style={{ '--pc': owner.color }}>
                  <span className="hg-owner-av"><Avatar preset={owner.avatar} size={22} /></span>
                  {owner.id === me ? 'You' : owner.name}
                </b>
              ) : (
                <b className="is-dim">Unowned</b>
              )}
            </div>
            {tile.type === 'property' ? (
              <div>
                <span>Building</span>
                <b className="hg-prop-level">
                  {owner ? <LevelPips level={level} color={color} /> : null}
                  {owner ? LEVEL_NAMES[level] : '—'}
                </b>
              </div>
            ) : null}
            {owner ? (
              <div><span>Rent now</span><b className={mortgaged ? 'is-dim' : 'is-gold'}>{mortgaged ? 'None' : formatINR(rentNow)}</b></div>
            ) : (
              <div>
                <span>Rent</span>
                <b>{tile.type === 'property' ? formatINR(rentFor(tile, 0)) : tile.type === 'transport' ? formatINR(TRANSPORT_RENT[1]) : `dice ${X} ${UTILITY_MULT[1]}`}</b>
              </div>
            )}
          </div>
        ) : null}

        {oddsPct != null ? (
          <div className="hg-odds" role="status">
            <Icon name="dice" size={18} />
            <span>Chance to land here next roll: <b>{oddsPct}%</b></span>
            <i aria-hidden="true"><em style={{ width: `${Math.min(100, Math.round((p || 0) * 100 * 4))}%` }} /></i>
          </div>
        ) : null}

        {tile.type === 'property' && owner ? (
          <div className={`hg-setstat${fullSet ? ' is-full' : ''}`} style={{ '--sc': color }}>
            <SetDots owned={ownedInSet} total={size} color={color} />
            <span>
              <b>{ownedInSet}/{size} {group.name}</b>
              {' · '}
              {fullSet
                ? `${X}${SET_BONUS.full} rent on empty plots, ${youOrName} can build here`
                : `${size - ownedInSet} more for the full set`}
            </span>
          </div>
        ) : null}

        {buyable && tile.type !== 'property' && size > 1 && owner ? (
          <div className={`hg-setstat${fullSet ? ' is-full' : ''}`}>
            <Icon name={fullSet ? 'check' : 'info'} size={16} />
            <span>
              {fullSet ? `${youOrName} own${owner.id === me ? '' : 's'} every ${unit}` : `${ownedInSet}/${size} ${unit}s owned by ${owner.id === me ? 'you' : owner.name}`}
            </span>
          </div>
        ) : null}

        {up && !up.ok && !buyingThis && !mortgaged ? (
          <p className="hg-hint"><Icon name="info" size={14} /> {level >= MAX_LEVEL ? `Fully built: ${LEVEL_NAMES[MAX_LEVEL]}` : up.reason}</p>
        ) : null}
      </>
    );

    const sub = (sellOpt || mortOpt || unmortOpt) ? (
      <div className="hg-sheet-subactions">
        {sellOpt ? (
          <Button variant="dark" size="sm" onClick={() => session.dispatch({ type: 'SELL_BUILDING', tile: tile.id })}>
            Sell building +{formatINR(sellOpt.refund)}
          </Button>
        ) : null}
        {mortOpt ? (
          <Button variant="dark" size="sm" onClick={() => session.dispatch({ type: 'MORTGAGE', tile: tile.id })}>
            Mortgage +{formatINR(mortOpt.value)}
          </Button>
        ) : null}
        {unmortOpt ? (
          <Button variant="green" size="sm" onClick={() => session.dispatch({ type: 'UNMORTGAGE', tile: tile.id })}>
            Unmortgage {formatINR(unmortOpt.cost)}
          </Button>
        ) : null}
      </div>
    ) : null;

    // traps (docs/GAME_RULES.md 13.4): view.traps is already redacted to my own
    const myTrapHere = (session.view?.traps || []).some((t) => t.tile === tile.id && t.owner === me);
    const canTrapHere = !myTrapHere && !!o.trap && tile.id !== GO_TO_JAIL && !session.busy;
    trapBlock = myTrapHere ? (
      <p className="hg-trapnote is-set" role="status"><Icon name="warn" size={18} /> Your trap is set here</p>
    ) : canTrapHere ? (
      <div className="hg-trapbox">
        <Button variant="gold" size="lg" className="hg-trap-btn" onClick={() => { session.dispatch({ type: 'PLACE_TRAP', tile: tile.id }); onClose?.(); }}>
          <Icon name="warn" size={20} /> Set trap here
        </Button>
        <span className="hg-hint">Hidden. The first rival to land here is thrown in jail.</span>
      </div>
    ) : null;

    if (buyingThis || skippingThis) {
      footer = (
        <div className="hg-sheet-actions">
          {skippingThis ? <Button variant="dark" onClick={() => { session.dispatch({ type: 'SKIP_BUY' }); onClose?.(); }}>Skip</Button> : null}
          {buyingThis ? (
            <Button variant="green" size="lg" onClick={() => { session.dispatch({ type: 'BUY' }); onClose?.(); }}>
              Buy for {formatINR(pend.price)}
            </Button>
          ) : (
            <span className="hg-hint is-warn">Not enough cash to buy</span>
          )}
        </div>
      );
    } else if (mine && tile.type === 'property' && !mortgaged) {
      footer = (
        <div className="hg-sheet-actions">
          <Button
            variant={canBuild ? 'gold' : 'dark'}
            size="lg"
            className={canBuild && isHotelStep ? 'hg-btn--hotel' : ''}
            disabled={!canBuild}
            onClick={() => session.dispatch({ type: 'UPGRADE', tile: tile.id })}
          >
            <Icon name="upgrade" size={20} />
            {level >= MAX_LEVEL
              ? `Fully built: ${LEVEL_NAMES[MAX_LEVEL]}`
              : isHotelStep
                ? <>Build hotel &middot; {formatINR(upgradeCost(tile))}</>
                : <>Upgrade to {LEVEL_NAMES[nextLevel]} &middot; {formatINR(upgradeCost(tile))}</>}
          </Button>
          {!canBuild && level < MAX_LEVEL ? (
            <span className="hg-hint">
              {session.busy ? 'Wait for the action to finish' : up?.ok ? 'You can build during your turn' : up?.reason}
            </span>
          ) : null}
          {sub}
        </div>
      );
    } else if (mine && sub) {
      footer = <div className="hg-sheet-actions">{sub}</div>;
    }
  }

  if (trapBlock) footer = <>{footer}{trapBlock}</>;

  return (
    <Sheet
      open={tileId != null}
      onClose={onClose}
      ariaLabel={tile ? tile.name : 'Tile details'}
      header={header}
      footer={footer}
      className="hg-propsheet"
      desktop="drawer"
    >
      {body}
    </Sheet>
  );
}
