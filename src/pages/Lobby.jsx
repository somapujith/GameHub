import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createRoom, errorMessage } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { paths } from '@/platform/paths.js';
import { useRoomConnection } from '@/components/online/useRoomConnection.js';
import { resolveSettings, seatsMessage, visibilityMessage } from '@/components/online/settings.js';
import { sameId } from '@/components/online/gameHelpers.js';
import { isRoomCode, normalizeRoomCode } from '@/components/online/codes.js';
import { gameName, gameOf, warmOnlineGame } from '@/components/online/games.js';
import { rememberRoomGame, roomGameId, roomVisibility } from '@/components/online/gameRoute.js';
import ConfirmDialog from '@/components/online/ConfirmDialog.jsx';
import GameIcon from '@/components/online/GameIcon.jsx';
import InviteFriends from '@/components/online/InviteFriends.jsx';
import PlayerRow from '@/components/online/PlayerRow.jsx';
import SettingsPanel from '@/components/online/SettingsPanel.jsx';
import ShareCard from '@/components/online/ShareCard.jsx';
import StatusPanel, { Loading } from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
import VisibilityBadge from '@/components/online/VisibilityBadge.jsx';
import VisibilityPicker from '@/components/online/VisibilityPicker.jsx';
import '@/styles/online.css';

const SEAT_COLORS = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b794f6', '#ff9f43'];

/** CSS variables that tint the lobby with the game's own colours. */
function themeVars(game) {
  const t = (game && game.theme) || {};
  const v = {};
  if (t.accent) v['--ho-accent'] = t.accent;
  if (t.accent2 || t.accent) v['--ho-accent-2'] = t.accent2 || t.accent;
  if (t.bg) v['--ho-game-bg'] = t.bg;
  return v;
}

function ConnectionBanner({ connection }) {
  if (connection === 'open') return null;
  return (
    <div className="ho-banner ho-banner--warn" role="status" aria-live="polite">
      <span className="ho-spinner" aria-hidden="true" />
      <span>{connection === 'closed' ? 'Disconnected from the room.' : 'Reconnecting to the room... your seat is kept.'}</span>
    </div>
  );
}

/** /lobby/:code */
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
            { label: 'Enter a code', to: paths.join(), primary: true },
            { label: 'Home', to: paths.hub() },
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
  if (!user) return <Navigate to={paths.login(paths.lobby(code))} replace />;
  return <LobbyInner code={code} user={user} />;
}

