import { memo, useEffect, useRef, useState } from 'react';
import { GROUPS, LEVEL_NAMES, TILES } from '@shared/board.js';
import { CenterArt } from '@/components/art/index.js';
import Dice, { LuckyBadge } from './Dice.jsx';
import '@/styles/board.css';

const WELCOME = { id: 'welcome', tone: 'cheer', text: 'Kya bolte, miyaan? Your city. Your empire.' };

/** Keeps the previous bubble around for the exit animation when the message clears. */
function useLeavingBubble(current) {
  const [leaving, setLeaving] = useState(null);
  const last = useRef(null);
  useEffect(() => {
    if (current) {
      last.current = current;
      setLeaving(null);
      return undefined;
    }
    if (!last.current) return undefined;
    setLeaving(last.current);
    last.current = null;
    const t = setTimeout(() => setLeaving(null), 260);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  return current ? null : leaving;
}

const BubbleView = memo(function BubbleView({ bubble, out = false }) {
  const tone = bubble.tone || 'info';
  const m = /^(You)\b([\s\S]*)$/.exec(bubble.text || '');
  return (
    <div className={`hb-bubble hb-bubble--${tone}${out ? ' is-out' : ''}`}>
      <span className="hb-bubble__text">
        {m ? (
          <>
            <b className="hb-bubble__you">{m[1]}</b>
            {m[2]}
          </>
        ) : (
          bubble.text
        )}
      </span>
    </div>
  );
});

function CenterStageImpl({ session, odds }) {
  const d = session?.display || session?.view || {};
  const players = d.players || [];
  const owners = d.owners || [];
  const levels = d.levels || [];
  const turnPlayer = players[d.turn];
  const isMe = !!turnPlayer && turnPlayer.id === session?.me;

  const tile = TILES[session?.stageTile ?? 0] || TILES[0];
  const level = levels[tile.id] || 0;
  const owner = owners[tile.id] != null ? players.find((p) => p.id === owners[tile.id]) : null;
  const group = tile.group ? GROUPS[tile.group] : null;
  const color = owner?.color || group?.color;

  const nobodyActed = !session?.bubble && !(session?.log && session.log.length);
  let bubble = session?.bubble || null;
  if (!bubble && nobodyActed) bubble = WELCOME;
  if (!bubble && turnPlayer) {
    bubble = {
      id: `idle-${turnPlayer.id}-${d.round}-${session?.options?.roll ? 'r' : 'w'}`,
      tone: 'info',
      text: session?.options?.roll ? 'Your turn, miyaan. Hit Roll below!' : isMe ? 'Your move…' : `${turnPlayer.name} is playing…`,
    };
  }
  const leaving = useLeavingBubble(bubble);

  const over = d.phase === 'over';
  const round = d.round || 1;
  const maxRounds = d.cfg ? d.cfg.maxRounds : undefined;
  const finalRound = !over && typeof maxRounds === 'number' && round >= maxRounds;
  // "Round 7 / 30", "Round 7 · ∞" (unlimited = null), or plain "Round 7" when cfg is unknown
  let roundText = `Round ${round}`;
  if (typeof maxRounds === 'number') roundText += ` / ${maxRounds}`;
  else if (d.cfg && maxRounds === null) roundText += ' · ∞';
  const roundLabel = finalRound ? `Round ${round} of ${maxRounds}, final round` : roundText;
  const caption = tile.type === 'property' && level > 0 ? `${tile.short} · ${LEVEL_NAMES[level]}` : tile.short;

  return (
    <div className="hb-stage">
      <div className="hb-stage__panel">
        <div className="hb-stage__inner">
          <div className="hb-stage__top">
            <div className="hb-turn" title={turnPlayer ? `${turnPlayer.name}'s turn` : undefined}>
              {turnPlayer && <span className="hb-turn__dot" style={{ '--c': turnPlayer.color }} />}
              <span className="hb-turn__name">{turnPlayer ? (isMe ? 'You' : turnPlayer.name) : '—'}</span>
              <span className="hb-turn__chip">{over ? 'Final' : 'Turn'}</span>
            </div>
            <span className={`hb-round${finalRound ? ' is-final' : ''}`} title={roundLabel} aria-label={roundLabel}>
              {finalRound ? 'Final round' : roundText}
            </span>
          </div>

          <div className="hb-bubble-slot" aria-live="polite">
            {leaving && <BubbleView key={`out-${leaving.id ?? leaving.text}`} bubble={leaving} out />}
            {bubble && <BubbleView key={bubble.id ?? bubble.text} bubble={bubble} />}
          </div>

          <div className="hb-art">
            <div className="hb-art__fit" key={`${tile.id}-${level}`}>
              <div className="hb-art__box">
                <CenterArt tile={tile} level={level} color={color} size={240} />
              </div>
            </div>
            {odds?.showing ? (
              <span className="hb-art__legend" title="Chance that your next roll ends on each tile. The three likeliest are starred.">
                <span>Odds</span>
                <span className="hb-legend">
                  <small>low</small>
                  <i className="hb-legend__bar" />
                  <small>high</small>
                </span>
                <span className="hb-legend__total">Σ {Math.round((odds.total || 0) * 100)}%</span>
              </span>
            ) : (
              <span className="hb-art__caption">{caption}</span>
            )}
          </div>

          <div className="hb-stage__dice">
            <div className="hb-stage__side hb-stage__side--l">
              {odds?.available && (
                <button
                  type="button"
                  className={`hb-odds-btn${odds.on ? ' is-on' : ''}`}
                  aria-pressed={odds.on}
                  aria-label="Show landing odds for the next roll"
                  title="Show where your next roll is likely to land"
                  onClick={odds.onToggle}
                >
                  <span className="hb-odds-btn__ico" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="hb-odds-btn__txt">Odds</span>
                </button>
              )}
            </div>
            <Dice session={session} />
            <div className="hb-stage__side hb-stage__side--r">
              <LuckyBadge session={session} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CenterStage = memo(CenterStageImpl);
export default CenterStage;
