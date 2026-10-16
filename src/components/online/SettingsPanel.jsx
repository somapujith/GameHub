import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  fieldOptions,
  formatValue,
  resolveSettings,
  schemaFields,
  seatBounds,
  settingsChips,
  settingsKey,
  settingsMessage,
  stepValue,
  summarizeSettings,
} from './settings.js';
import '@/styles/online.css';

const STEPPER_DELAY = 450; // ms: batch rapid +/- taps into one message
const SETTLE = 4000; // ms: if the server never echoes our change, fall back to what it says

function Chips({ label, options, value, onPick, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} className="ho-chips">
      {options.map((o) => {
        const on = Object.is(o.value, value);
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className={`ho-chip${on ? ' is-on' : ''}`} onClick={() => onPick(o.value)} disabled={disabled}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({ label, options, value, onPick, disabled }) {
  return (
    <div role="radiogroup" aria-label={label} className="ho-seg">
      {options.map((o) => {
        const on = Object.is(o.value, value);
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className={`ho-seg__opt${on ? ' is-on' : ''}`} onClick={() => onPick(o.value)} disabled={disabled}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ label, valueText, onMinus, onPlus, minusOff, plusOff, disabled }) {
  return (
    <div className="ho-stepper" role="group" aria-label={label}>
      <button type="button" className="ho-stepper__btn" onClick={onMinus} disabled={disabled || minusOff} aria-label={`Decrease ${label}`}>
        &minus;
      </button>
      <output className="ho-stepper__val" aria-live="polite">
        {valueText}
      </output>
      <button type="button" className="ho-stepper__btn" onClick={onPlus} disabled={disabled || plusOff} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

/** A segmented control is a pill row when it is short; many or long options wrap as chips instead. */
const isCompact = (options) => options.length <= 3 && options.reduce((n, o) => n + String(o.label ?? '').length, 0) <= 26;

/** One schema field, rendered by its `type`. `onChange(value)` / `onStep(dir)` are the host's edits. */
export function SettingField({ field, value, onChange, onStep, disabled }) {
  const id = useId();
  const options = fieldOptions(field);
  const helpId = field.help ? `${id}-help` : undefined;
  const help = field.help ? (
    <p className="ho-help" id={helpId}>
      {field.help}
    </p>
  ) : null;

  if (field.type === 'toggle') {
    return (
      <div className="ho-field">
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          aria-describedby={helpId}
          className={`ho-switch${value ? ' is-on' : ''}`}
          onClick={() => onChange(!value)}
          disabled={disabled}
        >
          <span className="ho-switch__label">{field.label}</span>
          <span className="ho-switch__track" aria-hidden="true">
            <span className="ho-switch__thumb" />
          </span>
        </button>
        {help}
      </div>
    );
  }

  if (field.type === 'stepper') {
    const min = typeof field.min === 'number' ? field.min : -Infinity;
    const max = typeof field.max === 'number' ? field.max : Infinity;
    const stepper = (
      <Stepper
        label={field.label.toLowerCase()}
        valueText={formatValue(field, value)}
        onMinus={() => onStep(-1)}
        onPlus={() => onStep(1)}
        minusOff={typeof value === 'number' && value <= min}
        plusOff={typeof value === 'number' && value >= max}
        disabled={disabled}
      />
    );
    return (
      <div className="ho-field">
        <div className="ho-field__label">{field.label}</div>
        {options.length > 0 && <Chips label={`${field.label} quick picks`} options={options} value={value} onPick={onChange} disabled={disabled} />}
        {options.length > 0 ? (
          <div className="ho-field__row">
            <span className="ho-muted">Custom</span>
            {stepper}
          </div>
        ) : (
          <div className="ho-field__row">{stepper}</div>
        )}
        {help}
      </div>
    );
  }

  // segmented
  return (
    <div className="ho-field">
      <div className="ho-field__label">{field.label}</div>
      {isCompact(options) ? (
        <Segmented label={field.label} options={options} value={value} onPick={onChange} disabled={disabled} />
      ) : (
        <Chips label={field.label} options={options} value={value} onPick={onChange} disabled={disabled} />
      )}
      {help}
    </div>
  );
}

/**
 * The room's game settings, rendered from the game's `manifest.settings` schema.
 *  - host: one control per field (segmented / stepper / toggle) plus "Max players" within `game.players`
 *  - everyone else: `game.summarize(settings)` and read-only chips
 * Props: `game` (manifest or null), `settings` (= room.settings), `maxPlayers`, `playerCount`, `isHost`, `disabled`,
 * `onSend(msg)` sends the FULL `{t:'settings', settings}`, `onMaxPlayers(n)`, `errorId` (rolls the optimistic UI back
 * when the server rejects a change).
 */
export default function SettingsPanel({ game, settings, maxPlayers, playerCount, isHost, disabled, onSend, onMaxPlayers, errorId }) {
  const schema = game && game.settings;
  const fields = useMemo(() => schemaFields(schema), [schema]);
  const server = useMemo(() => resolveSettings(schema, settings), [schema, settings]);
  const serverKey = settingsKey(schema, settings);
  const [draft, setDraft] = useState(null);
  const [seats, setSeats] = useState(null);
  const timer = useRef(null);
  const settle = useRef(null);
  const effRef = useRef(server);
  effRef.current = draft || server;

  const clearTimers = () => {
    clearTimeout(timer.current);
    clearTimeout(settle.current);
    timer.current = settle.current = null;
  };
  useEffect(() => clearTimers, []);

  // server echo arrives: drop the optimistic draft (unless a stepper burst is still pending)
  useEffect(() => {
    if (!timer.current) setDraft(null);
  }, [serverKey]);
  useEffect(() => {
    setSeats(null);
  }, [maxPlayers]);

  // server rejected something: roll back
  useEffect(() => {
    if (!errorId) return;
    clearTimers();
    setDraft(null);
    setSeats(null);
  }, [errorId]);

  const commit = useCallback(
    (patch, delay = 0) => {
      const msg = settingsMessage(schema, effRef.current, patch);
      effRef.current = msg.settings;
      setDraft(msg.settings);
      clearTimeout(timer.current);
      const fire = () => {
        timer.current = null;
        onSend(msg);
        clearTimeout(settle.current);
        settle.current = setTimeout(() => setDraft(null), SETTLE);
      };
      if (delay) timer.current = setTimeout(fire, delay);
      else fire();
    },
    [schema, onSend],
  );

  const eff = draft || server;
  const seatCount = seats ?? maxPlayers;
  const seatsKnown = typeof seatCount === 'number';

  if (!isHost) {
    return (
      <section className="ho-card ho-settings" aria-label="Game settings">
        <div className="ho-card__head">
          <h2 className="ho-h2">Game settings</h2>
          <span className="ho-muted">Set by the host</span>
        </div>
        <p className="ho-summary" aria-live="polite">
          {summarizeSettings(game, settings) || 'The host has not changed anything yet.'}
        </p>
        <ul className="ho-chiprow" aria-label="Settings summary">
          {settingsChips(schema, settings).map((c) => (
            <li key={c} className="ho-chip ho-chip--static">
              {c}
            </li>
          ))}
          {maxPlayers ? <li className="ho-chip ho-chip--static">{`Up to ${maxPlayers} players`}</li> : null}
        </ul>
      </section>
    );
  }

  const bounds = seatBounds(game, playerCount);
  return (
    <section className="ho-card ho-settings" aria-label="Game settings">
      <div className="ho-card__head">
        <h2 className="ho-h2">Game settings</h2>
        <span className="ho-muted">You are the host</span>
      </div>

      {fields.map((f) => (
        <SettingField
          key={f.key}
          field={f}
          value={eff[f.key]}
          disabled={disabled}
          onChange={(v) => commit({ [f.key]: v })}
          onStep={(dir) => commit({ [f.key]: stepValue(f, effRef.current[f.key], dir) }, STEPPER_DELAY)}
        />
      ))}

      {seatsKnown && (
        <div className="ho-field">
          <div className="ho-field__row">
            <div className="ho-field__label">Max players</div>
            <Stepper
              label="max players"
              valueText={String(seatCount)}
              onMinus={() => {
                const n = Math.max(bounds.min, seatCount - 1);
                setSeats(n);
                onMaxPlayers(n);
              }}
              onPlus={() => {
                const n = Math.min(bounds.max, seatCount + 1);
                setSeats(n);
                onMaxPlayers(n);
              }}
              minusOff={seatCount <= bounds.min}
              plusOff={seatCount >= bounds.max}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {fields.length > 0 && (
        <p className="ho-summary" aria-live="polite">
          {summarizeSettings(game, eff)}
        </p>
      )}
    </section>
  );
}
