import { describe, it, expect } from 'vitest';
import {
  emptyFriends,
  normalizeFriends,
  sortFriends,
  applyPresence,
  addFriend,
  acceptLocal,
  removeIncoming,
  removeOutgoing,
  removeFriend,
  addIncoming,
  countOnline,
} from './friendsModel.js';

const u = (id, name, extra = {}) => ({ id, name, avatar: 1, friendCode: `HYD-${id}`, online: false, level: 2, ...extra });

describe('normalizeFriends', () => {
  it('tolerates junk and sorts friends (online first, then name)', () => {
    expect(normalizeFriends(undefined)).toEqual(emptyFriends());
    expect(normalizeFriends({ friends: 'x', incoming: null })).toEqual(emptyFriends());
    const d = normalizeFriends({
      friends: [u('3', 'zed'), u('1', 'Bob', { online: true }), u('2', 'amy'), null, { name: 'no id' }],
      incoming: [u('9', 'In')],
    });
    expect(d.friends.map((f) => f.name)).toEqual(['Bob', 'amy', 'zed']);
    expect(d.incoming).toHaveLength(1);
  });
  it('fills missing fields', () => {
    const d = normalizeFriends({ friends: [{ id: 'a' }] });
    expect(d.friends[0]).toMatchObject({ name: 'Player', avatar: 0, level: 1, online: false });
  });
});

describe('presence', () => {
  it('updates one friend and re-sorts; ignores strangers', () => {
    const d = normalizeFriends({ friends: [u('1', 'Amy'), u('2', 'Bob')] });
    const on = applyPresence(d, '2', true);
    expect(on.friends.map((f) => f.id)).toEqual(['2', '1']);
    expect(applyPresence(d, 'zzz', true)).toBe(d);
    expect(countOnline(on)).toBe(1);
  });
});

describe('accept / decline / remove', () => {
  const base = () => normalizeFriends({ friends: [u('1', 'Amy')], incoming: [u('2', 'Bob'), u('3', 'Cy')], outgoing: [u('4', 'Di')] });

  it('acceptLocal moves the request into friends and does not mutate', () => {
    const d = base();
    const n = acceptLocal(d, '2');
    expect(n.incoming.map((x) => x.id)).toEqual(['3']);
    expect(n.friends.map((x) => x.id).sort()).toEqual(['1', '2']);
    expect(d.incoming).toHaveLength(2);
    expect(acceptLocal(d, 'nope')).toBe(d);
  });
  it('rollback is just restoring the snapshot', () => {
    const d = base();
    const n = acceptLocal(d, '2');
    expect(n).not.toBe(d);
    expect(d.friends.map((x) => x.id)).toEqual(['1']);
  });
  it('removes from each list', () => {
    const d = base();
    expect(removeIncoming(d, '2').incoming.map((x) => x.id)).toEqual(['3']);
    expect(removeOutgoing(d, '4').outgoing).toEqual([]);
    expect(removeFriend(d, '1').friends).toEqual([]);
  });
});

describe('live events', () => {
  it('friend_request adds once', () => {
    const d = emptyFriends();
    const a = addIncoming(d, { id: '5', name: 'Eve', avatar: 3 });
    expect(a.incoming).toHaveLength(1);
    expect(addIncoming(a, { id: '5', name: 'Eve' })).toBe(a);
    const withFriend = normalizeFriends({ friends: [u('6', 'Fay')] });
    expect(addIncoming(withFriend, { id: '6', name: 'Fay' })).toBe(withFriend);
    expect(addIncoming(d, null)).toBe(d);
  });
  it('friend_accepted adds a friend and clears the outgoing entry', () => {
    const d = normalizeFriends({ outgoing: [u('7', 'Gus')] });
    const n = addFriend(d, { id: '7', name: 'Gus', avatar: 4 });
    expect(n.friends.map((f) => f.id)).toEqual(['7']);
    expect(n.outgoing).toEqual([]);
    expect(addFriend(n, { id: '7', name: 'Gus' }).friends).toHaveLength(1);
  });
});

describe('sortFriends', () => {
  it('does not mutate its input', () => {
    const list = [u('2', 'b'), u('1', 'a', { online: true })];
    const sorted = sortFriends(list);
    expect(list[0].id).toBe('2');
    expect(sorted[0].id).toBe('1');
  });
});
