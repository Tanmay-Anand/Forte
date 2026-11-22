import {
  formatWeight,
  fromDisplayLength,
  fromDisplayWeight,
  lengthUnitFor,
  toDisplayLength,
  toDisplayWeight,
  trimNumber,
  type Unit,
} from '@/lib/format';

/**
 * Body measurements Forte records. Every kind is stored in metric (kg, cm,
 * percent) and converted only for display, like weight everywhere else.
 */
export type MeasureKind =
  | 'weight'
  | 'height'
  | 'body_fat'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'upper_arm'
  | 'forearm'
  | 'thigh'
  | 'calf';

export type Quantity = 'mass' | 'length' | 'percent';

export type KindInfo = { kind: MeasureKind; label: string; quantity: Quantity };

export const KINDS: Record<MeasureKind, KindInfo> = {
  weight: { kind: 'weight', label: 'Weight', quantity: 'mass' },
  height: { kind: 'height', label: 'Height', quantity: 'length' },
  body_fat: { kind: 'body_fat', label: 'Body fat', quantity: 'percent' },
  neck: { kind: 'neck', label: 'Neck', quantity: 'length' },
  shoulders: { kind: 'shoulders', label: 'Shoulders', quantity: 'length' },
  chest: { kind: 'chest', label: 'Chest', quantity: 'length' },
  waist: { kind: 'waist', label: 'Waist', quantity: 'length' },
  hips: { kind: 'hips', label: 'Hips', quantity: 'length' },
  upper_arm: { kind: 'upper_arm', label: 'Upper arm', quantity: 'length' },
  forearm: { kind: 'forearm', label: 'Forearm', quantity: 'length' },
  thigh: { kind: 'thigh', label: 'Thigh', quantity: 'length' },
  calf: { kind: 'calf', label: 'Calf', quantity: 'length' },
};

/** Tape measurements, in the order they're usually taken top to bottom. */
export const TAPE_KINDS: MeasureKind[] = [
  'neck',
  'shoulders',
  'chest',
  'upper_arm',
  'forearm',
  'waist',
  'hips',
  'thigh',
  'calf',
];

export function isMeasureKind(value: string): value is MeasureKind {
  return value in KINDS;
}

/** The unit a kind is typed and shown in, following the kg/lb setting. */
export function displayUnit(kind: MeasureKind, unit: Unit): string {
  const q = KINDS[kind].quantity;
  return q === 'mass' ? unit : q === 'length' ? lengthUnitFor(unit) : '%';
}

/** Stored metric value → the number shown, in the display unit. */
export function toDisplay(kind: MeasureKind, value: number, unit: Unit): number {
  const q = KINDS[kind].quantity;
  if (q === 'mass') return toDisplayWeight(value, unit);
  if (q === 'length') return toDisplayLength(value, unit);
  return value;
}

/** A value typed in the display unit → the stored metric value. */
export function fromDisplay(kind: MeasureKind, value: number, unit: Unit): number {
  const q = KINDS[kind].quantity;
  if (q === 'mass') return fromDisplayWeight(value, unit);
  if (q === 'length') return fromDisplayLength(value, unit);
  return value;
}

/**
 * Generous bounds that catch keypad slips (a missed decimal point turns 78.4
 * into 784) without second-guessing any real body. Metric values.
 */
const BOUNDS: Record<Quantity, [number, number]> = {
  mass: [20, 350],
  length: [5, 260],
  percent: [2, 70],
};

export function isPlausible(kind: MeasureKind, metricValue: number): boolean {
  const [lo, hi] = BOUNDS[KINDS[kind].quantity];
  return metricValue >= lo && metricValue <= hi;
}

export function formatMeasure(kind: MeasureKind, value: number, unit: Unit, withUnit = true): string {
  const q = KINDS[kind].quantity;
  if (q === 'mass') return formatWeight(value, unit, withUnit);
  const shown = trimNumber(q === 'length' ? toDisplayLength(value, unit) : value, 1);
  return withUnit ? `${shown} ${displayUnit(kind, unit)}` : shown;
}
