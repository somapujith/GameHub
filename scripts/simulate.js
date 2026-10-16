// Bot-only simulation of Hyderabad Tycoon: checks engine invariants and prints balance stats.
//
//   node scripts/simulate.js [--games 150] [--players 2,3,4] [--seed 1] [--varied] [--humans 0]
//                            [--rounds 30,50,unlimited] [--unlimited] [--set goal=60000,startCash=12000]
//                            [--bot reserve=500,greed=1] [--quiet] [--fuzz]
//
// --rounds     round limits to run (default 30,50,unlimited). `unlimited` = maxRounds null.
// --unlimited  shorthand for --rounds unlimited (simulator-only safety cap: 400 rounds, counted as "stalled").
// --varied     random bot personalities (like the story-mode rivals) instead of the defaults.
// --humans N   the first N seats are "human proxies": isBot=false, but their moves come from chooseBotAction,
//              so bots can offer them trades (a proxy accepts half of the offers it gets).
// --set        override engine settings (to experiment with the economy without editing the engine).
// --bot        override default bot params for every seat.
// --fuzz       stress mode: seats pick RANDOM legal actions straight from getOptions() (trades, mortgages, resigns,
//              odd bids...), asserting every offered action is accepted by applyAction and the invariants hold.

import {
  createGame, applyAction, nextBotMove, chooseBotAction, getOptions, netWorth, liquidationValue, mulberry32,
  BOARD_SIZE, MAX_LEVEL, GROUP_TILES, TILES, isBuyable, DEFAULT_SETTINGS,
} from '../shared/index.js';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const parseKV = (str) => {
  const out = {};
  if (typeof str !== 'string') return out;
  for (const part of str.split(',')) {
    const [k, v] = part.split('=');
    if (k) out[k.trim()] = v === 'null' ? null : Number.isNaN(Number(v)) ? v : Number(v);
  }
  return out;
};

const GAMES = Number(arg('games', 150));
const PLAYER_COUNTS = String(arg('players', '2,3,4')).split(',').map(Number);
const BASE_SEED = Number(arg('seed', 1));
const VARIED = arg('varied', false) === true;
const HUMANS = Number(arg('humans', 0));
const SETTINGS = parseKV(arg('set', ''));
const BOT_OVERRIDE = parseKV(arg('bot', ''));
const QUIET = arg('quiet', false) === true;
const FUZZ = arg('fuzz', false) === true;
const ROUND_LIMITS = (arg('unlimited', false) === true ? 'unlimited' : String(arg('rounds', '30,50,unlimited')))
  .split(',')
  .map((x) => (x.trim() === 'unlimited' || x.trim() === 'null' ? null : Number(x)));
const SAFETY_ROUNDS = 400; // simulator-only cap for unlimited games
const MAX_ACTIONS = 80000;

