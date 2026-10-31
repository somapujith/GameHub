// Traps (docs/GAME_RULES.md section 13): place one before rolling; when somebody else stops on it they are thrown in jail
// (like Go to Jail) and the tile's own effect is skipped. The tile stays secret until a trap springs.
import { describe, it, expect } from 'vitest';
import { createGame, applyAction, getOptions, TRAPS_EACH, GO_TO_JAIL_TILE, JAIL_TILE, START_CASH, TILES } from './index.js';
import * as board from './board.js';

const ids = ['p0', 'p1', 'p2', 'p3'];
const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: ids[i], name: `P${i}`, avatar: i }));
const edit = (s, fn) => {
  const c = structuredClone(s);
  fn(c);
  return c;
};
const game = (n = 3, settings = {}, seed = 7) => createGame({
  players: mkPlayers(n), seed, settings: { debug: true, auctionOnDecline: false, ...settings },
});
const ok = (res) => {
  expect(res.error).toBeUndefined();
  return res;
};
const act = (s, playerId, action) => ok(applyAction(s, { playerId, ...action }));
const place = (s, playerId, tile) => act(s, playerId, { type: 'PLACE_TRAP', tile });
const err = (s, playerId, action) => applyAction(s, { playerId, ...action }).error;
const ofType = (events, type) => events.filter((e) => e.type === type);

const BEGUMPET = 14; // pink, price 1,600
/** A state where it is `who`'s turn (roll phase), standing on `pos`, with `traps` already on the board. */
const turnOf = (s, who, pos, traps = []) => edit(s, (c) => {
  c.turn = ids.indexOf(who);
  c.players[c.turn].pos = pos;
  c.traps = traps.map(([tile, owner]) => ({ tile, owner }));
  for (const t of traps) c.players.find((p) => p.id === t[1]).traps = 0;
});

describe('constants and start state', () => {
  it('everybody starts with TRAPS_EACH traps in hand and none on the board; TRAP_FINE is gone', () => {
    expect(TRAPS_EACH).toBe(1);
    expect(board.TRAP_FINE).toBeUndefined();
    const s = game();
    expect(s.traps).toEqual([]);
    expect(s.players.map((p) => p.traps)).toEqual([1, 1, 1]);
  });
});

describe('placing (13.1)', () => {
  it('stores the trap secretly, uses the one in hand, does not end the turn, and the event has no tile', () => {
    const s = game();
    expect(getOptions(s, 'p0').trap).toBe(true);
    expect(getOptions(s, 'p1').trap).toBeFalsy(); // not their turn
    const r = place(s, 'p0', BEGUMPET);
    expect(r.state.traps).toEqual([{ tile: BEGUMPET, owner: 'p0' }]);
    expect(r.state.players[0].traps).toBe(0);
    expect(r.state.phase).toBe('roll');
    expect(r.state.turn).toBe(0);
    expect(r.events).toEqual([{ type: 'trap_placed', player: 'p0' }]);
    expect(Object.keys(r.events[0]).sort()).toEqual(['player', 'type']);
    expect(getOptions(r.state, 'p0').trap).toBeFalsy();
    expect(getOptions(r.state, 'p0').roll).toBe(true);
    expect(act(r.state, 'p0', { type: 'ROLL', dice: [2] }).state.players[0].pos).toBe(2); // and they still roll
  });

  it('a jailed player can place before rolling', () => {
    const s = edit(game(), (c) => { c.players[0].pos = JAIL_TILE; c.players[0].jailTurns = 1; });
    expect(getOptions(s, 'p0').trap).toBe(true);
    expect(place(s, 'p0', 20).state.traps).toHaveLength(1);
  });

  it('any tile except Go to Jail, including START, jail, cards and tax squares', () => {
    for (const tile of [0, 4, 7, 10, 20, 38, 39]) expect(place(game(), 'p0', tile).state.traps[0].tile).toBe(tile);
    expect(err(game(), 'p0', { type: 'PLACE_TRAP', tile: GO_TO_JAIL_TILE })).toBe('You cannot trap that square');
    for (const tile of [-1, 40, 1.5, '3', null, undefined, NaN]) {
      expect(err(game(), 'p0', { type: 'PLACE_TRAP', tile })).toBe('You cannot trap that square');
    }
  });

  it('errors: not your turn, after rolling or in another phase, no trap left, same tile twice', () => {
    const s = game();
    expect(err(s, 'p1', { type: 'PLACE_TRAP', tile: 3 })).toBe('Not your turn');
    const rolled = act(s, 'p0', { type: 'ROLL', dice: [3] }).state; // Malakpet: buy phase
    expect(rolled.phase).toBe('buy');
    expect(err(rolled, 'p0', { type: 'PLACE_TRAP', tile: 12 })).toBe('You can only set a trap before you roll');
    const manage = act(rolled, 'p0', { type: 'SKIP_BUY' }).state;
    expect(manage.phase).toBe('manage');
    expect(err(manage, 'p0', { type: 'PLACE_TRAP', tile: 12 })).toBe('You can only set a trap before you roll');
    expect(getOptions(manage, 'p0').trap).toBeFalsy();
    const sixes = act(s, 'p0', { type: 'ROLL', dice: [6] }).state; // extra roll: still after rolling
    expect(sixes.extraRoll).toBe(true);
    expect(err(edit(sixes, (c) => { c.pending = null; }), 'p0', { type: 'PLACE_TRAP', tile: 12 })).toBe('You can only set a trap before you roll');

    const used = place(s, 'p0', 12).state;
    expect(err(used, 'p0', { type: 'PLACE_TRAP', tile: 13 })).toBe('You have no trap left');
    const two = edit(used, (c) => { c.players[0].traps = 2; });
    expect(err(two, 'p0', { type: 'PLACE_TRAP', tile: 12 })).toBe('You cannot trap that square'); // same tile, same owner
    expect(place(two, 'p0', 13).state.traps).toHaveLength(2);
  });

  it('two different players may trap the same tile', () => {
    const a = place(game(), 'p0', BEGUMPET).state;
    const b = place(edit(a, (c) => { c.turn = 1; }), 'p1', BEGUMPET).state;
    expect(b.traps).toEqual([{ tile: BEGUMPET, owner: 'p0' }, { tile: BEGUMPET, owner: 'p1' }]);
  });
});

