import { lazy, Suspense, useId, useMemo, useState } from 'react';
import HubIcon from '@/platform/game/HubIcon.jsx';
import ErrorBoundary from '@/components/shell/ErrorBoundary.jsx';
import { GameIcon } from './GameArt.jsx';
import { themeVars } from './gameTheme.js';

/** Accessible accordion item for one game's own settings panel; the panel's code loads on first open. */
export default function GameSettings({ game }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const uid = useId();

  const Panel = useMemo(
    () =>
      lazy(() =>
        game.loaders.settingsPanel().then((m) => ({
          default: m.default ?? Object.values(m).find((v) => typeof v === 'function') ?? (() => null),
        })),
      ),
    [game],
  );

  const toggle = () => {
    setOpen((o) => !o);
    setSeen(true);
  };

  return (
    <div className={`hh2-acc ${open ? 'is-open' : ''}`} style={themeVars(game)}>
      <h4 className="hh2-acc__head">
        <button type="button" className="hh2-acc__btn" aria-expanded={open} aria-controls={`${uid}-panel`} id={`${uid}-btn`} onClick={toggle}>
          <GameIcon game={game} size={36} />
          <span className="hh2-acc__name">{game.name}</span>
          <span className="hh2-acc__hint">Game options</span>
          <HubIcon name="chevDown" size={20} className="hh2-acc__chev" />
        </button>
      </h4>
      <div id={`${uid}-panel`} role="region" aria-labelledby={`${uid}-btn`} className={`hh2-collapse ${open ? 'is-open' : ''}`}>
        <div className="hh2-collapse__inner" inert={!open}>
          <div className="hh2-acc__body">
            {seen && (
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div aria-hidden="true">
                      <span className="hh2-skel" style={{ width: '100%', height: 56, marginBottom: 10 }} />
                      <span className="hh2-skel" style={{ width: '100%', height: 56 }} />
                    </div>
                  }
                >
                  <Panel />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
