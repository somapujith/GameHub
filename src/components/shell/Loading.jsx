import { BrandMark } from '@/components/art/index.js';

/** Branded loading screen (Suspense fallback). `inline` fills only its container. */
export default function Loading({ label = 'Loading…', inline = false }) {
  return (
    <div className={`hh-loading ${inline ? 'hh-loading--inline' : ''}`} role="status" aria-live="polite">
      <div className="hh-loading__mark">
        <span className="hh-loading__halo" aria-hidden="true" />
        <BrandMark size={72} />
      </div>
      <div className="hh-loading__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="hh-loading__label">{label}</p>
    </div>
  );
}
