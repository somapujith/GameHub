import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createRoom, errorMessage } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { paths } from '@/platform/paths.js';
import { useRoomConnection } from '@/components/online/useRoomConnection.js';
import { joinedLabel, joinedPercent, startState } from '@/components/online/lobbyModel.js';
import { resolveSettings } from '@/components/online/settings.js';
import { sameId } from '@/components/online/gameHelpers.js';
import { isRoomCode, normalizeRoomCode } from '@/components/online/codes.js';
import { gameName, gameOf, warmOnlineGame } from '@/components/online/games.js';
import { rememberRoomGame, roomGameId } from '@/components/online/gameRoute.js';
import ConfirmDialog from '@/components/online/ConfirmDialog.jsx';
import GameIcon from '@/components/online/GameIcon.jsx';
import InviteFriends from '@/components/online/InviteFriends.jsx';
import Seat, { EmptySeat } from '@/components/online/Seat.jsx';
import SettingsPanel from '@/components/online/SettingsPanel.jsx';
import ShareCard from '@/components/online/ShareCard.jsx';
import StatusPanel, { Loading } from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
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
  const isHost = sameId(room.hostId, user.id);
  const bounds = (game && game.players) || {};
  const maxPlayers = room.maxPlayers || bounds.max || 6;
  const minToStart = Number.isFinite(bounds.min) ? bounds.min : 2;
  const open = connection === 'open';
  const joined = players.length;
  const { enough, full, emptySeats, label: startLabel, help: startHelp } = startState({ players: joined, joined, maxPlayers, minToStart, starting });
  const canStart = isHost && enough && open && !starting;

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
    if (isHost && players.length > 1) setConfirm({ kind: 'leave' });
    else doLeave();
  };

  return (
    <div className="ho-page ho-lobby ho-lobby--quick" style={themeVars(game)}>
      <header className="ho-qhead">
        <GameIcon game={game} name={gName} size={48} className="ho-qhead__icon" />
        <div className="ho-qhead__main">
          <h1 className="ho-h1">{gName}</h1>
          <p className="ho-muted">
            Room <b className="ho-qhead__code">{code}</b>
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

      <ShareCard code={code} gameName={gName} onNotify={push} />
      {user.isGuest && (
        <p className="ho-help ho-qguest">
          Share the code, link or QR above. <Link to={paths.login(paths.lobby(code))}>Sign in with Google</Link> to invite friends in one tap.
        </p>
      )}

      <section className="ho-card ho-seats" aria-label="Players">
        <div className="ho-card__head">
          <h2 className="ho-h2">Players</h2>
          <span className={`ho-count${full ? ' is-full' : ''}`} aria-live="polite">
            {joinedLabel(joined, maxPlayers)}
          </span>
        </div>
        <div className="ho-progress" role="progressbar" aria-label="Seats taken" aria-valuemin={0} aria-valuemax={maxPlayers} aria-valuenow={Math.min(joined, maxPlayers)}>
          <span style={{ width: `${joinedPercent(joined, maxPlayers)}%` }} />
        </div>
        <ul className="ho-seatgrid">
          {players.map((p, i) => (
            <Seat
              key={p.id}
              player={p}
              color={SEAT_COLORS[i % SEAT_COLORS.length]}
              isMe={sameId(p.id, user.id)}
              isHost={sameId(p.id, room.hostId)}
              canRemove={isHost && !sameId(p.id, user.id) && open}
              onRemove={() => setConfirm({ kind: 'kick', player: p })}
            />
          ))}
          {Array.from({ length: emptySeats }, (_, i) => (
            <EmptySeat key={`empty-${i}`} />
          ))}
        </ul>
      </section>

      <SettingsPanel game={game} settings={room.settings} isHost={isHost} disabled={!open} errorId={errorId} onSend={(msg) => send(msg, { queue: false })} />
      <p className="ho-help ho-rules">Table rules: single die &middot; 1 Snatch each &middot; sealed bidding on a tie</p>

      <section className="ho-card ho-startcard" aria-label="Start">
        {isHost ? (
          <>
            <button type="button" className={`ho-btn ho-btn--primary ho-btn--lg ho-btn--block${full && canStart ? ' ho-btn--full' : ''}`} onClick={start} disabled={!canStart}>
              {startLabel}
            </button>
            <p className="ho-help" aria-live="polite">
              {startHelp}
            </p>
          </>
        ) : (
          <p className="ho-waiting" role="status" aria-live="polite">
            <span className="ho-spinner" aria-hidden="true" /> Waiting for the host to start...
          </p>
        )}
      </section>

      {!user.isGuest && <InviteFriends code={code} gameName={gName} onNotify={push} />}

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
        body="They will be taken out of the lobby and cannot rejoin for a while."
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
