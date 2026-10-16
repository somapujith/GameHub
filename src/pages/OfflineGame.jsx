// /game/offline: new game from router state ({ config, chapterId }) or resume of the saved game.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import GameView from '@/components/game/GameView.jsx';
import { useOfflineGame } from '@/lib/session/useOfflineGame.js';
import { addMatchResult, completeChapter, loadGame } from '@/lib/storage.js';

/** Work out what to play. Returns { config, chapterId, resume } or null (-> back to /play). */
function resolveSource(routeState) {
  if (routeState?.config) {
    return { config: routeState.config, chapterId: routeState.chapterId ?? null, resume: null };
  }
  let saved = null;
  try { saved = loadGame(); } catch { saved = null; }
  if (!saved?.state) return null;
  const meta = saved.meta || {};
  let config = meta.config || (Array.isArray(meta.players) ? meta : null);
  if (!config) {
    // Older/partial save: rebuild the config from the saved engine state.
    config = {
      players: (saved.state.players || []).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, isBot: !!p.isBot, bot: p.bot || undefined })),
      settings: saved.state.cfg,
    };
  }
  return { config, chapterId: meta.chapterId ?? routeState?.chapterId ?? null, resume: { state: saved.state } };
}

function OfflineGameInner({ source }) {
  const navigate = useNavigate();
  const session = useOfflineGame({
    config: source.config,
    resume: source.resume || undefined,
    chapterId: source.chapterId || undefined,
  });
  const [rewards, setRewards] = useState(null);
  const handled = useRef(false);
  const { result } = session;

  /* Record the finished match exactly once per result (reset when the game restarts). */
  useEffect(() => {
    if (!result) {
      handled.current = false;
      setRewards(null);
      return;
    }
    if (handled.current) return;
    handled.current = true;
    const me = result.me || {};
    let gained = null;
    try {
      gained = addMatchResult({
        won: !!me.won,
        rank: me.rank,
        worth: me.worth,
        rentEarned: me.rentEarned,
        propertiesBought: me.propertiesBought,
        hotelsBuilt: me.hotelsBuilt,
        players: result.standings?.length ?? source.config?.players?.length,
        chapterId: source.chapterId || undefined,
      });
    } catch { /* storage is best-effort */ }
    if (me.won && source.chapterId) {
      try { completeChapter(source.chapterId); } catch { /* best-effort */ }
    }
    setRewards(gained || null);
  }, [result, source.chapterId, source.config]);

  return <GameView session={session} onExit={() => navigate('/')} rewards={rewards} />;
}

function OfflineGameRoute({ routeState }) {
  const [source] = useState(() => resolveSource(routeState));
  if (!source) return <Navigate to="/play" replace />;
  return <OfflineGameInner source={source} />;
}

export default function OfflineGame() {
  const location = useLocation();
  // a new navigation (new location.key) always starts a fresh session
  return <OfflineGameRoute key={location.key} routeState={location.state} />;
}
