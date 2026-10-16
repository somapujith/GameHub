import { Hono } from 'hono';
import { HttpError } from '../db.js';
import { requireUser } from '../auth.js';
import { newRoomCode, normalizeRoomCode } from '../codes.js';
import { getAdapter } from '../games/index.js';
import { parseRoomInit } from '../roomrules.js';
import { limit } from '../ratelimit.js';
import { readJson } from '../http.js';
import { roomCall } from '../hub.js';
import { listOpenRooms, listMyRooms } from '../roomsdb.js';

const rooms = new Hono();

// POST /api/rooms { gameId?, settings?, maxPlayers?, visibility? } -> { code, gameId }
// A missing gameId means hyderabad-tycoon; unknown games are refused; settings belong to the game
// and are validated by its adapter (and again by the room).
rooms.post('/', requireUser, limit('room-create', 10, 60), async (c) => {
  const user = c.get('user');
  const body = await readJson(c);
  const init = parseRoomInit(body);
  if (!init.ok) throw new HttpError(400, init.error);
  const host = { id: user.id, name: user.name, avatar: user.avatar, guest: !!user.is_guest };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newRoomCode();
    const { status, data } = await roomCall(c.env, code, '/init', {
      code,
      host,
      gameId: init.gameId,
      settings: init.settings,
      maxPlayers: init.maxPlayers,
      visibility: init.visibility,
    });
    if (status === 200 || status === 201) return c.json({ code, gameId: init.gameId }, 201);
    if (status !== 409) throw new HttpError(502, data?.error || 'Could not create the room.');
    // 409 = code already taken: try another one.
  }
  throw new HttpError(503, 'Could not allocate a room code, please try again.');
});

// GET /api/rooms/open?game=<id>&limit=20 -> { rooms:[{ code, gameId, hostName, players, maxPlayers, summary?, createdAt }] }
// Public (no sign-in), cached for 5 s: public lobbies with a free seat that were active recently.
rooms.get('/open', limit('rooms-open', 60, 60), async (c) => {
  const game = c.req.query('game');
  if (game !== undefined && game !== '' && !getAdapter(game)) throw new HttpError(400, 'unknown game');
  const list = await listOpenRooms(c.env, { game: game || undefined, limit: c.req.query('limit') });
  c.header('Cache-Control', 'public, max-age=5');
  return c.json({ rooms: list });
});

// GET /api/rooms/mine -> { rooms:[{ code, gameId, status, players, maxPlayers }] } (rooms I am in)
rooms.get('/mine', requireUser, limit('rooms-mine', 30, 60), async (c) => {
  return c.json({ rooms: await listMyRooms(c.env, c.get('user').id) });
});

// GET /api/rooms/:code -> { code, exists, status, players (count), maxPlayers, hostName, isMember, gameId, visibility, settings }
rooms.get('/:code', limit('room-info', 60, 60), async (c) => {
  const code = normalizeRoomCode(c.req.param('code'));
  if (!code) throw new HttpError(400, 'Room codes are 6 letters/numbers.');
  const uid = c.get('session')?.uid;
  const { status, data } = await roomCall(c.env, code, uid ? `/info?member=${uid}` : '/info');
  if (status !== 200 || !data) throw new HttpError(502, 'Could not look up the room.');
  if (!data.exists) {
    return c.json({
      code,
      exists: false,
      status: null,
      players: 0,
      maxPlayers: 0,
      hostName: null,
      isMember: false,
      gameId: null,
      visibility: null,
      settings: null,
    });
  }
  return c.json({
    code,
    exists: true,
    status: data.status,
    players: data.players,
    maxPlayers: data.maxPlayers,
    hostName: data.hostName,
    isMember: data.isMember === true, // is the signed-in caller already in this room (rejoin allowed)
    gameId: data.gameId,
    visibility: data.visibility,
    settings: data.settings ?? {},
  });
});

export default rooms;
