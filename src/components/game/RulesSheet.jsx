// Concise, illustrated rules (v2: hotel, set bonus, mortgage, trade, auction on skip, debt, jail card, dice).
// Numbers come from the live game settings when available.
import { BuildingArt } from '@/components/art/index.js';
import {
  LEVEL_NAMES, MAX_LEVEL, MORTGAGE_RATIO, RENT_RATE, SET_BONUS, TRANSPORT_RENT, UNMORTGAGE_INTEREST, UPGRADE_RATIO, UTILITY_MULT,
} from '@shared/board.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import { DEFAULT_CFG, FAIR_DICE_TEXT, LUCKY_DICE_TEXT, ROUND_RULE_TEXT, settingsSummary } from './ui/helpers.js';

const LEVEL_COLORS = ['#9aa5b1', '#22a06b', '#3b82f6', '#f08a24', '#e5484d', '#f2b705'];
const X = '×';

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
  const singleDie = rawCfg.diceCount === 1;
  const declineAuction = cfg.auctionOnDecline !== false;
  const pct = (n) => `${Math.round(n * 100)}%`;

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

      <Rule icon={<Dice a={singleDie ? 6 : 4} b={singleDie ? null : 4} />} title="Roll and move">
        <p>
          {singleDie ? <>Roll <b>one die</b> and walk 1–6 spaces clockwise. A <b>six</b> gives you another roll; <b>three sixes</b> in a row send you to jail. </> : <>Roll two dice and walk clockwise. <b>Doubles</b> give you another roll; <b>three doubles</b> in a row send you to jail. </>}
          Passing or landing on Charminar Chowk pays <b>{formatINR(cfg.passStart)}</b>.
        </p>
      </Rule>

      <Rule icon={fairDice ? '⚖️' : '🍀'} title={fairDice ? 'Fair dice' : 'Lucky dice'}>
        <p>{fairDice ? FAIR_DICE_TEXT : LUCKY_DICE_TEXT}</p>
      </Rule>

      <Rule icon={'🏠'} title="Buy, or let it go to auction">
        <p>
          Land on a free property, transport or utility and you may buy it.{' '}
          {declineAuction
            ? <>Skip it and a <b>sealed auction</b> opens: everyone, including you, may bid.</>
            : <>Skip it and it stays free for the next visitor.</>}{' '}
          Land on someone else&rsquo;s and you pay them rent.
        </p>
      </Rule>

      <Rule icon={'🎨'} title="Colour sets">
        <p>
          Own 2 of a 3-tile colour: <b>{X}{SET_BONUS.partial}</b> rent on empty plots. Own the full colour: <b>{X}{SET_BONUS.full}</b> and you may build.
          Build evenly: raise the lowest tile in the set first. The bonus applies to empty plots only; built tiles use the ladder below.
        </p>
      </Rule>

      <Rule icon={'🏗️'} title="Build up to a Hotel" wide>
        <p>Each level costs {Math.round(UPGRADE_RATIO * 100)}% of the price. The Hotel needs every tile in the colour at Tower.</p>
        <ol className="hg-rules-ladder">
          {LEVEL_NAMES.map((name, i) => (
            <li key={name}>
              <BuildingArt level={i} color={LEVEL_COLORS[i]} size={46} />
              <b>{name}</b>
              <small>{pct(RENT_RATE[i])} rent</small>
            </li>
          ))}
        </ol>
        <p className="hg-rule-note">Rent shown as a share of the tile price. Top level: {LEVEL_NAMES[MAX_LEVEL]}.</p>
      </Rule>

      <Rule icon={'🏦'} title="Mortgage and selling">
        <p>
          Short on cash? Mortgage an unbuilt tile to borrow <b>{pct(MORTGAGE_RATIO)}</b> of its price from the bank. A mortgaged tile collects no rent and cannot be built on.
          Unmortgage it later for the loan plus {pct(UNMORTGAGE_INTEREST)}. You can also sell a building back for half its build cost.
        </p>
      </Rule>

      <Rule icon={'🤝'} title="Trading">
        <p>
          On your turn, offer another player tiles and cash for theirs. They accept or reject; only one offer at a time.
          Tiles with buildings in their colour cannot be traded until the buildings are sold.
        </p>
      </Rule>

      <Rule icon={'🚇'} title="Transport and utilities">
        <p>
          Transport rent grows with how many you own ({TRANSPORT_RENT.slice(1).map(formatINR).join(' / ')}).
          Utility rent is your visitor&rsquo;s dice total {X} {UTILITY_MULT[1]} (or {X} {UTILITY_MULT[2]} with both).
        </p>
      </Rule>

      <Rule icon={'🚔'} title="Jail">
        <p>
          Skip a turn unless you roll {singleDie ? 'a six' : 'doubles'}, pay <b>{formatINR(cfg.bailFine)}</b> bail, or use a <b>Get-out-of-jail-free</b> Kismet card.
        </p>
      </Rule>

      <Rule icon={'🔨'} title="Laad Bazaar auction">
        <p>
          A random free property is auctioned. Everyone places <b>one sealed bid</b> or passes. Highest bid wins; ties go to the player whose turn it is, then clockwise.
        </p>
      </Rule>

      <Rule icon={'🎴'} title="Kismet, tax and Film City">
        <p>
          Kismet cards can be lucky or costly. Property tax costs {formatINR(cfg.taxAmount)}; a Film City cameo pays {formatINR(cfg.filmFee)}.
        </p>
      </Rule>

      <Rule icon={'💸'} title="Debt and bankruptcy">
        <p>
          If a bill is bigger than your cash you enter <b>debt</b>: mortgage tiles or sell buildings until you can pay, then pay.
          If even that cannot cover it, or you give up, you are bankrupt and out. Your assets go to the player you owed, or back to the bank for taxes and cards.
        </p>
      </Rule>
    </Sheet>
  );
}
