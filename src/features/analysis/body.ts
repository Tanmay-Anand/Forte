import type { BodyContext } from './brief.ts';

/**
 * Body context from plain rows — shared by the app (rows from SQLite) and the
 * PC companion (rows from a backup), so both describe the body the same way.
 */

export type MeasurementRowIn = { kind: string; value: number; measured_at: number };
export type ProfileRowIn = { date_of_birth: string | null; target_weight_kg: number | null };

const FOUR_WEEKS = 28 * 86_400_000;

/** Whole years from a 'YYYY-MM-DD' date of birth; null when unset or malformed. */
export function ageYears(dateOfBirth: string | null | undefined, now = Date.now()): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number) as [number, number, number];
  const today = new Date(now);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Change from the last reading at least four weeks before the latest one.
 * Null when there isn't one that old: a two-day difference is noise, not a trend.
 * `entries` must be one kind, oldest first.
 */
export function changeOverFourWeeks<T extends { value: number; measured_at: number }>(
  entries: T[],
): { change: number; since: number } | null {
  const latest = entries[entries.length - 1];
  if (!latest) return null;
  const before = [...entries].reverse().find((e) => e.measured_at <= latest.measured_at - FOUR_WEEKS);
  return before ? { change: latest.value - before.value, since: before.measured_at } : null;
}

export function bodyContextFrom(
  profile: ProfileRowIn | null,
  measurements: MeasurementRowIn[],
  now = Date.now(),
): BodyContext {
  const ofKind = (kind: string) =>
    measurements.filter((m) => m.kind === kind).sort((a, b) => a.measured_at - b.measured_at);
  const weights = ofKind('weight');
  const heights = ofKind('height');
  const weight = weights[weights.length - 1];
  return {
    ageYears: ageYears(profile?.date_of_birth, now),
    heightCm: heights[heights.length - 1]?.value ?? null,
    weightKg: weight?.value ?? null,
    weightAt: weight?.measured_at ?? null,
    weightChange4wKg: changeOverFourWeeks(weights)?.change ?? null,
    targetKg: profile?.target_weight_kg ?? null,
  };
}
