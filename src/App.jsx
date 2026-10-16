import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth.jsx';
import { AppShell, ErrorBoundary, Loading, ToastProvider } from '@/components/shell/index.js';
import { useSettings } from '@/components/shell/stores.js';

/**
 * Lazy page loader that tolerates default OR named exports (the online/game pages are written
 * by other agents; `name` is the named export to fall back to).
 */
function page(loader, name) {
  return lazy(() =>
    loader().then((m) => ({
      default: m.default ?? m[name] ?? Object.values(m).find((v) => typeof v === 'function'),
    })),
  );
}

const Home = page(() => import('@/pages/Home.jsx'), 'Home');
const Splash = page(() => import('@/pages/Splash.jsx'), 'Splash');
const PlaySetup = page(() => import('@/pages/PlaySetup.jsx'), 'PlaySetup');
const Campaign = page(() => import('@/pages/Campaign.jsx'), 'Campaign');
const SettingsPage = page(() => import('@/pages/SettingsPage.jsx'), 'SettingsPage');
const Leaderboard = page(() => import('@/pages/Leaderboard.jsx'), 'Leaderboard');
const NotFound = page(() => import('@/pages/NotFound.jsx'), 'NotFound');

const Login = page(() => import('@/pages/Login.jsx'), 'Login');
const Friends = page(() => import('@/pages/Friends.jsx'), 'Friends');
const Lobby = page(() => import('@/pages/Lobby.jsx'), 'Lobby');
const JoinRoom = page(() => import('@/pages/JoinRoom.jsx'), 'JoinRoom');
const OnlineGame = page(() => import('@/pages/OnlineGame.jsx'), 'OnlineGame');
const OfflineGame = page(() => import('@/pages/OfflineGame.jsx'), 'OfflineGame');

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MotionSync />
        <ScrollTop />
        <ToastProvider>
          <ErrorBoundary fullscreen>
            <Suspense fallback={<Loading />}>
              <Routes>
                {/* Game screens: no shell chrome */}
                <Route path="/game/offline" element={<OfflineGame />} />
                <Route path="/game/online/:code" element={<OnlineGame />} />

                <Route element={<AppShell />}>
                  <Route index element={<Home />} />
                  <Route path="/story" element={<Splash />} />
                  <Route path="/play" element={<PlaySetup />} />
                  <Route path="/campaign" element={<Campaign />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/friends" element={<Friends />} />
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
