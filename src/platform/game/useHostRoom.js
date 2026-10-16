// Creating a room from a game page ("Play with friends" / "Host a table").
//
//   const { host, busy } = useHostRoom(game);
//   host('private')   // or host('public')
//
// A session (guest or Google) is required; without one the player is sent to /login and brought back to the
// game page afterwards. Errors are shown as toasts, never thrown.
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { paths } from '@/platform/paths.js';

/** `{ [key]: default }` from a manifest's host-settings schema. */
export function defaultSettings(game) {
  const out = {};
  for (const s of Array.isArray(game?.settings) ? game.settings : []) {
    if (s && typeof s.key === 'string' && s.default !== undefined) out[s.key] = s.default;
  }
  return out;
}

export default function useHostRoom(game) {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const gameId = game?.id;

  const host = useCallback(
    async (visibility = 'private') => {
      if (!gameId || lock.current) return;
      if (!auth.user) {
        if (auth.loading) {
          toast('Checking your session… try again in a moment');
          return;
        }
        if (!auth.reachable) {
          toast("You're offline or the server is unreachable", { tone: 'bad' });
          return;
        }
        navigate(paths.login(paths.game(gameId)));
        return;
      }
      lock.current = true;
      setBusy(true);
      try {
        const r = await api.post('/api/rooms', { gameId, visibility, settings: defaultSettings(game) });
        if (!r || typeof r.code !== 'string' || !r.code) throw new Error('The server did not return a room code');
        navigate(paths.lobby(r.code));
      } catch (e) {
        toast(errorMessage(e, "Couldn't create the room, try again"), { tone: 'bad' });
        lock.current = false;
        setBusy(false);
      }
    },
    [auth.user, auth.loading, auth.reachable, game, gameId, navigate, toast],
  );

  return { host, busy };
}
