import Ava from './Ava.jsx';
import { fmtStat, statValue } from './gameStats.js';

/** One leaderboard row (rank 4 and below). `cols` are the stat definitions to show on the right. */
export default function RankRow({ row, cols, me }) {
  return (
    <li className={`hh2-lb__row ${me ? 'is-me' : ''}`}>
      <span className="hh2-lb__rank" aria-label={`Rank ${row.rank}`}>
        {row.rank}
      </span>
      <Ava preset={row.avatar} size={44} />
      <span className="hh2-lb__who">
        <b title={row.name}>
          {row.name}
          {me && <span className="hh2-you">You</span>}
        </b>
        <small>Level {row.level ?? 1}</small>
      </span>
      {cols.map((c) => (
        <span key={c.key} className="hh2-lb__stat">
          <b>{fmtStat(statValue(row, c.key), c)}</b>
          <small>{c.label}</small>
        </span>
      ))}
    </li>
  );
}
