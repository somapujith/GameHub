import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { allGames, gameById } from './catalog.js';
import { GameIcon } from './GameArt.jsx';
import { themeVars } from './gameTheme.js';
import { useApi, useApiReady } from './useApi.js';

const DONE = new Set(['finished', 'over', 'ended', 'closed']);

/** Offline games saved on this device, one per game that exposes `savedGame()` (each call guarded). */
function readSaved() {
  const out = [];
  for (const g of allGames()) {
    if (typeof g.savedGame !== 'function') continue;
    try {
      const s = g.savedGame();
      if (s && s.to) out.push({ key: `saved:${g.id}`, game: g, title: s.title || g.name, subtitle: s.subtitle || 'Saved game', to: s.to, cta: 'Resume' });
    } catch {
      /* a broken plugin must not hide the others */
    }
  }
  return out;
}

function roomItem(r) {
  const game = gameById(r.gameId);
  const lobby = !r.status || r.status === 'lobby';
  const seats = r.maxPlayers ? `${r.players ?? 1}/${r.maxPlayers} players` : `${r.players ?? 1} players`;
  return {
    key: `room:${r.code}`,
    game,
    title: game ? game.name : 'Game room',
    subtitle: `Room ${r.code} · ${seats} · ${lobby ? 'In lobby' : 'In progress'}`,
    to: lobby ? paths.lobby(r.code) : paths.online(r.gameId, r.code),
    cta: lobby ? 'Rejoin' : 'Resume',
  };
}

/** "Continue playing": saved offline games + rooms you are in. Renders nothing when there is nothing to show. */
export default function ContinueRow() {
  const { signedIn } = useAccount();
  const ready = useApiReady();
  const [saved, setSaved] = useState(readSaved);
  const rooms = useApi('/api/rooms/mine', { enabled: ready && signedIn });

  // The saved game changes while other screens are open; re-read when the tab regains focus.
  useEffect(() => {
    const refresh = () => setSaved(readSaved());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const items = useMemo(() => {
    const list = Array.isArray(rooms.data?.rooms) ? rooms.data.rooms : [];
    const live = list.filter((r) => r && r.code && !DONE.has(r.status)).map(roomItem);
    return [...saved, ...live];
  }, [saved, rooms.data]);

  if (!items.length) return null;

  return (
    <section className="hub-section hh2-continue" aria-labelledby="hh2-continue-h">
      <div className="hub-section__head">
        <h2 id="hh2-continue-h" className="hub-section__title">
          Continue playing
        </h2>
      </div>
      <ul className="hh2-cont">
        {items.map((it) => (
          <li key={it.key}>
            <Link to={it.to} className="hub-card hub-card--interactive hh2-cont__card" style={themeVars(it.game)}>
              {it.game ? <GameIcon game={it.game} size={56} /> : <span className="hh2-gicon" style={{ '--sz': '56px' }} aria-hidden="true" />}
              <span className="hh2-cont__text">
                <b>{it.title}</b>
                <small>{it.subtitle}</small>
              </span>
              <span className="hub-gamecard__play hh2-cont__cta" aria-hidden="true">
                <HubIcon name="play" size={11} /> {it.cta}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
