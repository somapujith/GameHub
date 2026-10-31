// Concise, illustrated rules for the 40-square Hyderabad board (colour sets, building ladder, mortgage, trade,
// stations and utilities, jail, cards, tax, auction on skip, debt, dice). Numbers come from the board data and
// from the live game settings when available.
import { BuildingArt } from '@/components/art/index.js';
import {
  BAIL_FINE, GROUPS, LEVEL_NAMES, MAX_LEVEL, PASS_START, SET_BONUS, START_CASH, TILES, TRANSPORT_RENT, UNMORTGAGE_INTEREST,
  UTILITY_MULT,
} from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import * as shared from '@shared/index.js';
import Sheet from './ui/Sheet.jsx';
import { DEFAULT_CFG, FAIR_DICE_TEXT, LUCKY_DICE_TEXT, ROUND_RULE_TEXT, settingsSummary } from './ui/helpers.js';

const LEVEL_COLORS = ['#9aa5b1', '#22a06b', '#3b82f6', '#f08a24', '#e5484d', '#f2b705'];
const LEVEL_SUB = ['base rent', '1 house', '2 houses', '3 houses', '4 houses', 'hotel'];
const X = '×';

// Read defensively: the sheet must keep working if the engine constants are not there yet.
const posInt = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : fallback);
const EVENT_EVERY = posInt(shared.EVENT_EVERY, 5);
const TOKEN_CAP = posInt(shared.TOKEN_CAP, 3);
const LAPS_PER_TOKEN = posInt(shared.LAPS_PER_TOKEN, 3);
const TRAPS_EACH = posInt(shared.TRAPS_EACH, 1);
const CITY_EVENTS = Array.isArray(shared.CITY_EVENTS) && shared.CITY_EVENTS.length
  ? shared.CITY_EVENTS
  : [
    { id: 'monsoon', title: 'Monsoon Floods', text: 'one colour group pays half rent this round.' },
    { id: 'ipl', title: 'IPL Night at Uppal', text: 'one colour group pays double rent this round.' },
    { id: 'metro_strike', title: 'Metro Strike', text: 'stations collect no rent this round.' },
    { id: 'tax_holiday', title: 'GHMC Tax Holiday', text: 'property tax and the ORR challan cost nothing this round.' },
    { id: 'bonalu', title: 'Bonalu Festival', text: 'everyone receives a festival gift.' },
  ];

const STATIONS = TILES.filter((t) => t.type === 'transport');
const UTILITIES = TILES.filter((t) => t.type === 'utility');
const TAXES = TILES.filter((t) => t.type === 'tax');

/** "₹500 (Brown, Light Blue) · ₹1,000 (Pink, Lakeside) ..." from the group tiles. */
const BUILD_PRICES = (() => {
  const byCost = new Map();
  for (const g of Object.values(GROUPS)) {
    const cost = TILES.find((t) => t.group === g.id)?.houseCost || 0;
    byCost.set(cost, [...(byCost.get(cost) || []), g.name]);
  }
  return [...byCost.entries()].sort((a, b) => a[0] - b[0]).map(([cost, names]) => `${formatINR(cost)} (${names.join(', ')})`).join(' · ');
})();

function Dice({ a, b }) {
  const pips = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
  };
  const face = (n) => (
    <svg viewBox="0 0 100 100" width="21" height="21" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="20" fill="#fff7e6" stroke="#f3e6c8" strokeWidth="4" />
      {pips[n].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#1b1340" />)}
    </svg>
  );
  return <span className="hg-rules-dice">{face(a)}{b ? face(b) : null}</span>;
}

function Rule({ icon, title, children, wide = false }) {
  return (
    <section className={`hg-rule${wide ? ' hg-rule--wide' : ''}`}>
      <span className="hg-rule-ico" aria-hidden="true">{icon}</span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </section>
  );
}

