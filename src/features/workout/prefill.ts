/**
 * What the number wells show for the next set — pure, so it can be tested
 * without a database (see tests/prefill.test.mjs).
 *
 * Order of preference:
 *  1. The same set number from the last session of this exercise (which the
 *     caller has already narrowed to the same workout when one exists). Set 3
 *     today starts where set 3 ended last time, so a pyramid or a back-off set
 *     pre-fills correctly instead of repeating today's previous set.
 *  2. Today's last performed set — doing more sets than last time.
 *  3. Last session's first performed set — set 1 was skipped last time.
 *  4. A first-time default.
 *
 * Skipped sets carry no load and never seed a value.
 */

export type PrefillSet = {
  set_number: number;
  weight_kg: number;
  reps: number;
  skipped: number;
};

export type Prefill = { weightKg: number; reps: number };

export function choosePrefill(
  today: readonly PrefillSet[],
  previous: readonly PrefillSet[] | null,
  isBodyweight: boolean,
): Prefill {
  // Set numbers are contiguous and include skipped rows, so this is the
  // number the next logged set will receive.
  const nextNumber = today.length + 1;

  const sameSet = previous?.find((s) => s.set_number === nextNumber && !s.skipped);
  if (sameSet) return { weightKg: sameSet.weight_kg, reps: sameSet.reps };

  const performedToday = today.filter((s) => !s.skipped);
  const lastToday = performedToday[performedToday.length - 1];
  if (lastToday) return { weightKg: lastToday.weight_kg, reps: lastToday.reps };

  const firstPrevious = previous?.find((s) => !s.skipped);
  if (firstPrevious) return { weightKg: firstPrevious.weight_kg, reps: firstPrevious.reps };

  return { weightKg: isBodyweight ? 0 : 20, reps: 8 };
}
