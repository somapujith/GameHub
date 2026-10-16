import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compactINR, formatINR } from '@shared/format.js';
import { Avatar } from '@/components/art/index.js';
import { RIVALS } from '@/data/story.js';
import PageHeader from '@/components/shell/PageHeader.jsx';
import GoalStepper from '@/components/shell/GoalStepper.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { Segmented, Toggle, radioKeyNav } from '@/components/shell/ui.jsx';
import { useProfile } from '@/components/shell/stores.js';
import { playSfx } from '@/components/shell/audio.js';
import {
  CASH_PRESETS,
  DEFAULT_AUCTION_ON_DECLINE,
  DEFAULT_CASH,
  DEFAULT_DICE,
  DEFAULT_GOAL,
  DEFAULT_ROUNDS,
  DICE_MODES,
  GOAL_MAX,
  GOAL_PRESETS,
  ROUND_OPTIONS,
  SETUP_KEY,
  clampGoal,
  minGoalFor,
  settingsSummary,
} from '@/components/shell/gameSettings.js';

const SPEEDS = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];
const GOAL_HINT = { 30000: 'Sprint', 50000: 'Short', 70000: 'Classic', 100000: 'Marathon' };
const ROUND_LABELS = [
  { value: 30, label: '30', sub: 'Quick' },
  { value: 50, label: '50', sub: 'Standard' },
  { value: null, label: 'Unlimited', sub: 'No limit' },
];

const DICE_OPTIONS = [
  { value: 'lucky', label: '🍀 Lucky', sub: 'Gentle help' },
  { value: 'fair', label: '⚖️ Fair', sub: 'Pure odds' },
];

const DEFAULTS = {
  players: 2,
  picked: ['biryani-bhai'],
  goal: 30000,
  maxRounds: 30,
  startCash: DEFAULT_CASH,
  dice: 'fair',
  auctionOnDecline: DEFAULT_AUCTION_ON_DECLINE,
  speed: 'normal',
};

const rivalList = Array.isArray(RIVALS) ? RIVALS : [];

/** Bring any stored/partial choice back into the valid ranges. */
function normalize(o = {}) {
  const startCash = CASH_PRESETS.includes(o.startCash) ? o.startCash : DEFAULT_CASH;
  const players = [2, 3, 4].includes(o.players) ? o.players : DEFAULTS.players;
  const ids = new Set(rivalList.map((r) => r.id));
  const picked = Array.isArray(o.picked) ? [...new Set(o.picked.filter((id) => ids.has(id)))].slice(-(players - 1)) : [];
  const goal = Math.max(minGoalFor(startCash), clampGoal(o.goal ?? DEFAULT_GOAL));
  const maxRounds = ROUND_OPTIONS.includes(o.maxRounds) ? o.maxRounds : DEFAULT_ROUNDS;
  const speed = SPEEDS.some((s) => s.value === o.speed) ? o.speed : 'normal';
  const dice = DICE_MODES.includes(o.dice) ? o.dice : DEFAULT_DICE;
  const auctionOnDecline = typeof o.auctionOnDecline === 'boolean' ? o.auctionOnDecline : DEFAULT_AUCTION_ON_DECLINE;
  return { players, picked, goal, maxRounds, startCash, dice, auctionOnDecline, speed };
}

function loadSetup() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    return normalize(raw ? JSON.parse(raw) : DEFAULTS);
  } catch {
    return normalize(DEFAULTS);
  }
}

/** Difficulty hint from the bot's greed (0.7 = careful ... 1.4 = reckless); Medium when unknown. */
function rivalStyle(r) {
  const g = Number(r?.bot?.greed);
  if (!Number.isFinite(g)) return { level: 2, label: 'Medium' };
  if (g < 0.95) return { level: 1, label: 'Easy · Cautious' };
  if (g < 1.2) return { level: 2, label: 'Medium · Balanced' };
  return { level: 3, label: 'Hard · Aggressive' };
}

