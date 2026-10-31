import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CodeSheet from '@/components/shell/nav/CodeSheet.jsx';
import { radioKeyNav } from '@/components/shell/ui.jsx';
import { featuredGame, getGame } from '@/games/registry.js';
import { BRAND } from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';
import { GameIcon } from '@/platform/home/GameArt.jsx';
import GameHero from '@/platform/game/GameHero.jsx';
import HubIcon from '@/platform/game/HubIcon.jsx';
import Unavailable from '@/platform/game/Unavailable.jsx';
import { themeVars } from '@/platform/game/color.js';
import { useNotify } from '@/platform/game/notify.js';
import useDocTitle from '@/platform/game/useDocTitle.js';
import { defaultSeats, seatOptions } from '@/platform/game/seats.js';
import useHostRoom from '@/platform/game/useHostRoom.js';

const Back = () => (
  <Link to={paths.hub()} className="hub-back">
    <HubIcon name="chevL" size={18} /> Games
  </Link>
);

/** Quick start: how many players -> Create table (a private room) -> the lobby, where friends are invited. */
function LiveDetail({ game }) {
  const { host, busy } = useHostRoom(game);
  const [codeOpen, setCodeOpen] = useState(false);
  const options = seatOptions(game.players);
  const [seats, setSeats] = useState(() => defaultSeats(options));

  return (
    <div className="hub-page hub-detail hub-quick" style={themeVars(game.theme)}>
      <Back />
      <section className="hub-quick__card" aria-labelledby="hub-quick-title">
        <header className="hub-quick__head">
          <GameIcon game={game} size={64} />
          <div className="hub-quick__titles">
            <h1 id="hub-quick-title" className="hub-quick__title">
              {game.name}
            </h1>
            {game.tagline && <p className="hub-quick__tagline">{game.tagline}</p>}
          </div>
        </header>

        <div className="hub-quick__step">
          <h2 id="hub-seats-h" className="hub-quick__label">
            How many players?
          </h2>
          <div className="hub-quick__seats" role="radiogroup" aria-labelledby="hub-seats-h" onKeyDown={radioKeyNav}>
            {options.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === seats}
                className={`hub-quick__seat${n === seats ? ' is-on' : ''}`}
                onClick={() => setSeats(n)}
                disabled={busy}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="hub-btn hub-btn--accent hub-btn--lg hub-btn--block" onClick={() => host({ maxPlayers: seats })} disabled={busy} aria-busy={busy}>
          {busy ? 'Creating table...' : 'Create table'}
        </button>
        <p className="hub-faint hub-quick__hint">You get a code to share. Friends join, then you set the cash limit and start.</p>

        <button type="button" className="hub-quick__join" onClick={() => setCodeOpen(true)}>
          <HubIcon name="hash" size={16} /> Join with a code
        </button>
      </section>

      <CodeSheet open={codeOpen} onClose={() => setCodeOpen(false)} />
    </div>
  );
}

function SoonDetail({ game }) {
  const [notify, toggle] = useNotify(game.id);
  const playable = featuredGame();
  const meanwhile = playable && playable.status !== 'coming_soon' ? playable : null;
  return (
    <div className="hub-page hub-detail" style={themeVars(game.theme)}>
      <Back />
      <GameHero game={game} soon />
      <section className="hub-panel hub-soon" aria-labelledby="hub-soon-h">
        <div className="hub-soon__text">
          <h2 id="hub-soon-h" className="hub-section__title">
            Coming soon
          </h2>
          <p className="hub-muted">{game.name} isn't open for play yet. Tap Notify me to mark it as one you're waiting for.</p>
        </div>
        <div className="hub-soon__actions">
          <button type="button" className={`hub-btn hub-btn--lg ${notify ? 'hub-btn--soft' : 'hub-btn--accent'}`} aria-pressed={notify} onClick={toggle}>
            <HubIcon name={notify ? 'check' : 'bell'} size={20} /> {notify ? 'On the list' : 'Notify me'}
          </button>
          {meanwhile && (
            <Link to={paths.game(meanwhile.id)} className="hub-btn hub-btn--ghost hub-btn--lg">
              Play {meanwhile.name} meanwhile
            </Link>
          )}
        </div>
        <p className="hub-faint">Saved on this device only.</p>
      </section>
    </div>
  );
}

/** /games/:gameId: a live game is a quick-start card (players, create table); a coming-soon game a teaser. */
export default function GameDetail() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  useDocTitle(game ? `${game.name} · ${BRAND.name}` : `Game not available · ${BRAND.name}`);
  if (!game) return <Unavailable reason="unknown" />;
  return game.status === 'coming_soon' ? <SoonDetail game={game} /> : <LiveDetail game={game} />;
}
