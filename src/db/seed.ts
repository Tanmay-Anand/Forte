import { sqlite } from './client';
import { EXERCISE_SEED } from '@/data/exercises.seed';
import { newId } from '@/lib/id';

/**
 * Idempotent seed. Runs on every launch but only inserts names that are
 * missing, so shipping new library exercises in a later version just works
 * and never disturbs the user's custom entries or their history.
 */
export function seedExercises(): void {
  const existing = sqlite.getAllSync<{ name: string }>('SELECT name FROM exercises;');
  const known = new Set(existing.map((r) => r.name.toLowerCase()));

  const missing = EXERCISE_SEED.filter(([name]) => !known.has(name.toLowerCase()));
  if (missing.length === 0) return;

  sqlite.withTransactionSync(() => {
    for (const [name, equipment, muscleGroup, weightStep, isBodyweight] of missing) {
      sqlite.runSync(
        `INSERT OR IGNORE INTO exercises
           (id, name, equipment, muscle_group, is_custom, weight_step, is_bodyweight)
         VALUES (?, ?, ?, ?, 0, ?, ?);`,
        [newId('ex_'), name, equipment, muscleGroup, weightStep, isBodyweight],
      );
    }
  });
}

/** Creates the seven routine rows once. All start unconfigured. */
export function seedRoutineDays(): void {
  const now = Date.now();
  sqlite.withTransactionSync(() => {
    for (let dow = 1; dow <= 7; dow++) {
      sqlite.runSync(
        `INSERT OR IGNORE INTO routine_days (day_of_week, name, is_rest, updated_at)
         VALUES (?, NULL, 0, ?);`,
        [dow, now],
      );
    }
  });
}

export function seedAll(): void {
  seedExercises();
  seedRoutineDays();
}