function LobbyInner({ code, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { push, node } = useToasts();
  const { room, connection, fatal, error, errorId, send, leave } = useRoomConnection(code);
  const [confirm, setConfirm] = useState(null); // {kind:'leave'} | {kind:'kick', player}
  const [starting, setStarting] = useState(false);
  const startTimer = useRef(null);

  const gameId = room ? roomGameId(room) : null;
  const game = useMemo(() => (gameId ? gameOf(gameId) : null), [gameId]);
  const gName = gameName(gameId, game);

  // a message handed over by whoever sent us here ("Invite sent to Ravi")
  useEffect(() => {
    const t = location.state && location.state.toast;
    if (t && t.text) {
      push(t.text, t.tone || 'info');
      navigate(location.pathname, { replace: true, state: null });
    }
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // server told us something went wrong (rejected setting, can't start, ...)
  useEffect(() => {
    if (errorId && error) {
      push(error, 'bad');
      setStarting(false);
    }
  }, [errorId, error, push]);
  useEffect(() => () => clearTimeout(startTimer.current), []);

  // get the game's page ready while people gather, so Start feels instant
  useEffect(() => {
    warmOnlineGame(game);
  }, [game]);

  // game started: head for the board
  useEffect(() => {
    if (room && room.status === 'playing' && !fatal) {
      rememberRoomGame(code, gameId);
      navigate(paths.online(gameId, code), { replace: true });
    }
  }, [room, fatal, code, gameId, navigate]);

  if (fatal) return <Fatal fatal={fatal} code={code} />;

  if (!room) {
    return (
      <div className="ho-page ho-lobby">
        <Loading text="Joining the room..." />
        <button type="button" className="ho-btn ho-btn--ghost ho-lobby__cancel" onClick={() => navigate(paths.hub())}>
          Cancel
        </button>
        {node}
      </div>
    );
  }

  if (room.status === 'finished') return <Rematch room={room} game={game} gameId={gameId} gameLabel={gName} />;

  const players = Array.isArray(room.players) ? room.players : [];
  const me = players.find((p) => sameId(p.id, user.id));
  const isHost = sameId(room.hostId, user.id);
  const visibility = roomVisibility(room);
  const bounds = (game && game.players) || {};
  const maxPlayers = room.maxPlayers || bounds.max || 6;
  const minToStart = Number.isFinite(bounds.min) ? bounds.min : 2;
  const open = connection === 'open';
  const humans = players.filter((p) => !p.isBot);
  const waitingOn = humans.filter((p) => !sameId(p.id, room.hostId) && !p.ready);
  const canStart = isHost && players.length >= minToStart && open && !starting;
  const full = players.length >= maxPlayers;
  const hostName = room.hostName || (players.find((p) => sameId(p.id, room.hostId)) || {}).name || 'Host';

  const start = () => {
    if (!canStart) return;
    setStarting(true);
    send({ t: 'start' }, { queue: false });
    clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => setStarting(false), 4000);
  };

  const doLeave = () => {
    leave();
    navigate(paths.hub(), { replace: true });
  };

  const askLeave = () => {
    if (isHost && humans.length > 1) setConfirm({ kind: 'leave' });
    else doLeave();
  };

  const emptySeats = Math.max(0, maxPlayers - players.length);
  const sendNow = (msg) => send(msg, { queue: false });

  return (
    <div className="ho-page ho-lobby" style={themeVars(game)}>
      <header className="ho-lobbyhead">
        <GameIcon game={game} name={gName} size={64} className="ho-lobbyhead__icon" />
        <div className="ho-lobbyhead__main">
          <span className="ho-eyebrow">Lobby</span>
          <h1 className="ho-h1">{gName}</h1>
          <p className="ho-muted ho-lobbyhead__sub">
            <span>
              {hostName}&rsquo;s room · {players.length}/{maxPlayers} players
            </span>
            <VisibilityBadge visibility={visibility} />
          </p>
        </div>
        <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={askLeave}>
          Leave
        </button>
      </header>

      <ConnectionBanner connection={connection} />

      {!game && (
        <div className="ho-banner ho-banner--warn" role="status">
          <span>This game is not available in this version of the app. Reload to update, or leave the room.</span>
          <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}

      <div className="ho-grid">
        <div className="ho-col">
          <ShareCard code={code} gameName={gName} onNotify={push} />

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
                  {starting ? 'Starting...' : players.length < minToStart ? `Need at least ${minToStart} players` : 'Start game'}
                </button>
                <p className="ho-help" aria-live="polite">
                  {players.length < minToStart
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
          {isHost && <VisibilityPicker visibility={visibility} disabled={!open} errorId={errorId} onPick={(v) => sendNow(visibilityMessage(v))} />}

          <SettingsPanel
            game={game}
            settings={room.settings}
            maxPlayers={maxPlayers}
            playerCount={players.length}
            isHost={isHost}
            disabled={!open}
            errorId={errorId}
            onSend={sendNow}
            onMaxPlayers={(n) => sendNow(seatsMessage(n))}
          />

          {user.isGuest ? (
            <section className="ho-card ho-invite" aria-label="Invite friends">
              <h2 className="ho-h2">Invite friends</h2>
              <p className="ho-empty">
                Share the code, link or QR above. <Link to={paths.login(paths.lobby(code))}>Sign in with Google</Link> to invite friends in one tap.
              </p>
            </section>
          ) : (
            <InviteFriends code={code} gameName={gName} onNotify={push} />
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

/** The match in this room is over: offer a fresh private room for the same game with the same settings. */
function Rematch({ room, game, gameId, gameLabel }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // only the keys the game's schema knows: the server validates strictly
      const settings = game && game.settings ? resolveSettings(game.settings, room.settings) : undefined;
      const res = await createRoom({ gameId, settings, maxPlayers: room.maxPlayers, visibility: 'private' });
      navigate(paths.lobby(res.code), { replace: true });
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
        body={`The ${gameLabel} match in this room is over. Start a new private room with the same settings and send your friends the new code.`}
        actions={[
          { label: busy ? 'Creating...' : 'New room, same settings', onClick: create, primary: true },
          { label: 'Home', to: paths.hub() },
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
  if (fatal.kind === 'kicked') {
    return (
      <div className="ho-page">
        <StatusPanel
          icon="🚪"
          tone="bad"
          title="You were removed from the room"
          body="The host took you out of this lobby. You can join another room, or ask for the code again."
          actions={[
            { label: 'Home', to: paths.hub(), primary: true },
            { label: 'Join another room', to: paths.join() },
          ]}
        />
      </div>
    );
  }
  if (fatal.kind === 'auth') {
    return <Navigate to={paths.login(paths.lobby(code))} replace />;
  }
  if (fatal.kind === 'left') {
    return <Navigate to={paths.hub()} replace />;
  }
  return (
    <div className="ho-page">
      <StatusPanel
        icon="!"
        tone="bad"
        title={fatal.kind === 'join' ? "Can't join this room" : 'Lost the connection'}
        body={fatal.message}
        actions={[
          ...(fatal.kind === 'closed' ? [{ label: 'Try again', onClick: () => window.location.reload(), primary: true }] : [{ label: 'Enter another code', to: paths.join(), primary: true }]),
          { label: 'Home', to: paths.hub() },
        ]}
      />
    </div>
  );
}
