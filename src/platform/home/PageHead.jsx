/** Title block for the hub pages (Rank, Profile). */
export default function PageHead({ title, sub, icon, actions, id = 'hh2-title' }) {
  return (
    <header className="hh2-pagehead">
      {icon && (
        <span className="hh2-pagehead__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="hh2-pagehead__text">
        <h1 id={id} className="hub-h1">
          {title}
        </h1>
        {sub && <p className="hub-lead">{sub}</p>}
      </div>
      {actions && <div className="hh2-pagehead__actions">{actions}</div>}
    </header>
  );
}
