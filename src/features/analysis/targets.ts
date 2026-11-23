import { formatWeight, plural, type Unit } from '../../lib/format.ts';
import type { History } from './types.ts';

/**
 * Next-set target — double progression, the plainest rule that works:
 *
 *   Every set at the top weight reached the same reps  → add one weight step.
 *   Some sets fell short                               → same weight, bring them up.
 *   A single set at the top weight (a pyramid)         → same weight, one more rep.
 *   Unloaded bodyweight                                → one more rep than the best set.
 *
 * A target is a suggestion shown beside the numbers. It never changes what
 * the number wells pre-fill: what you lift is still decided at the bench.
 */

export type NextTarget = {
  weightKg: number;
  reps: number;
  progress: 'weight' | 'reps';
  /** Why, in one sentence, from the last session's sets. */
  reason: string;
};

export function nextTarget(
  sets: { weightKg: number; reps: number }[],
  weightStep: number,
  unit: Unit,
): NextTarget | null {
  const done = sets.filter((s) => s.reps > 0);
  if (!done.length) return null;
  const top = Math.max(...done.map((s) => s.weightKg));

  if (top <= 0) {
    const best = Math.max(...done.map((s) => s.reps));
    return { weightKg: 0, reps: best + 1, progress: 'reps', reason: `Best set last time was ${plural(best, 'rep')}.` };
  }

  const atTop = done.filter((s) => s.weightKg === top).map((s) => s.reps);
  const most = Math.max(...atTop);
  const least = Math.min(...atTop);
  const w = formatWeight(top, unit);

  if (atTop.length === 1) {
    return { weightKg: top, reps: most + 1, progress: 'reps', reason: `One set at ${w} last time, for ${most}.` };
  }
  if (least === most) {
    return {
      weightKg: top + weightStep,
      reps: most,
      progress: 'weight',
      reason: `All ${atTop.length} sets at ${w} reached ${most} reps.`,
    };
  }
  return {
    weightKg: top,
    reps: most,
    progress: 'reps',
    reason: `At ${w}, sets ranged from ${least} to ${most} reps. Match ${most} on every set first.`,
  };
}

/** "65 kg × 8", or "12 reps" for unloaded bodyweight. */
export function formatTarget(t: NextTarget, unit: Unit): string {
  return t.weightKg > 0 ? `${formatWeight(t.weightKg, unit)} × ${t.reps}` : plural(t.reps, 'rep');
}

/**
 * Targets for each exercise of a workout, from the last time that workout (by
 * name) included it. Exercises never done in it get none.
 */
export function workoutTargets(
  history: History,
  workoutName: string,
  exerciseIds: string[],
  unit: Unit,
): Record<string, NextTarget> {
  const out: Record<string, NextTarget> = {};
  for (const id of exerciseIds) {
    const points = history.exercises[id]?.points ?? [];
    const last = [...points].reverse().find((p) => p.sessionName === workoutName) ?? points[points.length - 1];
    if (!last) continue;
    const t = nextTarget(last.sets, last.weightStep, unit);
    if (t) out[id] = t;
  }
  return out;
}
