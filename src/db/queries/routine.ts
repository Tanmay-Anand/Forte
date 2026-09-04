import { sqlite } from '../client';
import { newId } from '@/lib/id';
import { bumpRevision } from '@/lib/db-hooks';
import type { Equipment, MuscleGroup } from '@/data/exercises.seed';

export type ExerciseRow = {
  id: string;
  name: string;
  equipment: Equipment;
  muscle_group: MuscleGroup;
  weight_step: number;
  is_bodyweight: number;
  is_custom: number;
};

export type RoutineDayRow = {
  day_of_week: number;
  name: string | null;
  is_rest: number;
};

export type RoutineDaySummary = RoutineDayRow & {
  exercise_count: number;
  /** workout | rest | unconfigured — DESIGN.md 5.2 */
  state: 'workout' | 'rest' | 'unconfigured';
};

export type RoutineExerciseRow = {
  id: string;
  exercise_id: string;
  position: number;
  name: string;
  equipment: Equipment;
  muscle_group: MuscleGroup;
  weight_step: number;
  is_bodyweight: number;
};

function classify(row: RoutineDayRow, count: number): RoutineDaySummary['state'] {
  if (row.is_rest === 1) return 'rest';
  if (row.name && count > 0) return 'workout';
  if (count > 0) return 'workout';
  return 'unconfigured';
}

export function getWeek(): RoutineDaySummary[] {
  const rows = sqlite.getAllSync<RoutineDayRow & { exercise_count: number }>(
    `SELECT d.day_of_week, d.name, d.is_rest,
            (SELECT COUNT(*) FROM routine_exercises r WHERE r.day_of_week = d.day_of_week)
              AS exercise_count
       FROM routine_days d
      ORDER BY d.day_of_week;`,
  );
  return rows.map((r) => ({ ...r, state: classify(r, r.exercise_count) }));
}

export function getDay(dayOfWeek: number): RoutineDaySummary | null {
  const week = getWeek();
  return week.find((d) => d.day_of_week === dayOfWeek) ?? null;
}

export function getDayExercises(dayOfWeek: number): RoutineExerciseRow[] {
  return sqlite.getAllSync<RoutineExerciseRow>(
    `SELECT r.id, r.exercise_id, r.position,
            e.name, e.equipment, e.muscle_group, e.weight_step, e.is_bodyweight
       FROM routine_exercises r
       JOIN exercises e ON e.id = r.exercise_id
      WHERE r.day_of_week = ?
      ORDER BY r.position;`,
    [dayOfWeek],
  );
}

export function renameDay(dayOfWeek: number, name: string): void {
  sqlite.runSync(
    `UPDATE routine_days SET name = ?, is_rest = 0, updated_at = ? WHERE day_of_week = ?;`,
    [name.trim() || null, Date.now(), dayOfWeek],
  );
  bumpRevision();
}

export function setRestDay(dayOfWeek: number, isRest: boolean): void {
  sqlite.withTransactionSync(() => {
    sqlite.runSync(`UPDATE routine_days SET is_rest = ?, updated_at = ? WHERE day_of_week = ?;`, [
      isRest ? 1 : 0,
      Date.now(),
      dayOfWeek,
    ]);
    if (isRest) {
      sqlite.runSync(`DELETE FROM routine_exercises WHERE day_of_week = ?;`, [dayOfWeek]);
      sqlite.runSync(`UPDATE routine_days SET name = NULL WHERE day_of_week = ?;`, [dayOfWeek]);
    }
  });
  bumpRevision();
}

export function clearDay(dayOfWeek: number): void {
  sqlite.withTransactionSync(() => {
    sqlite.runSync(`DELETE FROM routine_exercises WHERE day_of_week = ?;`, [dayOfWeek]);
    sqlite.runSync(
      `UPDATE routine_days SET name = NULL, is_rest = 0, updated_at = ? WHERE day_of_week = ?;`,
      [Date.now(), dayOfWeek],
    );
  });
  bumpRevision();
}

export function addExerciseToDay(dayOfWeek: number, exerciseId: string): void {
  const max = sqlite.getFirstSync<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM routine_exercises WHERE day_of_week = ?;`,
    [dayOfWeek],
  );
  const position = (max?.m ?? -1) + 1;
  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO routine_exercises (id, day_of_week, exercise_id, position)
       VALUES (?, ?, ?, ?);`,
      [newId('rex_'), dayOfWeek, exerciseId, position],
    );
    // Adding an exercise implicitly makes the day a training day.
    sqlite.runSync(`UPDATE routine_days SET is_rest = 0, updated_at = ? WHERE day_of_week = ?;`, [
      Date.now(),
      dayOfWeek,
    ]);
  });
  bumpRevision();
}

