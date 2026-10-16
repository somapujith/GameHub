import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AVATAR_PRESETS } from '@/components/art/index.js';
import { Icon } from '../icons.jsx';
import { AvatarRing, Coins, XpBar, radioKeyNav } from '../ui.jsx';
import { apiPatch } from '../net.js';
import { levelInfo, pctOf, useProfile } from '../stores.js';
import { useAccount } from '../hooks.js';

const MAX_NAME = 16;

/** Profile summary with inline name + avatar editing, level / XP bar and coins. */
export default function ProfileCard({ defaultOpen = false, heading = 'Your profile' }) {
  const [profile, update] = useProfile();
  const { signedIn, guest, account, auth } = useAccount();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState(profile.name);
  const inputId = useId();
  const li = levelInfo(profile.xp);

  useEffect(() => setDraft(profile.name), [profile.name]);

  const syncRemote = (patch) => {
    if (!signedIn) return;
    Promise.resolve()
      .then(() => apiPatch('/api/me', patch))
      .then(() => auth.refresh?.())
      .catch(() => {
        /* best effort: the local profile is the source of truth offline */
      });
  };

  const commitName = () => {
    const n = draft.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Guest';
    setDraft(n);
    if (n !== profile.name) {
      update({ name: n });
      syncRemote({ name: n });
    }
  };

  const pick = (id) => {
    if (id === profile.avatar) return;
    update({ avatar: id });
    syncRemote({ avatar: id });
  };

  const current = AVATAR_PRESETS?.find((a) => a.id === profile.avatar);

  return (
    <section className="hh-card hh-profile" aria-labelledby={`${inputId}-h`}>
      <h2 id={`${inputId}-h`} className="sr-only">
        {heading}
      </h2>
      <div className="hh-profile__top">
        <AvatarRing preset={profile.avatar} size={72} tone="gold" className="hh-profile__avatar" />
        <div className="hh-profile__id">
          <p className="hh-profile__name" title={profile.name}>
            {profile.name}
          </p>
          <div className="hh-profile__badges">
            <span className="hh-pill hh-pill--gold">Lv {li.level}</span>
            {account && (
              <span className="hh-pill hh-pill--good">
                <i className="hh-dot hh-dot--on" /> Signed in
              </span>
            )}
            {guest && <span className="hh-pill">Guest account</span>}
            {!signedIn && <span className="hh-pill">Offline profile</span>}
          </div>
        </div>
        <button
          type="button"
          className={`hh-iconbtn hh-profile__edit ${open ? 'is-on' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`${inputId}-edit`}
          aria-label={open ? 'Close profile editor' : 'Edit name and avatar'}
        >
          <Icon name={open ? 'check' : 'pencil'} size={20} />
        </button>
      </div>

      <XpBar level={li.level} into={li.into} need={li.need} pct={pctOf(li)} />

      <div className="hh-profile__wallet">
        <span className="hh-profile__wallet-label">Coins</span>
        <Coins value={profile.coins} size={22} />
      </div>

      <div id={`${inputId}-edit`} className={`hh-collapse ${open ? 'is-open' : ''}`}>
        <div className="hh-collapse__inner" inert={!open}>
          <div className="hh-profile__edit-body">
            <label className="hh-field" htmlFor={inputId}>
              <span className="hh-field__label">Display name</span>
              <input
                id={inputId}
                className="hh-input"
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

            <div className="hh-field">
              <span className="hh-field__label">
                Avatar{current ? <b> · {current.label}</b> : null}
              </span>
              <div className="hh-avgrid" role="radiogroup" aria-label="Choose your avatar" onKeyDown={radioKeyNav}>
                {(AVATAR_PRESETS || []).map((a) => {
                  const on = a.id === profile.avatar;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={a.label}
                      title={a.label}
                      className={`hh-avgrid__item ${on ? 'is-on' : ''}`}
                      onClick={() => pick(a.id)}
                    >
                      <Avatar preset={a.id} size={52} />
                      {on && (
                        <span className="hh-avgrid__tick">
                          <Icon name="check" size={12} strokeWidth={3.4} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {!signedIn && (
              <p className="hh-profile__hint">
                Saved on this device.{' '}
                <Link to="/login?next=/settings" className="hh-link">
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
