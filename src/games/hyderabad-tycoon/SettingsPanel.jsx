// Hyderabad Tycoon's own settings, rendered by the hub inside Profile > "Game settings": a voice switch
// per hero actor and a "Test voice" button. The platform-wide sound options (effects, volume, voice lines
// on/off, text-to-speech, subtitles, reduced motion) live in the hub's own Sound settings.
import { useEffect, useRef, useState } from 'react';
import { ACTORS } from '@/data/actors.js';
import { Icon } from '@/components/shell/icons.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { useSettings } from '@/components/shell/stores.js';
import { onVoiceLine, pickLine, speak, stopSpeaking } from '@/components/shell/audio.js';
import './tycoon.css';

const TEST_TRIGGERS = ['game_start', 'buy', 'win_me', 'rent_receive', 'emote_cheer', 'emote_mass', 'doubles'];
const actors = Array.isArray(ACTORS) ? ACTORS : [];

export default function SettingsPanel() {
  const toast = useToast();
  const [settings, update] = useSettings();
  const [line, setLine] = useState(null);
  const [testing, setTesting] = useState(false);
  const lastLine = useRef(null);

  // Show the line that is being spoken (and stop talking when the panel closes).
  useEffect(() => {
    const off = onVoiceLine(({ line: l, actor, phase }) => {
      if (phase === 'start') setLine({ line: l, actor });
      else setTimeout(() => setLine((cur) => (cur?.line === l ? null : cur)), 2500);
    });
    return () => {
      off();
      stopSpeaking();
    };
  }, []);

  const actorOn = (id) => settings.actors?.[id] !== false;
  const setActor = (id, v) => update({ actors: { ...settings.actors, [id]: v } });
  const setAllActors = (v) => update({ actors: Object.fromEntries(actors.map((a) => [a.id, v])) });
  const allOn = actors.every((a) => actorOn(a.id));

  const testVoice = async () => {
    setTesting(true);
    try {
      let l = null;
      for (let n = 0; n < 4 && !l; n += 1) {
        const trig = TEST_TRIGGERS[Math.floor(Math.random() * TEST_TRIGGERS.length)];
        l = pickLine(trig, { avoid: lastLine.current ? [lastLine.current] : [] });
      }
      if (!l) {
        toast('No voice lines available. Enable at least one actor.', { tone: 'bad' });
        return;
      }
      lastLine.current = l.id;
      setLine({ line: l, actor: actors.find((a) => a.id === l.actor) });
      await speak(l, { priority: 9 });
    } finally {
      setTesting(false);
    }
  };

  const subLine = line?.line ? line.line[settings.subtitles === 'off' ? 'en' : settings.subtitles] || line.line.en : null;

  return (
    <div className="tyc-settings">
      <section className="tyc-settings__block" aria-labelledby="tyc-heroes-h">
        <div className="tyc-settings__head">
          <h3 id="tyc-heroes-h" className="tyc-settings__title">
            Hero voices
          </h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAllActors(!allOn)}>
            {allOn ? 'Mute all' : 'Enable all'}
          </button>
        </div>
        <ul className="hh-actors">
          {actors.map((a) => {
            const on = actorOn(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  className={`hh-actor ${on ? 'is-on' : ''}`}
                  style={{ '--ac': a.color || 'var(--violet)', '--ax': a.accent || 'var(--gold)' }}
                  onClick={() => setActor(a.id, !on)}
                >
                  <span className="hh-actor__badge" aria-hidden="true">
                    {a.initials || a.name?.slice(0, 2)}
                  </span>
                  <span className="hh-actor__name">{a.short || a.name}</span>
                  <span className="hh-actor__state" aria-hidden="true">
                    <Icon name={on ? 'volume' : 'volumeOff'} size={14} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="hh-test">
          <button type="button" className="btn btn--saffron" onClick={testVoice} disabled={testing || !settings.voice}>
            <Icon name="mic" size={18} /> {testing ? 'Speaking…' : 'Test voice'}
          </button>
          {!settings.voice && <span className="hh-muted">Turn on voice lines in Sound settings to test.</span>}
        </div>
        {line?.line && (
          <blockquote className="hh-linecard" aria-live="polite">
            <span className="hh-linecard__who">{line.actor?.name || line.line.actor}</span>
            <p className="hh-linecard__te" lang="te">
              {line.line.te}
            </p>
            {settings.subtitles !== 'off' && subLine && settings.subtitles !== 'te' && <p className="hh-linecard__sub">{subLine}</p>}
            <p className="hh-linecard__en">{line.line.en}</p>
          </blockquote>
        )}
      </section>
    </div>
  );
}