export function removeRoutineExercise(id: string): void {
  sqlite.runSync(`DELETE FROM routine_exercises WHERE id = ?;`, [id]);
  bumpRevision();
}

export function replaceRoutineExercise(id: string, exerciseId: string): void {
  sqlite.runSync(`UPDATE routine_exercises SET exercise_id = ? WHERE id = ?;`, [exerciseId, id]);
  bumpRevision();
}

/** Rewrites positions from an ordered list of routine_exercise ids. */
export function reorderDay(dayOfWeek: number, orderedIds: string[]): void {
  sqlite.withTransactionSync(() => {
    orderedIds.forEach((id, index) => {
      sqlite.runSync(`UPDATE routine_exercises SET position = ? WHERE id = ? AND day_of_week = ?;`, [
        index,
        id,
        dayOfWeek,
      ]);
    });
  });
  bumpRevision();
}

export function moveRoutineExercise(dayOfWeek: number, id: string, delta: -1 | 1): void {
  const items = getDayExercises(dayOfWeek);
  const index = items.findIndex((i) => i.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return;
  const ids = items.map((i) => i.id);
  const a = ids[index];
  const b = ids[target];
  if (a === undefined || b === undefined) return;
  ids[index] = b;
  ids[target] = a;
  reorderDay(dayOfWeek, ids);
}

/** Copies one day's name and exercise list onto another day. */
export function duplicateDay(fromDow: number, toDow: number): void {
  const source = getDay(fromDow);
  const items = getDayExercises(fromDow);
  sqlite.withTransactionSync(() => {
    sqlite.runSync(`DELETE FROM routine_exercises WHERE day_of_week = ?;`, [toDow]);
    sqlite.runSync(
      `UPDATE routine_days SET name = ?, is_rest = ?, updated_at = ? WHERE day_of_week = ?;`,
      [source?.name ?? null, source?.is_rest ?? 0, Date.now(), toDow],
    );
    items.forEach((item, index) => {
      sqlite.runSync(
        `INSERT INTO routine_exercises (id, day_of_week, exercise_id, position)
         VALUES (?, ?, ?, ?);`,
        [newId('rex_'), toDow, item.exercise_id, index],
      );
    });
  });
  bumpRevision();
}

// ---------------------------------------------------------------- exercises

export function searchExercises(query: string, group: MuscleGroup | 'all'): ExerciseRow[] {
  const q = `%${query.trim()}%`;
  const clauses = ['archived_at IS NULL'];
  const params: (string | number)[] = [];
  if (query.trim()) {
    clauses.push('name LIKE ?');
    params.push(q);
  }
  if (group !== 'all') {
    clauses.push('muscle_group = ?');
    params.push(group);
  }
  return sqlite.getAllSync<ExerciseRow>(
    `SELECT id, name, equipment, muscle_group, weight_step, is_bodyweight, is_custom
       FROM exercises
      WHERE ${clauses.join(' AND ')}
      ORDER BY name COLLATE NOCASE
      LIMIT 300;`,
    params,
  );
}

/** Exercises the user has actually logged, most recent first. Better ranking than alphabetical. */
export function recentExercises(limit = 6): ExerciseRow[] {
  return sqlite.getAllSync<ExerciseRow>(
    `SELECT e.id, e.name, e.equipment, e.muscle_group, e.weight_step, e.is_bodyweight, e.is_custom,
            MAX(sn.started_at) AS last_used
       FROM exercises e
       JOIN session_exercises se ON se.exercise_id = e.id
       JOIN sessions sn ON sn.id = se.session_id AND sn.status = 'completed'
      WHERE e.archived_at IS NULL
      GROUP BY e.id
      ORDER BY last_used DESC
      LIMIT ?;`,
    [limit],
  );
}

export function createExercise(
  name: string,
  equipment: Equipment,
  muscleGroup: MuscleGroup,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = sqlite.getFirstSync<{ id: string }>(
    `SELECT id FROM exercises WHERE name = ? COLLATE NOCASE;`,
    [trimmed],
  );
  if (existing) return existing.id;

  const id = newId('ex_');
  const step = equipment === 'machine' ? 2.5 : equipment === 'barbell' ? 2.5 : 1.25;
  sqlite.runSync(
    `INSERT INTO exercises (id, name, equipment, muscle_group, is_custom, weight_step, is_bodyweight)
     VALUES (?, ?, ?, ?, 1, ?, ?);`,
    [id, trimmed, equipment, muscleGroup, step, equipment === 'bodyweight' ? 1 : 0],
  );
  bumpRevision();
  return id;
}

export function getExercise(id: string): ExerciseRow | null {
  return (
    sqlite.getFirstSync<ExerciseRow>(
      `SELECT id, name, equipment, muscle_group, weight_step, is_bodyweight, is_custom
         FROM exercises WHERE id = ?;`,
      [id],
    ) ?? null
  );
}
