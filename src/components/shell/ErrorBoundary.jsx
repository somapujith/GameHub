import { Component } from 'react';
import { Icon } from './icons.jsx';

const CHUNK_RE = /dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically/i;

/** Catches render errors under it and shows a friendly retry screen. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset() {
    const stale = CHUNK_RE.test(String(this.state.error?.message || ''));
    if (stale) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = CHUNK_RE.test(String(error?.message || ''));
    return (
      <div className={`hh-error ${this.props.fullscreen ? 'hh-error--full' : ''}`} role="alert">
        <div className="hh-error__card card">
          <span className="hh-error__icon">
            <Icon name="refresh" size={30} />
          </span>
          <h1 className="hh-error__title">{stale ? 'A fresh version is ready' : 'Oops, the auto broke down'}</h1>
          <p className="hh-error__text">
            {stale
              ? 'The game was updated while you were away. Reload to pick up the new version.'
              : 'Something unexpected went wrong on this screen. Your progress is safe. Give it another go.'}
          </p>
          <div className="row hh-error__actions">
            <button type="button" className="btn btn--primary" onClick={this.reset}>
              <Icon name="refresh" size={18} /> {stale ? 'Reload' : 'Try again'}
            </button>
            <a className="btn btn--ghost" href="/">
              <Icon name="home" size={18} /> Home
            </a>
          </div>
          {import.meta.env?.DEV && <pre className="hh-error__detail">{String(error?.message || error)}</pre>}
        </div>
      </div>
    );
  }
}
