import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACTORS } from '@/data/actors.js';
import PageHeader from '@/components/shell/PageHeader.jsx';
import Modal from '@/components/shell/Modal.jsx';
import ProfileCard from '@/components/shell/home/ProfileCard.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { AvatarRing, Segmented, Toggle } from '@/components/shell/ui.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { DEFAULT_PROFILE, safeClearGame, useProfile, useSettings } from '@/components/shell/stores.js';
import { onVoiceLine, pickLine, playSfx, speak, stopSpeaking, ttsAvailable } from '@/components/shell/audio.js';

const SUBTITLES = [
  { value: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { value: 'tn', label: 'Tenglish', sub: 'Latin script' },
  { value: 'en', label: 'English', sub: 'Gist' },
  { value: 'off', label: 'Off', sub: 'No subtitles' },
];
const TEST_TRIGGERS = ['game_start', 'buy', 'win_me', 'rent_receive', 'emote_cheer', 'emote_mass', 'doubles'];
const actors = Array.isArray(ACTORS) ? ACTORS : [];

/** Remove campaign progress (the lib exposes no reset; clear its localStorage keys defensively). */
function clearCampaignStorage() {
  try {
    const keys = [];
    for (let k = 0; k < localStorage.length; k += 1) {
      const key = localStorage.key(k);
      if (key && /campaign/i.test(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, update] = useSettings();
  const [profile, updateProfile] = useProfile();
  const { user, signedIn, guest, auth } = useAccount();
  const [confirmReset, setConfirmReset] = useState(false);
  const [line, setLine] = useState(null);
  const [testing, setTesting] = useState(false);
  const lastLine = useRef(null);

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

  const doReset = () => {
    updateProfile({
      xp: 0,
      level: 1,
      coins: DEFAULT_PROFILE.coins,
      stats: { ...DEFAULT_PROFILE.stats },
      lastDailyClaim: null,
      dailyStreak: 0,
    });
    safeClearGame();
    clearCampaignStorage();
    setConfirmReset(false);
    toast('Progress reset. Fresh start!', { tone: 'good' });
    // The campaign store has no reset hook; a reload makes every screen re-read storage.
    setTimeout(() => window.location.assign('/'), 700);
  };

  const logout = async () => {
    try {
      await auth.logout?.();
      toast('Signed out.', { tone: 'info' });
    } catch {
      toast('Could not sign out. Try again.', { tone: 'bad' });
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Friend code copied', { tone: 'good' });
    } catch {
      toast(text, { tone: 'info' });
    }
  };

  const subLine = line?.line ? line.line[settings.subtitles === 'off' ? 'en' : settings.subtitles] || line.line.en : null;
  const noTts = !ttsAvailable();

  return (
    <div className="hh-settings">
      <PageHeader back="/" title="Settings" te="సెట్టింగ్స్" subtitle="Profile, sound, voices and account." icon="gear" />

      <div className="hh-settings__grid">
        <div className="hh-settings__col">
          <ProfileCard defaultOpen heading="Profile" />

          {/* ---------- account ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-acct-h">
            <h2 id="hh-acct-h" className="hh-h2">
              Account
            </h2>
            {signedIn ? (
              <div className="hh-acct">
                <AvatarRing preset={user?.avatar ?? profile.avatar} size={48} dot="on" tone="good" />
                <div className="hh-acct__text">
                  <b>{user?.name || profile.name}</b>
                  <small>{guest ? 'Guest account (rooms only)' : 'Signed in with Google'}</small>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
                  <Icon name="logout" size={16} /> Sign out
                </button>
                {user?.friendCode && !guest && (
                  <button type="button" className="hh-codechip" onClick={() => copy(user.friendCode)} aria-label={`Copy friend code ${user.friendCode}`}>
                    <span>Friend code</span>
                    <b>{user.friendCode}</b>
                    <Icon name="copy" size={16} />
                  </button>
                )}
                {guest && (
                  <Link to="/login?next=/settings" className="hh-link hh-acct__upgrade">
                    Sign in with Google for friends and rankings
                  </Link>
                )}
              </div>
            ) : (
              <div className="hh-acct">
                <p className="hh-muted">You are playing offline on this device. Sign in to save progress, add friends and play online rooms.</p>
                <Link to="/login?next=/settings" className="btn btn--primary">
                  <Icon name="login" size={18} /> Sign in
                </Link>
              </div>
            )}
          </section>

          {/* ---------- motion ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-motion-h">
            <h2 id="hh-motion-h" className="hh-h2">
              Motion
            </h2>
            <Toggle
              icon={<Icon name="sparkle" size={20} />}
              label="Reduce motion"
              hint="Calmer animations: no twinkling stars, typing effects or coin bursts."
              checked={settings.reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
            />
          </section>
        </div>

        <div className="hh-settings__col">
          {/* ---------- sound ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-snd-h">
            <h2 id="hh-snd-h" className="hh-h2">
              Sound
            </h2>
            <Toggle
              icon={<Icon name={settings.sfx ? 'volume' : 'volumeOff'} size={20} />}
              label="Sound effects"
              hint="Dice, coins and taps"
              checked={settings.sfx}
              onChange={(v) => {
                update({ sfx: v });
                if (v) setTimeout(() => playSfx('coin'), 80);
              }}
            />
            <Toggle
              icon={<Icon name="mic" size={20} />}
              label="Hero voice lines"
              hint="Tollywood-style one-liners during the game"
              checked={settings.voice}
              onChange={(v) => update({ voice: v })}
            />
            <Toggle
              icon={<Icon name="book" size={20} />}
              label="Text-to-speech"
              hint={noTts ? 'Not available in this browser. Subtitles still show.' : 'Read lines aloud in Telugu when no recorded clip exists'}
              checked={settings.tts}
              disabled={!settings.voice}
              onChange={(v) => update({ tts: v })}
            />
            <div className="hh-range">
              <label htmlFor="hh-volume" className="hh-range__label">
                <span>Volume</span>
                <b>{Math.round(settings.volume * 100)}%</b>
              </label>
              <input
                id="hh-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(settings.volume * 100)}
                style={{ '--v': `${Math.round(settings.volume * 100)}%` }}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
                onPointerUp={() => playSfx('click')}
                onKeyUp={(e) => (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') && playSfx('click')}
                data-nosfx
              />
            </div>
          </section>

          {/* ---------- subtitles ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-sub-h">
            <h2 id="hh-sub-h" className="hh-h2">
              Subtitles
            </h2>
            <p className="hh-muted hh-block__note">Shown with every hero voice line.</p>
            <Segmented label="Subtitle language" value={settings.subtitles} onChange={(v) => update({ subtitles: v })} options={SUBTITLES} size="sm" className="hh-seg--wrap" />
          </section>

          {/* ---------- voices ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-vo-h">
            <div className="hh-card__head">
              <h2 id="hh-vo-h" className="hh-h2">
                Hero voices
              </h2>
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
              {!settings.voice && <span className="hh-muted">Turn on hero voice lines to test.</span>}
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
      </div>

      {/* ---------- danger zone + about ---------- */}
      <div className="hh-settings__foot">
        <section className="hh-card hh-block hh-danger" aria-labelledby="hh-reset-h">
          <h2 id="hh-reset-h" className="hh-h2">
            Reset progress
          </h2>
          <p className="hh-muted">Clears your XP, level, coins, stats, daily streak, story progress and any saved game. Settings and your name stay.</p>
          <button type="button" className="btn btn--danger" onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={18} /> Reset progress
          </button>
        </section>

        <section className="hh-card hh-block hh-about" aria-labelledby="hh-about-h">
          <h2 id="hh-about-h" className="hh-h2">
            About & credits
          </h2>
          <p>
            <b>Hyderabad Tycoon</b> is a fan-made, non-commercial game celebrating the City of Pearls: from Miyapur to Banjara Hills.
          </p>
          <p>
            <b>Voice lines are fan-made and original.</b> Every line is newly written in a playful nod to each star's on-screen style. No film dialogue, songs, recordings or photos are used, and no actor has recorded or endorsed anything here. Actor names appear only descriptively, as badges with monograms. All characters are generic and fictional.
          </p>
          <p className="hh-muted">Built with React and Vite. Fonts: Baloo Tammudu 2 and Noto Sans Telugu (SIL Open Font License). All art is inline SVG.</p>
          <Link to="/story" className="btn btn--ghost">
            <Icon name="play" size={16} /> Watch the story again
          </Link>
        </section>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)} data-autofocus>
              Cancel
            </button>
            <button type="button" className="btn btn--danger" onClick={doReset}>
              Yes, reset
            </button>
          </>
        }
      >
        <p>This cannot be undone. Your XP, coins, stats, streak, chapters and saved game will be cleared on this device.</p>
      </Modal>
    </div>
  );
}
