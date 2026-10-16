// Renders one screen of a game plugin for a `:gameId` route.
//
//   <PluginRoute kind="offlineSetup" />          -> manifest.loaders.offlineSetup
//   <PluginRoute kind="offlineGame" fullscreen /> -> manifest.loaders.offlineGame (no hub chrome)
//   <PluginRoute kind="extra" />                 -> manifest.extras.find(e => e.path === :extra).loader
//
// Unknown game, coming-soon game, or a manifest without that loader -> a friendly "not available" screen.
// The lazy component is created once per game + kind (and re-created if the loader function changes).
import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import ErrorBoundary from '@/components/shell/ErrorBoundary.jsx';
import { getGame } from '@/games/registry.js';
import PageLoading from './PageLoading.jsx';
import Unavailable from './Unavailable.jsx';

const cache = new Map(); // `${gameId}:${kind}` -> { loader, Component }

/** Pick the page component out of a module: default export, else the first function export. */
function componentOf(mod) {
  if (!mod) return () => null;
  return mod.default ?? Object.values(mod).find((v) => typeof v === 'function' || (v && typeof v === 'object' && v.$$typeof)) ?? (() => null);
}

export function lazyFor(key, loader) {
  const hit = cache.get(key);
  if (hit && hit.loader === loader) return hit.Component;
  const Component = lazy(() => loader().then((m) => ({ default: componentOf(m) })));
  cache.set(key, { loader, Component });
  return Component;
}

export default function PluginRoute({ kind, fullscreen = false }) {
  const { gameId, extra } = useParams();
  const game = getGame(gameId);
  if (!game) return <Unavailable reason="unknown" fullscreen={fullscreen} />;
  if (game.status === 'coming_soon') return <Unavailable reason="soon" game={game} fullscreen={fullscreen} />;

  const loader =
    kind === 'extra'
      ? (Array.isArray(game.extras) ? game.extras : []).find((e) => e && e.path === extra)?.loader
      : game.loaders?.[kind];
  if (typeof loader !== 'function') return <Unavailable reason="missing" game={game} fullscreen={fullscreen} />;

  const id = `${game.id}:${kind}${kind === 'extra' ? `:${extra}` : ''}`;
  const Screen = lazyFor(id, loader);
  return (
    <ErrorBoundary key={id} fullscreen={fullscreen}>
      <Suspense fallback={<PageLoading fullscreen={fullscreen} />}>
        <Screen />
      </Suspense>
    </ErrorBoundary>
  );
}
