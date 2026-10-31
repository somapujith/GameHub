// Randomised stress test: seats pick random LEGAL actions straight from getOptions(). Every action the
// options offer must be accepted by applyAction, and the structural invariants must hold after each one.
// During the snatch window the eligible seats (getOptions().snatch) randomly press SNATCH or do nothing, and the
// "room" closes the window with { type: 'SNATCH_CLOSE' } (no playerId) when nobody feels like pressing.
import { describe, it, expect } from 'vitest';
import {
  createGame, applyAction, getOptions, netWorth, liquidationValue, mulberry32,
  BOARD_SIZE, JAIL_TILE, MAX_LEVEL, TOKEN_CAP, TRAPS_EACH, GROUP_TILES, TILES, isBuyable,
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
  if (s.phase === 'snatch') {
    const live = s.players.filter((p) => getOptions(s, p.id).snatch);
    if (live.length && rnd() < 0.6) return { type: 'SNATCH', playerId: pick(live).id };
    return { type: 'SNATCH_CLOSE' }; // the room's timer: carries no player
  }
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
    if (o.trap && rnd() < 0.5) add(4, { type: 'PLACE_TRAP', tile: Math.floor(rnd() * BOARD_SIZE) });
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

function invariants(s, cfg) {
  const ids = new Set(s.players.map((p) => p.id));
  let jailCards = 0;
  for (const p of s.players) {
    expect(Number.isInteger(p.cash) && p.cash >= 0).toBe(true);
    expect(Number.isInteger(p.snatches) && p.snatches >= 0 && p.snatches <= Math.max(cfg.snatches, TOKEN_CAP)).toBe(true); // tokens: never negative, capped
    if (cfg.snatches === 0) expect(p.snatches).toBe(0); // the feature off: nothing is ever earned
    expect(p.traps >= 0 && p.traps <= TRAPS_EACH).toBe(true);
    expect(s.traps.filter((t) => t.owner === p.id).length + p.traps).toBeLessThanOrEqual(TRAPS_EACH);
    if (p.bankrupt) expect(s.traps.some((t) => t.owner === p.id)).toBe(false);
    expect(p.pos >= 0 && p.pos < BOARD_SIZE).toBe(true);
    if (p.jailTurns > 0) expect(p.pos).toBe(JAIL_TILE);
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
  if (s.phase === 'snatch') {
    const pd = s.pending;
    expect(pd.type).toBe('snatch');
    expect(pd.eligible.length).toBeGreaterThan(0);
    expect(pd.eligible).not.toContain(pd.buyer);
    expect(new Set(pd.claims).size).toBe(pd.claims.length); // nobody presses twice
    for (const id of pd.claims) expect(pd.eligible).toContain(id);
    for (const id of pd.eligible) expect(s.players.find((p) => p.id === id).snatches).toBeGreaterThan(0);
    expect(s.players[s.turn].id).toBe(pd.buyer);
    expect(pd.ms).toBe(cfg.snatchMs);
    expect(pd.returnPhase).toBe('manage');
  }
  if (s.phase !== 'buy' && s.phase !== 'auction' && s.phase !== 'snatch') expect(s.pending).toBeNull();
  if (s.trade) expect(s.players.filter((p) => !p.bankrupt && (p.id === s.trade.from || p.id === s.trade.to))).toHaveLength(2);
}

// Every cash change of a player is announced by a `cash` event: the cash events of one action add up to the
// change of that player's cash (so a snatch moves a tile and nothing else: the buyer is never refunded).
function cashConserved(before, after, events) {
  const delta = {};
  for (const e of events) if (e.type === 'cash') delta[e.player] = (delta[e.player] || 0) + e.delta;
  for (const p of after.players) {
    const prior = before.players.find((q) => q.id === p.id);
    if (p.bankrupt && !prior.bankrupt) continue; // a resigning player forfeits their cash without a cash event
    const was = prior.cash;
    expect(p.cash - was, `cash of ${p.id} after ${events.map((e) => e.type).join(',')}`).toBe(delta[p.id] || 0);
  }
}

describe('fuzz: random legal play', () => {
  for (const n of [2, 3, 4, 6]) {
    it(`${n} players: every offered action is accepted and the invariants hold`, () => {
      const seen = { windows: 0, snatched: 0, bidding: 0, none: 0, errorsInWindow: 0 };
      for (let g = 0; g < 8; g++) {
        const seed = n * 1000 + g;
        const snatches = [1, 2, 3, 0][g % 4]; // 0 = the feature is off: no window may ever open
        let s = createGame({
          players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, isBot: false })),
          seed,
          settings: { goal: 400000, startCash: 8000, maxRounds: 25, snatches, snatchMs: 3000 },
        });
        const rnd = mulberry32(seed + 77);
        let steps = 0;
        let sawTrade = false;
        while (s.phase !== 'over') {
          if (s.phase === 'snatch' && rnd() < 0.25) {
            // everything but SNATCH / RESIGN is refused while the window is open
            const who = s.players.filter((p) => !p.bankrupt)[Math.floor(rnd() * n) % s.players.filter((p) => !p.bankrupt).length];
            for (const type of ['ROLL', 'END_TURN', 'BUY', 'SKIP_BUY', 'BID', 'PAY_BAIL', 'TRADE_OFFER']) {
              const bad = applyAction(s, { type, playerId: who.id, amount: 0, to: 'p0', give: { cash: 1 }, get: {} });
              expect(bad.error).toBe('Wait for the snatch window');
              expect(bad.state).toBe(s);
              seen.errorsInWindow++;
            }
          }
          const a = randomAction(s, rnd);
          const res = applyAction(s, a);
          if (res.error) {
            expect(['TRADE_OFFER', 'PLACE_TRAP'], `unexpected error "${res.error}" for ${JSON.stringify(a)}`).toContain(a.type); // random offers / trap squares may be refused
            continue;
          }
          if (a.type === 'TRADE_ACCEPT') sawTrade = true;
          if (a.type === 'PLACE_TRAP' && res.error === undefined) expect(res.events).toEqual([{ type: 'trap_placed', player: a.playerId }]);
          if (a.type === 'SNATCH' && res.state.phase === 'snatch') expect(res.events).toEqual([]); // pressing is sealed (until the window closes)
          for (const e of res.events) {
            if (e.type === 'snatch_open') seen.windows++;
            if (e.type === 'snatch_end') seen[{ none: 'none', snatched: 'snatched', bidding: 'bidding' }[e.outcome]]++;
          }
          cashConserved(s, res.state, res.events);
          if (snatches === 0) expect(res.state.phase).not.toBe('snatch');
          for (const q of res.state.players) {
            const was = s.players.find((x) => x.id === q.id).snatches;
            const earned = res.events.filter((e) => e.type === 'token_earned' && e.player === q.id).length;
            expect(q.snatches).toBeLessThanOrEqual(was + earned); // tokens only go up through token_earned
          }
          s = res.state;
          invariants(s, s.cfg);
          if (++steps > 20000) throw new Error('did not terminate');
        }
        expect(['last_standing', 'rounds']).toContain(s.winReason);
        expect(s.winner).toBeTruthy();
        if (g === 0 && n >= 3) expect(typeof sawTrade).toBe('boolean');
      }
      // the feature really was exercised: windows opened and at least one ended in a transfer or a sealed bidding
      expect(seen.windows).toBeGreaterThan(0);
      expect(seen.snatched + seen.bidding).toBeGreaterThan(0);
      expect(seen.errorsInWindow).toBeGreaterThan(0);
    });
  }
});
