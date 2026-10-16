import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CodeSheet from '@/components/shell/nav/CodeSheet.jsx';
import { featuredGame, getGame } from '@/games/registry.js';
import { BRAND } from '@/platform/brand.js';
import { paths } from '@/platform/paths.js';
import GameHero from '@/platform/game/GameHero.jsx';
import HowToPlay from '@/platform/game/HowToPlay.jsx';
import HubIcon from '@/platform/game/HubIcon.jsx';
import ModeCard from '@/platform/game/ModeCard.jsx';
import TopPlayersCard from '@/platform/game/TopPlayersCard.jsx';
import Unavailable from '@/platform/game/Unavailable.jsx';
import YourStats from '@/platform/game/YourStats.jsx';
import { themeVars } from '@/platform/game/color.js';
import { useNotify } from '@/platform/game/notify.js';
import useDocTitle from '@/platform/game/useDocTitle.js';
import useHostRoom from '@/platform/game/useHostRoom.js';
import useOpenRooms from '@/platform/game/useOpenRooms.js';

const Back = () => (
  <Link to={paths.hub()} className="hub-back">
    <HubIcon name="chevL" size={18} /> Games
  </Link>
);

/** "3 open", "20+ open", or nothing while loading / unreachable. */
function openBadge(rooms, limit) {
  if (!rooms) return null;
  if (rooms.length === 0) return 'None yet';
  return rooms.length >= limit ? `${limit}+ open` : `${rooms.length} open`;
}

function LiveDetail({ game }) {
  const { host, busy } = useHostRoom(game);
  const [codeOpen, setCodeOpen] = useState(false);
  const { rooms } = useOpenRooms(game.id, { limit: 20 });
  const modes = { bots: true, friends: true, open: true, ...(game.modes || {}) };
  const extras = (Array.isArray(game.extras) ? game.extras : []).filter((e) => e && e.path && e.label);
  const hasSetup = typeof game.loaders?.offlineSetup === 'function';

  return (
    <div className="hub-page hub-detail" style={themeVars(game.theme)}>
      <Back />
      <GameHero game={game} />

      <div className="hub-detail__grid">
        <div className="hub-detail__main">
          <section aria-labelledby="hub-modes-h">
            <h2 id="hub-modes-h" className="hub-section__title">
              Ways to play
            </h2>
            <div className="hub-modes">
              {modes.bots && hasSetup && (
                <ModeCard variant="primary" icon="robot" title="Play with bots" text="Solo, no sign-in. Pick your rivals and go." to={paths.setup(game.id)} />
              )}
              {modes.friends && (
                <ModeCard icon="users" title="Play with friends" text="Create a private room and share the code." onClick={() => host('private')} busy={busy} />
              )}
              {modes.open && (
                <ModeCard icon="table" title="Open tables" text="Jump into a public game." to={paths.tables(game.id)} badge={openBadge(rooms, 20)} />
              )}
              {(modes.friends || modes.open) && <ModeCard icon="hash" title="Join with a code" text="Got a room code? Enter it here." onClick={() => setCodeOpen(true)} />}
            </div>
          </section>

          {extras.length > 0 && (
            <section aria-labelledby="hub-extras-h">
              <h2 id="hub-extras-h" className="hub-section__title">
                More from {game.name}
              </h2>
              <div className="hub-modes hub-modes--compact">
                {extras.map((e) => (
                  <ModeCard key={e.path} icon={e.icon || 'spark'} title={e.label} to={paths.extra(game.id, e.path)} />
                ))}
              </div>
            </section>
          )}

          <HowToPlay steps={game.howToPlay} />
        </div>

        <aside className="hub-detail__side" aria-label={`${game.name} leaderboard and stats`}>
          <YourStats game={game} />
          <TopPlayersCard game={game} />
        </aside>
      </div>

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

/** /games/:gameId: cover hero, ways to play, how to play, top players and your stats. */
export default function GameDetail() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  useDocTitle(game ? `${game.name} · ${BRAND.name}` : `Game not available · ${BRAND.name}`);
  if (!game) return <Unavailable reason="unknown" />;
  return game.status === 'coming_soon' ? <SoonDetail game={game} /> : <LiveDetail game={game} />;
}
