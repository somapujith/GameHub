import { CatIcon } from './GameArt.jsx';

/** "All" + one chip per category that has games. Toggle buttons (aria-pressed), one active at a time. */
export default function CategoryChips({ cats, value, onChange }) {
  return (
    <div className="hub-row hub-row--tight hh2-chiprow" role="group" aria-label="Filter games by category">
      <button type="button" className={`hub-chip ${value === 'all' ? 'is-on' : ''}`} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        All
      </button>
      {cats.map((c) => (
        <button key={c.id} type="button" className={`hub-chip ${value === c.id ? 'is-on' : ''}`} aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <CatIcon cat={c} size={18} />
          {c.label}
        </button>
      ))}
    </div>
  );
}
