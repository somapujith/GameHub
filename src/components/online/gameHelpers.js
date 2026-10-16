// Pure helpers behind useOnlineGame (kept free of React so they can be unit-tested in node).

/** Every key of getOptions() (rules v2 included) with nothing allowed. */
const BLANK = Object.freeze({
  roll: false,
  bail: false,
  buy: false,
  skipBuy: false,
  endTurn: false,
  upgrade: [],
  bid: null,
  resign: false,
  mortgage: [],
  unmortgage: [],
  sellBuilding: [],
  debt: null,
  payDebt: false,
  useJailCard: false,
  trade: { canOffer: false },
  tradeOffer: null,
  tradeSent: null,
  sets: [],
});

/**
 * getOptions() result for "nothing is allowed right now": every action key false / [] / null.
 * Pass the real options as `like` to (a) also blank any key the engine adds later, by type, and
 * (b) keep the purely informational `sets` list so the UI does not flicker while animations play.
 */
export function blankOptions(like) {
  const out = { ...BLANK, upgrade: [], mortgage: [], unmortgage: [], sellBuilding: [], trade: { canOffer: false }, sets: [] };
  if (like && typeof like === 'object') {
    for (const [k, v] of Object.entries(like)) {
      if (k in BLANK) continue;
      out[k] = Array.isArray(v) ? [] : typeof v === 'boolean' ? false : null;
    }
    if (Array.isArray(like.sets)) out.sets = like.sets;
  }
  return out;
}

/** ReconnectingSocket status -> session.connection ('connecting' | 'open' | 'closed'). */
export function toConnection(status) {
  if (status === 'open') return 'open';
  if (status === 'closed') return 'closed';
  return 'connecting';
}

/**
 * Errors that arrive AFTER we were seated and still end our stay (everything else is a rejected action = toast;
 * errors before the first room payload always mean "you cannot join").
 */
export function isFatalRoomError(message) {
  return /has expired|removed from this room/i.test(String(message || ''));
}

/**
 * Build `session.result` from the final engine state.
 * `standings` is the engine's `standings(state)`; passed in so this file stays dependency-free.
 */
export function buildResult(view, me, standings) {
  if (!view || view.phase !== 'over' || !Array.isArray(view.players)) return null;
  const meId = String(me);
  const byId = new Map(view.players.map((p) => [String(p.id), p]));
  const rows = standings(view).map((r) => {
    const p = byId.get(String(r.id)) || {};
    return { id: r.id, name: p.name ?? '?', avatar: Number.isInteger(p.avatar) ? p.avatar : 0, cash: r.cash, worth: r.worth, rank: r.rank };
  });
  const mine = rows.find((r) => String(r.id) === meId);
  const mp = byId.get(meId);
  return {
    winner: view.winner ?? null,
    reason: view.winReason ?? null,
    rounds: Number.isFinite(view.round) ? view.round : null,
    maxRounds: view.cfg && Number.isFinite(view.cfg.maxRounds) ? view.cfg.maxRounds : null, // null = unlimited
    standings: rows,
    me: {
      won: view.winner != null && String(view.winner) === meId,
      rank: mine ? mine.rank : rows.length,
      worth: mine ? mine.worth : 0,
      rentEarned: mp?.stats?.rentEarned ?? 0,
      propertiesBought: mp?.stats?.propertiesBought ?? 0,
    },
  };
}

/** True when `a` and `b` are the same id regardless of number/string typing. */
export const sameId = (a, b) => a != null && b != null && String(a) === String(b);
