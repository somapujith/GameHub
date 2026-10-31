// Sealed-bid privacy. The engine keeps every bid in `state.pending.bids` in clear; before a
// state goes to a client, every OTHER player's amount is replaced by 0 (the key stays, so the UI
// can still tell who has already bid). The `auction_end` event legitimately reveals all bids.
// The same goes for a Snatch window (docs/GAME_RULES.md 9.8): `pending.claims` is rewritten to
// [userId] for a viewer who pressed and [] for everybody else; `snatch_end` reveals the claimants.
// Placed traps (13.3) are secret too: `state.traps` is cut down to the viewer's own.

// The engine's random-number state and the shuffled card deck are server secrets: a client that holds them could
// compute the next die, the next Kismet card and the next city event. Nothing in the client reads them.
// One stripped copy is cached per authoritative state object, so it costs one spread per action, not per viewer.
const stripped = new WeakMap();
function withoutSecrets(state) {
  if (!('rng' in state) && !('deck' in state)) return state;
  let copy = stripped.get(state);
  if (!copy) {
    copy = { ...state, rng: 0, deck: [] };
    stripped.set(state, copy);
  }
  return copy;
}

/** Returns `state` itself when nothing is secret or sealed, else a copy safe to send to `userId`. */
export function maskStateFor(state, userId) {
  if (!state) return state;
  let out = withoutSecrets(state);
  const pend = state.pending;
  if (pend && pend.type === 'snatch' && Array.isArray(pend.claims)) {
    out = { ...out, pending: { ...pend, claims: pend.claims.includes(userId) ? [userId] : [] } };
  } else if (pend && pend.type === 'auction' && pend.bids && typeof pend.bids === 'object') {
    const bids = {};
    for (const [id, amount] of Object.entries(pend.bids)) bids[id] = id === userId ? amount : 0;
    out = { ...out, pending: { ...pend, bids } };
  }
  // Traps (docs/GAME_RULES.md 13.3): a viewer only ever sees their own; spectators see none.
  if (hasTraps(state)) out = { ...out, traps: state.traps.filter((t) => t.owner === userId) };
  return out;
}

const hasTraps = (state) => !!state && Array.isArray(state.traps) && state.traps.length > 0;

/** True when the state has something sealed (an auction, a Snatch window or a placed trap): per-recipient masking is needed. */
export const hasSealedBids = (state) => !!(state && state.pending && (state.pending.type === 'auction' || state.pending.type === 'snatch')) || hasTraps(state);
