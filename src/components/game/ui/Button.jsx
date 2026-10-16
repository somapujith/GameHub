// Game button: 44px+ touch target, tone variants, optional click sound.
import { sfx } from '@/lib/sfx.js';

/**
 * variant: gold | green | blue | rose | ghost | dark
 * size: sm | md | lg
 */
export default function Button({
  variant = 'ghost', size = 'md', block = false, icon = null, className = '', children, onClick, sound = 'click', type = 'button', ...rest
}) {
  const handle = (e) => {
    if (sound) {
      try { sfx.play(sound); } catch { /* sound is optional */ }
    }
    onClick?.(e);
  };
  return (
    <button
      type={type}
      className={`hg-btn hg-btn--${variant} hg-btn--${size}${block ? ' is-block' : ''} ${className}`}
      onClick={handle}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
