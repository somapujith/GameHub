// Tap any tile: name + Telugu name, lore, price, rent ladder (0..Hotel), set bonus, owner + set progress,
// landing odds, mortgage state, and the owner's Build / Sell / Mortgage actions (+ Buy/Skip when pending).
import { Avatar, TileIcon } from '@/components/art/index.js';
import {
  GROUPS, GROUP_TILES, HOTEL_LEVEL, LEVEL_NAMES, LEVEL_NAMES_TE, MAX_LEVEL, SET_BONUS, TILES, TRANSPORT_RENT, UTILITY_MULT,
  mortgageValue, rentFor, setMultiplier, unmortgageCost, upgradeCost,
} from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { LevelPips, SetDots } from './ui/TileChip.jsx';
import {
  DEFAULT_CFG, canUpgradeSafe, diceSum, landingOddsSafe, previewRentSafe, tileAccent, useHeld, useStateLike,
} from './ui/helpers.js';

const TYPE_LABEL = {
  start: 'Start', property: 'Property', transport: 'Transport', utility: 'Utility', kismet: 'Kismet',
  tax: 'Tax', film: 'Film City', jail: 'Jail', auction: 'Auction',
};
const X = '×';

function Special({ tile, cfg }) {
  const c = { ...DEFAULT_CFG, ...(cfg || {}) };
  const text = {
    start: `Pass or land here to collect ${formatINR(c.passStart)} salary.`,
    tax: `Land here and pay ${formatINR(c.taxAmount)} in property tax.`,
    film: `Land here for a cameo and collect ${formatINR(c.filmFee)}.`,
    jail: `Visiting is free. If you are sent here you skip a turn unless you roll ${cfg?.diceCount === 1 ? 'a six' : 'doubles'}, pay ${formatINR(c.bailFine)} bail or use a Get-out-of-jail card.`,
    kismet: 'Draw a Kismet card: a windfall, a challan, or something odd.',
    auction: 'A random unowned property goes under the hammer. Everyone places one sealed bid, starting at half price.',
  }[tile.type];
  return text ? <p className="hg-special">{text}</p> : null;
}

