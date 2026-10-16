import { Hono } from 'hono';
import { HttpError } from '../db.js';
import { requireUser } from '../auth.js';
import { newRoomCode, normalizeRoomCode } from '../codes.js';
import { sanitizeSettings, parseMaxPlayers } from '../validate.js';
import { limit } from '../ratelimit.js';
import { readJson } from '../http.js';
import { roomCall } from '../hub.js';

const rooms = new Hono();

// POST /api/rooms { settings?, maxPlayers? } -> { code }
rooms.post('/', requireUser, limit('room-create', 10, 60), async (c) => {
  const user = c.get('user');
  const body = await readJson(c);
  const { settings, maxPlayers: mpFromSettings, errors } = sanitizeSettings(body.settings);
  if (errors.length) throw new HttpError(400, errors[0]);
  let maxPlayers = 4;
  if (body.maxPlayers !== undefined) {
    const mp = parseMaxPlayers(body.maxPlayers);
    if (mp == null) throw new HttpError(400, 'maxPlayers must be between 2 and 6.');
    maxPlayers = mp;
  } else if (mpFromSettings) {
    maxPlayers = mpFromSettings;
  }
  const host = { id: user.id, name: user.name, avatar: user.avatar, guest: !!user.is_guest };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newRoomCode();
    const { status, data } = await roomCall(c.env, code, '/init', { code, host, settings, maxPlayers });
    if (status === 200 || status === 201) return c.json({ code }, 201);
    if (status !== 409) throw new HttpError(502, data?.error || 'Could not create the room.');
    // 409 = code already taken: try another one.
  }
  throw new HttpError(503, 'Could not allocate a room code, please try again.');
});

// GET /api/rooms/:code -> { code, exists, status, players (count), maxPlayers, hostName, isMember }
rooms.get('/:code', limit('room-info', 60, 60), async (c) => {
  const code = normalizeRoomCode(c.req.param('code'));
  if (!code) throw new HttpError(400, 'Room codes are 6 letters/numbers.');
  const uid = c.get('session')?.uid;
  const { status, data } = await roomCall(c.env, code, uid ? `/info?member=${uid}` : '/info');
  if (status !== 200 || !data) throw new HttpError(502, 'Could not look up the room.');
  if (!data.exists) {
    return c.json({ code, exists: false, status: null, players: 0, maxPlayers: 0, hostName: null, isMember: false });
  }
  return c.json({
    code,
    exists: true,
    status: data.status,
    players: data.players,
    maxPlayers: data.maxPlayers,
    hostName: data.hostName,
    isMember: data.isMember === true, // is the signed-in caller already in this room (rejoin allowed)
  });
});

export default rooms;
