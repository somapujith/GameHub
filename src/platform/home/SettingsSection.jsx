import { useState } from 'react';
import HubIcon from '@/platform/game/HubIcon.jsx';
import Modal from '@/components/shell/Modal.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { Toggle } from '@/components/shell/ui.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { DEFAULT_PROFILE, useProfile, useSettings } from '@/components/shell/stores.js';
import { playSfx } from '@/components/shell/sound.js';

/** Profile > Settings: sound effects, volume, motion, reset progress. */
export default function SettingsSection() {
  const toast = useToast();
  const [settings, update] = useSettings();
  const [, updateProfile] = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const volume = Math.round(settings.volume * 100);

  const doReset = () => {
    updateProfile({
      xp: 0,
      level: 1,
      coins: DEFAULT_PROFILE.coins,
      stats: { ...DEFAULT_PROFILE.stats },
      lastDailyClaim: null,
      dailyStreak: 0,
    });
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

      <section className="hub-panel hh2-danger" aria-labelledby="hh2-reset-h">
        <div>
          <h3 id="hh2-reset-h" className="hub-section__title">
            <HubIcon name="refresh" size={18} /> Reset progress
          </h3>
          <p className="hub-muted">Clears your XP, level, coins, local stats and daily streak on this device. Settings and your name stay.</p>
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
        <p>This cannot be undone. Your XP, coins, local stats and streak will be cleared on this device.</p>
      </Modal>
    </section>
  );
}
