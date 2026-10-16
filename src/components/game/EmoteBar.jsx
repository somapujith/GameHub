// Chat/emote bar. Mobile ('bar'): chat icon + "Say hello…" pill + send, quick-chat chips pop up above it.
// Desktop ('panel'): chips always visible. Online sessions can also type text.
import { useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon.jsx';
import { getPlayer } from './ui/helpers.js';

export const EMOTES = [
  { key: 'emote_mass', label: 'Mass', te: 'మాస్', emoji: '🔥' },
  { key: 'emote_cheer', label: 'Cheer', te: 'జై!', emoji: '🎉' },
  { key: 'emote_shock', label: 'Shock', te: 'అయ్యో!', emoji: '😲' },
  { key: 'emote_laugh', label: 'Laugh', te: 'నవ్వు', emoji: '😂' },
  { key: 'emote_thanks', label: 'Thanks', te: 'థ్యాంక్స్', emoji: '🙏' },
  { key: 'emote_hurry', label: 'Hurry', te: 'త్వరగా', emoji: '⏰' },
  { key: 'emote_taunt', label: 'Taunt', te: 'చూసుకో', emoji: '😏' },
];
const EMOTE_BY_KEY = Object.fromEntries(EMOTES.map((e) => [e.key, e]));
const COOLDOWN_MS = 1500;
const BUBBLE_MS = 5200;

/** Short-lived bubbles for incoming `session.chat` messages (history on mount is not replayed). */
export function ChatBubbles({ session }) {
  const chat = session.chat || [];
  const seen = useRef(null);
  if (seen.current === null) seen.current = new Set(chat.map((m) => m.id));
  const [live, setLive] = useState([]);

  useEffect(() => {
    const fresh = chat.filter((m) => !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => {
      seen.current.add(m.id);
      setTimeout(() => setLive((l) => l.filter((x) => x.id !== m.id)), BUBBLE_MS);
    });
    setLive((l) => [...l, ...fresh].slice(-4));
  }, [chat]);

  if (!live.length) return <ul className="hg-bubbles" aria-live="polite" />;
  return (
    <ul className="hg-bubbles" aria-live="polite">
      {live.map((m) => {
        const p = getPlayer(session, m.from);
        const em = m.emote ? EMOTE_BY_KEY[m.emote] : null;
        return (
          <li key={m.id} className="hg-bubble" style={{ '--pc': p?.color || '#fff' }}>
            <b>{p?.name || 'Player'}</b>
            <span>
              {em ? <><span className="hg-bubble-emoji" aria-hidden="true">{em.emoji}</span> {em.label} <small lang="te">{em.te}</small></> : m.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Chips({ onPick, disabled }) {
  return (
    <div className="hg-chips-grid" role="group" aria-label="Quick chat">
      {EMOTES.map((e) => (
        <button key={e.key} type="button" className="hg-emote-chip" disabled={disabled} onClick={() => onPick(e)}>
          <span className="hg-emote-emoji" aria-hidden="true">{e.emoji}</span>
          <span className="hg-emote-label">{e.label}</span>
          <small lang="te">{e.te}</small>
        </button>
      ))}
    </div>
  );
}

export default function EmoteBar({ session, variant = 'bar' }) {
  const online = session.mode === 'online';
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [cool, setCool] = useState(false);
  const rootRef = useRef(null);
  const coolTimer = useRef(0);

  useEffect(() => () => clearTimeout(coolTimer.current), []);

  /* close the tray on outside tap / Escape (bar variant) */
  useEffect(() => {
    if (!open || variant !== 'bar') return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, variant]);

  const pick = (e) => {
    if (cool) return;
    session.sendChat?.('', e.key);
    setCool(true);
    clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => setCool(false), COOLDOWN_MS);
    if (variant === 'bar') setOpen(false);
  };

  const submit = (ev) => {
    ev?.preventDefault();
    const t = text.trim();
    if (!t) { setOpen((o) => !o); return; }
    session.sendChat?.(t);
    setText('');
  };

  if (variant === 'panel') {
    return (
      <section className="hg-emote hg-emote--panel" aria-label="Chat">
        <header className="hg-log-head"><h2>Quick chat</h2></header>
        <Chips onPick={pick} disabled={cool} />
        {online ? (
          <form className="hg-emote-form" onSubmit={submit}>
            <input
              className="hg-emote-input"
              value={text}
              maxLength={120}
              placeholder="Say hello…"
              aria-label="Chat message"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="hg-emote-send" aria-label="Send message" disabled={!text.trim()}>
              <Icon name="send" size={20} />
            </button>
          </form>
        ) : null}
        <ChatBubbles session={session} />
      </section>
    );
  }

  return (
    <div className="hg-emote hg-emote--bar" ref={rootRef}>
      <ChatBubbles session={session} />
      {open ? (
        <div className="hg-emote-tray">
          <Chips onPick={pick} disabled={cool} />
        </div>
      ) : null}
      <form className="hg-emote-row" onSubmit={submit}>
        <button
          type="button"
          className="hg-emote-chat"
          aria-label="Quick chat"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="chat" size={26} />
        </button>
        {online ? (
          <input
            className="hg-emote-pill"
            value={text}
            maxLength={120}
            placeholder="Say hello…"
            aria-label="Chat message"
            onFocus={() => setOpen(true)}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <button type="button" className="hg-emote-pill is-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Say hello…
          </button>
        )}
        <button
          type="submit"
          className="hg-emote-send"
          aria-label={online && text.trim() ? 'Send message' : 'Open quick chat'}
        >
          <Icon name="send" size={24} />
        </button>
      </form>
    </div>
  );
}
