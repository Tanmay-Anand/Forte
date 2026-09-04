/** Number and unit formatting. Storage is always kg; pounds is display only. */

export type Unit = 'kg' | 'lb';

const LB_PER_KG = 2.2046226218;

export function toDisplayWeight(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

/**
 * Trims trailing zeroes: 62.5 -> "62.5", 60.0 -> "60", 10 -> "10".
 *
 * Only strips AFTER a decimal point. Stripping unconditionally turns 10 into
 * "1" and 0 into "" — which is exactly what it did until a skipped set put a
 * zero on screen and exposed it.
 */
export function trimNumber(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return '0';
  const fixed = n.toFixed(maxDecimals);
  if (!fixed.includes('.')) return fixed;
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

export function formatWeight(kg: number, unit: Unit, withUnit = true): string {
  const v = trimNumber(toDisplayWeight(kg, unit), unit === 'kg' ? 2 : 1);
  return withUnit ? `${v} ${unit}` : v;
}

/** 6850 -> "6,850" */
export function formatVolume(kg: number, unit: Unit, withUnit = true): string {
  const v = Math.round(toDisplayWeight(kg, unit));
  const s = v.toLocaleString('en-US');
  return withUnit ? `${s} ${unit}` : s;
}

export type Delta = { text: string; direction: 'up' | 'down' | 'flat' };

/**
 * Signed percentage plus a direction. The caller draws an arrow icon from the
 * direction — this returns no glyph characters, because the app renders
 * iconography as vectors rather than as text (see src/ui/Icon.tsx).
 *
 * Direction is also what keeps colour from being the only signal.
 */
export function formatDelta(current: number, previous: number): Delta {
  if (previous <= 0 || current === previous) {
    return { text: '', direction: 'flat' };
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 0;
  return { text: `${up ? '+' : ''}${pct.toFixed(1)}%`, direction: up ? 'up' : 'down' };
}

/** Feather icon name for a delta direction. */
export function deltaIcon(direction: Delta['direction']): 'arrow-up' | 'arrow-down' | 'minus' {
  return direction === 'up' ? 'arrow-up' : direction === 'down' ? 'arrow-down' : 'minus';
}
