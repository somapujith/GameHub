import '@/styles/online.css';

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** "Public" / "Private" pill for a room. */
export default function VisibilityBadge({ visibility }) {
  const pub = visibility === 'public';
  return (
    <span className={`ho-vis ho-vis--${pub ? 'public' : 'private'}`}>
      {pub ? <GlobeIcon /> : <LockIcon />}
      {pub ? 'Public' : 'Private'}
    </span>
  );
}