export default function PropertySheet({ session, tileId, onClose }) {
  const heldId = useHeld(tileId);
  const state = useStateLike(session);
  const tile = heldId != null ? TILES[heldId] : null;
  const o = session.options || {};
  const me = session.me;

  let body = null;
  let footer = null;
  let header = null;

  if (tile) {
    const { color, ink } = tileAccent(tile);
    const group = tile.group ? GROUPS[tile.group] : null;
    const buyable = tile.type === 'property' || tile.type === 'transport' || tile.type === 'utility';
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

    header = (
      <div className="hg-prop-band" data-drag="" style={{ '--band': color, '--ink': ink }}>
        <span className="hg-prop-icon"><TileIcon tile={tile} size={44} /></span>
        <div className="hg-prop-titles">
          <h2>{tile.name}</h2>
          <p lang="te">{tile.te}</p>
        </div>
        <span className="hg-prop-type">{group ? group.name : TYPE_LABEL[tile.type]}</span>
      </div>
    );

    body = (
      <>
        <p className="hg-lore">{tile.lore}</p>

        {mortgaged ? (
          <div className="hg-mortbanner" role="status">
            <Icon name="lock" size={18} />
            <span>
              <b>Mortgaged.</b> Collects no rent and cannot be built on. {mine ? `Pay ${formatINR(unmortgageCost(tile))} to unmortgage.` : ''}
            </span>
          </div>
        ) : null}

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
              <div><span>Rent (plot)</span><b>{formatINR(tile.type === 'property' ? rentFor(tile, 0) : tile.type === 'transport' ? TRANSPORT_RENT[1] : UTILITY_MULT[1] * 7)}</b></div>
            )}
            {mine ? (
              <div className="is-wide"><span>Mortgage value</span><b>{formatINR(mortgageValue(tile))} <small>(unmortgage {formatINR(unmortgageCost(tile))})</small></b></div>
            ) : null}
          </div>
        ) : null}

        {oddsPct != null ? (
          <div className="hg-odds" role="status">
            <Icon name="dice" size={18} />
            <span>Chance to land here next roll: <b>{oddsPct}%</b></span>
            <i aria-hidden="true"><em style={{ width: `${Math.min(100, Math.round((p || 0) * 100 * 4))}%` }} /></i>
          </div>
        ) : null}

        {tile.type === 'property' ? (
          <>
            <p className="hg-bonus">
              <b>Set bonus</b>{' '}
              {size === 3
                ? `Own 2 of 3: ${X}${SET_BONUS.partial} rent on empty plots · Full colour: ${X}${SET_BONUS.full} and you can build`
                : `Own both: ${X}${SET_BONUS.full} rent on empty plots and you can build`}
            </p>
            {owner ? (
              <div className={`hg-setstat${fullSet ? ' is-full' : ''}`} style={{ '--sc': color }}>
                <SetDots owned={ownedInSet} total={size} color={color} />
                <span>
                  <b>{ownedInSet}/{size} {group.name}</b>
                  {' · '}
                  {fullSet
                    ? `${youOrName} can build here`
                    : mult > 1
                      ? `${X}${mult} rent on empty plots`
                      : 'no set bonus yet'}
                </span>
              </div>
            ) : null}
          </>
        ) : null}

        {buyable && tile.type !== 'property' && size > 1 && owner ? (
          <div className={`hg-setstat${fullSet ? ' is-full' : ''}`}>
            <Icon name={fullSet ? 'check' : 'info'} size={16} />
            <span>
              {fullSet ? `${youOrName} own${owner.id === me ? '' : 's'} every ${TYPE_LABEL[tile.type].toLowerCase()} tile` : `${ownedInSet}/${size} ${TYPE_LABEL[tile.type].toLowerCase()} tiles owned by ${owner.id === me ? 'you' : owner.name}`}
            </span>
          </div>
        ) : null}

        {tile.type === 'property' ? (
          <table className="hg-ladder">
            <caption>Rent by building</caption>
            <thead>
              <tr><th scope="col">Level</th><th scope="col" className="r">Rent</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: MAX_LEVEL + 1 }, (_, i) => (
                <tr key={i} className={`${owner && level === i ? 'is-current' : ''}${i === HOTEL_LEVEL ? ' is-hotel' : ''}`}>
                  <th scope="row">
                    <LevelPips level={i} color={color} />
                    <span>{LEVEL_NAMES[i]}</span>
                    <small lang="te">{LEVEL_NAMES_TE[i]}</small>
                  </th>
                  <td className="r">
                    {formatINR(rentFor(tile, i))}
                    {i === 0 ? <small>{X}{SET_BONUS.partial}/{X}{SET_BONUS.full} with a set</small> : <small>+{formatINR(upgradeCost(tile))} to build</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tile.type === 'transport' ? (
          <table className="hg-ladder">
            <caption>Rent by transport owned</caption>
            <thead><tr><th scope="col">Owned</th><th scope="col" className="r">Rent</th></tr></thead>
            <tbody>
              {[1, 2, 3].map((n) => (
                <tr key={n} className={owner && ownedInSet === n ? 'is-current' : ''}>
                  <th scope="row">{n} of 3</th>
                  <td className="r">{formatINR(TRANSPORT_RENT[n])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {tile.type === 'utility' ? (
          <table className="hg-ladder">
            <caption>Rent = dice total {X} multiplier</caption>
            <thead><tr><th scope="col">Owned</th><th scope="col" className="r">Rent</th></tr></thead>
            <tbody>
              {[1, 2].map((n) => (
                <tr key={n} className={owner && ownedInSet === n ? 'is-current' : ''}>
                  <th scope="row">{n} of 2</th>
                  <td className="r">roll {X} {UTILITY_MULT[n]}<small>{state.cfg?.diceCount === 1 ? `${formatINR(UTILITY_MULT[n])}–${formatINR(6 * UTILITY_MULT[n])} for a roll of 1–6` : `about ${formatINR(7 * UTILITY_MULT[n])} at a 7`}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {!buyable ? <Special tile={tile} cfg={session.view?.cfg} /> : null}

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

  return (
    <Sheet
      open={tileId != null}
      onClose={onClose}
      ariaLabel={tile ? `${tile.name}, ${tile.te}` : 'Tile details'}
      header={header}
      footer={footer}
      className="hg-propsheet"
      desktop="drawer"
    >
      {body}
    </Sheet>
  );
}
