// Turns engine events into short, fun English lines for the game log and the centre-stage bubble.
//
//   describeEvent(ev, ctx) -> { text, tone, tile?, icon?, bubble? } | null
//
// ctx = {
//   players: [{ id, name }],  me: playerId,                 // "You" / "Your" for `me`
//   owners?: (id|null)[],     // owners BEFORE this event (lets `own liquidate` say whose tile it was)
//   round?: number,           // round shown BEFORE this event (turn events log only when it increases)
//   maxRounds?: number|null,  // flags the final round
//   jailTurns?: number,       // length of a jail stay (defaults to 1)
// }
//
// tone: 'info' | 'good' | 'bad' | 'warn' | 'cheer'. Optional extras: `bubble` is a shorter text for the
// bubble; `extra` ({ text, tone, icon }) is a second, log-only line (lucky-dice help).
// Events that need no line (plain moves, the receiving half of a rent payment, ...) return null.

import { TILES, LEVEL_NAMES, MAX_LEVEL, GROUPS } from '@shared/board.js';
import { formatINR } from '@shared/format.js';

const tileName = (id) => (TILES[id] ? TILES[id].name : `tile ${id}`);

function playerName(ctx, id) {
  if (id === null || id === undefined) return 'Someone';
  if (ctx && id === ctx.me) return 'You';
  const p = ctx && Array.isArray(ctx.players) ? ctx.players.find((x) => x.id === id) : null;
  return p && p.name ? p.name : String(id);
}

const isMe = (ctx, id) => !!ctx && id !== null && id !== undefined && id === ctx.me;
const poss = (ctx, id) => (isMe(ctx, id) ? 'Your' : `${playerName(ctx, id)}'s`);
const be = (ctx, id) => (isMe(ctx, id) ? 'are' : 'is');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** "a Hotel", "an Empty plot", but plain "Apartments" (plural). */
const withArticle = (word) => (/s$/i.test(word) ? word : `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`);

/** good/bad when it concerns the local player, otherwise neutral. */
const toneFor = (ctx, id, mine, other = 'info') => (isMe(ctx, id) ? mine : other);

