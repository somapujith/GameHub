import { useNavigate } from 'react-router-dom';
import { Icon } from './icons.jsx';

/**
 * Page title block. `back`: true (history back, falling back to Home) or a path.
 * `te` is the optional Telugu sub-title, `actions` renders on the right.
 */
export default function PageHeader({ title, te, subtitle, back, eyebrow, actions, icon, id = 'hh-page-title' }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  return (
    <header className="hh-pageheader">
      {back && (
        <button type="button" className="hh-iconbtn hh-pageheader__back" onClick={goBack} aria-label="Back">
          <Icon name="chevL" size={22} />
        </button>
      )}
      {icon && (
        <span className="hh-pageheader__icon" aria-hidden="true">
          <Icon name={icon} size={26} />
        </span>
      )}
      <div className="hh-pageheader__text">
        {eyebrow && <p className="hh-pageheader__eyebrow">{eyebrow}</p>}
        <h1 id={id} className="hh-pageheader__title">
          {title}
          {te && (
            <span className="hh-pageheader__te" lang="te">
              {te}
            </span>
          )}
        </h1>
        {subtitle && <p className="hh-pageheader__sub">{subtitle}</p>}
      </div>
      {actions && <div className="hh-pageheader__actions">{actions}</div>}
    </header>
  );
}
