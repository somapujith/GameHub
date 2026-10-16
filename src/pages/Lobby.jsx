import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { useRoomConnection } from '@/lib/session/useOnlineGame.js';
import { settingsMessage } from '@/components/online/settings.js';
import { sameId } from '@/components/online/gameHelpers.js';
import { isRoomCode, normalizeRoomCode } from '@/components/online/codes.js';
import ConfirmDialog from '@/components/online/ConfirmDialog.jsx';
import InviteFriends from '@/components/online/InviteFriends.jsx';
import PlayerRow from '@/components/online/PlayerRow.jsx';
import SettingsPanel from '@/components/online/SettingsPanel.jsx';
import ShareCard from '@/components/online/ShareCard.jsx';
import StatusPanel, { Loading } from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
import '@/styles/online.css';

const SEAT_COLORS = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b794f6', '#ff9f43'];

function ConnectionBanner({ connection }) {
  if (connection === 'open') return null;
  return (
    <div className="ho-banner ho-banner--warn" role="status" aria-live="polite">
      <span className="ho-spinner" aria-hidden="true" />
      <span>{connection === 'closed' ? 'Disconnected from the room.' : 'Reconnecting to the room... your seat is kept.'}</span>
    </div>
  );
}

export default function Lobby() {
  const { code: rawCode } = useParams();
  const code = normalizeRoomCode(rawCode || '');
  const valid = isRoomCode(code);
  const { user, loading } = useAuth();

  if (!valid) {
    return (
      <div className="ho-page">
        <StatusPanel
          icon="?"
          tone="bad"
          title="That is not a room code"
          body="Room codes are 6 letters or numbers, like ABC234."
          actions={[
            { label: 'Enter a code', to: '/join', primary: true },
            { label: 'Home', to: '/' },
          ]}
        />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="ho-page">
        <Loading text="Opening the lobby..." />
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/lobby/${code}`)}`} replace />;
  return <LobbyInner code={code} user={user} />;
}

function LobbyInner({ code, user }) {
  const navigate = useNavigate();
  const { push, node } = useToasts();
  const { room, connection, fatal, error, errorId, send, leave } = useRoomConnection(code);
  const [confirm, setConfirm] = useState(null); // {kind:'leave'} | {kind:'kick', player}
  const [starting, setStarting] = useState(false);
  const startTimer = useRef(null);

  // server told us something went wrong (rejected setting, can't start, ...)
  useEffect(() => {
    if (errorId && error) {
      push(error, 'bad');
      setStarting(false);
    }
  }, [errorId, error, push]);
  useEffect(() => () => clearTimeout(startTimer.current), []);

  // game started: head for the board
  useEffect(() => {
    if (room && room.status === 'playing' && !fatal) navigate(`/game/online/${code}`, { replace: true });
  }, [room, fatal, code, navigate]);

  if (fatal) return <Fatal fatal={fatal} code={code} />;

  if (!room) {
    return (
      <div className="ho-page ho-lobby">
        <Loading text="Joining the room..." />
        <button type="button" className="ho-btn ho-btn--ghost ho-lobby__cancel" onClick={() => navigate('/')}>
          Cancel
        </button>
        {node}
      </div>
    );
  }

  if (room.status === 'finished') return <Rematch room={room} />;

  const players = Array.isArray(room.players) ? room.players : [];
  const me = players.find((p) => sameId(p.id, user.id));
  const isHost = sameId(room.hostId, user.id);
  const maxPlayers = room.maxPlayers || 6;
  const open = connection === 'open';
  const humans = players.filter((p) => !p.isBot);
  const waitingOn = humans.filter((p) => !sameId(p.id, room.hostId) && !p.ready);
  const canStart = isHost && players.length >= 2 && open && !starting;
  const full = players.length >= maxPlayers;

  const start = () => {
    if (!canStart) return;
    setStarting(true);
    send({ t: 'start' }, { queue: false });
    clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => setStarting(false), 4000);
  };

  const doLeave = () => {
    leave();
    navigate('/', { replace: true });
  };

  const askLeave = () => {
    if (isHost && humans.length > 1) setConfirm({ kind: 'leave' });
    else doLeave();
  };

  const emptySeats = Math.max(0, maxPlayers - players.length);

  return (
    <div className="ho-page ho-lobby">
      <header className="ho-head">
        <div>
          <h1 className="ho-h1">Lobby</h1>
          <p className="ho-muted">
            {room.hostName || (players.find((p) => sameId(p.id, room.hostId)) || {}).name || 'Host'}&rsquo;s room · {players.length}/{maxPlayers} players
          </p>
        </div>
        <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={askLeave}>
          Leave
        </button>
      </header>

      <ConnectionBanner connection={connection} />

      <div className="ho-grid">
        <div className="ho-col">
          <ShareCard code={code} onNotify={push} />

          <section className="ho-card ho-players" aria-label="Players">
            <div className="ho-card__head">
              <h2 className="ho-h2">Players</h2>
              <span className="ho-count">
                {players.length}/{maxPlayers}
              </span>
            </div>
            <ul className="ho-list ho-list--players">
              {players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  color={SEAT_COLORS[i % SEAT_COLORS.length]}
                  isMe={sameId(p.id, user.id)}
                  isHost={sameId(p.id, room.hostId)}
                  canRemove={isHost && !sameId(p.id, user.id) && open}
                  onRemove={() => (p.isBot ? send({ t: 'removeBot', id: p.id }) : setConfirm({ kind: 'kick', player: p }))}
                />
              ))}
              {Array.from({ length: emptySeats }, (_, i) => (
                <li key={`empty-${i}`} className="ho-player ho-player--empty" aria-label="Open seat">
                  <span className="ho-player__avatar ho-player__avatar--empty" aria-hidden="true">
                    +
                  </span>
                  <span className="ho-player__main">
                    <span className="ho-player__name ho-muted">Waiting for a player...</span>
                  </span>
                </li>
              ))}
            </ul>
            {isHost && (
              <button type="button" className="ho-btn ho-btn--ghost ho-btn--block" onClick={() => send({ t: 'addBot' })} disabled={full || !open}>
                {full ? 'Room is full' : 'Add a bot'}
              </button>
            )}
          </section>

          <section className="ho-card ho-startcard" aria-label="Ready and start">
            {isHost ? (
              <>
                <button type="button" className="ho-btn ho-btn--primary ho-btn--lg ho-btn--block" onClick={start} disabled={!canStart}>
                  {starting ? 'Starting...' : players.length < 2 ? 'Need at least 2 players' : 'Start game'}
                </button>
                <p className="ho-help" aria-live="polite">
                  {players.length < 2
                    ? 'Invite a friend with the code, or add a bot to play right now.'
                    : waitingOn.length > 0
                      ? `${waitingOn.map((p) => p.name).join(', ')} ${waitingOn.length === 1 ? 'is' : 'are'} not ready yet. You can still start.`
                      : 'Everyone is ready.'}
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`ho-btn ho-btn--lg ho-btn--block ${me && me.ready ? 'ho-btn--ghost' : 'ho-btn--primary'}`}
                  onClick={() => send({ t: 'ready', ready: !(me && me.ready) })}
                  disabled={!open || !me}
                  aria-pressed={!!(me && me.ready)}
                >
                  {me && me.ready ? 'Ready! Tap to undo' : "I'm ready"}
                </button>
                <p className="ho-help" aria-live="polite">
                  Waiting for the host to start the game.
                </p>
              </>
            )}
          </section>
        </div>

        <div className="ho-col">
          <SettingsPanel
            settings={room.settings}
            maxPlayers={maxPlayers}
            playerCount={players.length}
            isHost={isHost}
            disabled={!open}
            errorId={errorId}
            onSend={(msg) => send(msg, { queue: false })}
            onMaxPlayers={(n) => send({ t: 'settings', settings: { maxPlayers: n } }, { queue: false })}
          />

          {user.isGuest ? (
            <section className="ho-card ho-invite" aria-label="Invite friends">
              <h2 className="ho-h2">Invite friends</h2>
              <p className="ho-empty">
                Share the code, link or QR above. <Link to={`/login?next=${encodeURIComponent(`/lobby/${code}`)}`}>Sign in with Google</Link> to invite friends in one tap.
              </p>
            </section>
          ) : (
            <InviteFriends code={code} onNotify={push} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm?.kind === 'leave'}
        title="Leave this room?"
        body="Other players stay in the lobby and the host role passes on."
        confirmLabel="Leave room"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          doLeave();
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'kick'}
        title={confirm?.player ? `Remove ${confirm.player.name}?` : ''}
        body="They will be taken out of the lobby. They can rejoin with the code."
        confirmLabel="Remove"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const p = confirm?.player;
          setConfirm(null);
          if (p) send({ t: 'kick', id: p.id });
        }}
      />
      {node}
    </div>
  );
}

