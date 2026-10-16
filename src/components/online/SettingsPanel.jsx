import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatINR } from '@shared/format.js';
import {
  AUCTION_LABEL,
  CASH_PRESETS,
  DICE_CHOICES,
  DICE_HELP,
  GOAL_MAX,
  GOAL_MIN,
  GOAL_PRESETS,
  PLAYERS_MAX,
  PLAYERS_MIN,
  ROUNDS_HELP,
  ROUND_CHOICES,
  resolveSettings,
  settingsChips,
  settingsMessage,
  settingsSummary,
  stepGoal,
} from './settings.js';
import '@/styles/online.css';

const STEPPER_DELAY = 450; // ms: batch rapid +/- taps into one message
const SETTLE = 4000; // ms: if the server never echoes our change, fall back to what it says

function Chips({ label, options, value, onPick, disabled, format }) {
  return (
    <div role="radiogroup" aria-label={label} className="ho-chips">
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={String(o)} type="button" role="radio" aria-checked={on} className={`ho-chip${on ? ' is-on' : ''}`} onClick={() => onPick(o)} disabled={disabled}>
            {format(o)}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ label, valueText, onMinus, onPlus, minusOff, plusOff, disabled }) {
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

/**
 * Host: editable winning target / rounds / start cash / max players. Everyone else: a read-only summary.
 * `settings` = room.settings, `onSend(msg)` sends `{t:'settings', settings:{goal,startCash,maxRounds,dice,auctionOnDecline}}`,
 * `onMaxPlayers(n)` changes the seats, `errorId` rolls the optimistic UI back when the server rejects.
 */
export default function SettingsPanel({ settings, maxPlayers, playerCount, isHost, disabled, onSend, onMaxPlayers, errorId }) {
  const server = useMemo(() => resolveSettings(settings), [settings]);
  const serverKey = `${server.goal}|${server.startCash}|${server.maxRounds}|${server.dice}|${server.auctionOnDecline}`;
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
      const msg = settingsMessage(effRef.current, patch);
      const next = msg.settings;
      effRef.current = next;
      setDraft(next);
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
    [onSend],
  );

  const eff = draft || server;
  const seatCount = seats ?? maxPlayers;

  if (!isHost) {
    return (
      <section className="ho-card ho-settings" aria-label="Game settings">
        <div className="ho-card__head">
          <h2 className="ho-h2">Game settings</h2>
          <span className="ho-muted">Set by the host</span>
        </div>
        <p className="ho-summary" aria-live="polite">
          {settingsSummary(settings)}
        </p>
        <ul className="ho-chiprow" aria-label="Settings summary">
          {settingsChips(settings).map((c) => (
            <li key={c} className="ho-chip ho-chip--static">
              {c}
            </li>
          ))}
          {maxPlayers ? <li className="ho-chip ho-chip--static">{`Up to ${maxPlayers} players`}</li> : null}
        </ul>
      </section>
    );
  }

  const minSeats = Math.max(PLAYERS_MIN, playerCount || 0);
  return (
    <section className="ho-card ho-settings" aria-label="Game settings">
      <div className="ho-card__head">
        <h2 className="ho-h2">Game settings</h2>
        <span className="ho-muted">You are the host</span>
      </div>

      <div className="ho-field">
        <div className="ho-field__label" id="ho-goal-label">
          Winning target
        </div>
        <Chips label="Winning target presets" options={GOAL_PRESETS} value={eff.goal} onPick={(g) => commit({ goal: g })} disabled={disabled} format={formatINR} />
        <div className="ho-field__row">
          <span className="ho-muted">Custom</span>
          <Stepper
            label="winning target"
            valueText={formatINR(eff.goal)}
            onMinus={() => commit({ goal: stepGoal(eff.goal, -1) }, STEPPER_DELAY)}
            onPlus={() => commit({ goal: stepGoal(eff.goal, 1) }, STEPPER_DELAY)}
            minusOff={eff.goal <= GOAL_MIN}
            plusOff={eff.goal >= GOAL_MAX}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="ho-field">
        <div className="ho-field__label">Rounds</div>
        <div role="radiogroup" aria-label="Round limit" className="ho-seg">
          {ROUND_CHOICES.map((r) => {
            const on = eff.maxRounds === r.value;
            return (
              <button key={r.label} type="button" role="radio" aria-checked={on} className={`ho-seg__opt${on ? ' is-on' : ''}`} onClick={() => commit({ maxRounds: r.value })} disabled={disabled}>
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="ho-help">{ROUNDS_HELP}</p>
      </div>

      <div className="ho-field">
        <div className="ho-field__label">Start cash</div>
        <Chips label="Start cash" options={CASH_PRESETS} value={eff.startCash} onPick={(c) => commit({ startCash: c })} disabled={disabled} format={formatINR} />
      </div>

      <div className="ho-field">
        <div className="ho-field__label">Dice</div>
        <div role="radiogroup" aria-label="Dice" className="ho-seg">
          {DICE_CHOICES.map((d) => {
            const on = eff.dice === d.value;
            return (
              <button key={d.value} type="button" role="radio" aria-checked={on} className={`ho-seg__opt${on ? ' is-on' : ''}`} onClick={() => commit({ dice: d.value })} disabled={disabled}>
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="ho-help">{DICE_HELP}</p>
      </div>

      <div className="ho-field">
        <button
          type="button"
          role="switch"
          aria-checked={eff.auctionOnDecline}
          className={`ho-switch${eff.auctionOnDecline ? ' is-on' : ''}`}
          onClick={() => commit({ auctionOnDecline: !eff.auctionOnDecline })}
          disabled={disabled}
        >
          <span className="ho-switch__label">{AUCTION_LABEL}</span>
          <span className="ho-switch__track" aria-hidden="true">
            <span className="ho-switch__thumb" />
          </span>
        </button>
      </div>

      <div className="ho-field">
        <div className="ho-field__row">
          <div className="ho-field__label">Max players</div>
          <Stepper
            label="max players"
            valueText={String(seatCount)}
            onMinus={() => {
              const n = Math.max(minSeats, seatCount - 1);
              setSeats(n);
              onMaxPlayers(n);
            }}
            onPlus={() => {
              const n = Math.min(PLAYERS_MAX, seatCount + 1);
              setSeats(n);
              onMaxPlayers(n);
            }}
            minusOff={seatCount <= minSeats}
            plusOff={seatCount >= PLAYERS_MAX}
            disabled={disabled}
          />
        </div>
      </div>

      <p className="ho-summary" aria-live="polite">
        {settingsSummary(eff)}
      </p>
    </section>
  );
}
