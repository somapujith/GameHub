import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOptions as tycoonGetOptions, standings as tycoonStandings } from '@shared/index.js';
import * as presenterModule from '@/lib/session/usePresenter.js';
import { useAuth } from '@/lib/auth.jsx';
import { pickLine } from '@/lib/voiceLines.js';
import { voice } from '@/lib/voice.js';
import { blankOptions, buildResult } from '@/components/online/gameHelpers.js';
import { useRoomConnection } from '@/components/online/useRoomConnection.js';
import { paths } from '@/platform/paths.js';

// The presenter may be a named or the default export; accept both.
const usePresenter = presenterModule.usePresenter || presenterModule.default;

const ACTION_TIMEOUT = 5000; // re-enable the UI if the server never answers an action

// Socket + room state for ONE room code (no game in it) lives in components/online/useRoomConnection.js and is
// re-exported here, because game plugins (Hyderabad Tycoon) import it from this module:
//   const { room, view, chat, connection, error, errorId, fatal, send, leave } = useRoomConnection(code, { onState, onChat });
export { useRoomConnection };

function playEmote(key) {
  if (typeof key !== 'string' || !key.startsWith('emote_')) return;
  try {
    const line = pickLine(key);
    if (line) voice.speak(line, { priority: 1 });
  } catch {
    /* sound is never worth a crash */
  }
}

/**
 * Online game session for GameView: `{ room, session, status, error, errorId, sendRoom, fatal }`.
 *
 *  - session   follows the contract `session` interface (mode 'online', me = auth user id as a string)
 *  - status    'connecting' | 'reconnecting' | 'lobby' | 'playing' | 'finished' | 'closed'
 *  - sendRoom  raw room message ({t:'ready'}, {t:'chat'}, …)
 *  - fatal     null | { kind, message }: kicked / room gone / signed out / left (socket already closed)
 *
 * Server events are replayed by the shared presenter; the first state after every (re)connect is a snapshot
 * (events: []) and goes through `reset()` so nothing is animated twice.
 *
 * `useOnlineGame(code, { getOptions, standings })`: the two engine calls that are specific to a game.
 *  - getOptions(view, meId) -> the allowed actions for `session.options`. Defaults to the Tycoon engine for now.
 *    Pass `null` for a game without an options concept (`session.options` is then all-blank).
 *  - standings(view) -> ranked rows for `session.result`. Defaults to the Tycoon engine. Pass `null` for no result.
 * Everything else (socket, room, chat, error handling) is game-agnostic, so another game's plugin can call this
 * hook with its own functions, or use `useRoomConnection` directly.
 */
export function useOnlineGame(code, { getOptions = tycoonGetOptions, standings = tycoonStandings } = {}) {
  const { user } = useAuth();
  const me = user ? String(user.id) : '';
  const navigate = useNavigate();
  const presenter = usePresenter({ meId: me, initialState: null }); // the first server snapshot arrives via reset()
  const presenterRef = useRef(presenter);
  const [awaiting, setAwaiting] = useState(false);
  const awaitTimer = useRef(null);
  const busyRef = useRef(false);
  const awaitingRef = useRef(false);

  useEffect(() => {
    presenterRef.current = presenter;
    busyRef.current = !!presenter.busy;
  });
  useEffect(() => {
    awaitingRef.current = awaiting;
  }, [awaiting]);

  const clearAwaiting = useCallback(() => {
    clearTimeout(awaitTimer.current);
    setAwaiting(false);
  }, []);
  useEffect(() => () => clearTimeout(awaitTimer.current), []);

  const onState = useCallback(
    ({ state, events, fresh }) => {
      clearAwaiting();
      const p = presenterRef.current;
      if (fresh) p.reset(state);
      else p.enqueue(events, state);
    },
    [clearAwaiting],
  );

  const conn = useRoomConnection(code, { onState, onChat: (entry) => playEmote(entry.emote) });
  const { room, view, chat, connection, send, leave, fatal, error, errorId } = conn;

  // a rejected action or a dropped connection releases the "waiting for the server" lock
  useEffect(() => {
    if (errorId) clearAwaiting();
  }, [errorId, clearAwaiting]);
  useEffect(() => {
    if (connection !== 'open') clearAwaiting();
  }, [connection, clearAwaiting]);

  const dispatch = useCallback(
    (action) => {
      if (!action || typeof action !== 'object' || !me) return;
      if (busyRef.current || awaitingRef.current) return;
      const ok = send({ t: 'action', action: { ...action, playerId: me } }, { queue: false });
      if (!ok) return;
      awaitingRef.current = true;
      setAwaiting(true);
      clearTimeout(awaitTimer.current);
      awaitTimer.current = setTimeout(() => setAwaiting(false), ACTION_TIMEOUT);
    },
    [me, send],
  );

  const sendChat = useCallback(
    (text = '', emote) => {
      const msg = { t: 'chat' };
      const t = typeof text === 'string' ? text.trim().slice(0, 200) : '';
      if (t) msg.text = t;
      if (emote) msg.emote = emote;
      if (!msg.text && !msg.emote) return;
      send(msg, { queue: false });
    },
    [send],
  );

  const sendRoom = useCallback((msg, opts) => send(msg, opts), [send]);

  const busy = !!presenter.busy;
  const display = presenter.display;

  const options = useMemo(() => {
    let real = null;
    if (view && me && typeof getOptions === 'function') {
      try {
        real = getOptions(view, me);
      } catch {
        real = null;
      }
    }
    // all action keys (including the rules-v2 ones) are blank while animating, awaiting the server, or offline
    if (!real || busy || awaiting || connection !== 'open') return blankOptions(real);
    return real;
  }, [view, me, busy, awaiting, connection, getOptions]);

  // Only after the win presentation finished: the presenter has snapped `display` to the final state.
  const displayDone = !display || display.phase === undefined || display.phase === 'over';
  const result = useMemo(() => (busy || !displayDone || typeof standings !== 'function' ? null : buildResult(view, me, standings)), [view, me, busy, displayDone, standings]);

  const restart = useCallback(() => {
    navigate(paths.lobby(code));
  }, [navigate, code]);

  const session = useMemo(
    () => ({
      mode: 'online',
      me,
      view,
      display,
      busy,
      rolling: presenter.rolling,
      bubble: presenter.bubble,
      stageTile: presenter.stageTile,
      log: presenter.log,
      options,
      dispatch,
      chat,
      sendChat,
      result,
      connection,
      restart,
      quit: leave,
    }),
    [me, view, display, busy, presenter.rolling, presenter.bubble, presenter.stageTile, presenter.log, options, dispatch, chat, sendChat, result, connection, restart, leave],
  );

  let status;
  if (fatal) status = 'closed';
  else if (connection !== 'open') status = room ? 'reconnecting' : 'connecting';
  else status = room ? room.status || 'connecting' : 'connecting';

  return { room, session, status, error, errorId, sendRoom, fatal };
}

export default useOnlineGame;
