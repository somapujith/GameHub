import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary.jsx';
import Loading from './Loading.jsx';
import ProfileChip from './ProfileChip.jsx';
import TabBar, { TopNav } from './TabBar.jsx';
import { Icon } from './icons.jsx';
import { useAccount, useGlobalClickSfx } from './hooks.js';

/** Routes that render full-bleed without the top bar / tab bar. */
const BARE = ['/story'];

/**
 * App chrome: animated night backdrop, top bar (logo + nav + profile chip), bottom tab bar on
 * phones. Used as a layout route; pages render through <Outlet/>.
 */
export default function AppShell() {
  const { pathname } = useLocation();
  const { signedIn, loading } = useAccount();
  const bare = BARE.includes(pathname);
  useGlobalClickSfx();

  return (
    <div className={`hh-app ${bare ? 'hh-app--bare' : ''}`}>
      <a className="hh-skip" href="#main">
        Skip to content
      </a>
      {!bare && (
        <div className="hh-backdrop" aria-hidden="true">
          <div className="hh-backdrop__shade" />
        </div>
      )}

      {!bare && (
        <header className="hh-topbar">
          <div className="hh-topbar__inner">
            <Link to="/" className="hh-topbar__logo" aria-label="Hyderabad Tycoon, home">
              <span className="hh-brand__mark" aria-hidden="true"><Icon name="dice" size={25} /></span>
              <span className="hh-brand__name">Hyderabad<span>TYCOON</span></span>
            </Link>
            <TopNav />
            <div className="hh-topbar__end">
              {!signedIn && !loading && (
                <Link to="/login" className="btn btn--ghost btn--sm hh-topbar__signin">
                  <Icon name="login" size={16} /> Sign in
                </Link>
              )}
              <ProfileChip />
            </div>
          </div>
        </header>
      )}

      <main id="main" className={bare ? 'hh-main hh-main--bare' : 'hh-main'} tabIndex={-1}>
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<Loading inline />}>{bare ? <Outlet /> : <div className="hh-container"><Outlet /></div>}</Suspense>
        </ErrorBoundary>
      </main>

      {!bare && <TabBar />}
    </div>
  );
}
