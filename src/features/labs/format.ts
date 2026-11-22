import { trimNumber } from '@/lib/format';
import type { LabResult } from '@/db/queries/labs';

/** "138 mg/dL", or the text result ("Negative"). */
export function resultValue(x: Pick<LabResult, 'value' | 'value_text' | 'unit'>): string {
  if (x.value == null) return x.value_text ?? '—';
  return `${trimNumber(x.value, 2)}${x.unit ? ` ${x.unit}` : ''}`;
}

/** "Lab range 40–60", "Lab range below 100", or "No range recorded". */
export function resultRange(x: Pick<LabResult, 'ref_low' | 'ref_high' | 'unit'>): string {
  const u = x.unit ? ` ${x.unit}` : '';
  if (x.ref_low != null && x.ref_high != null) return `Lab range ${trimNumber(x.ref_low, 2)}–${trimNumber(x.ref_high, 2)}${u}`;
  if (x.ref_high != null) return `Lab range below ${trimNumber(x.ref_high, 2)}${u}`;
  if (x.ref_low != null) return `Lab range above ${trimNumber(x.ref_low, 2)}${u}`;
  return 'No range recorded';
}

/** "12 Sep 2026" */
export function reportDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Today as 'YYYY-MM-DD', for the date field. */
export function isoToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → local midday epoch ms, or null. Midday keeps the date stable across time zones. */
export function parseIsoDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (d.getMonth() !== Number(m[2]) - 1 || d.getTime() > Date.now() + 86_400_000) return null;
  return d.getTime();
}