// ---------- invariants ----------
function checkInvariants(s) {
  const fail = (msg) => { throw new Error(`invariant: ${msg}`); };
  if (!['roll', 'buy', 'auction', 'manage', 'debt', 'over'].includes(s.phase)) fail(`bad phase ${s.phase}`);
  if (!Number.isFinite(s.round) || s.round < 1) fail(`bad round ${s.round}`);
  if (!Number.isInteger(s.rng)) fail('rng not an integer');
  const ids = new Set(s.players.map((p) => p.id));
  let heldJailCards = 0;
  for (const p of s.players) {
    if (!Number.isFinite(p.cash) || !Number.isInteger(p.cash)) fail(`${p.id} cash not an integer: ${p.cash}`);
    if (p.cash < 0) fail(`${p.id} negative cash ${p.cash}`);
    if (!Number.isInteger(p.pos) || p.pos < 0 || p.pos >= BOARD_SIZE) fail(`${p.id} bad pos ${p.pos}`);
    if (p.jailTurns < 0 || p.doubles < 0 || p.doubles > 2) fail(`${p.id} bad jail/doubles`);
    if (p.jailTurns > 0 && p.pos !== 14) fail(`${p.id} jailed away from the jail tile`);
    if (!Number.isInteger(p.jailCards) || p.jailCards < 0) fail(`${p.id} bad jailCards`);
    if (!Number.isInteger(p.rollsSinceDouble) || p.rollsSinceDouble < 0) fail(`${p.id} bad rollsSinceDouble`);
    if (!Number.isInteger(p.rentStreak) || p.rentStreak < 0) fail(`${p.id} bad rentStreak`);
    heldJailCards += p.jailCards;
    if (p.bankrupt && (p.cash !== 0 || s.owners.includes(p.id) || p.jailCards)) fail(`${p.id} bankrupt but still holds assets`);
    for (const [k, v] of Object.entries(p.stats)) if (!Number.isFinite(v) || v < 0) fail(`${p.id} stat ${k}=${v}`);
    if (Number.isNaN(netWorth(s, p.id))) fail(`${p.id} worth NaN`);
  }
  if (heldJailCards > 1) fail('more than one jail card in circulation');
  if (!Array.isArray(s.mortgaged) || s.mortgaged.length !== BOARD_SIZE) fail('mortgaged array missing');
  for (let i = 0; i < BOARD_SIZE; i++) {
    const o = s.owners[i];
    const lv = s.levels[i];
    if (o !== null) {
      if (!ids.has(o)) fail(`tile ${i} owned by unknown ${o}`);
      if (!isBuyable(TILES[i])) fail(`tile ${i} owned but not buyable`);
      if (s.players.find((p) => p.id === o).bankrupt) fail(`tile ${i} owned by bankrupt ${o}`);
    }
    if (!Number.isInteger(lv) || lv < 0 || lv > MAX_LEVEL) fail(`tile ${i} bad level ${lv}`);
    if (lv > 0) {
      if (TILES[i].type !== 'property') fail(`tile ${i} has level but is not a property`);
      if (o === null) fail(`tile ${i} has level but no owner`);
      if (!GROUP_TILES[TILES[i].group].every((t) => s.owners[t] === o)) fail(`tile ${i} built without the full set`);
      if (GROUP_TILES[TILES[i].group].some((t) => s.mortgaged[t])) fail(`tile ${i} built inside a mortgaged colour`);
      const levels = GROUP_TILES[TILES[i].group].map((t) => s.levels[t]);
      if (Math.max(...levels) - Math.min(...levels) > 1) fail(`tile ${i} breaks the even-build rule`);
    }
    if (s.mortgaged[i] && (o === null || lv > 0)) fail(`tile ${i} mortgaged while unowned or built`);
  }
  if (s.phase === 'buy' && s.pending?.type !== 'buy') fail('buy phase without pending buy');
  if (s.phase === 'auction' && s.pending?.type !== 'auction') fail('auction phase without pending auction');
  if (s.phase !== 'buy' && s.phase !== 'auction' && s.pending) fail(`pending left over in phase ${s.phase}`);
  if (s.phase === 'debt') {
    const d = s.debt;
    if (!d) fail('debt phase without a debt');
    const debtor = s.players.find((p) => p.id === d.player);
    if (!debtor || debtor.bankrupt) fail('debtor missing or bankrupt');
    if (debtor.cash >= d.amount && false) fail('unreachable');
    if (debtor.cash + liquidationValue(s, d.player) < d.amount) fail('debt that liquidation cannot cover should be a bankruptcy');
  } else if (s.debt) fail('debt left over outside the debt phase');
  if (s.trade) {
    const a = s.players.find((p) => p.id === s.trade.from);
    const b = s.players.find((p) => p.id === s.trade.to);
    if (!a || !b || a.bankrupt || b.bankrupt) fail('trade with a bankrupt player');
    if (s.phase === 'over') fail('trade left open after the game ended');
  }
  if (s.phase !== 'over') {
    if (s.players[s.turn].bankrupt && s.phase !== 'auction' && s.phase !== 'debt') fail('turn points at a bankrupt player');
    if (s.players.filter((p) => !p.bankrupt).length < 2) fail('game should be over');
  } else if (!s.winReason) fail('over without winReason');
}