function describeCash(ev, ctx) {
  const who = playerName(ctx, ev.player);
  const amt = formatINR(Math.abs(ev.delta));
  const me = isMe(ctx, ev.player);
  switch (ev.reason) {
    case 'salary':
      return { text: `${who} collected ${amt} salary`, tone: toneFor(ctx, ev.player, 'good'), icon: '💰' };
    case 'rent': {
      if (!(ev.delta < 0)) return null; // the paying half already tells the story
      const to = ev.other !== undefined && ev.other !== null ? ` to ${playerName(ctx, ev.other)}` : '';
      let tone = 'info';
      if (me) tone = 'bad';
      else if (isMe(ctx, ev.other)) tone = 'good';
      return { text: `${who} paid ${amt} rent${to}`, tone, icon: '🏠' };
    }
    case 'tax':
      return { text: `${who} paid ${amt} property tax`, tone: toneFor(ctx, ev.player, 'bad'), icon: '🧾' };
    case 'film':
      return ev.delta >= 0
        ? { text: `${who} earned ${amt} for a Film City cameo`, tone: toneFor(ctx, ev.player, 'good'), icon: '🎬' }
        : { text: `${who} paid ${amt} at Film City`, tone: toneFor(ctx, ev.player, 'bad'), icon: '🎬' };
    case 'bail':
      return { text: `${who} paid ${amt} bail`, tone: toneFor(ctx, ev.player, 'warn'), icon: '🔓' };
    case 'bazaar':
      return { text: `${who} got a ${amt} Laad Bazaar bonus`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔨' };
    case 'buy':
    case 'upgrade':
    case 'auction':
    case 'card':
    case 'liquidate':
    case 'mortgage':
    case 'unmortgage':
    case 'sell':
    case 'trade':
      return null; // described by own / level / auction_end / card / mortgage / trade events
    default:
      return {
        text: `${who} ${ev.delta >= 0 ? 'received' : 'paid'} ${amt}`,
        tone: toneFor(ctx, ev.player, ev.delta >= 0 ? 'good' : 'bad'),
        icon: '💸',
      };
  }
}

function describeJail(ev, ctx) {
  const who = playerName(ctx, ev.player);
  if (ev.jailed) {
    const n = Math.max(1, Math.round(Number(ctx && ctx.jailTurns) || 1));
    const stay = `${who} ${be(ctx, ev.player)} in jail for ${plural(n, 'round')}`;
    let text = stay;
    if (ev.reason === 'three_doubles') text = `Three doubles in a row! ${stay}`;
    else if (ev.reason === 'three_sixes') text = `Three sixes in a row! ${stay}`;
    else if (ev.reason === 'card') text = `Kismet strikes! ${stay}`;
    return { text, tone: toneFor(ctx, ev.player, 'bad', 'warn'), tile: 14, icon: '🚔' };
  }
  switch (ev.reason) {
    case 'six':
      return { text: `${who} rolled a six and broke out of jail`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
    case 'doubles':
      return { text: `${who} rolled doubles and broke out of jail`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
    case 'bail':
      return { text: `${who} walked free after paying bail`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
    case 'served':
      return { text: `${who} served ${isMe(ctx, ev.player) ? 'your' : 'their'} time and ${be(ctx, ev.player)} free to roll`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
    case 'card_used':
      return { text: `${who} used a Get Out of Jail Free card`, tone: toneFor(ctx, ev.player, 'good'), icon: '🎟️' };
    default:
      return { text: `${who} ${be(ctx, ev.player)} out of jail`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
  }
}

/** "Ameerpet + Begumpet + ₹500" (or "nothing") for one side of a trade. */
function bundleText(b) {
  const tiles = b && Array.isArray(b.tiles) ? b.tiles : [];
  const cash = Number(b && b.cash) || 0;
  const parts = tiles.map(tileName);
  if (cash > 0) parts.push(formatINR(cash));
  return parts.length ? parts.join(' + ') : 'nothing';
}

/** The person as an object of a sentence: "you" or the name. */
const whom = (ctx, id) => (isMe(ctx, id) ? 'you' : playerName(ctx, id));

function describeTrade(ev, ctx) {
  const involvesMe = isMe(ctx, ev.from) || isMe(ctx, ev.to);
  switch (ev.type) {
    case 'trade_offer':
      return {
        text: `${playerName(ctx, ev.from)} offered ${whom(ctx, ev.to)} a trade: ${bundleText(ev.give)} for ${bundleText(ev.get)}`,
        tone: isMe(ctx, ev.to) ? 'warn' : 'info',
        icon: '🤝',
      };
    case 'trade_done':
      return {
        text: `Trade done! ${playerName(ctx, ev.from)} gave ${bundleText(ev.give)} to ${whom(ctx, ev.to)} for ${bundleText(ev.get)}`,
        tone: involvesMe ? 'good' : 'info',
        icon: '🤝',
      };
    default: {
      // trade_rejected
      const why = String(ev.reason || '');
      let text;
      if (/cancel/i.test(why)) text = `${playerName(ctx, ev.from)} cancelled the trade offer to ${whom(ctx, ev.to)}`;
      else if (/time/i.test(why)) text = `The trade offer from ${playerName(ctx, ev.from)} to ${whom(ctx, ev.to)} timed out`;
      else if (/invalid/i.test(why)) text = `The trade offer from ${playerName(ctx, ev.from)} to ${whom(ctx, ev.to)} is no longer valid`;
      else if (/bankrupt/i.test(why)) text = `The trade offer between ${playerName(ctx, ev.from)} and ${whom(ctx, ev.to)} was called off`;
      else text = `${playerName(ctx, ev.to)} turned down ${isMe(ctx, ev.from) ? 'your' : `${playerName(ctx, ev.from)}'s`} trade offer`;
      return { text, tone: involvesMe ? 'warn' : 'info', icon: '🙅' };
    }
  }
}

function describeTurn(ev, ctx) {
  // Per-turn lines would drown the log: only announce a new round.
  if (!ctx || typeof ctx.round !== 'number' || !(ev.round > ctx.round)) return null;
  const max = Number(ctx.maxRounds);
  const final = Number.isFinite(max) && max > 0 && ev.round === max;
  return {
    text: final ? `Round ${ev.round} begins. Final round!` : `Round ${ev.round} begins`,
    bubble: final ? 'Final round!' : `Round ${ev.round}`,
    tone: final ? 'warn' : 'info',
    icon: final ? '🏁' : '🔔',
  };
}

function describeWin(ev, ctx) {
  const who = playerName(ctx, ev.player);
  const worth = formatINR(ev.worth || 0);
  const me = isMe(ctx, ev.player);
  if (ev.player === null || ev.player === undefined) return { text: 'The game is over. Nobody is left standing', tone: 'warn', icon: '🏆' };
  switch (ev.reason) {
    case 'rounds':
      return { text: `Round limit reached! ${who} ${be(ctx, ev.player)} the richest with ${worth}`, tone: 'cheer', icon: '🏆' };
    case 'last_standing':
      return { text: `${who} ${me ? 'are' : 'is'} the last one standing and ${me ? 'win' : 'wins'}!`, tone: 'cheer', icon: '🏆' };
    default:
      return { text: `${who} reached a net worth of ${worth} and ${me ? 'win' : 'wins'}!`, tone: 'cheer', icon: '🏆' };
  }
}

export function describeEvent(ev, ctx) {
  ctx = ctx || {};
  if (!ev || typeof ev.type !== 'string') return null;
  try {
    switch (ev.type) {
      case 'dice': {
        const [a, b] = ev.values || [];
        const single = ev.values?.length === 1;
        const dbl = !single && a === b;
        const six = single && a === 6;
        const d = {
          text: single ? `${playerName(ctx, ev.player)} rolled ${a}${six ? ': six!' : ''}` : `${playerName(ctx, ev.player)} rolled ${a} + ${b}${dbl ? ': doubles!' : ''}`,
          tone: dbl || six ? toneFor(ctx, ev.player, 'good') : 'info',
          icon: '🎲',
        };
        // A second, log-only line when the lucky-dice rules helped the local player.
        if (ev.assist && isMe(ctx, ev.player)) d.extra = { text: 'Lucky dice gave you a little help 🍀', tone: 'good', icon: '🍀' };
        return d;
      }

      case 'move':
        return ev.teleport
          ? { text: `${playerName(ctx, ev.player)} zipped to ${tileName(ev.to)}`, tone: 'info', tile: ev.to, icon: '✨' }
          : null;

      case 'land': {
        const tile = TILES[ev.tile];
        const who = playerName(ctx, ev.player);
        const own = ctx.owners && ctx.owners[ev.tile] === ev.player && tile && tile.price;
        return {
          text: own ? `${who} ${be(ctx, ev.player)} back on ${isMe(ctx, ev.player) ? 'your' : 'their'} own ${tileName(ev.tile)}` : `${who} landed on ${tileName(ev.tile)}`,
          tone: 'info',
          tile: ev.tile,
          icon: tile ? tile.emoji : undefined,
        };
      }

      case 'cash':
        return describeCash(ev, ctx);

      case 'own': {
        const tile = TILES[ev.tile];
        if (ev.reason === 'buy') {
          return {
            text: `${playerName(ctx, ev.owner)} bought ${tileName(ev.tile)} for ${formatINR(tile ? tile.price : 0)}`,
            tone: toneFor(ctx, ev.owner, 'good'),
            tile: ev.tile,
            icon: '🔑',
          };
        }
        if (ev.reason === 'liquidate') {
          const prev = ctx.owners ? ctx.owners[ev.tile] : null;
          return {
            text: prev ? `${playerName(ctx, prev)} sold ${tileName(ev.tile)} to pay a debt` : `${tileName(ev.tile)} was sold to pay a debt`,
            tone: toneFor(ctx, prev, 'warn'),
            tile: ev.tile,
            icon: '📉',
          };
        }
        return null; // auction (auction_end tells it) and bankrupt (bankrupt tells it)
      }

      case 'level': {
        const name = LEVEL_NAMES[ev.level] || `level ${ev.level}`;
        const owner = ctx.owners ? ctx.owners[ev.tile] : null;
        if (ev.reason === 'upgrade') {
          const top = ev.level >= MAX_LEVEL;
          return {
            text: top
              ? `${playerName(ctx, owner)} built ${withArticle(name)} on ${tileName(ev.tile)}!`
              : `${playerName(ctx, owner)} upgraded ${tileName(ev.tile)} to ${withArticle(name)}`,
            tone: top ? 'cheer' : toneFor(ctx, owner, 'good'),
            tile: ev.tile,
            icon: top ? '🏨' : '🏗️',
          };
        }
        if (ev.reason === 'liquidate' || ev.reason === 'sell') {
          const sold = LEVEL_NAMES[ev.level + 1];
          const now = ev.level > 0 ? ` (now ${withArticle(name)})` : '';
          return {
            text:
              ev.reason === 'sell'
                ? `${playerName(ctx, owner)} sold ${sold ? withArticle(sold) : 'a building'} on ${tileName(ev.tile)}${now}`
                : `${poss(ctx, owner)} ${tileName(ev.tile)} was sold down to ${LEVEL_NAMES[ev.level] || 'a plot'} to pay a debt`,
            tone: toneFor(ctx, owner, 'warn'),
            tile: ev.tile,
            icon: '📉',
          };
        }
        return null;
      }

      case 'jail':
        return describeJail(ev, ctx);

      case 'jail_stay': {
        const who = playerName(ctx, ev.player);
        const left = Math.max(0, Number(ev.left) || 0);
        return {
          text: left > 0
            ? `${who} ${be(ctx, ev.player)} in jail for ${plural(left, 'more round')}`
            : `${who} missed a turn in jail`,
          tone: toneFor(ctx, ev.player, 'warn'),
          tile: 14,
          icon: '🚔',
        };
      }

      case 'card': {
        const me = isMe(ctx, ev.player);
        const tone = !me ? 'info' : ev.kind === 'good' ? 'good' : ev.kind === 'bad' ? 'bad' : 'info';
        return {
          text: me ? `${ev.title}: ${ev.text}` : `${playerName(ctx, ev.player)} drew "${ev.title}"`,
          tone,
          icon: '🎴',
          title: ev.title,
        };
      }

      case 'auction_start':
        return {
          text: `Auction! ${tileName(ev.tile)} is up for bids (min ${formatINR(ev.minBid)})`,
          tone: 'info',
          tile: ev.tile,
          icon: '🔨',
        };

      case 'auction_end': {
        if (ev.winner === null || ev.winner === undefined) {
          return { text: `No bids. ${tileName(ev.tile)} stays with the bank`, tone: 'info', tile: ev.tile, icon: '🔨' };
        }
        return {
          text: `${playerName(ctx, ev.winner)} won ${tileName(ev.tile)} at auction for ${formatINR(ev.amount)}`,
          tone: toneFor(ctx, ev.winner, 'good'),
          tile: ev.tile,
          icon: '🔨',
        };
      }

      case 'bankrupt':
        return {
          text: isMe(ctx, ev.player) ? 'You went bankrupt!' : `${playerName(ctx, ev.player)} went bankrupt`,
          tone: toneFor(ctx, ev.player, 'bad', 'warn'),
          icon: '💥',
        };

      case 'set_complete': {
        const g = GROUPS[ev.group];
        return {
          text: `${playerName(ctx, ev.player)} completed the ${g ? g.name : ev.group} set!`,
          tone: toneFor(ctx, ev.player, 'cheer'),
          icon: '🎉',
        };
      }

      case 'mortgage':
        return {
          text: `${playerName(ctx, ev.player)} mortgaged ${tileName(ev.tile)} for ${formatINR(ev.value)}`,
          tone: toneFor(ctx, ev.player, 'warn'),
          tile: ev.tile,
          icon: '🏦',
        };

      case 'unmortgage':
        return {
          text: `${playerName(ctx, ev.player)} paid ${formatINR(ev.cost)} to unmortgage ${tileName(ev.tile)}`,
          tone: toneFor(ctx, ev.player, 'good'),
          tile: ev.tile,
          icon: '🏦',
        };

      case 'trade_offer':
      case 'trade_done':
      case 'trade_rejected':
        return describeTrade(ev, ctx);

      case 'debt': {
        const to = ev.creditor === null || ev.creditor === undefined ? 'the bank' : whom(ctx, ev.creditor);
        return {
          text: isMe(ctx, ev.player)
            ? `You owe ${formatINR(ev.amount)} to ${to}. Raise cash or resign!`
            : `${playerName(ctx, ev.player)} is in debt: owes ${formatINR(ev.amount)} to ${to}`,
          tone: toneFor(ctx, ev.player, 'bad', 'warn'),
          icon: '⚠️',
        };
      }

      case 'turn':
        return describeTurn(ev, ctx);

      case 'win':
        return describeWin(ev, ctx);

      default:
        return null;
    }
  } catch {
    return null;
  }
}

export { tileName, playerName };
