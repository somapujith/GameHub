import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth.jsx';
import { AppShell, ErrorBoundary, ToastProvider } from '@/components/shell/index.js';
import { useSettings } from '@/components/shell/stores.js';
import { BRAND } from '@/platform/brand.js';
import { LEGACY_REDIRECTS, paths } from '@/platform/paths.js';
import PageLoading from '@/platform/game/PageLoading.jsx';
import PluginRoute from '@/platform/game/PluginRoute.jsx';
import '@/styles/hub.css';

/**
 * Lazy page loader that tolerates default OR named exports (several pages are written by other agents;
 * `name` is the named export to fall back to).
 */
function page(loader, name) {
  return lazy(() =>
    loader().then((m) => ({
      default: m.default ?? m[name] ?? Object.values(m).find((v) => typeof v === 'function'),
    })),
  );
}

// Hub pages
const Home = page(() => import('@/pages/Home.jsx'), 'Home');
const Leaderboard = page(() => import('@/pages/Leaderboard.jsx'), 'Leaderboard');
const Profile = page(() => import('@/pages/Profile.jsx'), 'Profile');
const GameDetail = page(() => import('@/pages/GameDetail.jsx'), 'GameDetail');
const GameTables = page(() => import('@/pages/GameTables.jsx'), 'GameTables');
const NotFound = page(() => import('@/pages/NotFound.jsx'), 'NotFound');

// Rooms, friends, accounts
const Login = page(() => import('@/pages/Login.jsx'), 'Login');
const Friends = page(() => import('@/pages/Friends.jsx'), 'Friends');
const FriendLink = page(() => import('@/pages/FriendLink.jsx'), 'FriendLink');
const Lobby = page(() => import('@/pages/Lobby.jsx'), 'Lobby');
const JoinRoom = page(() => import('@/pages/JoinRoom.jsx'), 'JoinRoom');
const OnlineGame = page(() => import('@/pages/OnlineGame.jsx'), 'OnlineGame');

/** Mirrors the in-app "reduced motion" setting onto <html> so CSS can honour it. */
function MotionSync() {
  const [settings] = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    if (settings.reducedMotion) el.dataset.motion = 'reduced';
    else delete el.dataset.motion;
  }, [settings.reducedMotion]);
  return null;
}

/** Scroll to the top on navigation (not on hash changes). */
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Redirect that keeps what an old link carried: `location.state` (e.g. a campaign chapter), the query string
 * and the hash. If `to` has its own query, it wins over the same key from the old URL.
 */
function KeepRedirect({ to }) {
  const loc = useLocation();
  const [base, own = ''] = String(to).split('?');
  const search = new URLSearchParams(loc.search);
  for (const [k, v] of new URLSearchParams(own)) search.set(k, v);
  const qs = search.toString();
  return <Navigate replace to={{ pathname: base, search: qs ? `?${qs}` : '', hash: loc.hash }} state={loc.state} />;
}

/** `/game/online/:code` (the old single-game URL) -> the default game's online screen. */
function LegacyOnline() {
  const { code } = useParams();
  return <KeepRedirect to={paths.online(BRAND.defaultGameId, code)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MotionSync />
        <ScrollTop />
        <ToastProvider>
          <ErrorBoundary fullscreen>
            <Suspense fallback={<PageLoading fullscreen />}>
              <Routes>
                {/* Old single-game URLs keep working (state + query preserved) */}
                {LEGACY_REDIRECTS.map(([from, to]) => (
                  <Route key={from} path={from} element={<KeepRedirect to={to} />} />
                ))}
                <Route path="/game/offline" element={<KeepRedirect to={paths.offline(BRAND.defaultGameId)} />} />
                <Route path="/game/online/:code" element={<LegacyOnline />} />

                {/* Game screens: full screen, no hub chrome */}
                <Route path="/play/:gameId/offline" element={<PluginRoute kind="offlineGame" fullscreen />} />
                <Route path="/play/:gameId/online/:code" element={<OnlineGame />} />

                {/* Hub screens */}
                <Route element={<AppShell />}>
                  <Route index element={<Home />} />
                  <Route path="/games/:gameId" element={<GameDetail />} />
                  <Route path="/games/:gameId/play" element={<PluginRoute kind="offlineSetup" />} />
                  <Route path="/games/:gameId/tables" element={<GameTables />} />
                  <Route path="/games/:gameId/x/:extra" element={<PluginRoute kind="extra" />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/f/:code" element={<FriendLink />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/lobby/:code" element={<Lobby />} />
                  <Route path="/join" element={<JoinRoom />} />
                  <Route path="/join/:code" element={<JoinRoom />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
