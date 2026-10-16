import { useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon.jsx';
import { getPlayer } from './ui/helpers.js';
import '@/styles/chat.css';

export default function EmoteBar({ session }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [cool, setCool] = useState(false);
  const timer = useRef(null);
  const list = useRef(null);
  const stick = useRef(true);
  const connected = session.connection === 'open';
  const history = session.chat || [];
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (list.current && stick.current) list.current.scrollTop = list.current.scrollHeight; }, [history.length, open]);
  const submit = (event) => {
    event.preventDefault();
    if (!text.trim() || !connected || cool) return;
    session.sendChat?.(text.trim());
    setText('');
    setCool(true);
    timer.current = setTimeout(() => setCool(false), 1500);
  };
  if (session.mode !== 'online') return null;
  return <section className="table-chat" aria-label="Room chat">
    {open && history.length > 0 && <ol ref={list} className="table-chat__history" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions" onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32; }}>
      {history.slice(-100).map((message) => {
        const player = getPlayer(session, message.from);
        return <li key={message.id}><b style={{ color: player?.color }}>{message.from === session.me ? 'You' : player?.name || message.name || 'Player'}</b><span>{message.text || '👋'}</span></li>;
      })}
    </ol>}
    <form className="table-chat__composer" onSubmit={submit}>
      <button type="button" className="table-chat__toggle" aria-label={open ? 'Hide chat' : 'Show chat'} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="chat" size={21} />{history.length > 0 && <i aria-hidden="true" />}</button>
      <input value={text} onChange={(event) => setText(event.target.value)} onFocus={() => setOpen(true)} maxLength={120} placeholder={connected ? 'Salaam, kya haal?' : 'Reconnecting…'} disabled={!connected} aria-label="Chat message" autoComplete="off" />
      <button type="submit" className="table-chat__send" disabled={!text.trim() || !connected || cool} aria-label="Send message"><Icon name="send" size={21} /></button>
    </form>
  </section>;
}
