// CSS-only confetti. `count` pieces fall once or forever (`loop`). Hidden for reduced motion via game.css.
const COLORS = ['#ffc857', '#ff5d73', '#3ddc97', '#4cc9f0', '#b794f6', '#ff9f43', '#ffffff'];

export default function Confetti({ count = 44, loop = true, className = '' }) {
  return (
    <div className={`hg-confetti ${loop ? '' : 'is-once'} ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i
          key={i}
          style={{
            '--x': `${(i * 37 + 11) % 100}%`,
            '--d': `${(i % 11) * 0.12}s`,
            '--t': `${2.4 + (i % 5) * 0.5}s`,
            '--r': `${(i * 67) % 360}deg`,
            '--s': `${6 + (i % 4) * 2}px`,
            '--sway': `${((i % 7) - 3) * 14}px`,
            background: COLORS[i % COLORS.length],
          }}
        />
      ))}
    </div>
  );
}
