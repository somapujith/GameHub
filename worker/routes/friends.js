import { Hono } from 'hono';
import { query, HttpError } from '../db.js';
import { requireMember } from '../auth.js';
import { getUserByFriendCode, getUserById, rowToFriend, identity } from '../users.js';
import { normalizeFriendCode } from '../codes.js';
import { isUuid } from '../validate.js';
import { limit } from '../ratelimit.js';
import { readJson } from '../http.js';
import { isUserOnline, pushToUser, background } from '../hub.js';

const friends = new Hono();
friends.use('*', requireMember); // guests cannot use friends

// GET /api/friends -> { friends, incoming, outgoing }
friends.get('/', async (c) => {
  const me = c.get('user');
  const rows = await query(
    c.env,
    `SELECT f.status, (f.user_id = $1) AS outgoing,
            u.id, u.name, u.avatar, u.friend_code, u.xp
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
      WHERE f.user_id = $1 OR f.friend_id = $1
      ORDER BY lower(u.name), u.id`,
    [me.id],
  );
  const accepted = rows.filter((r) => r.status === 'accepted');
  const onlineFlags = await Promise.all(accepted.map((r) => isUserOnline(c.env, r.id)));
  return c.json({
    friends: accepted.map((r, i) => rowToFriend(r, onlineFlags[i])),
    incoming: rows.filter((r) => r.status === 'pending' && !r.outgoing).map((r) => rowToFriend(r, false)),
    outgoing: rows.filter((r) => r.status === 'pending' && r.outgoing).map((r) => rowToFriend(r, false)),
  });
});

// POST /api/friends/request { friendCode } - idempotent; a mutual request auto-accepts.
friends.post('/request', limit('friend-request', 20, 60), async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const code = normalizeFriendCode(body.friendCode);
  if (!code) throw new HttpError(400, 'That friend code does not look right (e.g. HYD-7K2Q).');
  const target = await getUserByFriendCode(c.env, code);
  if (!target || target.is_guest) throw new HttpError(404, 'No player found with that friend code.');
  if (target.id === me.id) throw new HttpError(400, 'That is your own friend code.');

  // 1) They already asked me -> accept (mutual request).
  const accepted = await query(
    c.env,
    `UPDATE friendships SET status = 'accepted'
      WHERE user_id = $1 AND friend_id = $2 AND status = 'pending' RETURNING 1 AS ok`,
    [target.id, me.id],
  );
  if (accepted.length) {
    background(c, pushToUser(c.env, target.id, { t: 'friend_accepted', by: identity(me) }));
    return c.json({ ok: true, status: 'accepted', friend: rowToFriend(target) });
  }
  // 2) New pending request; the pair-unique index makes a repeat (or a race) a no-op.
  const inserted = await query(
    c.env,
    `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')
     ON CONFLICT DO NOTHING RETURNING 1 AS ok`,
    [me.id, target.id],
  );
  if (inserted.length) {
    background(c, pushToUser(c.env, target.id, { t: 'friend_request', from: identity(me) }));
    return c.json({ ok: true, status: 'pending', friend: rowToFriend(target) });
  }
  // 3) Already existed: report its current state.
  const existing = await query(
    c.env,
    `SELECT status FROM friendships
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [me.id, target.id],
  );
  return c.json({ ok: true, status: existing[0]?.status || 'pending', friend: rowToFriend(target) });
});

// POST /api/friends/accept { userId }
friends.post('/accept', async (c) => {
  const me = c.get('user');
  const { userId } = await readJson(c);
  if (!isUuid(userId)) throw new HttpError(400, 'Invalid user id.');
  const updated = await query(
    c.env,
    `UPDATE friendships SET status = 'accepted'
      WHERE user_id = $1 AND friend_id = $2 AND status = 'pending' RETURNING 1 AS ok`,
    [userId, me.id],
  );
  if (!updated.length) {
    const existing = await query(
      c.env,
      `SELECT 1 FROM friendships
        WHERE status = 'accepted'
          AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))`,
      [me.id, userId],
    );
    if (!existing.length) throw new HttpError(404, 'No pending request from that player.');
    return c.json({ ok: true, status: 'accepted' }); // already friends: idempotent
  }
  background(c, pushToUser(c.env, userId, { t: 'friend_accepted', by: identity(me) }));
  const other = await getUserById(c.env, userId);
  return c.json({ ok: true, status: 'accepted', friend: other ? rowToFriend(other) : undefined });
});

// POST /api/friends/decline { userId } - drops an incoming pending request (idempotent).
friends.post('/decline', async (c) => {
  const me = c.get('user');
  const { userId } = await readJson(c);
  if (!isUuid(userId)) throw new HttpError(400, 'Invalid user id.');
  await query(c.env, `DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`, [userId, me.id]);
  return c.json({ ok: true });
});

// DELETE /api/friends/:userId - unfriend, or cancel my outgoing request (idempotent).
friends.delete('/:userId', async (c) => {
  const me = c.get('user');
  const userId = c.req.param('userId');
  if (!isUuid(userId)) throw new HttpError(400, 'Invalid user id.');
  await query(
    c.env,
    `DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [me.id, userId],
  );
  return c.json({ ok: true });
});

export default friends;
