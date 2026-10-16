import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOptions, standings } from '@shared/index.js';
import * as presenterModule from '@/lib/session/usePresenter.js';
import { openRoomSocket } from '@/lib/socket.js';
import { api } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { pickLine } from '@/lib/voiceLines.js';
import { voice } from '@/lib/voice.js';
import { blankOptions, buildResult, isFatalRoomError, toConnection } from '@/components/online/gameHelpers.js';

// The presenter may be a named or the default export; accept both.
const usePresenter = presenterModule.usePresenter || presenterModule.default;

const ERROR_TTL = 6000;
const ACTION_TIMEOUT = 5000; // re-enable the UI if the server never answers an action

/**
 * Socket + room state for ONE room code. No game presentation: the lobby uses this directly.
 *
 * Returns { room, view, chat, connection, error, errorId, fatal, send, leave }
 *  - room        the last `{t:'room'}` payload (null until it arrives)
 *  - view        the last `{t:'state'}` engine state (null until a game is running)
 *  - connection  'connecting' | 'open' | 'closed'   (reconnects show up as 'connecting')
 *  - error       transient server error text (auto-clears), `errorId` changes on every new one
 *  - fatal       null | { kind: 'kicked'|'join'|'auth'|'closed'|'left', message }  (the socket is closed)
 *  - send(msg, {queue})  JSON to the room; queued while connecting unless queue:false
 *  - leave()     sends {t:'leave'} and closes for good
 *
 * `onState({state, events, seq, fresh})` fires for every state; `fresh` = first state after (re)connect,
 * i.e. the events must NOT be animated. `onChat(entry)` fires once per new chat message.
 */
