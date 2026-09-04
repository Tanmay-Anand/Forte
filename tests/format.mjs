// Plain-JS mirror of trimNumber from src/lib/format.ts so the formatting rules
// can be tested with `node --test` without a React Native toolchain.
export function trimNumber(n, maxDecimals = 2) {
  if (!Number.isFinite(n)) return '0';
  const fixed = n.toFixed(maxDecimals);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}