describe('springing (13.2)', () => {
  const sprung = (extra = (c) => {}) => act(edit(turnOf(game(), 'p1', 11, [[BEGUMPET, 'p0']]), extra), 'p1', { type: 'ROLL', dice: [3] });

  it('jails the victim who lands on it: teleport, jail event, no salary, no cash, turn ends', () => {
    const r = sprung();
    expect(r.events.map((e) => e.type)).toEqual(['dice', 'move', 'land', 'trap_sprung', 'move', 'jail', 'turn']);
    expect(ofType(r.events, 'trap_sprung')).toEqual([{ type: 'trap_sprung', tile: BEGUMPET, owner: 'p0', victim: 'p1' }]);
    expect(ofType(r.events, 'move')[1]).toMatchObject({ player: 'p1', from: BEGUMPET, to: JAIL_TILE, teleport: true, passedStart: false });
    expect(ofType(r.events, 'jail')).toEqual([{ type: 'jail', player: 'p1', jailed: true, reason: 'trap' }]);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
    expect(r.state.players[1]).toMatchObject({ pos: JAIL_TILE, cash: START_CASH });
    expect(r.state.players[1].jailTurns).toBeGreaterThan(0);
    expect(r.state.players[0].cash).toBe(START_CASH);
    expect(r.state.traps).toEqual([]); // one-shot
    expect(r.state.turn).toBe(2);
    expect(r.state.phase).toBe('roll');
  });

  it('skips the tile effect: no buy offer on a free tile', () => {
    const r = sprung();
    expect(r.state.pending).toBeNull();
    expect(r.state.phase).toBe('roll');
    expect(ofType(r.events, 'land')).toHaveLength(1);
  });

  it('skips rent on an owned tile', () => {
    const r = sprung((c) => { c.owners[BEGUMPET] = 'p2'; });
    expect(r.state.players[1].cash).toBe(START_CASH);
    expect(r.state.players[2].cash).toBe(START_CASH);
    expect(ofType(r.events, 'cash')).toHaveLength(0);
  });

  it('skips tax and card squares', () => {
    const tax = act(turnOf(game(), 'p1', 1, [[4, 'p0']]), 'p1', { type: 'ROLL', dice: [3] });
    expect(tax.state.players[1].cash).toBe(START_CASH);
    expect(ofType(tax.events, 'card')).toHaveLength(0);
    expect(ofType(tax.events, 'jail')[0].reason).toBe('trap');
    const card = act(turnOf(game(), 'p1', 4, [[7, 'p0']]), 'p1', { type: 'ROLL', dice: [3] });
    expect(ofType(card.events, 'card')).toHaveLength(0);
    expect(card.state.players[1].pos).toBe(JAIL_TILE);
  });

  it('loses the extra roll of a six, and passing START on the way still pays salary', () => {
    const six = act(turnOf(game(), 'p1', 8, [[BEGUMPET, 'p0']]), 'p1', { type: 'ROLL', dice: [6] });
    expect(six.state.extraRoll).toBe(false);
    expect(six.state.turn).toBe(2);
    const lap = act(turnOf(game(), 'p1', 38, [[3, 'p0']]), 'p1', { type: 'ROLL', dice: [5] });
    expect(ofType(lap.events, 'cash')).toEqual([{ type: 'cash', player: 'p1', delta: 2000, reason: 'salary' }]);
    expect(lap.state.players[1].pos).toBe(JAIL_TILE);
  });

  it('does nothing when the player only passes over it', () => {
    const r = act(turnOf(game(), 'p1', 11, [[BEGUMPET, 'p0']]), 'p1', { type: 'ROLL', dice: [5] }); // 16
    expect(ofType(r.events, 'trap_sprung')).toHaveLength(0);
    expect(r.state.traps).toEqual([{ tile: BEGUMPET, owner: 'p0' }]);
    expect(r.state.players[1].pos).toBe(16);
  });

  it('a teleport to jail does not spring a trap on the jail square', () => {
    const s = turnOf(game(), 'p1', 27, [[JAIL_TILE, 'p0']]);
    const r = act(s, 'p1', { type: 'ROLL', dice: [3] }); // 30 = Go to Jail
    expect(ofType(r.events, 'trap_sprung')).toHaveLength(0);
    expect(r.state.traps).toHaveLength(1);
  });

  it('the owner is immune and the trap stays', () => {
    const r = act(turnOf(game(), 'p0', 11, [[BEGUMPET, 'p0']]), 'p0', { type: 'ROLL', dice: [3] });
    expect(ofType(r.events, 'trap_sprung')).toHaveLength(0);
    expect(r.state.traps).toEqual([{ tile: BEGUMPET, owner: 'p0' }]);
    expect(r.state.players[0].pos).toBe(BEGUMPET);
    expect(r.state.phase).toBe('buy'); // the normal tile effect
  });

  it('is one-shot: the next visitor is not jailed', () => {
    const after = sprung().state;
    const next = act(turnOf(after, 'p2', 11, []), 'p2', { type: 'ROLL', dice: [3] });
    expect(ofType(next.events, 'trap_sprung')).toHaveLength(0);
    expect(next.state.phase).toBe('buy');
  });

  it('two traps on one tile: both are spent, the victim goes to jail once', () => {
    const s = turnOf(game(), 'p1', 11, [[BEGUMPET, 'p0'], [BEGUMPET, 'p2']]);
    const r = act(s, 'p1', { type: 'ROLL', dice: [3] });
    expect(ofType(r.events, 'trap_sprung').map((e) => e.owner)).toEqual(['p0', 'p2']);
    expect(ofType(r.events, 'jail')).toHaveLength(1);
    expect(ofType(r.events, 'move').filter((e) => e.teleport)).toHaveLength(1);
    expect(r.state.traps).toEqual([]);
  });

  it('only the trap of the other player springs when the lander owns one on the same tile', () => {
    const s = turnOf(game(), 'p1', 11, [[BEGUMPET, 'p0'], [BEGUMPET, 'p1']]);
    const r = act(s, 'p1', { type: 'ROLL', dice: [3] });
    expect(r.state.traps).toEqual([{ tile: BEGUMPET, owner: 'p1' }]);
    expect(ofType(r.events, 'trap_sprung')).toHaveLength(1);
  });

  it('a card that moves a player onto a trap springs it too', () => {
    // 34 + 2 = 36 (Nawab ka Farman); card 17 = Metro Runs Smooth moves 3 forward to tile 39
    const s = edit(turnOf(game(), 'p1', 34, [[39, 'p0']]), (c) => { c.deck = [17, ...c.deck.filter((x) => x !== 17)]; c.deckPos = 0; });
    const r = act(s, 'p1', { type: 'ROLL', dice: [2] });
    expect(ofType(r.events, 'trap_sprung')).toEqual([{ type: 'trap_sprung', tile: 39, owner: 'p0', victim: 'p1' }]);
    expect(r.state.players[1].pos).toBe(JAIL_TILE);
    expect(r.state.turn).toBe(2);
  });
});

describe('bankruptcy and old saves', () => {
  it('a bankrupt player\'s traps are removed (traps of others stay)', () => {
    const s = turnOf(game(), 'p0', 0, [[BEGUMPET, 'p0'], [20, 'p1']]);
    const r = act(s, 'p0', { type: 'RESIGN' });
    expect(r.state.players[0].bankrupt).toBe(true);
    expect(r.state.traps).toEqual([{ tile: 20, owner: 'p1' }]);
  });

  it('a state without traps / player.traps behaves as no traps', () => {
    const s = edit(game(), (c) => { delete c.traps; for (const p of c.players) delete p.traps; });
    expect(getOptions(s, 'p0').trap).toBeFalsy();
    expect(err(s, 'p0', { type: 'PLACE_TRAP', tile: 3 })).toBe('You have no trap left');
    const r = act(s, 'p0', { type: 'ROLL', dice: [3] });
    expect(r.state.phase).toBe('buy');
    expect(TILES[3].type).toBe('property');
  });
});