/** The match in this room is over: offer a fresh room with the same settings. */
function Rematch({ room }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { settings } = settingsMessage(room.settings);
      const res = await api.post('/api/rooms', { settings, maxPlayers: room.maxPlayers });
      navigate(`/lobby/${res.code}`, { replace: true });
    } catch (e) {
      setError(errorMessage(e, 'Could not create a new room'));
      setBusy(false);
    }
  };

  return (
    <div className="ho-page">
      <StatusPanel
        icon="🏁"
        title="This game has finished"
        body="The match in this room is over. Start a new room with the same settings and send your friends the new code."
        actions={[
          { label: busy ? 'Creating...' : 'New room, same settings', onClick: create, primary: true },
          { label: 'Home', to: '/' },
        ]}
      >
        {error && (
          <p className="ho-inline-error" role="alert">
            {error}
          </p>
        )}
      </StatusPanel>
    </div>
  );
}

function Fatal({ fatal, code }) {
  const next = `/lobby/${code}`;
  if (fatal.kind === 'kicked') {
    return (
      <div className="ho-page">
        <StatusPanel
          icon="🚪"
          tone="bad"
          title="You were removed from the room"
          body="The host took you out of this lobby. You can join another room, or ask for the code again."
          actions={[
            { label: 'Home', to: '/', primary: true },
            { label: 'Join another room', to: '/join' },
          ]}
        />
      </div>
    );
  }
  if (fatal.kind === 'auth') {
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (fatal.kind === 'left') {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="ho-page">
      <StatusPanel
        icon="!"
        tone="bad"
        title={fatal.kind === 'join' ? "Can't join this room" : 'Lost the connection'}
        body={fatal.message}
        actions={[
          ...(fatal.kind === 'closed' ? [{ label: 'Try again', onClick: () => window.location.reload(), primary: true }] : [{ label: 'Enter another code', to: '/join', primary: true }]),
          { label: 'Home', to: '/' },
        ]}
      />
    </div>
  );
}
