import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, errorMessage, sendInvite } from '@/lib/api.js';
import { paths } from '@/platform/paths.js';
import { inviteGames, warmOnlineGame } from './games.js';
import GameIcon from './GameIcon.jsx';
import Sheet from './Sheet.jsx';
import '@/styles/online.css';

/**
 * "Invite to game": pick one of the live games, we open a private room for it, invite the friend
 * (POST /api/invites) and land in the lobby. `friend` = { id, name }.
 */
export default function InviteToGameSheet({ friend, onClose }) {
  const navigate = useNavigate();
  const games = inviteGames();
  const [busy, setBusy] = useState(null); // gameId being created
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const pick = async (game) => {
    if (busy) return;
    setBusy(game.id);
    setError('');
    let room;
    try {
      room = await createRoom({ gameId: game.id, visibility: 'private' });
      if (!room || !room.code) throw new Error('The room could not be created. Try again.');
    } catch (e) {
      if (!alive.current) return;
      setError(errorMessage(e, 'Could not create the room'));
      setBusy(null);
      return;
    }
    let toast = { text: `Invite sent to ${friend.name}`, tone: 'good' };
    try {
      await sendInvite(room.code, friend.id);
    } catch (e) {
      toast = { text: `Room ready, but ${friend.name} could not be invited: ${errorMessage(e, 'try again from the lobby')}`, tone: 'bad' };
    }
    navigate(paths.lobby(room.code), { state: { toast } });
  };

  return (
    <Sheet open title={`Invite ${friend.name}`} subtitle="Pick a game. We open a private room and send the invite." onClose={busy ? undefined : onClose}>
      {games.length === 0 ? (
        <p className="ho-empty">No games are open for friends yet. Check back soon.</p>
      ) : (
        <ul className="ho-list ho-gamelist" aria-label="Games">
          {games.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="ho-gamepick"
                onClick={() => pick(g)}
                onPointerEnter={() => warmOnlineGame(g)}
                onFocus={() => warmOnlineGame(g)}
                disabled={!!busy}
                aria-busy={busy === g.id || undefined}
              >
                <GameIcon game={g} size={52} />
                <span className="ho-gamepick__main">
                  <span className="ho-gamepick__name">{g.name}</span>
                  <span className="ho-gamepick__sub">
                    {g.tagline}
                    {g.players ? ` · ${g.players.min}-${g.players.max} players` : ''}
                  </span>
                </span>
                <span className="ho-gamepick__go">{busy === g.id ? 'Opening...' : 'Invite'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="ho-inline-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
