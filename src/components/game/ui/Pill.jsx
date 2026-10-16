// Small status pill. tone: neutral | blue | good | bad | warn | gold | violet
export default function Pill({ tone = 'neutral', pulse = false, icon = null, className = '', children, ...rest }) {
  return (
    <span className={`hg-pill hg-pill--${tone}${pulse ? ' is-pulse' : ''} ${className}`} {...rest}>
      {icon}
      {children}
    </span>
  );
}