function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export default function PlaySetup() {
  const navigate = useNavigate();
  const [profile] = useProfile();
  const [form, setForm] = useState(loadSetup);
  const { players, picked, goal, maxRounds, startCash, dice, auctionOnDecline, speed } = form;
  const seats = players - 1;

  useEffect(() => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(form));
    } catch {
      /* private mode: choices just won't be remembered */
    }
  }, [form]);

  const patch = (p) => setForm((f) => normalize({ ...f, ...p }));

  const togglePick = (id) => {
    setForm((f) => {
      const cap = f.players - 1;
      if (f.picked.includes(id)) return { ...f, picked: f.picked.filter((x) => x !== id) };
      return { ...f, picked: [...f.picked, id].slice(-cap) };
    });
  };

  const randomise = () => {
    playSfx('card');
    setForm((f) => ({ ...f, picked: sample(rivalList, f.players - 1).map((r) => r.id) }));
  };

  const byId = useMemo(() => new Map(rivalList.map((r) => [r.id, r])), []);
  const pickedRivals = picked.map((id) => byId.get(id)).filter(Boolean);
  const emptySeats = Math.max(0, seats - pickedRivals.length);
  const minGoal = minGoalFor(startCash);
  const settings = { goal, startCash, maxRounds, dice, auctionOnDecline };

  const start = () => {
    const chosen = [...pickedRivals];
    if (chosen.length < seats) {
      const pool = rivalList.filter((r) => !picked.includes(r.id));
      chosen.push(...sample(pool, seats - chosen.length));
    }
    const config = {
      players: [
        { id: 'me', name: profile.name, avatar: profile.avatar, isBot: false },
        ...chosen.map((r, i) => ({ id: `bot${i + 1}`, name: r.name, avatar: r.avatar, isBot: true, bot: r.bot })),
      ],
      settings: { goal, startCash, maxRounds, dice, auctionOnDecline },
      seed: Date.now(),
      speed,
    };
    navigate('/game/offline', { state: { config } });
  };

  return (
    <div className="hh-setup">
      <PageHeader back="/" title="Your table, your rules" subtitle="Pick a rival. Set the stakes. Chalo, let's play." icon="dice" />

      <div className="hh-setup__grid">
        <div className="hh-setup__left">
          {/* ---------- players + lineup ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-pl-h">
            <h2 id="hh-pl-h" className="hh-h2">
              Players
            </h2>
            <Segmented
              label="Number of players, including you"
              value={players}
              onChange={(v) => patch({ players: v })}
              options={[
                { value: 2, label: '2', sub: 'Duel' },
                { value: 3, label: '3', sub: 'Classic' },
                { value: 4, label: '4', sub: 'Full table' },
              ]}
            />
            <ul className="hh-lineup" aria-label="Lineup">
              <li className="hh-seat hh-seat--me">
                <span className="hh-seat__face">
                  <Avatar preset={profile.avatar} size={52} />
                </span>
                <span className="hh-seat__name">You</span>
              </li>
              {pickedRivals.map((r) => (
                <li key={r.id} className="hh-seat">
                  <button type="button" className="hh-seat__btn" onClick={() => togglePick(r.id)} aria-label={`Remove ${r.name}`}>
                    <span className="hh-seat__face">
                      <Avatar preset={r.avatar} size={52} />
                    </span>
                    <span className="hh-seat__x" aria-hidden="true">
                      <Icon name="close" size={12} strokeWidth={3.2} />
                    </span>
                  </button>
                  <span className="hh-seat__name">{r.name}</span>
                </li>
              ))}
              {Array.from({ length: emptySeats }, (_, i) => (
                <li key={`e${i}`} className="hh-seat hh-seat--empty">
                  <span className="hh-seat__face" aria-hidden="true">
                    ?
                  </span>
                  <span className="hh-seat__name">Random</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- rivals ---------- */}
          <section className="hh-card hh-block" aria-labelledby="hh-rv-h">
            <div className="hh-card__head">
              <h2 id="hh-rv-h" className="hh-h2">
                Choose rivals
              </h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={randomise}>
                <Icon name="dice" size={16} /> Random
              </button>
            </div>
            <p className="hh-muted hh-block__note" id="hh-rv-note">
              Pick {seats} rival{seats > 1 ? 's' : ''}. Empty seats are filled at random when you start.
            </p>
            {rivalList.length === 0 ? (
              <p className="hh-muted">Rivals are loading. You can still start; opponents will be chosen automatically.</p>
            ) : (
              <ul className="hh-rivals" aria-describedby="hh-rv-note">
                {rivalList.map((r) => {
                  const on = picked.includes(r.id);
                  const st = rivalStyle(r);
                  return (
                    <li key={r.id}>
                      <button type="button" className={`hh-rival ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => togglePick(r.id)}>
                        <span className="hh-rival__face">
                          <Avatar preset={r.avatar} size={56} />
                        </span>
                        <span className="hh-rival__text">
                          <span className="hh-rival__name">{r.name}</span>
                          <span className="hh-rival__tag">{r.tagline}</span>
                          <span className="hh-rival__meta" aria-label={`Difficulty: ${st.label}`}>
                            <span className="hh-pips" aria-hidden="true">
                              {[1, 2, 3].map((n) => (
                                <i key={n} className={n <= st.level ? 'is-on' : ''} />
                              ))}
                            </span>
                            {st.label}
                          </span>
                        </span>
                        <span className="hh-rival__check" aria-hidden="true">
                          <Icon name="check" size={14} strokeWidth={3.4} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- settings + start ---------- */}
        <div className="hh-setup__right">
          <section className="hh-card hh-block hh-gs" aria-labelledby="hh-gs-h">
            <h2 id="hh-gs-h" className="hh-h2">
              Game settings
            </h2>

            <div className="hh-gs__group" role="radiogroup" aria-labelledby="hh-goal-l" onKeyDown={radioKeyNav}>
              <p id="hh-goal-l" className="hh-gs__label">
                <Icon name="target" size={16} /> Winning target <small>net worth</small>
              </p>
              <div className="hh-chips">
                {GOAL_PRESETS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={goal === g}
                    disabled={g < minGoal}
                    className={`hh-optchip ${goal === g ? 'is-on' : ''}`}
                    onClick={() => patch({ goal: g })}
                  >
                    <b>{formatINR(g)}</b>
                    <small>{GOAL_HINT[g]}</small>
                  </button>
                ))}
              </div>
              <GoalStepper value={goal} min={minGoal} max={GOAL_MAX} onChange={(g) => patch({ goal: g })} />
            </div>

            <div className="hh-gs__group">
              <p id="hh-rounds-l" className="hh-gs__label">
                <Icon name="clock" size={16} /> Rounds
              </p>
              <Segmented label="Round limit" value={maxRounds} onChange={(v) => patch({ maxRounds: v })} options={ROUND_LABELS} />
              <p className="hh-gs__help">One round = every player plays once. When the rounds run out, the richest player wins.</p>
            </div>

            <details className="hh-table-rules">
              <summary><span><Icon name="gear" size={16} /> More table rules</span><Icon name="chevR" size={16} /></summary>
            <div className="hh-gs__group" role="radiogroup" aria-labelledby="hh-cash-l" onKeyDown={radioKeyNav}>
              <p id="hh-cash-l" className="hh-gs__label">
                <Icon name="rupee" size={16} /> Start cash
              </p>
              <div className="hh-chips">
                {CASH_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={startCash === c}
                    disabled={c + 5000 > goal}
                    className={`hh-optchip hh-optchip--sm ${startCash === c ? 'is-on' : ''}`}
                    onClick={() => patch({ startCash: c })}
                  >
                    <b>{formatINR(c)}</b>
                  </button>
                ))}
              </div>
            </div>

            <div className="hh-gs__group">
              <p id="hh-dice-l" className="hh-gs__label">
                <Icon name="dice" size={16} /> Single die · roll style
              </p>
              <Segmented label="Dice mode" value={dice} onChange={(v) => patch({ dice: v })} options={DICE_OPTIONS} />
              <p className="hh-gs__help">One die, six faces. Fair gives every face an equal chance; Lucky gently helps the player behind.</p>
            </div>

            <div className="hh-gs__group hh-gs__group--switch">
              <Toggle
                icon={<Icon name="building" size={20} />}
                label="Auction when a player skips a property"
                hint="Skipped tiles go to a sealed-bid auction, so everyone can bid."
                checked={auctionOnDecline}
                onChange={(v) => patch({ auctionOnDecline: v })}
              />
            </div>

            <div className="hh-gs__group">
              <p id="hh-speed-l" className="hh-gs__label">
                <Icon name="bolt" size={16} /> Game speed
              </p>
              <Segmented label="Game speed" value={speed} onChange={(v) => patch({ speed: v })} options={SPEEDS} size="sm" />
            </div>
            </details>

            <p className="hh-gs__summary" aria-live="polite">
              <Icon name="sparkle" size={16} /> <span>{settingsSummary(settings)}</span>
            </p>
          </section>

          <div className="hh-startbar">
            <p className="hh-startbar__info">
              <b>You + {seats} rival{seats > 1 ? 's' : ''}</b>
              <span>
                {compactINR(goal)} goal · {maxRounds === null ? 'unlimited' : `${maxRounds} rounds`} · {compactINR(startCash)} start
              </span>
            </p>
            <button type="button" className="btn btn--primary btn--lg hh-startbar__go" onClick={start}>
              <Icon name="play" size={18} /> Start game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
