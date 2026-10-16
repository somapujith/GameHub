// Public rooms ("open tables") for one game: GET /api/rooms/open?game=ID&limit=N
//
//   const { rooms, loading, refreshing, error, refresh, updatedAt } = useOpenRooms(gameId, { poll: 10000 });
//
// `rooms` is null until the first answer, then always an array. Failures keep the last good list and set
// `error` (a string); nothing throws and nothing logs, so an unreachable API is a quiet degraded state.
// With `poll` the list refreshes on that interval while the tab is visible, and again when it becomes visible.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api.js';

function normalise(r) {
  const rows = Array.isArray(r?.rooms) ? r.rooms : [];
  return rows
    .filter((x) => x && typeof x.code === 'string' && x.code)
    .map((x) => ({
      code: x.code,
      gameId: x.gameId,
      hostName: typeof x.hostName === 'string' && x.hostName ? x.hostName : 'A player',
      players: Math.max(0, Number(x.players) || 0),
      maxPlayers: Math.max(1, Number(x.maxPlayers) || 1),
      summary: typeof x.summary === 'string' ? x.summary : '',
      createdAt: x.createdAt ?? null,
    }));
}

export default function useOpenRooms(gameId, { poll = 0, limit = 20 } = {}) {
  const [state, setState] = useState({ rooms: null, error: '', updatedAt: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const ctrl = useRef(null);
  const last = useRef(0);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setRefreshing(true);
    try {
      const r = await api.get(`/api/rooms/open?game=${encodeURIComponent(gameId)}&limit=${limit}`, { signal: c.signal });
      if (c.signal.aborted) return;
      last.current = Date.now();
      setState({ rooms: normalise(r), error: '', updatedAt: last.current });
    } catch (e) {
      if (c.signal.aborted) return;
      setState((s) => ({ ...s, error: errorMessage(e, "Couldn't load open tables") }));
    } finally {
      if (ctrl.current === c) setRefreshing(false);
    }
  }, [gameId, limit]);

  useEffect(() => {
    setState({ rooms: null, error: '', updatedAt: 0 });
    refresh();
    return () => ctrl.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (!poll) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = setInterval(tick, poll);
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > Math.min(poll, 5000)) refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [poll, refresh]);

  return {
    rooms: state.rooms,
    loading: state.rooms === null && !state.error,
    refreshing,
    error: state.error,
    updatedAt: state.updatedAt,
    refresh,
  };
}