export default function RulesSheet({ open, onClose, session }) {
  const rawCfg = session?.display?.cfg || session?.view?.cfg || {};
  const cfg = { ...DEFAULT_CFG, ...rawCfg };
  const goal = session?.display?.goal ?? cfg.goal;
  const summary = settingsSummary(rawCfg, goal);
  const fairDice = (cfg.dice ?? 'lucky') === 'fair';
  const declineAuction = cfg.auctionOnDecline !== false;
  const passStart = cfg.passStart ?? PASS_START;
  const bail = cfg.bailFine ?? BAIL_FINE;
  const startCash = cfg.startCash ?? START_CASH;
  const tokens = Math.max(0, Math.round(Number(cfg.snatches ?? 1)));
  const snatchSecs = Math.max(1, Math.round((Number(cfg.snatchMs) || 3000) / 1000));
  const pct = (n) => `${Math.round(n * 100)}%`;
  const taxLine = (t) => (t.taxPercent
    ? `${t.name}: pay ${formatINR(t.taxFlat)}, or ${t.taxPercent}% of your total worth if that is less`
    : `${t.name}: pay ${formatINR(t.taxFlat)}`);

  return (
    <Sheet open={open} onClose={onClose} title="How to play" className="hg-rules" desktop="modal">
      <p className="hg-summary is-strong">{summary}</p>

      <Rule icon={'🏆'} title="Win by net worth">
        <p>
          Net worth is your cash plus the price of every property you own plus what you built on them (a mortgaged tile counts at price minus its loan).
          Reach <b>{formatINR(goal)}</b> first and you win.
        </p>
        <p className="hg-rule-round">{ROUND_RULE_TEXT}</p>
      </Rule>

      <Rule icon={<Dice a={6} />} title="Roll and move">
        <p>
          Everyone starts with <b>{formatINR(startCash)}</b> at Rajiv Gandhi Airport (<b>START</b>) and walks <b>clockwise</b> around the 40 squares.{' '}
          Roll <b>one die</b> and move 1&ndash;6 squares. A <b>six</b> gives you another roll.{' '}
          Each time you pass or land on START you collect <b>{formatINR(passStart)}</b>.
        </p>
      </Rule>

      <Rule icon={fairDice ? '⚖️' : '🍀'} title={fairDice ? 'Fair dice' : 'Lucky dice'}>
        <p>{fairDice ? FAIR_DICE_TEXT : LUCKY_DICE_TEXT}</p>
      </Rule>

      <Rule icon={'🏠'} title="Buy, or let it go to auction">
        <p>
          Land on a free property, station or utility and you may buy it.{' '}
          {declineAuction
            ? <>Skip it and a <b>sealed auction</b> opens: everyone, including you, may bid.</>
            : <>Skip it and it stays free for the next visitor.</>}{' '}
          Land on someone else&rsquo;s and you pay them rent.
        </p>
      </Rule>

      <Rule icon={'⚡'} title="Snatch">
        <p>
          Everyone starts with <b>{tokens} Snatch {tokens === 1 ? 'token' : 'tokens'}</b>. After any player <b>buys</b> a property, everyone else with a token has{' '}
          <b>{snatchSecs} seconds</b> to hit <b>Snatch</b>.
        </p>
        <p>
          One snatcher takes the property <b>for free</b> and spends a token, while the buyer still pays the bank.
          Two or more snatchers bid for it in <b>sealed bidding</b> among themselves: only the winner pays and spends a token, and if nobody bids the buyer keeps it.
        </p>
        <p className="hg-rule-note">Auctions, trades and cards never open a snatch window.</p>
      </Rule>

      <Rule icon={'🛡️'} title="Tokens, Shield and city events">
        {tokens > 0 ? (
          <>
            <p>
              Spend a token on <b>Buy + Shield</b> and nobody can snatch that purchase. It works only if another player holds a token too.
            </p>
            <p>
              Earn more tokens: after every <b>{LAPS_PER_TOKEN} laps</b> (passing or landing on START), and each time you land on the <b>Irani Chai &amp; Biryani Break</b>.
              You can hold at most <b>{TOKEN_CAP}</b>.
            </p>
          </>
        ) : null}
        <p>
          Every <b>{EVENT_EVERY} rounds</b> a random <b>city event</b> hits and lasts one round:
        </p>
        <ul className="hg-rule-list" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {CITY_EVENTS.map((e) => <li key={e.id}><b>{e.title}</b>: {e.text}</li>)}
        </ul>
      </Rule>

      <Rule icon={'🪤'} title="Traps">
        <p>
          Everyone gets <b>{TRAPS_EACH} {TRAPS_EACH === 1 ? 'trap' : 'traps'}</b>. Before you roll, tap any tile (except Go to Jail) and choose <b>Set trap here</b>.
          Nobody sees where it is. The first rival to <b>land</b> on it goes <b>straight to jail</b> (no salary), and the trap is used up.
          You are immune to your own trap, and passing over it does nothing.
        </p>
      </Rule>

      <Rule icon={'🎨'} title="Colour sets">
        <p>
          Own <b>every</b> property of a colour and the rent on its empty plots is <b>doubled ({X}{SET_BONUS.full})</b>. Only a full set lets you build.
          Build evenly: raise the lowest tile in the set first. Built tiles pay the rent ladder printed on their title deed.
        </p>
      </Rule>

      <Rule icon={'🏗️'} title="Build up to a Hotel" wide>
        <p>Every level costs the colour&rsquo;s building price, and rent jumps with each step. Tap any property to see its title deed.</p>
        <ol className="hg-rules-ladder">
          {LEVEL_NAMES.map((name, i) => (
            <li key={name}>
              <BuildingArt level={i} color={LEVEL_COLORS[i]} size={46} />
              <b>{name}</b>
              <small>{LEVEL_SUB[i]}</small>
            </li>
          ))}
        </ol>
        <p className="hg-rule-note">Building price per level: {BUILD_PRICES}. Top level: {LEVEL_NAMES[MAX_LEVEL]}.</p>
      </Rule>

      <Rule icon={'🏦'} title="Mortgage and selling">
        <p>
          Short on cash? Mortgage an unbuilt tile to borrow its <b>mortgage value</b> (half the price) from the bank. A mortgaged tile collects no rent and cannot be built on.
          Unmortgage it later for the loan plus {pct(UNMORTGAGE_INTEREST)}. You can also sell a building back for half its build cost.
        </p>
      </Rule>

      <Rule icon={'🤝'} title="Trading">
        <p>
          On your turn, offer another player tiles and cash for theirs. They accept or reject; only one offer at a time.
          Tiles with buildings in their colour cannot be traded until the buildings are sold.
        </p>
      </Rule>

      <Rule icon={'🚉'} title="Stations and utilities">
        <p>
          There are {STATIONS.length} stations ({STATIONS.map((t) => t.short).join(', ')}). Their rent grows with how many you own:{' '}
          <b>{TRANSPORT_RENT.slice(1).map(formatINR).join(' / ')}</b>.
        </p>
        <p>
          The {UTILITIES.length} utilities ({UTILITIES.map((t) => t.short).join(' and ')}) charge the visitor&rsquo;s dice roll {X} <b>{UTILITY_MULT[1]}</b>, or {X} <b>{UTILITY_MULT[2]}</b> if one player owns both.
        </p>
      </Rule>

      <Rule icon={'🚔'} title="Chanchalguda Jail">
        <p>
          Landing on the Jail corner is just a visit and costs nothing. You are sent <b>to jail</b> by the Go to Jail corner (caught at a signal without a helmet, no salary),
          or by some cards. To get out, roll <b>a six</b> (you leave and move that many squares), pay <b>{formatINR(bail)}</b> bail, or use a <b>Get Out of Jail Free</b> card.
        </p>
      </Rule>

      <Rule icon={'☕'} title="Irani Chai & Biryani Break">
        <p>
          This corner is a rest stop. Sit back with a chai and a plate of biryani: no rent, no bill.
          {tokens > 0 ? <> You earn <b>+1 Snatch token</b> (up to {TOKEN_CAP}).</> : null}
        </p>
      </Rule>

      <Rule icon={'🎴'} title="Nawab ka Farman and Hyderabadi Khazana">
        <p>
          Land on a card square and draw a card from that deck. Cards can pay you, bill you, move your pawn or send you to jail.
          Some are collected from, or paid to, every other player.
        </p>
      </Rule>

      <Rule icon={'🧾'} title="Taxes and challans">
        <p>{TAXES.map(taxLine).join('. ')}.</p>
      </Rule>

      {declineAuction ? (
        <Rule icon={'🔨'} title="Auction">
          <p>
            When a player skips a free property it is auctioned. Everyone places <b>one sealed bid</b> or passes. Highest bid wins; ties go to the player whose turn it is, then clockwise.
          </p>
        </Rule>
      ) : null}

      <Rule icon={'💸'} title="Debt and bankruptcy">
        <p>
          If a bill is bigger than your cash you enter <b>debt</b>: mortgage tiles or sell buildings until you can pay, then pay.
          If even that cannot cover it, or you give up, you are bankrupt and out. Your assets go to the player you owed, or back to the bank for taxes and cards.
        </p>
      </Rule>
    </Sheet>
  );
}
