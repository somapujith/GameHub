// Currency helpers. All money in the game is whole rupees (integers).
const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹70,000 / ₹1,50,000 (Indian digit grouping). */
export function formatINR(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '-' : ''}₹${IN.format(Math.abs(v))}`;
}

const trim = (x) => {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** ₹500, ₹1.2k, ₹5k, ₹70k, ₹1.5L — used on tight board tiles. */
export function compactINR(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  const sign = n < 0 ? '-' : '';
  if (v >= 100000) return `${sign}₹${trim(v / 100000)}L`;
  if (v >= 1000) return `${sign}₹${trim(v / 1000)}k`;
  return `${sign}₹${v}`;
}
