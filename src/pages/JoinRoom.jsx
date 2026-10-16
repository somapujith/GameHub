import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createRoom, errorMessage, getRoom } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { paths } from '@/platform/paths.js';
import CodeInput from '@/components/online/CodeInput.jsx';
import GameIcon from '@/components/online/GameIcon.jsx';
import VisibilityBadge from '@/components/online/VisibilityBadge.jsx';
import { Loading } from '@/components/online/StatusPanel.jsx';
import { isRoomCode, normalizeRoomCode, playerCountOf, roomProblem } from '@/components/online/codes.js';
import { defaultGame, gameName, gameOf, inviteGames } from '@/components/online/games.js';
import { roomGameId, roomVisibility } from '@/components/online/gameRoute.js';
import '@/styles/online.css';

const JOIN_DELAY = 700; // ms: long enough to read who and what you are joining

/** Who and what a code is: game icon + name, host, players/max, public/private. */
function RoomPreview({ info }) {
  const gameId = roomGameId(info);
  const game = gameOf(gameId);
  const name = gameName(gameId, game);
  const count = playerCountOf(info);
  const max = Number.isFinite(info.maxPlayers) && info.maxPlayers > 0 ? info.maxPlayers : null;
  return (
    <div className="ho-roompreview" aria-label="Room found">
      <GameIcon game={game} name={name} size={52} />
      <div className="ho-roompreview__main">
        <span className="ho-roompreview__game">{name}</span>
        <span className="ho-roompreview__sub">
          {info.hostName ? `Hosted by ${info.hostName}` : 'Open room'} · {max ? `${count}/${max}` : count} {count === 1 && !max ? 'player' : 'players'}
        </span>
        {info.visibility && (
          <span className="ho-roompreview__badge">
            <VisibilityBadge visibility={roomVisibility(info)} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * /join and /join/:code. Needs a session (guest or Google): signed-out visitors go to /login and come back.
 * The code is checked against GET /api/rooms/:code (game name, host, players/max are shown), then we open the lobby.
 */
export default function JoinRoom() {
  const { code: paramCode } = useParams();
  const [params] = useSearchParams();
  const hosting = params.get('host') === '1';
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fromLink = !!paramCode;
  const [code, setCode] = useState(normalizeRoomCode(paramCode || ''));
  const [check, setCheck] = useState({ state: 'idle', message: '', info: null }); // idle | checking | error | offline | joining
  const seq = useRef(0);
  const joinTimer = useRef(null);
  const myId = user ? user.id : null;

  useEffect(() => () => clearTimeout(joinTimer.current), []);

  const verify = useCallback(
    async (c) => {
      const mine = ++seq.current;
      clearTimeout(joinTimer.current);
      setCheck({ state: 'checking', message: '', info: null });
      try {
        const info = await getRoom(c);
        if (mine !== seq.current) return;
        const problem = roomProblem(info, myId);
        if (problem) {
          setCheck({ state: 'error', message: problem, info });
          return;
        }
        setCheck({ state: 'joining', message: '', info });
        joinTimer.current = setTimeout(() => {
          if (mine === seq.current) navigate(paths.lobby(c), { replace: fromLink });
        }, JOIN_DELAY);
      } catch (e) {
        if (mine !== seq.current) return;
        if (e && e.status === 404) setCheck({ state: 'error', message: 'No room with that code. Check it and try again.', info: null });
        else if (e && e.status === 400) setCheck({ state: 'error', message: errorMessage(e, 'That code is not valid.'), info: null });
        else setCheck({ state: 'offline', message: errorMessage(e, 'Could not reach the server'), info: null });
      }
    },
    [myId, navigate, fromLink],
  );

  // validate as soon as six valid characters are in
  useEffect(() => {
    if (loading || !user || hosting) return;
    if (!isRoomCode(code)) {
      seq.current += 1;
      clearTimeout(joinTimer.current);
      setCheck({ state: 'idle', message: '', info: null });
      return;
    }
    verify(code);
  }, [code, loading, user, verify, hosting]);

  if (loading) {
    return (
      <div className="ho-page ho-join">
        <Loading text="One moment..." />
      </div>
    );
  }
  if (!user) {
    const target = hosting ? `${paths.join()}?host=1` : isRoomCode(code) ? paths.join(code) : paths.join();
    return <Navigate to={paths.login(target)} replace />;
  }

  if (hosting) return <HostRoom initialGame={params.get('game')} />;

  const state = check.state;
  const uiState = state === 'checking' || state === 'joining' ? 'checking' : state === 'error' ? 'error' : 'idle';
  const info = check.info;
  const hostName = info && info.hostName;
  const joiningGame = info ? gameName(roomGameId(info)) : '';

  return (
    <div className="ho-page ho-join">
      <header className="ho-head">
        <div>
          <h1 className="ho-h1">Join a room</h1>
          <p className="ho-muted">Got a code from a friend? Pop it in and you are at their table.</p>
        </div>
      </header>

      <section className="ho-card ho-join__card" aria-labelledby="ho-join-h">
        <h2 id="ho-join-h" className="ho-h2">
          Enter the 6-character code
        </h2>
        <p className="ho-muted">Ask the host for the code, or paste the invite link. Letters and numbers only, no O, I, 0 or 1.</p>

        <CodeInput
          value={code}
          onChange={(v) => setCode(v)}
          state={uiState}
          autoFocus={!fromLink}
          disabled={state === 'joining'}
          describedBy="ho-join-status"
        />

        {info && info.exists !== false && (state === 'joining' || state === 'error') && <RoomPreview info={info} />}

        <div id="ho-join-status" className="ho-join__status" role="status" aria-live="polite">
          {state === 'idle' && code.length > 0 && <span className="ho-muted">{6 - code.length} more to go</span>}
          {state === 'checking' && (
            <span className="ho-muted">
              <span className="ho-spinner" aria-hidden="true" /> Checking the room...
            </span>
          )}
          {state === 'joining' && (
            <span className="ho-good">
              <span className="ho-spinner" aria-hidden="true" /> {hostName ? `Joining ${hostName}'s ${joiningGame} room...` : `Joining the ${joiningGame} room...`}
            </span>
          )}
          {state === 'error' && <span className="ho-bad">{check.message}</span>}
          {state === 'offline' && (
            <span className="ho-bad">
              {check.message}{' '}
              <button type="button" className="ho-linkbtn" onClick={() => isRoomCode(code) && verify(code)}>
                Try again
              </button>
            </span>
          )}
        </div>

        {(state === 'error' || state === 'offline') && (
          <div className="ho-status__actions">
            {state === 'error' && info && info.exists !== false && (
              // The lookup does not say who is in the room: players already seated can always get back in.
              <button type="button" className="ho-btn ho-btn--primary" onClick={() => navigate(paths.lobby(code))}>
                I was in this game: rejoin
              </button>
            )}
            <button type="button" className="ho-btn ho-btn--ghost" onClick={() => setCode('')}>
              Clear code
            </button>
          </div>
        )}
      </section>

      <p className="ho-muted ho-join__alt">
        Want your own table? <Link to={`${paths.join()}?host=1`}>Create a private room</Link>.
      </p>
    </div>
  );
}

/** `/join?host=1[&game=<id>]`: choose a game and open a private room for it (the game pages also do this themselves). */
function HostRoom({ initialGame }) {
  const navigate = useNavigate();
  const games = inviteGames();
  const fallback = (initialGame && gameOf(initialGame)) || defaultGame();
  const [gameId, setGameId] = useState(fallback ? fallback.id : games[0] ? games[0].id : '');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  const create = async () => {
    if (pending.current || !gameId) return;
    pending.current = true;
    setCreating(true);
    setError('');
    try {
      const room = await createRoom({ gameId, visibility: 'private' });
      if (!room?.code) throw new Error('Your table could not be created. Try again.');
      navigate(paths.lobby(room.code), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not reach the server. Please try again.'));
      pending.current = false;
      setCreating(false);
    }
  };

  return (
    <div className="ho-page ho-join">
      <header className="ho-head">
        <div>
          <span className="ho-eyebrow">Your friends. Your game.</span>
          <h1 className="ho-h1">Host a table</h1>
          <p className="ho-muted">A private room for you and your friends.</p>
        </div>
      </header>
      <section className="ho-card ho-host" aria-labelledby="host-heading">
        <h2 id="host-heading" className="ho-h2">
          Pick a game
        </h2>
        {games.length === 0 ? (
          <p className="ho-empty">No games are open for friends yet. Check back soon.</p>
        ) : (
          <div role="radiogroup" aria-label="Game" className="ho-gamelist">
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={g.id === gameId}
                className={`ho-gamepick${g.id === gameId ? ' is-on' : ''}`}
                onClick={() => setGameId(g.id)}
              >
                <GameIcon game={g} size={48} />
                <span className="ho-gamepick__main">
                  <span className="ho-gamepick__name">{g.name}</span>
                  <span className="ho-gamepick__sub">
                    {g.players ? `${g.players.min}-${g.players.max} players` : g.tagline}
                    {g.duration ? ` · ${g.duration}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <ol className="ho-host__steps">
          <li>Create a private room</li>
          <li>Share your six-character code</li>
          <li>Start when everyone is ready</li>
        </ol>
        <button type="button" className="ho-btn ho-btn--primary" disabled={creating || !gameId} aria-busy={creating} onClick={create}>
          {creating ? 'Setting up your table…' : error ? 'Try creating again' : 'Create private room'}
        </button>
        {error && (
          <p className="ho-bad" role="alert">
            {error}
          </p>
        )}
        <Link className="ho-linkbtn" to={paths.join()}>
          Have a code? Join a room
        </Link>
      </section>
    </div>
  );
}
