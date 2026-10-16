// Game over: confetti (CSS only), podium, headline, reason, stats, rewards, Play again / Home.
import { Avatar } from '@/components/art/index.js';
import { formatINR } from '@shared/format.js';
import Sheet from './ui/Sheet.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import Pill from './ui/Pill.jsx';
import Confetti from './ui/Confetti.jsx';
import { ordinal, useHeld } from './ui/helpers.js';

function reasonLine(result, goal) {
  switch (result.reason) {
    case 'rounds': return 'Round limit reached: richest player wins';
    case 'net_worth': return `Reached ${formatINR(goal)} first`;
    case 'last_standing': return 'Last player standing';
    default: return '';
  }
}

export default function GameOverModal({ session, onExit, rewards }) {
  const result = useHeld(session.result);
  const open = !!session.result;
  const goal = session.display?.goal ?? session.view?.cfg?.goal ?? 0;

  let content = null;
  let won = false;
  if (result) {
    const rows = [...(result.standings || [])].sort((a, b) => a.rank - b.rank);
    const meRow = rows.find((r) => r.id === session.me);
    const rank = result.me?.rank ?? meRow?.rank ?? rows.length;
    won = !!(result.me?.won ?? rank === 1);
    const winner = rows.find((r) => r.id === result.winner) || rows[0];
    const rounds = result.rounds ?? session.view?.round;
    const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
    const rest = rows.slice(3);
    const reason = reasonLine(result, goal);

    content = (
      <>
        <div className="hg-over-head">
          <span className={`hg-over-trophy${won ? ' is-won' : ''}`}><Icon name="trophy" size={34} /></span>
          <h2 className="hg-over-title">{won ? 'You won!' : `You finished ${ordinal(rank)}`}</h2>
          {!won && winner ? <p className="hg-over-sub">{winner.name} wins the game</p> : null}
          {reason ? <p className="hg-over-reason">{reason}</p> : null}
          {rounds != null ? <p className="hg-over-rounds">Rounds played: {rounds}</p> : null}
        </div>

        <ol className={`hg-podium n${podium.length}`} aria-label="Final standings">
          {podium.map((r) => (
            <li key={r.id} className={`hg-pod p${r.rank}${r.id === session.me ? ' is-me' : ''}`}>
              <span className="hg-pod-av">
                {r.rank === 1 ? <Icon name="crown" size={22} className="hg-pod-crown" /> : null}
                <Avatar preset={r.avatar} size={r.rank === 1 ? 64 : 52} />
              </span>
              <b className="hg-pod-name">{r.name}</b>
              <span className="hg-pod-worth">{formatINR(r.worth)}</span>
              <span className="hg-pod-block"><i>{r.rank}</i></span>
            </li>
          ))}
        </ol>

        {rest.length ? (
          <ol className="hg-over-rest" start={4}>
            {rest.map((r) => (
              <li key={r.id} className={r.id === session.me ? 'is-me' : ''}>
                <span className="hg-over-rank">{r.rank}</span>
                <Avatar preset={r.avatar} size={30} />
                <b>{r.name}</b>
                <span>{formatINR(r.worth)}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <dl className="hg-stats hg-over-stats">
          <div><dt>Net worth</dt><dd className="is-good">{formatINR(result.me?.worth ?? meRow?.worth ?? 0)}</dd></div>
          <div><dt>Rent earned</dt><dd>{formatINR(result.me?.rentEarned ?? 0)}</dd></div>
          <div><dt>Properties</dt><dd>{result.me?.propertiesBought ?? 0}</dd></div>
        </dl>

        {rewards ? (
          <div className="hg-rewards" aria-label="Rewards">
            <Pill tone="gold" icon={<Icon name="spark" size={14} />}>+{rewards.xpGained ?? 0} XP</Pill>
            <Pill tone="gold" icon={<Icon name="coin" size={14} />}>+{rewards.coinsGained ?? 0} coins</Pill>
            {rewards.leveledUp ? <Pill tone="good" pulse>Level up{rewards.level ? `! Lv ${rewards.level}` : '!'}</Pill> : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Sheet
      open={open}
      dismissible={false}
      variant="dialog"
      ariaLabel="Game over"
      className="hg-over"
      behind={won && open ? <Confetti /> : null}
      footer={result ? (
        <div className="hg-over-actions">
          <Button variant="ghost" onClick={() => onExit?.()} icon={<Icon name="home" size={20} />}>Home</Button>
          <Button variant="gold" size="lg" onClick={() => session.restart?.()} icon={<Icon name="refresh" size={20} />}>
            Play again
          </Button>
        </div>
      ) : null}
    >
      {content}
    </Sheet>
  );
}
