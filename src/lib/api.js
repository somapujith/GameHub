// Tiny fetch wrapper for the Worker API. Cookie session (httpOnly `hyd_session`), JSON in/out.
//
//   const { friends } = await api.get('/api/friends');
//   await api.post('/api/rooms', { maxPlayers: 4 });
//
// Failures throw an ApiError (`{ status, message }`):
//   - server errors use the server's `{ error }` text as `message`
//   - network failure / timeout / the Worker not running  ->  status 0, message 'Offline'

const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const OFFLINE = () => new ApiError(0, 'Offline');

function fallbackMessage(status) {
  if (status === 401) return 'Please sign in first';
  if (status === 403) return 'Not allowed';
  if (status === 404) return 'Not found';
  if (status === 429) return 'Too many requests, slow down';
  if (status >= 500) return 'Server unavailable, try again';
  return `Request failed (${status})`;
}

async function request(method, path, body, { signal, timeout = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: ctrl.signal,
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  let text = '';
  try {
    res = await fetch(path, init);
    text = await res.text();
  } catch {
    throw OFFLINE();
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // HTML (the SPA fallback when no Worker is running) or other junk
      data = undefined;
    }
  }

  if (!res.ok) {
    const msg = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : '';
    // A proxy with nothing behind it answers 5xx with an empty / non-JSON body: that is "Offline", not our bug.
    if (!msg && res.status >= 500 && data === undefined) throw OFFLINE();
    throw new ApiError(res.status, msg || fallbackMessage(res.status));
  }
  if (data === undefined) {
    // 2xx but not JSON: the dev server's index.html fallback => the Worker is not reachable
    throw OFFLINE();
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body = {}, opts) => request('POST', path, body, opts),
  patch: (path, body = {}, opts) => request('PATCH', path, body, opts),
  del: (path, opts) => request('DELETE', path, undefined, opts),
};

/** Best human message for anything thrown by `api.*` (or anything else). */
export function errorMessage(err, fallback = 'Something went wrong') {
  if (err && typeof err.message === 'string' && err.message) {
    return err.status === 0 ? "You're offline or the server is unreachable" : err.message;
  }
  return fallback;
}

export default api;
