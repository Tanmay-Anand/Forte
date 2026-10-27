// Plain-JS mirror of choosePrefill from src/features/workout/prefill.ts so the
// pre-fill rules can be tested with `node --test` without a React Native toolchain.
export function choosePrefill(today, previous, isBodyweight) {
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
