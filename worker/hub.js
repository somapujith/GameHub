// Helpers for talking to the Durable Objects from the Worker (internal fetches).
// The DOs are only reachable through these bindings, so the internal paths below cannot
// be called from the internet.
const INTERNAL = 'https://internal.invalid';

export const userHubStub = (env, userId) => env.USER_HUB.get(env.USER_HUB.idFromName(userId));
export const roomStub = (env, code) => env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));

/** Push a JSON message to all live sockets of a user. Best effort: resolves to a count (0 on failure). */
export async function pushToUser(env, userId, message) {
  try {
    const res = await userHubStub(env, userId).fetch(`${INTERNAL}/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.delivered) || 0;
  } catch {
    return 0;
  }
}

/** Is the user's hub holding at least one live socket? Tolerates failures (false). */
export async function isUserOnline(env, userId) {
  try {
    const res = await userHubStub(env, userId).fetch(`${INTERNAL}/online`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.online === true;
  } catch {
    return false;
  }
}

/** Internal JSON call into a GameRoom. Returns `{ status, data }`. */
export async function roomCall(env, code, path, body) {
  const res = await roomStub(env, code).fetch(`${INTERNAL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

/** Run a promise after the response without ever throwing into the request. */
export function background(c, promise) {
  const safe = Promise.resolve(promise).catch(() => {});
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    /* no execution context (tests) – the promise still runs */
  }
}
