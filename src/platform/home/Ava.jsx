import { Avatar } from '@/components/art/index.js';

/** Round avatar with an optional ring colour (CSS colour) and presence dot ('on' | 'off'). */
export default function Ava({ preset = 0, size = 48, ring, dot, className = '' }) {
  return (
    <span className={`hh2-ava ${className}`.trim()} style={{ '--sz': `${size}px`, ...(ring ? { '--ring': ring } : null) }}>
      <Avatar preset={Number(preset) || 0} size={size} />
      {dot && <i className={`hh2-ava__dot hh2-ava__dot--${dot}`} />}
    </span>
  );
}
