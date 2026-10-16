import { useCallback, useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import GameView from '@/components/game/GameView.jsx';
import { useAuth } from '@/lib/auth.jsx';
import { useOnlineGame } from '@/lib/session/useOnlineGame.js';
import { isRoomCode, normalizeRoomCode } from '@/components/online/codes.js';
import StatusPanel from '@/components/online/StatusPanel.jsx';
import { useToasts } from '@/components/online/Toasts.jsx';
import '@/styles/online.css';

function Screen({ children }) {
  return <div className="ho-screen">{children}</div>;
}

/** /game/online/:code — connects to the room and renders the shared GameView. */
export default function OnlineGame() {
  const { code: rawCode } = useParams();
  const code = normalizeRoomCode(rawCode || '');
  const { user, loading } = useAuth();

  if (!isRoomCode(code)) {
    return (
      <Screen>
        <StatusPanel icon="?" tone="bad" title="That is not a room code" body="Room codes are 6 letters or numbers, like ABC234." actions={[{ label: 'Home', to: '/', primary: true }, { label: 'Enter a code', to: '/join' }]} />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen>
        <StatusPanel busy title="Loading..." />
      </Screen>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`/game/online/${code}`)}`} replace />;
  return <OnlineGameInner code={code} />;
}

function OnlineGameInner({ code }) {
  const navigate = useNavigate();
  const { push, node } = useToasts();
  const { room, session, status, error, errorId, fatal } = useOnlineGame(code);

  // rejected actions ("not your turn", ...) show as a toast
  useEffect(() => {
    if (errorId && error) push(error, 'bad');
  }, [errorId, error, push]);

  // the match ended: leaving the room is implicit; mid-game, leaving must tell the server
  const exit = useCallback(() => {
    if (!session.view || session.view.phase !== 'over') session.quit();
    navigate('/', { replace: true });
  }, [session, navigate]);

  if (fatal) {
    if (fatal.kind === 'left') return <Navigate to="/" replace />;
    if (fatal.kind === 'auth') return <Navigate to={`/login?next=${encodeURIComponent(`/game/online/${code}`)}`} replace />;
    const kicked = fatal.kind === 'kicked';
    return (
      <Screen>
        <StatusPanel
          icon={kicked ? '🚪' : '!'}
          tone="bad"
          title={kicked ? 'You were removed from the match' : fatal.kind === 'join' ? "Can't join this match" : 'Lost the connection'}
          body={fatal.message}
          actions={[
            ...(fatal.kind === 'closed' ? [{ label: 'Reconnect', onClick: () => window.location.reload(), primary: true }] : []),
            { label: 'Home', to: '/', primary: !fatal.kind || fatal.kind !== 'closed' },
            { label: 'Join another room', to: '/join' },
          ]}
        />
      </Screen>
    );
  }

  // the room is (back) in the lobby: the game is not running yet
  if (status === 'lobby') return <Navigate to={`/lobby/${code}`} replace />;

  if (!session.view) {
    if (status === 'finished') {
      return (
        <Screen>
          <StatusPanel icon="🏁" title="This game has finished" body="The match in this room is over." actions={[{ label: 'Home', to: '/', primary: true }]} />
        </Screen>
      );
    }
    return (
      <Screen>
        <StatusPanel
          busy
          title={status === 'reconnecting' ? 'Reconnecting...' : room ? 'Waiting for the match...' : 'Joining the match...'}
          body={status === 'reconnecting' ? 'Your seat is kept. Hang on a moment.' : 'Getting the board ready.'}
          actions={[{ label: 'Leave', onClick: exit }]}
        />
      </Screen>
    );
  }

  return (
    <>
      <GameView session={session} onExit={exit} />
      {session.connection !== 'open' && (
        <div className="ho-conn" role="status" aria-live="polite">
          <span className="ho-spinner" aria-hidden="true" />
          <span className="ho-conn__text">Reconnecting... if you stay offline you will be auto-played.</span>
          <button type="button" className="ho-btn ho-btn--ghost ho-btn--sm" onClick={exit}>
            Leave
          </button>
        </div>
      )}
      {node}
    </>
  );
}
