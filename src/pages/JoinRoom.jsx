import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import CodeInput from '@/components/online/CodeInput.jsx';
import { Loading } from '@/components/online/StatusPanel.jsx';
import { isRoomCode, normalizeRoomCode, roomProblem } from '@/components/online/codes.js';
import '@/styles/online.css';

/**
 * /join and /join/:code. Needs a session (guest or Google): signed-out visitors go to /login and come back.
 * The code is checked against GET /api/rooms/:code before we navigate to the lobby.
 */
export default function JoinRoom() {
  const { code: paramCode } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fromLink = !!paramCode;
  const [code, setCode] = useState(normalizeRoomCode(paramCode || ''));
  const [check, setCheck] = useState({ state: 'idle', message: '', info: null }); // idle | checking | error | offline | joining
  const seq = useRef(0);
  const myId = user ? user.id : null;

  const verify = useCallback(
    async (c) => {
      const mine = ++seq.current;
      setCheck({ state: 'checking', message: '', info: null });
      try {
        const info = await api.get(`/api/rooms/${encodeURIComponent(c)}`);
        if (mine !== seq.current) return;
        const problem = roomProblem(info, myId);
        if (problem) {
          setCheck({ state: 'error', message: problem, info });
          return;
        }
        setCheck({ state: 'joining', message: '', info });
        navigate(`/lobby/${c}`, { replace: fromLink });
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
    if (loading || !user) return;
    if (!isRoomCode(code)) {
      seq.current += 1;
      setCheck({ state: 'idle', message: '', info: null });
      return;
    }
    verify(code);
  }, [code, loading, user, verify]);

  if (loading) {
    return (
      <div className="ho-page ho-join">
        <Loading text="One moment..." />
      </div>
    );
  }
  if (!user) {
    const target = isRoomCode(code) ? `/join/${code}` : '/join';
    return <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />;
  }

  const state = check.state;
  const uiState = state === 'checking' || state === 'joining' ? 'checking' : state === 'error' ? 'error' : 'idle';
  const hostName = check.info && check.info.hostName;

  return (
    <div className="ho-page ho-join">
      <header className="ho-head">
        <div>
          <h1 className="ho-h1">Join a room</h1>
          <p className="ho-muted" lang="te">
            గదిలో చేరండి
          </p>
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

        <div id="ho-join-status" className="ho-join__status" role="status" aria-live="polite">
          {state === 'idle' && code.length > 0 && <span className="ho-muted">{6 - code.length} more to go</span>}
          {state === 'checking' && (
            <span className="ho-muted">
              <span className="ho-spinner" aria-hidden="true" /> Checking the room...
            </span>
          )}
          {state === 'joining' && (
            <span className="ho-good">
              <span className="ho-spinner" aria-hidden="true" /> {hostName ? `Joining ${hostName}'s room...` : 'Joining...'}
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
            {state === 'error' && check.info && check.info.exists !== false && (
              // The lookup does not say who is in the room: players already seated can always get back in.
              <button type="button" className="ho-btn ho-btn--primary" onClick={() => navigate(`/lobby/${code}`)}>
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
        Want to host instead? <Link to="/">Create a room from Home</Link>.
      </p>
    </div>
  );
}
