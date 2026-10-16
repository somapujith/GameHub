// Sealed-bid privacy. The engine keeps every bid in `state.pending.bids` in clear; before a
// state goes to a client, every OTHER player's amount is replaced by 0 (the key stays, so the UI
// can still tell who has already bid). The `auction_end` event legitimately reveals all bids.

/** Returns `state` itself when no auction is pending, else a copy safe to send to `userId`. */
export function maskStateFor(state, userId) {
  const pend = state && state.pending;
  if (!pend || pend.type !== 'auction' || !pend.bids || typeof pend.bids !== 'object') return state;
  const bids = {};
  for (const [id, amount] of Object.entries(pend.bids)) bids[id] = id === userId ? amount : 0;
  return { ...state, pending: { ...pend, bids } };
}

/** True when the state has a sealed auction in progress (so per-recipient masking is needed). */
export const hasSealedBids = (state) => !!(state && state.pending && state.pending.type === 'auction');
