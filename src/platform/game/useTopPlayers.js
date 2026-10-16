// Per-game leaderboard preview: GET /api/leaderboard?game=ID -> { rows: [{ rank, name, avatar, level, wins, games, bestScore, rating }] }
//
//   const { rows, loading, error, reload } = useTopPlayers(gameId, 5);
//
// Quiet on failure (string `error`, no throw, no console noise).
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api.js';

export default function useTopPlayers(gameId, limit = 5) {
  const [state, setState] = useState({ rows: null, error: '' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!gameId) return undefined;
    const c = new AbortController();
    setState({ rows: null, error: '' });
    api
      .get(`/api/leaderboard?game=${encodeURIComponent(gameId)}`, { signal: c.signal })
      .then((r) => {
        if (c.signal.aborted) return;
        const rows = (Array.isArray(r?.rows) ? r.rows : []).filter((x) => x && typeof x.name === 'string').slice(0, limit);
        setState({ rows, error: '' });
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        setState({ rows: null, error: errorMessage(e, "Couldn't load the leaderboard") });
      });
    return () => c.abort();
  }, [gameId, limit, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { rows: state.rows, loading: state.rows === null && !state.error, error: state.error, reload };
}