export function useRoomConnection(code, { onState, onChat } = {}) {
  const { user, loading } = useAuth();
  const uid = user ? String(user.id) : null;
  const [room, setRoom] = useState(null);
  const [view, setView] = useState(null);
  const [chat, setChat] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState(null);
  const [fatal, setFatal] = useState(null);
  const sockRef = useRef(null);
  const handlers = useRef({});
  const errorSeq = useRef(0);

  useEffect(() => {
    handlers.current = { onState, onChat };
  });

  useEffect(() => {
    if (!code || !uid) return undefined;
    setRoom(null);
    setView(null);
    setChat([]);
    setError(null);
    setFatal(null);
    setConnection('connecting');

    let alive = true;
    const sock = openRoomSocket(code);
    sockRef.current = sock;
    const st = { fresh: true, gotRoom: false, lastSeq: -1, diagnosing: false, seen: new Set() };

    const fail = (kind, message) => {
      if (!alive) return;
      setFatal((cur) => cur || { kind, message }); // keep the first (most specific) reason
      setConnection('closed');
      sock.close();
    };

    // The server closes with its own codes when it refuses us: 4001 sign in, 4003/4004 not allowed / not found,
    // 4009 replaced by another tab. Turn them into a clear message instead of reconnecting forever.
    const failFromClose = (info) => {
      const reason = info && info.closeReason ? String(info.closeReason) : '';
      switch (info && info.code) {
        case 4001:
          return fail('auth', 'Your session expired. Please sign in again.');
        case 4003:
          return fail('join', reason || 'You cannot join this room.');
        case 4004:
          return fail('join', reason || 'That room does not exist.');
        case 4009:
          return fail('closed', 'This room was opened in another tab or device.');
        default:
          return fail('closed', 'The connection to the room was closed.');
      }
    };

    // After a few failed connection attempts, find out WHY (signed out? room gone?) instead of spinning forever.
    const diagnose = async () => {
      if (st.diagnosing || !alive) return;
      st.diagnosing = true;
      try {
        const me = await api.get('/api/me');
        if (!alive) return;
        if (!me || !me.user) {
          fail('auth', 'Your session expired. Please sign in again.');
          return;
        }
        const info = await api.get(`/api/rooms/${encodeURIComponent(code)}`);
        if (!alive) return;
        if (info && info.exists === false) fail('join', 'That room no longer exists.');
      } catch {
        /* offline / Worker down: keep retrying quietly */
      } finally {
        st.diagnosing = false;
      }
    };

    const onMessage = (msg) => {
      switch (msg.t) {
        case 'room': {
          if (!msg.room) break;
          st.gotRoom = true;
          if (msg.room.status === 'lobby') st.lastSeq = -1;
          setRoom(msg.room);
          break;
        }
        case 'state': {
          const { state, events, seq } = msg;
          if (!state) break;
          const list = Array.isArray(events) ? events : [];
          const fresh = st.fresh || list.length === 0;
          if (!fresh && typeof seq === 'number' && seq <= st.lastSeq) break; // duplicate / out-of-order
          st.fresh = false;
          if (typeof seq === 'number') st.lastSeq = seq;
          // presenter first, then `view`: the board must never render a state its display has not got yet
          handlers.current.onState?.({ state, events: list, seq, fresh });
          setView(state);
          break;
        }
        case 'chat': {
          const id = msg.id ?? `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
          if (st.seen.has(id)) break;
          st.seen.add(id);
          const entry = { id, from: msg.from, text: typeof msg.text === 'string' ? msg.text : '' };
          if (msg.emote) entry.emote = msg.emote;
          if (typeof msg.name === 'string') entry.name = msg.name;
          if (typeof msg.ts === 'number') entry.ts = msg.ts;
          setChat((cur) => [...cur, entry].slice(-100));
          handlers.current.onChat?.(entry);
          break;
        }
        case 'error': {
          const message = String(msg.message || 'Something went wrong');
          // Before the first {t:'room'} an error always means the server refused us (it follows with a close).
          // Afterwards errors are rejected actions ("Not your turn", "The room is full.") = toasts, except
          // the room expiring under us.
          if (!st.gotRoom) fail('join', message);
          else if (isFatalRoomError(message)) fail('closed', message);
          else {
            errorSeq.current += 1;
            setError({ id: errorSeq.current, message });
          }
          break;
        }
        case 'kicked':
          fail('kicked', 'The host removed you from this room.');
          break;
        default:
      }
    };

    const offs = [
      sock.on('open', () => {
        st.fresh = true; // the next state is a snapshot, not a live update
        setConnection('open');
      }),
      sock.on('status', (s, info) => {
        setConnection(toConnection(s));
        if (s === 'closed' && info && info.reason && info.reason !== 'client') {
          failFromClose(info);
        } else if (s === 'reconnecting' && !st.gotRoom && info && info.attempt % 3 === 0) {
          diagnose();
        }
      }),
      sock.on('message', onMessage),
    ];

    return () => {
      alive = false;
      offs.forEach((off) => off());
      sock.close();
      if (sockRef.current === sock) sockRef.current = null;
    };
  }, [code, uid]);

  // transient errors clear themselves
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), ERROR_TTL);
    return () => clearTimeout(t);
  }, [error]);

  const send = useCallback((msg, opts) => (sockRef.current ? sockRef.current.send(msg, opts) : false), []);

  const leave = useCallback(() => {
    const sock = sockRef.current;
    if (sock) {
      sock.send({ t: 'leave' }, { queue: false });
      sock.close();
    }
    setConnection('closed');
    setFatal((cur) => cur || { kind: 'left', message: 'You left the room.' });
  }, []);

  const authFatal = !loading && !uid ? { kind: 'auth', message: 'Sign in to join a room.' } : null;

  return {
    room,
    view,
    chat,
    connection: authFatal ? 'closed' : connection,
    error: error ? error.message : null,
    errorId: error ? error.id : 0,
    fatal: fatal || authFatal,
    send,
    leave,
  };
}

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
 */
export function useOnlineGame(code) {
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
    if (view && me) {
      try {
        real = getOptions(view, me);
      } catch {
        real = null;
      }
    }
    // all action keys (including the rules-v2 ones) are blank while animating, awaiting the server, or offline
    if (!real || busy || awaiting || connection !== 'open') return blankOptions(real);
    return real;
  }, [view, me, busy, awaiting, connection]);

  // Only after the win presentation finished: the presenter has snapped `display` to the final state.
  const displayDone = !display || display.phase === undefined || display.phase === 'over';
  const result = useMemo(() => (busy || !displayDone ? null : buildResult(view, me, standings)), [view, me, busy, displayDone]);

  const restart = useCallback(() => {
    navigate(`/lobby/${code}`);
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