// ---------- one game ----------
function makePlayers(n, seed) {
  const r = mulberry32(seed * 7919 + 13);
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Bot ${i + 1}`,
    avatar: i,
    isBot: i >= HUMANS,
    bot: VARIED
      ? { reserve: Math.round((300 + r() * 1200) / 50) * 50, greed: Math.round((0.7 + r() * 0.6) * 100) / 100 }
      : { ...(Object.keys(BOT_OVERRIDE).length ? BOT_OVERRIDE : {}) },
  }));
}

/** Who must act now, whether a bot or a human proxy. */
function actorOf(s) {
  if (s.phase === 'debt') return s.debt.player;
  if (s.trade) return s.trade.to;
  if (s.phase === 'auction') {
    const p = s.players.find((q) => !q.bankrupt && !(q.id in s.pending.bids));
    return p ? p.id : null;
  }
  return s.players[s.turn].id;
}

/** A random action that getOptions() says is legal (plus some random trade offers, which the engine may refuse). */
function fuzzAction(s, rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const active = s.players.filter((p) => !p.bankrupt);
  if (rnd() < 0.004 && active.length > 2) return { type: 'RESIGN', playerId: pick(active).id, offered: true };
  const who = actorOf(s);
  const o = getOptions(s, who);
  const c = [];
  const add = (w, a) => c.push({ w, a: { ...a, playerId: who, offered: true } });
  if (s.trade && s.trade.to === who) {
    add(1, { type: 'TRADE_ACCEPT' });
    add(1, { type: 'TRADE_REJECT' });
  } else if (s.trade && s.trade.from === who) {
    add(1, { type: 'TRADE_CANCEL' });
  } else if (s.phase === 'debt') {
    if (o.payDebt) add(8, { type: 'PAY_DEBT' });
    for (const m of o.mortgage) add(2, { type: 'MORTGAGE', tile: m.tile });
    for (const m of o.sellBuilding) add(2, { type: 'SELL_BUILDING', tile: m.tile });
    if (!c.length || rnd() < 0.01) add(1, { type: 'RESIGN' });
  } else if (s.phase === 'auction') {
    if (o.bid) {
      add(2, { type: 'BID', amount: 0 });
      add(3, { type: 'BID', amount: Math.min(o.bid.max, o.bid.min + 10 * Math.floor(rnd() * 40)) });
      add(1, { type: 'BID', amount: o.bid.max });
    }
  } else {
    if (o.roll) add(10, { type: 'ROLL' });
    if (o.endTurn) add(6, { type: 'END_TURN' });
    if (o.buy) add(5, { type: 'BUY' });
    if (o.skipBuy) add(2, { type: 'SKIP_BUY' });
    if (o.bail) add(2, { type: 'PAY_BAIL' });
    if (o.useJailCard) add(3, { type: 'USE_JAIL_CARD' });
    for (const u of o.upgrade) add(2, { type: 'UPGRADE', tile: u.tile });
    for (const m of o.mortgage) add(1, { type: 'MORTGAGE', tile: m.tile });
    for (const m of o.unmortgage) add(1, { type: 'UNMORTGAGE', tile: m.tile });
    for (const m of o.sellBuilding) add(1, { type: 'SELL_BUILDING', tile: m.tile });
    if (o.trade.canOffer && rnd() < 0.3) {
      const me = s.players.find((p) => p.id === who);
      const others = active.filter((p) => p.id !== who);
      const to = pick(others);
      const tilesOf = (pl) => s.owners.map((ow, i) => (ow === pl.id ? i : -1)).filter((i) => i >= 0);
      const some = (arr) => arr.filter(() => rnd() < 0.4).slice(0, 2);
      c.push({ w: 3, a: { type: 'TRADE_OFFER', playerId: who, to: to.id, give: { cash: Math.floor(rnd() * Math.min(me.cash, 1500)), tiles: some(tilesOf(me)) }, get: { cash: Math.floor(rnd() * Math.min(to.cash, 1500)), tiles: some(tilesOf(to)) } } });
    }
  }
  if (!c.length) return null;
  let t = rnd() * c.reduce((x, e) => x + e.w, 0);
  for (const e of c) { t -= e.w; if (t <= 0) return e.a; }
  return c[c.length - 1].a;
}

function playGame(n, seed, maxRounds) {
  const players = makePlayers(n, seed);
  let state = createGame({ players, seed, settings: { ...(FUZZ ? { goal: 400000, startCash: 8000 } : {}), ...SETTINGS, maxRounds } });
  const rnd = mulberry32(seed ^ 0x5eed);
  let actions = 0;
  const counts = { rent: 0, auction: 0, jail: 0, card: 0, bankrupt: 0, upgrade: 0, trade: 0, tradeOffer: 0, mortgage: 0, hotel: 0, debt: 0, sets: 0, jailCard: 0, assists: 0, declineAuctions: 0 };
  let stalled = false;
  while (state.phase !== 'over') {
    if (maxRounds === null && state.round > SAFETY_ROUNDS) { stalled = true; break; }
    let action = null;
    if (FUZZ) {
      action = fuzzAction(state, rnd);
      if (!action) throw new Error(`fuzz: nobody can act in phase ${state.phase}`);
    } else action = nextBotMove(state, rnd);
    if (!action) {
      const who = actorOf(state);
      const actor = state.players.find((p) => p.id === who);
      if (!actor || actor.isBot) throw new Error(`bot stuck in phase ${state.phase} (actor ${who})`);
      // a human proxy plays like a bot, except that it accepts half of the trade offers it gets
      action = state.trade && state.trade.to === who
        ? { type: rnd() < 0.5 ? 'TRADE_ACCEPT' : 'TRADE_REJECT', playerId: who }
        : chooseBotAction(state, who, rnd);
      if (!action) throw new Error(`human proxy has no action in phase ${state.phase} (actor ${who})`);
    }
    const offered = action.offered;
    if (offered) delete action.offered;
    const res = applyAction(state, action);
    if (res.error) {
      if (FUZZ && !offered) continue; // a random trade offer the engine rightly refused
      throw new Error(`engine rejected ${JSON.stringify(action)}: ${res.error}`);
    }
    for (const e of res.events) {
      if (e.type === 'cash' && e.reason === 'rent' && e.delta > 0) counts.rent += 1;
      else if (e.type === 'auction_end' && e.winner) counts.auction += 1;
      else if (e.type === 'auction_start' && state.phase === 'buy') counts.declineAuctions += 1;
      else if (e.type === 'jail' && e.jailed) counts.jail += 1;
      else if (e.type === 'jail' && e.reason === 'card_used') counts.jailCard += 1;
      else if (e.type === 'card') counts.card += 1;
      else if (e.type === 'bankrupt') counts.bankrupt += 1;
      else if (e.type === 'level' && e.reason === 'upgrade') { counts.upgrade += 1; if (e.level === MAX_LEVEL) counts.hotel += 1; }
      else if (e.type === 'trade_done') counts.trade += 1;
      else if (e.type === 'trade_offer') counts.tradeOffer += 1;
      else if (e.type === 'mortgage') counts.mortgage += 1;
      else if (e.type === 'debt') counts.debt += 1;
      else if (e.type === 'set_complete') counts.sets += 1;
      else if (e.type === 'dice' && e.assist) counts.assists += 1;
    }
    state = res.state;
    checkInvariants(state);
    if (++actions > MAX_ACTIONS) throw new Error('game did not terminate');
  }
  const seat = state.winner ? state.players.findIndex((p) => p.id === state.winner) : -1;
  const worths = state.players.map((p) => netWorth(state, p.id)).sort((a, b) => b - a);
  return {
    seat, reason: stalled ? 'stalled' : state.winReason, rounds: state.round, turns: state.turnCount, counts, actions,
    // how decisive a round-limit finish is: lead of the winner over the runner-up, as a share of the winner's worth
    lead: worths[0] > 0 ? (worths[0] - worths[1]) / worths[0] : 0,
  };
}

// ---------- stats ----------
const pct = (arr, q) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))];
};
const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

const summary = [];
let failures = 0;
const t0 = Date.now();
for (const maxRounds of ROUND_LIMITS) {
  for (const n of PLAYER_COUNTS) {
    const results = [];
    for (let g = 0; g < GAMES; g++) {
      const seed = BASE_SEED * 100003 + n * 1009 + g * 31 + 7;
      try {
        results.push(playGame(n, seed, maxRounds));
      } catch (err) {
        failures += 1;
        if (failures <= 5) console.error(`FAIL players=${n} rounds=${maxRounds} seed=${seed}: ${err.message}`);
      }
    }
    const ok = results.length;
    if (!ok) continue;
    const reasons = {};
    for (const r of results) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    const seatWins = Array(n).fill(0);
    for (const r of results) if (r.seat >= 0) seatWins[r.seat] += 1;
    const rounds = results.map((r) => r.rounds);
    const byRounds = results.filter((r) => r.reason === 'rounds');
    const row = {
      limit: maxRounds === null ? 'unlimited' : maxRounds, n, games: ok,
      netWorthPct: ((reasons.net_worth || 0) / ok) * 100,
      lastPct: ((reasons.last_standing || 0) / ok) * 100,
      roundsPct: ((reasons.rounds || 0) / ok) * 100,
      stalledPct: ((reasons.stalled || 0) / ok) * 100,
      median: pct(rounds, 0.5), p90: pct(rounds, 0.9), min: Math.min(...rounds), max: Math.max(...rounds),
      avgTurns: avg(results.map((r) => r.turns)),
      avgActions: avg(results.map((r) => r.actions)),
      seatWins: seatWins.map((w) => (w / ok) * 100),
      leadByRounds: byRounds.length ? avg(byRounds.map((r) => r.lead)) * 100 : null,
    };
    const per = (k) => avg(results.map((r) => r.counts[k]));
    row.counts = Object.fromEntries(Object.keys(results[0].counts).map((k) => [k, per(k)]));
    row.tradePct = (results.filter((r) => r.counts.trade > 0).length / ok) * 100;
    row.mortgagePct = (results.filter((r) => r.counts.mortgage > 0).length / ok) * 100;
    row.hotelPct = (results.filter((r) => r.counts.hotel > 0).length / ok) * 100;
    summary.push(row);
    if (!QUIET) {
      console.log(`\n=== ${n} players, limit ${row.limit}, ${ok}/${GAMES} games ok${HUMANS ? `, ${HUMANS} human proxy` : ''} ===`);
      console.log(`win reason   : net_worth ${f1(row.netWorthPct)}%  last_standing ${f1(row.lastPct)}%  rounds ${f1(row.roundsPct)}%${row.stalledPct ? `  STALLED(>${SAFETY_ROUNDS}) ${f1(row.stalledPct)}%` : ''}`);
      console.log(`rounds       : median ${row.median}  p90 ${row.p90}  min ${row.min}  max ${row.max}${row.leadByRounds !== null ? `   (round-limit wins lead runner-up by ${f1(row.leadByRounds)}% of worth)` : ''}`);
      console.log(`turns/game   : ${f1(row.avgTurns)} (avg)   actions/game ${f1(row.avgActions)}`);
      console.log(`wins by seat : ${row.seatWins.map((w, i) => `S${i + 1} ${f1(w)}%`).join('  ')}`);
      const c = row.counts;
      console.log(`per game avg : rents ${f1(c.rent)}  upgrades ${f1(c.upgrade)}  hotels ${f2(c.hotel)}  sets ${f1(c.sets)}  auctions won ${f1(c.auction)} (declined-tile ${f1(c.declineAuctions)})  bankruptcies ${f2(c.bankrupt)}`);
      console.log(`               mortgages ${f1(c.mortgage)}  debts ${f1(c.debt)}  trades ${f2(c.trade)}/${f2(c.tradeOffer)} offers  jail ${f1(c.jail)} (cards used ${f2(c.jailCard)})  lucky-dice assists ${f1(c.assists)}`);
      console.log(`games with   : a trade ${f1(row.tradePct)}%  a mortgage ${f1(row.mortgagePct)}%  a hotel ${f1(row.hotelPct)}%`);
    }
  }
}

const u = { ...DEFAULT_SETTINGS, ...SETTINGS };
console.log(`\nsettings: startCash ${u.startCash}, goal ${u.goal}, passStart ${u.passStart}, tax ${u.taxAmount}, film ${u.filmFee}, dice ${u.dice}${VARIED ? ' (varied bots)' : ''}`);
console.log(`${failures === 0 ? 'ALL INVARIANTS HELD' : `${failures} GAME(S) FAILED`} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (QUIET) {
  for (const r of summary) {
    console.log(`n=${r.n} lim=${r.limit} nw=${f1(r.netWorthPct)}% last=${f1(r.lastPct)}% rounds=${f1(r.roundsPct)}%${r.stalledPct ? ` stalled=${f1(r.stalledPct)}%` : ''} med=${r.median} p90=${r.p90} s1=${f1(r.seatWins[0])}% hotel=${f1(r.hotelPct)}% mort=${f1(r.mortgagePct)}% trade=${f1(r.tradePct)}% bankr=${f2(r.counts.bankrupt)}`);
  }
}
process.exit(failures === 0 ? 0 : 1);
