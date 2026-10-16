import { Hono } from 'hono';
import { query, HttpError } from '../db.js';
import { requireMember } from '../auth.js';
import { identity } from '../users.js';
import { normalizeRoomCode } from '../codes.js';
import { isUuid } from '../validate.js';
import { limit } from '../ratelimit.js';
import { readJson } from '../http.js';
import { pushToUser, roomCall } from '../hub.js';

const invites = new Hono();

// POST /api/invites { code, userId } -> pushes an `invite` to that friend's UserHub.
invites.post('/', requireMember, limit('invite', 30, 60), async (c) => {
  const me = c.get('user');
  const body = await readJson(c);
  const code = normalizeRoomCode(body.code);
  if (!code) throw new HttpError(400, 'Invalid room code.');
  if (!isUuid(body.userId)) throw new HttpError(400, 'Invalid user id.');

  // Only accepted friends can be invited.
  const friend = await query(
    c.env,
    `SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))`,
    [me.id, body.userId],
  );
  if (!friend.length) throw new HttpError(403, 'You can only invite your friends.');

  // The room must be an open lobby that the inviter is part of.
  const { status, data } = await roomCall(c.env, code, `/info?member=${me.id}`);
  if (status !== 200 || !data?.exists) throw new HttpError(404, 'That room does not exist.');
  if (!data.isMember) throw new HttpError(403, 'Join the room before inviting friends.');
  if (data.status !== 'lobby') throw new HttpError(409, 'That game has already started.');

  const delivered = await pushToUser(c.env, body.userId, { t: 'invite', from: identity(me), code });
  return c.json({ ok: true, delivered: delivered > 0 });
});

export default invites;
