// Story-mode campaign: chapter cards. Rendered by the hub at paths.extra(GAME_ID, 'campaign').
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '@shared/format.js';
import { Scene } from '@/components/art/index.js';
import { CHAPTERS } from '@/data/campaign.js';
import { RIVALS } from '@/data/story.js';
import PageHeader from '@/components/shell/PageHeader.jsx';
import { Icon } from '@/components/shell/icons.jsx';
import { AvatarRing, Coins, fmtNum } from '@/components/shell/ui.jsx';
import { useCampaign, useProfile } from '@/components/shell/stores.js';
import { paths } from '@/platform/paths.js';
import { GAME_ID } from './constants.js';
import { roundsLabel, DEFAULT_ROUNDS } from './settings.js';
import './tycoon.css';

const chapters = Array.isArray(CHAPTERS) ? CHAPTERS : [];
const rivalMap = new Map((Array.isArray(RIVALS) ? RIVALS : []).map((r) => [r.id, r]));

/** Build the offline-game config for a chapter (chapter keeps its own settings; maxRounds only if it defines one). */
function chapterConfig(chapter, profile) {
  const rivals = (chapter.rivals || []).map((id) => rivalMap.get(id)).filter(Boolean);
  return {
    players: [
      { id: 'me', name: profile.name, avatar: profile.avatar, isBot: false },
      ...rivals.map((r, i) => ({ id: `bot${i + 1}`, name: r.name, avatar: r.avatar, isBot: true, bot: r.bot })),
    ],
    settings: { ...chapter.settings },
    seed: Date.now(),
  };
}

export default function Campaign() {
  const navigate = useNavigate();
  const [profile] = useProfile();
  const campaign = useCampaign();

  const state = useMemo(() => {
    const done = new Set(campaign.completed);
    let next = -1;
    const items = chapters.map((c, i) => {
      const completed = done.has(c.id);
      const unlocked = i === 0 || i + 1 <= campaign.unlocked || done.has(chapters[i - 1]?.id) || completed;
      if (next < 0 && unlocked && !completed) next = i;
      return { c, i, completed, unlocked };
    });
    return { items, next, doneCount: items.filter((x) => x.completed).length };
  }, [campaign]);

  const total = chapters.length;
  const pct = total ? (state.doneCount / total) * 100 : 0;

  return (
    <div className="hh-campaign">
      <PageHeader back={paths.game(GAME_ID)} title="Story Mode" te="స్టోరీ మోడ్" subtitle="Rise from the Miyapur Metro to the heights of Banjara Hills." icon="map" />

      <section className="hh-card hh-camp-progress" aria-label="Campaign progress">
        <div>
          <p className="hh-camp-progress__title">
            <Icon name="trophy" size={18} /> {state.doneCount} of {total} chapters complete
          </p>
          <div className="hh-xp__track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.doneCount} aria-label="Chapters completed">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {total === 0 ? (
        <p className="hh-muted">Chapters are on their way. Check back soon.</p>
      ) : (
        <ol className="hh-chapters">
          {state.items.map(({ c, i, completed, unlocked }) => {
            const rivals = (c.rivals || []).map((id) => rivalMap.get(id)).filter(Boolean);
            const isNext = i === state.next;
            const s = c.settings || {};
            return (
              <li key={c.id} className={`hh-chapter ${completed ? 'is-done' : ''} ${!unlocked ? 'is-locked' : ''} ${isNext ? 'is-next' : ''}`}>
                <span className="hh-chapter__node" aria-hidden="true">
                  {completed ? <Icon name="check" size={18} strokeWidth={3.2} /> : !unlocked ? <Icon name="lock" size={16} /> : <b>{i + 1}</b>}
                </span>
                <article className="hh-card hh-chapter__card" aria-labelledby={`hh-ch-${c.id}`}>
                  <div className="hh-chapter__thumb" aria-hidden="true">
                    <span className="hh-chapter__scene">
                      <Scene name={c.scene || 'night'} />
                    </span>
                    <span className="hh-chapter__shade" />
                    {isNext && <span className="hh-ribbon">Next up</span>}
                    {completed && (
                      <span className="hh-ribbon hh-ribbon--done">
                        <Icon name="star" size={12} /> Cleared
                      </span>
                    )}
                    {!unlocked && (
                      <span className="hh-chapter__lock">
                        <Icon name="lock" size={28} />
                      </span>
                    )}
                  </div>
                  <div className="hh-chapter__body">
                    <p className="hh-chapter__num">Chapter {i + 1}</p>
                    <h2 id={`hh-ch-${c.id}`} className="hh-chapter__title">
                      {c.title}
                    </h2>
                    {c.te && (
                      <p className="hh-chapter__te" lang="te">
                        {c.te}
                      </p>
                    )}
                    <p className="hh-chapter__blurb">{c.blurb}</p>

                    <ul className="hh-chapter__facts">
                      <li>
                        <Icon name="target" size={15} /> Target <b>{formatINR(s.goal)}</b>
                      </li>
                      <li>
                        <Icon name="rupee" size={15} /> Start <b>{formatINR(s.startCash)}</b>
                      </li>
                      <li>
                        <Icon name="clock" size={15} /> <b>{roundsLabel(s.maxRounds === undefined ? DEFAULT_ROUNDS : s.maxRounds)}</b>
                      </li>
                    </ul>

                    <div className="hh-chapter__foot">
                      <div className="hh-chapter__rivals" aria-label={`Rivals: ${rivals.map((r) => r.name).join(', ') || 'none'}`}>
                        {rivals.map((r) => (
                          <span key={r.id} className="hh-chapter__rival" title={r.name}>
                            <AvatarRing preset={r.avatar} size={38} tone="dim" />
                          </span>
                        ))}
                      </div>
                      <div className="hh-chapter__reward" aria-label="Reward">
                        <span className="hh-pill hh-pill--gold">
                          <Icon name="bolt" size={13} /> {fmtNum(c.reward?.xp)} XP
                        </span>
                        <Coins value={c.reward?.coins} size={18} />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn btn--block ${completed ? 'btn--ghost' : 'btn--primary'}`}
                      disabled={!unlocked}
                      onClick={() => navigate(paths.offline(GAME_ID), { state: { config: chapterConfig(c, profile), chapterId: c.id } })}
                    >
                      {!unlocked ? (
                        <>
                          <Icon name="lock" size={18} /> Complete chapter {i} to unlock
                        </>
                      ) : completed ? (
                        <>
                          <Icon name="refresh" size={18} /> Replay
                        </>
                      ) : (
                        <>
                          <Icon name="play" size={16} /> Play chapter
                        </>
                      )}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
