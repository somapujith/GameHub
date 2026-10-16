// Randomised stress test: seats pick random LEGAL actions straight from getOptions(). Every action the
// options offer must be accepted by applyAction, and the structural invariants must hold after each one.
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, netWorth, liquidationValue, mulberry32,
  BOARD_SIZE, MAX_LEVEL, GROUP_TILES, TILES, isBuyable,
} from './index.js';

const actorOf = (s) => {
  if (s.phase === 'debt') return s.debt.player;
  if (s.trade) return s.trade.to;
  if (s.phase === 'auction') return s.players.find((p) => !p.bankrupt && !(p.id in s.pending.bids)).id;
  return s.players[s.turn].id;
};

function randomAction(s, rnd) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const active = s.players.filter((p) => !p.bankrupt);
  if (rnd() < 0.004 && active.length > 2) return { type: 'RESIGN', playerId: pick(active).id };
  const who = actorOf(s);
  const o = getOptions(s, who);
  const c = [];
  const add = (w, a) => c.push({ w, a: { ...a, playerId: who } });
  if (s.trade && s.trade.to === who) {
    add(1, { type: 'TRADE_ACCEPT' });
    add(1, { type: 'TRADE_REJECT' });
  } else if (s.trade && s.trade.from === who) {
    add(1, { type: 'TRADE_CANCEL' });
  } else if (s.phase === 'debt') {
    if (o.payDebt) add(8, { type: 'PAY_DEBT' });
    for (const m of o.mortgage) add(2, { type: 'MORTGAGE', tile: m.tile });
    for (const m of o.sellBuilding) add(2, { type: 'SELL_BUILDING', tile: m.tile });
    if (!c.length) add(1, { type: 'RESIGN' });
  } else if (s.phase === 'auction') {
    add(2, { type: 'BID', amount: 0 });
    add(3, { type: 'BID', amount: Math.min(o.bid.max, o.bid.min + 10 * Math.floor(rnd() * 40)) });
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
      const to = pick(active.filter((p) => p.id !== who));
      const tilesOf = (pl) => s.owners.map((ow, i) => (ow === pl.id ? i : -1)).filter((i) => i >= 0);
      const some = (arr) => arr.filter(() => rnd() < 0.4).slice(0, 2);
      add(3, {
        type: 'TRADE_OFFER', to: to.id,
        give: { cash: Math.floor(rnd() * Math.min(me.cash, 1500)), tiles: some(tilesOf(me)) },
        get: { cash: Math.floor(rnd() * Math.min(to.cash, 1500)), tiles: some(tilesOf(to)) },
      });
    }
  }
  let t = rnd() * c.reduce((x, e) => x + e.w, 0);
  for (const e of c) {
    t -= e.w;
    if (t <= 0) return e.a;
  }
  return c.at(-1).a;
}

function invariants(s) {
  const ids = new Set(s.players.map((p) => p.id));
  let jailCards = 0;
  for (const p of s.players) {
    expect(Number.isInteger(p.cash) && p.cash >= 0).toBe(true);
    expect(p.pos >= 0 && p.pos < BOARD_SIZE).toBe(true);
    if (p.jailTurns > 0) expect(p.pos).toBe(14);
    if (p.bankrupt) expect(p.cash === 0 && !s.owners.includes(p.id) && p.jailCards === 0).toBe(true);
    jailCards += p.jailCards;
    expect(Number.isNaN(netWorth(s, p.id))).toBe(false);
  }
  expect(jailCards).toBeLessThanOrEqual(1);
  for (let i = 0; i < BOARD_SIZE; i++) {
    const o = s.owners[i];
    if (o !== null) {
      expect(ids.has(o) && isBuyable(TILES[i])).toBe(true);
      expect(s.players.find((p) => p.id === o).bankrupt).toBe(false);
    }
    expect(s.levels[i] >= 0 && s.levels[i] <= MAX_LEVEL).toBe(true);
    if (s.levels[i] > 0) {
      expect(o).not.toBeNull();
      const g = GROUP_TILES[TILES[i].group];
      expect(g.every((t) => s.owners[t] === o && !s.mortgaged[t])).toBe(true);
      const lv = g.map((t) => s.levels[t]);
      expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(1);
    }
    if (s.mortgaged[i]) expect(o !== null && s.levels[i] === 0).toBe(true);
  }
  if (s.phase === 'debt') {
    const d = s.debt;
    const debtor = s.players.find((p) => p.id === d.player);
    expect(debtor.bankrupt).toBe(false);
    expect(debtor.cash + liquidationValue(s, d.player)).toBeGreaterThanOrEqual(d.amount);
  } else expect(s.debt).toBeNull();
  if (s.phase === 'buy') expect(s.pending.type).toBe('buy');
  if (s.phase === 'auction') expect(s.pending.type).toBe('auction');
  if (s.phase !== 'buy' && s.phase !== 'auction') expect(s.pending).toBeNull();
  if (s.trade) expect(s.players.filter((p) => !p.bankrupt && (p.id === s.trade.from || p.id === s.trade.to))).toHaveLength(2);
}

describe('fuzz: random legal play', () => {
  for (const n of [2, 3, 4, 6]) {
    it(`${n} players: every offered action is accepted and the invariants hold`, () => {
      for (let g = 0; g < 8; g++) {
        const seed = n * 1000 + g;
        let s = createGame({
          players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, isBot: false })),
          seed,
          settings: { goal: 400000, startCash: 8000, maxRounds: 25 },
        });
        const rnd = mulberry32(seed + 77);
        let steps = 0;
        let sawTrade = false;
        while (s.phase !== 'over') {
          const a = randomAction(s, rnd);
          const res = applyAction(s, a);
          if (res.error) {
            expect(a.type, `unexpected error "${res.error}" for ${JSON.stringify(a)}`).toBe('TRADE_OFFER'); // random offers may be refused
            continue;
          }
          if (a.type === 'TRADE_ACCEPT') sawTrade = true;
          s = res.state;
          invariants(s);
          if (++steps > 20000) throw new Error('did not terminate');
        }
        expect(['last_standing', 'rounds']).toContain(s.winReason);
        expect(s.winner).toBeTruthy();
        if (g === 0 && n >= 3) expect(typeof sawTrade).toBe('boolean');
      }
    });
  }
});
