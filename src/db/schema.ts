/**
 * Drizzle schema — IMPLEMENTATION_PLAN.md section 4.
 * Timestamps are UTC epoch milliseconds. Durations are seconds.
 * Weight is ALWAYS kilograms; pounds is a display conversion only.
 */
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    equipment: text('equipment').notNull(),
    muscleGroup: text('muscle_group').notNull(),
    isCustom: integer('is_custom').notNull().default(0),
    /** Stepper increment for the weight well (DESIGN.md 5.4.1). */
    weightStep: real('weight_step').notNull().default(2.5),
    /** Bodyweight movements log reps, with weight as optional added load. */
    isBodyweight: integer('is_bodyweight').notNull().default(0),
    archivedAt: integer('archived_at'),
  },
  (t) => ({ nameIdx: index('idx_exercises_name').on(t.name) }),
);

/** Exactly seven rows. day_of_week: 1 = Monday ... 7 = Sunday. */
export const routineDays = sqliteTable('routine_days', {
  dayOfWeek: integer('day_of_week').primaryKey(),
  name: text('name'),
  isRest: integer('is_rest').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    id: text('id').primaryKey(),
    dayOfWeek: integer('day_of_week').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
  },
  (t) => ({ dayIdx: index('idx_rex_day').on(t.dayOfWeek, t.position) }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    dayOfWeek: integer('day_of_week'),
    name: text('name').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /** active | completed | discarded */
    status: text('status').notNull(),
    note: text('note'),

    // ---- live workout state: what makes crash recovery a two-line job ----
    currentIndex: integer('current_index').notNull().default(0),
    /** null = not resting */
    restStartedAt: integer('rest_started_at'),
    /** null = running */
    restPausedAt: integer('rest_paused_at'),
    /** seconds banked across pauses */
    restAccumulatedS: integer('rest_accumulated_s').notNull().default(0),
    /** rest measured but not yet attached to a set; written to the next set logged */
    pendingRestS: integer('pending_rest_s'),
  },
  (t) => ({ startedIdx: index('idx_sessions_started').on(t.startedAt) }),
);

/** Snapshot of the routine, so editing a day never rewrites history. */
export const sessionExercises = sqliteTable(
  'session_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    skipped: integer('skipped').notNull().default(0),
    adHoc: integer('ad_hoc').notNull().default(0),
  },
  (t) => ({ sessionIdx: index('idx_sex_session').on(t.sessionId, t.position) }),
);

/** The atomic unit of the product. */
export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    sessionExerciseId: text('session_exercise_id').notNull(),
    setNumber: integer('set_number').notNull(),
    weightKg: real('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    completedAt: integer('completed_at').notNull(),
    /** Rest that PRECEDED this set. null on the first set of an exercise. */
    restBeforeS: integer('rest_before_s'),
    /** Logged but not performed. Excluded from volume and progression. */
    skipped: integer('skipped').notNull().default(0),
  },
  (t) => ({ sexIdx: index('idx_sets_sex').on(t.sessionExerciseId, t.setNumber) }),
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type RoutineDay = typeof routineDays.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
