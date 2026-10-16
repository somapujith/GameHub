import HubIcon from '@/platform/game/HubIcon.jsx';
import Ava from './Ava.jsx';
import { fmtStat, statValue } from './gameStats.js';

const MEDAL = ['#ffd24d', '#d9deea', '#e09a5b'];

/** Top three as a podium. DOM order is 1st, 2nd, 3rd (reading order); CSS places 1st in the middle. */
export default function Podium({ rows, cols, isMe }) {
  const top = rows.slice(0, 3);
  const [main, second] = cols;
  return (
    <ol className="hh2-podium" aria-label="Top three players">
      {top.map((r, i) => {
        const place = i + 1;
        const me = isMe(r);
        return (
          <li key={`${r.rank}-${r.name}`} className={`hh2-podium__slot hh2-podium__slot--${place} ${me ? 'is-me' : ''}`} style={{ '--mc': MEDAL[i] }}>
            <span className="hh2-podium__crown" aria-hidden="true">
              {place === 1 && <HubIcon name="crown" size={26} />}
            </span>
            <Ava preset={r.avatar} size={place === 1 ? 76 : 60} ring={MEDAL[i]} />
            <b className="hh2-podium__name" title={r.name}>
              {r.name}
            </b>
            {me && <span className="hh2-you">You</span>}
            <span className="hh2-podium__stat">
              <b>{fmtStat(statValue(r, main.key), main)}</b> {main.label.toLowerCase()}
            </span>
            {second && (
              <small className="hh2-podium__stat2">
                {fmtStat(statValue(r, second.key), second)} {second.label.toLowerCase()}
              </small>
            )}
            <span className="hh2-podium__block" aria-label={`Rank ${place}`}>
              <b>{place}</b>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
