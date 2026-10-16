import { HubMark } from './hubArt.jsx';

/** Hub loading state (Suspense fallback). `fullscreen` fills the viewport; otherwise it fills its container. */
export default function PageLoading({ label = 'Loading…', fullscreen = false }) {
  return (
    <div className={`hub-loading${fullscreen ? ' hub-loading--full' : ''}`} role="status" aria-live="polite">
      <span className="hub-loading__mark" aria-hidden="true">
        <HubMark size={56} />
      </span>
      <span className="hub-loading__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="hub-sr">{label}</span>
    </div>
  );
}
