import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BRAND } from '@/platform/brand.js';
import { HubBackdrop } from '@/platform/game/hubArt.jsx';
import PageLoading from '@/platform/game/PageLoading.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import TabBar, { TopNav } from './TabBar.jsx';
import TopBar from './nav/TopBar.jsx';
import { useGlobalClickSfx } from './hooks.js';

/** Static titles for hub tabs; game pages (/games/...) set their own with useDocTitle. */
const TITLES = [
  ['/friends', 'Friends'],
  ['/leaderboard', 'Rank'],
  ['/profile', 'Profile'],
  ['/lobby', 'Lobby'],
  ['/join', 'Join a table'],
  ['/login', 'Sign in'],
  ['/f', 'Add a friend'],
];

function useBaseTitle(pathname) {
  useEffect(() => {
    if (pathname.startsWith('/games/')) return;
    const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
    if (hit) document.title = `${hit[1]} · ${BRAND.name}`;
    else if (pathname === '/') document.title = `${BRAND.name} · ${BRAND.tagline}`;
  }, [pathname]);
}

/**
 * Hub chrome (a layout route): soft backdrop, top bar (logo, "Have a code?", coins, profile chip), bottom
 * tab bar on phones, left rail from 900 px. Game screens (/play/**) are rendered outside it.
 */
export default function AppShell() {
  const { pathname } = useLocation();
  useGlobalClickSfx();
  useBaseTitle(pathname);

  return (
    <div className="hub-app">
      <a className="hh-skip" href="#main">
        Skip to content
      </a>
      <div className="hub-backdrop" aria-hidden="true">
        <HubBackdrop />
        <div className="hub-backdrop__shade" />
      </div>

      <TopBar />

      <div className="hub-body">
        <TopNav />
        <main id="main" className="hub-main" tabIndex={-1}>
          <div className="hub-container">
            <ErrorBoundary key={pathname}>
              <Suspense fallback={<PageLoading />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <TabBar />
    </div>
  );
}
