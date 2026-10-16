// Full-screen offline game at paths.offline(GAME_ID): a new game from router state ({ config, chapterId })
// or a resume of the saved game. Exit goes back to the game's page in the hub.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import GameView from '@/components/game/GameView.jsx';
import Modal from '@/components/shell/Modal.jsx';
import { paths } from '@/platform/paths.js';
import { GAME_ID } from './constants.js';
import { useOfflineGame } from '@/lib/session/useOfflineGame.js';
import { addMatchResult, completeChapter, loadGame } from '@/lib/storage.js';
import { upgradeSavedGame } from '@/lib/session/resumeGame.js';

/** Work out what to play. Returns { config, chapterId, resume } or null (-> back to the setup screen). */
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

  return <GameView session={session} onExit={() => navigate(paths.game(GAME_ID))} rewards={rewards} />;
}

function OfflineGameRoute({ routeState }) {
  const navigate = useNavigate();
  const leave = () => navigate(paths.game(GAME_ID));
  const [source, setSource] = useState(() => resolveSource(routeState));
  const [upgradeNeeded, setUpgradeNeeded] = useState(() => !!(!routeState?.config && source?.resume?.state && source.resume.state.cfg?.diceCount !== 1));
  const [replaceSaved, setReplaceSaved] = useState(() => {
    if (!routeState?.config) return false;
    try { const saved = loadGame(); return !!(saved?.state && saved.state.phase !== 'over' && !saved.state.winner); }
    catch { return false; }
  });
  if (!source) return <Navigate to={paths.setup(GAME_ID)} replace />;
  if (replaceSaved) return <div className="hg-game hg-game--loading">
    <Modal open onClose={leave} title="You have a game in progress" actions={<>
      <button type="button" className="btn btn--primary" data-autofocus onClick={() => navigate(paths.offline(GAME_ID), { replace: true, state: null })}>Resume saved game</button>
      <button type="button" className="btn btn--ghost" onClick={() => setReplaceSaved(false)}>Start a new game</button>
    </>}><p>Starting a new table replaces your saved offline game. Resume where you left off, or make a fresh start.</p></Modal>
  </div>;
  if (upgradeNeeded) return <div className="hg-game hg-game--loading"><Modal open title="Bring your table to one die" onClose={leave} actions={<>
    <button type="button" className="btn btn--primary" data-autofocus onClick={() => {
      const state = upgradeSavedGame(source.resume.state);
      setSource({ ...source, resume: { state }, config: { ...source.config, settings: { ...source.config.settings, diceCount: 1 } } });
      setUpgradeNeeded(false);
    }}>Continue with one die</button><button type="button" className="btn btn--ghost" onClick={leave}>Back</button>
  </>}><p>This saved game uses the older two-die rules. Continue with one die while keeping your cash, properties, positions, and pending decisions. A six now earns another roll.</p></Modal></div>;
  return <OfflineGameInner source={source} />;
}

export default function OfflineGame() {
  const location = useLocation();
  // a new navigation (new location.key) always starts a fresh session
  return <OfflineGameRoute key={location.key} routeState={location.state} />;
}
