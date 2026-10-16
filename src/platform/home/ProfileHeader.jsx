import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AVATAR_PRESETS } from '@/components/art/index.js';
import { paths } from '@/platform/paths.js';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { errorMessage } from '@/lib/api.js';
import { CoinIcon } from '@/components/shell/icons.jsx';
import { fmtNum, radioKeyNav } from '@/components/shell/ui.jsx';
import { useToast } from '@/components/shell/Toast.jsx';
import { useAccount } from '@/components/shell/hooks.js';
import { levelInfo, pctOf, useProfile } from '@/components/shell/stores.js';
import Ava from './Ava.jsx';

const MAX_NAME = 20;

/** Avatar, name, level / XP bar and coins, with an inline editor for the name and avatar. */
export default function ProfileHeader() {
  const [profile, update] = useProfile();
  const { user, signedIn, guest, account, auth } = useAccount();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const inputId = useId();

  const name = (signedIn && user?.name) || profile.name;
  const avatar = signedIn && user?.avatar != null ? Number(user.avatar) : profile.avatar;
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  const li = levelInfo(profile.xp);
  const pct = pctOf(li);

  // The local profile is the source of truth offline; signed-in players also get it saved on the server.
  const sync = async (patch) => {
    if (!signedIn || typeof auth.updateProfile !== 'function') return;
    try {
      await auth.updateProfile(patch);
    } catch (e) {
      toast(`Saved on this device. ${errorMessage(e, 'Could not sync your profile.')}`, { tone: 'info' });
    }
  };

  const commitName = () => {
    const n = draft.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Guest';
    setDraft(n);
    if (n !== name) {
      update({ name: n });
      sync({ name: n });
    }
  };

  const pick = (id) => {
    if (id === avatar) return;
    update({ avatar: id });
    sync({ avatar: id });
  };

  const current = (AVATAR_PRESETS || []).find((a) => a.id === avatar);
  const status = account ? { text: 'Signed in', tone: 'good' } : guest ? { text: 'Guest account', tone: '' } : { text: 'Offline profile', tone: '' };

  return (
    <section className="hub-panel hh2-pro" aria-labelledby="hh2-pro-h">
      <div className="hh2-pro__top">
        <Ava preset={avatar} size={88} ring="var(--hh2-brand)" dot={account ? 'on' : undefined} />
        <div className="hh2-pro__id">
          <h2 id="hh2-pro-h" className="hh2-pro__name" title={name}>
            {name}
          </h2>
          <div className="hh2-pro__pills">
            <span className="hub-pill hub-pill--accent">Level {li.level}</span>
            <span className={`hub-pill${status.tone === 'good' ? ' hub-pill--good' : ''}`}>{status.text}</span>
          </div>
        </div>
        <button
          type="button"
          className={`hub-btn hub-btn--soft hub-btn--sm hh2-pro__edit ${open ? 'is-on' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${inputId}-edit`}
        >
          <HubIcon name={open ? 'check' : 'pencil'} size={16} /> {open ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="hh2-pro__stats">
        <div className="hh2-xp">
          <div className="hh2-xp__top">
            <span>
              <HubIcon name="bolt" size={14} /> Level {li.level}
            </span>
            <span>
              {fmtNum(li.into)} / {fmtNum(li.need)} XP
            </span>
          </div>
          <div className="hh2-xp__track" role="progressbar" aria-label="Experience to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="hh2-pro__coins" aria-label={`${fmtNum(profile.coins)} coins`}>
          <CoinIcon size={26} />
          <span>
            <b>{fmtNum(profile.coins)}</b>
            <small>Coins</small>
          </span>
        </div>
      </div>

      <div id={`${inputId}-edit`} className={`hh2-collapse ${open ? 'is-open' : ''}`}>
        <div className="hh2-collapse__inner" inert={!open}>
          <div className="hh2-pro__editor">
            <label className="hh2-field" htmlFor={inputId}>
              <span className="hh2-field__label">Display name</span>
              <input
                id={inputId}
                className="hh2-input"
                value={draft}
                maxLength={MAX_NAME}
                autoComplete="nickname"
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitName();
                    e.currentTarget.blur();
                  }
                }}
              />
            </label>
            <div className="hh2-field">
              <span className="hh2-field__label" id={`${inputId}-av`}>
                Avatar{current ? <b> {'·'} {current.label}</b> : null}
              </span>
              <div className="hh2-avgrid" role="radiogroup" aria-labelledby={`${inputId}-av`} onKeyDown={radioKeyNav}>
                {(AVATAR_PRESETS || []).map((a) => {
                  const on = a.id === avatar;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={a.label}
                      title={a.label}
                      tabIndex={on ? 0 : -1}
                      className={`hh2-avgrid__item ${on ? 'is-on' : ''}`}
                      onClick={() => pick(a.id)}
                    >
                      <Avatar preset={a.id} size={56} />
                      {on && (
                        <span className="hh2-avgrid__tick" aria-hidden="true">
                          <HubIcon name="check" size={12} strokeWidth={3.4} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {!signedIn && (
              <p className="hub-muted">
                Saved on this device.{' '}
                <Link to={paths.login(paths.profile())} className="hh2-textlink">
                  Sign in
                </Link>{' '}
                to keep your progress and play with friends.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
