// Pure state transitions for the Friends page (optimistic updates + live socket events). Unit-tested.
// data = { friends: [...], incoming: [...], outgoing: [...] }, each entry { id, name, avatar, friendCode, online, level }.

const same = (a, b) => a != null && b != null && String(a) === String(b);
const without = (list, id) => list.filter((x) => !same(x.id, id));

export const emptyFriends = () => ({ friends: [], incoming: [], outgoing: [] });

const clean = (u) => ({
  id: u.id,
  name: typeof u.name === 'string' && u.name ? u.name : 'Player',
  avatar: Number.isInteger(u.avatar) ? u.avatar : 0,
  friendCode: u.friendCode || '',
  online: !!u.online,
  level: Number.isFinite(u.level) ? u.level : 1,
});

/** Online first, then alphabetical (case-insensitive). Returns a new array. */
export function sortFriends(list) {
  return [...list].sort((a, b) => Number(!!b.online) - Number(!!a.online) || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
}

/** Server payload (possibly partial / junk) -> well-formed data. */
export function normalizeFriends(raw) {
  const arr = (v) => (Array.isArray(v) ? v.filter((u) => u && u.id != null).map(clean) : []);
  return {
    friends: sortFriends(arr(raw && raw.friends)),
    incoming: arr(raw && raw.incoming),
    outgoing: arr(raw && raw.outgoing),
  };
}

export function applyPresence(data, userId, online) {
  if (!data.friends.some((f) => same(f.id, userId))) return data;
  return { ...data, friends: sortFriends(data.friends.map((f) => (same(f.id, userId) ? { ...f, online: !!online } : f))) };
}

/** Add `user` to friends (deduped) and drop any pending request entries for them. */
export function addFriend(data, user) {
  if (!user || user.id == null) return data;
  const u = clean(user);
  const existing = data.friends.find((f) => same(f.id, u.id));
  const friends = existing ? data.friends.map((f) => (same(f.id, u.id) ? { ...u, ...existing, ...stripEmpty(u) } : f)) : [...data.friends, u];
  return { friends: sortFriends(friends), incoming: without(data.incoming, u.id), outgoing: without(data.outgoing, u.id) };
}

function stripEmpty(u) {
  const o = {};
  for (const [k, v] of Object.entries(u)) if (v !== '' && v != null) o[k] = v;
  return o;
}

/** Optimistic accept: move the incoming request into friends. */
export function acceptLocal(data, userId) {
  const u = data.incoming.find((x) => same(x.id, userId));
  return u ? addFriend(data, u) : data;
}

export function removeIncoming(data, userId) {
  return { ...data, incoming: without(data.incoming, userId) };
}

export function removeOutgoing(data, userId) {
  return { ...data, outgoing: without(data.outgoing, userId) };
}

export function removeFriend(data, userId) {
  return { ...data, friends: without(data.friends, userId) };
}

/** A live `friend_request` event: add to incoming unless we already know them. */
export function addIncoming(data, from) {
  if (!from || from.id == null) return data;
  if (data.friends.some((f) => same(f.id, from.id)) || data.incoming.some((f) => same(f.id, from.id))) return data;
  return { ...data, incoming: [...data.incoming, clean({ ...from, online: true })] };
}

export const countOnline = (data) => data.friends.filter((f) => f.online).length;
export const isEmpty = (data) => !data.friends.length && !data.incoming.length && !data.outgoing.length;
