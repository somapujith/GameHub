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
//   tile?: number,            // the square being played (names the tax a 'tax' payment belongs to)
// }
//
// tone: 'info' | 'good' | 'bad' | 'warn' | 'cheer'. Optional extras: `bubble` is a shorter text for the
// bubble; `extra` ({ text, tone, icon }) is a second, log-only line (lucky-dice help).
// Events that need no line (plain moves, the receiving half of a rent payment, ...) return null.

import { TILES, LEVEL_NAMES, MAX_LEVEL, GROUPS, JAIL_TILE } from '@shared/board.js';
import { formatINR } from '@shared/format.js';

const tileName = (id) => (TILES[id] ? TILES[id].name : `tile ${id}`);

/** Short deck name for a card event: "Farman" (Nawab ka Farman) or "Khazana" (Hyderabadi Khazana). */
const deckShort = (deck) => TILES.find((t) => t.type === 'kismet' && t.deck === deck)?.short || null;

/** "A", "A and B", "A, B and C": names of several players. */
function nameList(ctx, ids) {
  const names = (Array.isArray(ids) ? ids : []).map((id) => playerName(ctx, id));
  if (names.length <= 1) return names[0] || 'Someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The buyer as the object of a sentence: "you" or the name. */
const objName = (ctx, id) => (isMe(ctx, id) ? 'you' : playerName(ctx, id));

/** What a tax payment was for. The event may carry `tile`; otherwise the square being played tells. */
function taxLabel(ev, ctx) {
  const t = TILES[ev.tile] && TILES[ev.tile].type === 'tax' ? TILES[ev.tile] : ctx && TILES[ctx.tile] && TILES[ctx.tile].type === 'tax' ? TILES[ctx.tile] : null;
  if (!t) return { text: 'tax', tile: undefined };
  return { text: t.taxPercent ? 'GHMC property tax' : `for the ${t.name}`, tile: t.id };
}

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
    case 'tax': {
      const tax = taxLabel(ev, ctx);
      return { text: `${who} paid ${amt} ${tax.text}`, tone: toneFor(ctx, ev.player, 'bad'), tile: tax.tile, icon: '🧾' };
    }
    case 'bail':
      return { text: `${who} paid ${amt} bail`, tone: toneFor(ctx, ev.player, 'warn'), icon: '🔓' };
    case 'event':
      return {
        text: ev.delta >= 0 ? `Festival gift: ${who} received ${amt}` : `${who} paid ${amt} (city event)`,
        tone: toneFor(ctx, ev.player, ev.delta >= 0 ? 'good' : 'bad'),
        icon: '🎁',
      };
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
    if (ev.reason === 'card') text = `The card says go to jail! ${stay}`;
    else if (/go.?to.?jail|signal|tile/i.test(String(ev.reason || ''))) text = `Caught at a signal without a helmet! ${stay}`;
    return { text, tone: toneFor(ctx, ev.player, 'bad', 'warn'), tile: JAIL_TILE, icon: '🚔' };
  }
  switch (ev.reason) {
    case 'six':
      return { text: `${who} rolled a six and broke out of jail`, tone: toneFor(ctx, ev.player, 'good'), icon: '🔓' };
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
        const a = (ev.values || [])[0]; // one die, always
        const six = a === 6;
        const d = {
          text: `${playerName(ctx, ev.player)} rolled ${a}${six ? ': six!' : ''}`,
          tone: six ? toneFor(ctx, ev.player, 'good') : 'info',
          icon: '🎲',
        };
        // A second, log-only line when the lucky-dice rules helped the local player.
        if (ev.assist && isMe(ctx, ev.player)) d.extra = { text: 'Lucky dice gave you a little help 🍀', tone: 'good', icon: '🍀' };
        return d;
      }

      case 'move':
        // A trip to jail is told by the jail event that follows, so the jump itself stays quiet.
        return ev.teleport && ev.to !== JAIL_TILE
          ? { text: `${playerName(ctx, ev.player)} zipped to ${tileName(ev.to)}`, tone: 'info', tile: ev.to, icon: '✨' }
          : null;

      case 'land': {
        const tile = TILES[ev.tile];
        const who = playerName(ctx, ev.player);
        const own = ctx.owners && ctx.owners[ev.tile] === ev.player && tile && tile.price;
        let text = `${who} landed on ${tileName(ev.tile)}`;
        if (own) text = `${who} ${be(ctx, ev.player)} back on ${isMe(ctx, ev.player) ? 'your' : 'their'} own ${tileName(ev.tile)}`;
        else if (tile && tile.type === 'jail') text = `${who} ${be(ctx, ev.player)} just visiting ${tileName(ev.tile)}`;
        else if (tile && tile.type === 'parking') text = `${who} stopped for an Irani chai and biryani. Nothing happens`;
        else if (tile && tile.type === 'gotojail') text = `${who} landed on Go to Jail`;
        return {
          text,
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
        return null; // auction / snatch (auction_end and snatch_end tell it) and bankrupt (bankrupt tells it)
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
          tile: JAIL_TILE,
          icon: '🚔',
        };
      }

      case 'card': {
        const me = isMe(ctx, ev.player);
        const tone = !me ? 'info' : ev.kind === 'good' ? 'good' : ev.kind === 'bad' ? 'bad' : 'info';
        const deck = deckShort(ev.deck);
        return {
          text: me ? `${ev.title}: ${ev.text}` : `${playerName(ctx, ev.player)} drew ${deck ? `a ${deck} card: ` : ''}"${ev.title}"`,
          tone,
          icon: '🎴',
          title: ev.title,
        };
      }

      case 'auction_start':
        // Snatch bidding is announced by the snatch_end line ("... both snatched! Sealed bidding for ...").
        if (ev.reason === 'snatch') return null;
        return {
          text: `Auction! ${tileName(ev.tile)} is up for bids (min ${formatINR(ev.minBid)})`,
          tone: 'info',
          tile: ev.tile,
          icon: '🔨',
        };

      case 'auction_end': {
        const snatch = ev.reason === 'snatch';
        if (ev.winner === null || ev.winner === undefined) {
          if (snatch) {
            const buyer = ev.buyer ?? (ctx.owners ? ctx.owners[ev.tile] : null);
            const keeper = buyer === null || buyer === undefined ? 'its buyer' : objName(ctx, buyer);
            return { text: `Nobody bid. ${tileName(ev.tile)} stays with ${keeper}.`, tone: 'info', tile: ev.tile, icon: '⚡' };
          }
          return { text: `No bids. ${tileName(ev.tile)} stays with the bank`, tone: 'info', tile: ev.tile, icon: '🔨' };
        }
        return {
          text: `${playerName(ctx, ev.winner)} won ${tileName(ev.tile)} ${snatch ? 'in the snatch bidding' : 'at auction'} for ${formatINR(ev.amount)}`,
          tone: toneFor(ctx, ev.winner, 'good'),
          tile: ev.tile,
          icon: snatch ? '⚡' : '🔨',
        };
      }

      case 'snatch_open': {
        const secs = Math.max(1, Math.round((Number(ev.ms) || 3000) / 1000));
        const price = ev.price ?? (TILES[ev.tile] ? TILES[ev.tile].price : 0);
        const eligibleMe = Array.isArray(ev.eligible) && ctx.me !== undefined && ev.eligible.includes(ctx.me);
        return {
          text: `${playerName(ctx, ev.buyer)} bought ${tileName(ev.tile)} for ${formatINR(price)}. Snatch window open (${secs}s)!`,
          bubble: eligibleMe ? 'Snatch it!' : `Snatch window (${secs}s)`,
          tone: eligibleMe ? 'warn' : 'info',
          tile: ev.tile,
          icon: '⚡',
        };
      }

      case 'snatch_end': {
        const claimants = Array.isArray(ev.claimants) ? ev.claimants : [];
        if (ev.outcome === 'snatched' && ev.winner !== null && ev.winner !== undefined) {
          const price = ev.price ?? (TILES[ev.tile] ? TILES[ev.tile].price : 0);
          const bought = isMe(ctx, ev.buyer) ? 'You' : playerName(ctx, ev.buyer);
          return {
            text: `${playerName(ctx, ev.winner)} SNATCHED ${tileName(ev.tile)} from ${objName(ctx, ev.buyer)} for free! (${bought} still paid ${formatINR(price)})`,
            bubble: `${playerName(ctx, ev.winner)} snatched it!`,
            tone: isMe(ctx, ev.winner) ? 'cheer' : toneFor(ctx, ev.buyer, 'bad'),
            tile: ev.tile,
            icon: '⚡',
          };
        }
        if (ev.outcome === 'bidding') {
          const all = claimants.length > 2;
          return {
            text: `${nameList(ctx, claimants)} ${all ? 'all' : 'both'} snatched! Sealed bidding for ${tileName(ev.tile)}.`,
            bubble: 'Snatch bidding!',
            tone: claimants.includes(ctx.me) ? 'warn' : 'info',
            tile: ev.tile,
            icon: '⚡',
          };
        }
        return {
          text: `Nobody snatched. ${tileName(ev.tile)} stays with ${objName(ctx, ev.buyer)}.`,
          tone: 'info',
          tile: ev.tile,
          icon: '⚡',
        };
      }

      case 'shield':
        return {
          text: `${playerName(ctx, ev.player)} shielded ${tileName(ev.tile)}: no snatching!`,
          bubble: 'Shielded!',
          tone: toneFor(ctx, ev.player, 'good'),
          tile: ev.tile,
          icon: '🛡️',
        };

      case 'trap_placed':
        return {
          text: isMe(ctx, ev.player) ? 'You set a trap. Shhh.' : `${playerName(ctx, ev.player)} set a trap somewhere...`,
          bubble: isMe(ctx, ev.player) ? 'Trap set. Shhh.' : 'A trap was set...',
          tone: isMe(ctx, ev.player) ? 'info' : 'warn',
          icon: '🪤',
        };

      case 'trap_sprung': {
        const owner = isMe(ctx, ev.owner) ? 'your' : `${playerName(ctx, ev.owner)}'s`;
        return {
          text: `${playerName(ctx, ev.victim)} walked into ${owner} trap on ${tileName(ev.tile)} and ${isMe(ctx, ev.victim) ? 'were' : 'was'} thrown in jail!`,
          bubble: isMe(ctx, ev.victim) ? 'Trapped!' : isMe(ctx, ev.owner) ? 'Your trap sprang!' : 'Trap sprung!',
          tone: isMe(ctx, ev.victim) ? 'bad' : isMe(ctx, ev.owner) ? 'good' : 'info',
          tile: ev.tile,
          icon: '🪤',
        };
      }

      case 'token_earned': {
        const why = ev.reason === 'chai' ? 'Chai break' : 'lap bonus';
        return {
          text: `${playerName(ctx, ev.player)} earned a Snatch token (${why})`,
          bubble: '+1 Snatch token',
          tone: toneFor(ctx, ev.player, 'good'),
          icon: '⚡',
        };
      }

      case 'city_event':
        return {
          text: `${ev.title} ${ev.text}`,
          bubble: ev.title,
          tone: ev.kind === 'good' ? 'good' : ev.kind === 'bad' ? 'warn' : 'cheer',
          icon: '🌆',
          title: ev.title,
        };

      case 'snatch_token':
        return null; // the scoreboard shows the token count; snatch_end already told the story

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
