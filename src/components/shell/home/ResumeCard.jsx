import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '@shared/format.js';
import { Avatar } from '@/components/art/index.js';
import { Icon } from '../icons.jsx';
import Modal from '../Modal.jsx';
import { safeClearGame, safeLoadGame } from '../stores.js';

/** "Resume game" card, shown only when an unfinished offline game is saved. */
export default function ResumeCard() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => {
    const g = safeLoadGame();
    return g && g.state?.phase !== 'over' && !g.state?.winner ? g : null;
  });
  const [confirm, setConfirm] = useState(false);
  if (!saved) return null;

  const st = saved.state;
  const players = Array.isArray(st.players) ? st.players : [];
  const me = players.find((p) => !p.isBot) || players[0];
  const goal = st.cfg?.goal;
  const rounds = st.cfg?.maxRounds;

  return (
    <section className="hh-card hh-resume" aria-labelledby="hh-resume-h">
      <div className="hh-resume__main">
        <div className="hh-resume__faces" aria-hidden="true">
          {players.slice(0, 4).map((p) => (
            <span key={p.id} className="hh-resume__face" style={{ '--pc': p.color || 'var(--gold)' }}>
              <Avatar preset={Number(p.avatar) || 0} size={38} />
            </span>
          ))}
        </div>
        <div className="hh-resume__text">
          <h2 id="hh-resume-h" className="hh-h2">
            Game in progress
          </h2>
          <p className="hh-resume__meta">
            Round {st.round ?? 1}
            {rounds ? ` / ${rounds}` : ''}
            {goal ? ` · Target ${formatINR(goal)}` : ''}
            {me && typeof me.cash === 'number' ? ` · You ${formatINR(me.cash)}` : ''}
          </p>
        </div>
      </div>
      <div className="hh-resume__actions">
        <button type="button" className="btn btn--primary" onClick={() => navigate('/game/offline')}>
          <Icon name="play" size={16} /> Resume
        </button>
        <button type="button" className="hh-iconbtn" onClick={() => setConfirm(true)} aria-label="Discard saved game">
          <Icon name="trash" size={19} />
        </button>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Discard this game?"
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)} data-autofocus>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                safeClearGame();
                setSaved(null);
                setConfirm(false);
              }}
            >
              Discard
            </button>
          </>
        }
      >
        <p>Your unfinished game will be deleted. This cannot be undone.</p>
      </Modal>
    </section>
  );
}
