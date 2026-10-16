import { useState } from 'react';
import HubIcon from '@/platform/game/HubIcon.jsx';
import Modal from '@/components/shell/Modal.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { Segmented, Toggle } from '@/components/shell/ui.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { DEFAULT_PROFILE, safeClearGame, useProfile, useSettings } from '@/components/shell/stores.js';
import { playSfx } from '@/components/shell/audio.js';
import { liveList } from './catalog.js';
import GameSettings from './GameSettings.jsx';

const SUBTITLES = [
  { value: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { value: 'tn', label: 'Tenglish', sub: 'Latin script' },
  { value: 'en', label: 'English', sub: 'Gist' },
  { value: 'off', label: 'Off', sub: 'No subtitles' },
];

/** Story / campaign progress has no reset hook in the storage lib; clear its keys defensively. */
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

/** Profile > Settings: sound, voice, subtitles, motion, per-game panels, reset progress. */
export default function SettingsSection() {
  const toast = useToast();
  const [settings, update] = useSettings();
  const [, updateProfile] = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const volume = Math.round(settings.volume * 100);
  const withPanels = liveList().filter((g) => typeof g.loaders?.settingsPanel === 'function');

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
    // Some stores have no reset hook; a reload makes every screen re-read storage.
    setTimeout(() => window.location.assign('/'), 700);
  };

  return (
    <section id="settings" className="hub-section" aria-labelledby="hh2-settings-h">
      <div className="hub-section__head">
        <h2 id="hh2-settings-h" className="hub-section__title">
          Settings
        </h2>
      </div>

      <div className="hh2-setgrid">
        <section className="hub-panel" aria-labelledby="hh2-snd-h">
          <h3 id="hh2-snd-h" className="hub-section__title">
            <HubIcon name="bolt" size={18} /> Sound
          </h3>
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
            label="Voice lines"
            hint="Spoken one-liners in games that have them"
            checked={settings.voice}
            onChange={(v) => update({ voice: v })}
          />
          <div className="hh2-range">
            <label htmlFor="hh2-volume" className="hh2-range__label">
              <span>Volume</span>
              <b>{volume}%</b>
            </label>
            <input
              id="hh2-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              style={{ '--v': `${volume}%` }}
              onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => playSfx('click')}
              onKeyUp={(e) => (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') && playSfx('click')}
              data-nosfx
            />
          </div>
        </section>

        <section className="hub-panel" aria-labelledby="hh2-sub-h">
          <h3 id="hh2-sub-h" className="hub-section__title">
            <HubIcon name="book" size={18} /> Subtitles
          </h3>
          <p className="hub-muted hh2-card__note">Shown with every voice line.</p>
          <Segmented label="Subtitle language" value={settings.subtitles} onChange={(v) => update({ subtitles: v })} options={SUBTITLES} size="sm" className="hh-seg--wrap" />
        </section>

        <section className="hub-panel" aria-labelledby="hh2-motion-h">
          <h3 id="hh2-motion-h" className="hub-section__title">
            <HubIcon name="spark" size={18} /> Motion
          </h3>
          <Toggle
            icon={<Icon name="sparkle" size={20} />}
            label="Reduce motion"
            hint="Calmer animations: no auto-rotating banner, twinkling stars or coin bursts."
            checked={settings.reducedMotion}
            onChange={(v) => update({ reducedMotion: v })}
          />
        </section>
      </div>

      {withPanels.length > 0 && (
        <div className="hh2-gamesettings">
          <h3 className="hh2-subhead">Game settings</h3>
          {withPanels.map((g) => (
            <GameSettings key={g.id} game={g} />
          ))}
        </div>
      )}

      <section className="hub-panel hh2-danger" aria-labelledby="hh2-reset-h">
        <div>
          <h3 id="hh2-reset-h" className="hub-section__title">
            <HubIcon name="refresh" size={18} /> Reset progress
          </h3>
          <p className="hub-muted">Clears your XP, level, coins, offline stats, daily streak, story progress and any saved game on this device. Settings and your name stay.</p>
        </div>
        <button type="button" className="hub-btn hh2-danger-btn" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" size={18} /> Reset progress
        </button>
      </section>

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
        <p>This cannot be undone. Your XP, coins, offline stats, streak, story progress and saved game will be cleared on this device.</p>
      </Modal>
    </section>
  );
}
