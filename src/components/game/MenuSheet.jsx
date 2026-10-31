// "..." menu: settings summary, sound toggle + volume, reduce motion, player stats, log, rules, quit.
import { useSettings } from '@/lib/storage.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { Switch } from './ui/Controls.jsx';
import { FAIR_DICE_TEXT, LUCKY_DICE_TEXT, ROUND_RULE_TEXT, diceLabel, settingsSummary } from './ui/helpers.js';

export default function MenuSheet({ open, onClose, onRules, onQuit, onStats, onLog, session }) {
  const [s, update] = useSettings();
  const cfg = session?.display?.cfg || session?.view?.cfg;
  const summary = settingsSummary(cfg, session?.display?.goal);
  const fairDice = (cfg?.dice ?? 'lucky') === 'fair';

  return (
    <Sheet open={open} onClose={onClose} title="Menu" className="hg-menu" desktop="modal">
      <div className="hg-menu-rules">
        <p className="hg-summary is-strong">{summary}</p>
        <p className="hg-menu-note">{ROUND_RULE_TEXT}</p>
        <div className="hg-menu-dice">
          <b>{diceLabel(cfg)}</b>
          <p>{fairDice ? FAIR_DICE_TEXT : LUCKY_DICE_TEXT}</p>
        </div>
      </div>

      <div className="hg-group" role="group" aria-label="Sound">
        <Switch icon="sound" label="Sound effects" checked={s.sfx} onChange={(v) => update({ sfx: v })} />
        <div className="hg-row-ctl hg-row-ctl--slider">
          <span className="hg-row-ico"><Icon name="sound" size={20} /></span>
          <span className="hg-row-txt"><label htmlFor="hg-volume">Volume</label></span>
          <input
            id="hg-volume"
            className="hg-range is-small"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume ?? 0.8}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            style={{ '--pct': `${Math.round((s.volume ?? 0.8) * 100)}%` }}
          />
        </div>
      </div>

      <div className="hg-group">
        <Switch icon="spark" label="Reduce motion" hint="Fewer animations" checked={!!s.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
      </div>

      <div className="hg-menu-actions">
        {onStats ? (
          <Button variant="dark" block icon={<Icon name="trophy" size={20} />} onClick={onStats}>Player stats</Button>
        ) : null}
        {onLog ? (
          <Button variant="dark" block icon={<Icon name="list" size={20} />} onClick={onLog}>Game log</Button>
        ) : null}
        <Button variant="dark" block icon={<Icon name="book" size={20} />} onClick={onRules}>How to play</Button>
        <Button variant="rose" block icon={<Icon name="exit" size={20} />} onClick={onQuit}>Quit to home</Button>
      </div>
    </Sheet>
  );
}
