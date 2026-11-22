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
    /** 1–5 rating of the whole session, given after Finish. null = not rated. */
    effort: integer('effort'),
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
    /** 0 for the set itself; 1, 2… for drops done straight after it (same set_number). */
    dropIndex: integer('drop_index').notNull().default(0),
  },
  (t) => ({ sexIdx: index('idx_sets_sex').on(t.sessionExerciseId, t.setNumber) }),
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Exactly one row. Age is derived from date_of_birth, never stored. */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  /** 'YYYY-MM-DD' */
  dateOfBirth: text('date_of_birth'),
  /** 'male' | 'female' | null — used only as context for lab reference ranges. */
  sex: text('sex'),
  targetWeightKg: real('target_weight_kg'),
  updatedAt: integer('updated_at').notNull(),
});

/** Append-only. Weight in kg, lengths in cm, body fat in percent. */
export const bodyMeasurements = sqliteTable(
  'body_measurements',
  {
    id: text('id').primaryKey(),
    /** 'weight' | 'height' | 'body_fat' | 'waist' | … — src/features/profile/kinds.ts */
    kind: text('kind').notNull(),
    value: real('value').notNull(),
    measuredAt: integer('measured_at').notNull(),
    note: text('note'),
  },
  (t) => ({ kindIdx: index('idx_bm_kind').on(t.kind, t.measuredAt) }),
);

/** Analyses kept with their session — today, Claude replies pasted back by the person. */
export const aiAnalyses = sqliteTable('ai_analyses', {
  id: text('id').primaryKey(),
  /** 'session' | 'weekly' | 'health' */
  kind: text('kind').notNull(),
  sessionId: text('session_id'),
  periodStart: integer('period_start'),
  periodEnd: integer('period_end'),
  /** 'pending' | 'ok' | 'failed' | 'refused' */
  status: text('status').notNull(),
  /** 'pasted', or an API provider id on the optional API route. */
  provider: text('provider'),
  model: text('model'),
  promptVersion: integer('prompt_version').notNull(),
  inputHash: text('input_hash'),
  categories: text('categories'),
  content: text('content'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  errorCode: text('error_code'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const labMarkers = sqliteTable('lab_markers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  defaultUnit: text('default_unit'),
  isCustom: integer('is_custom').notNull().default(0),
});

/** A dated report, with its file (if any) in documentDirectory/reports/. */
export const labReports = sqliteTable(
  'lab_reports',
  {
    id: text('id').primaryKey(),
    takenAt: integer('taken_at').notNull(),
    labName: text('lab_name'),
    category: text('category').notNull(),
    fileName: text('file_name'),
    /** Relative to documentDirectory. */
    filePath: text('file_path'),
    mimeType: text('mime_type'),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({ takenIdx: index('idx_lab_reports_taken').on(t.takenAt) }),
);

/** One recorded value, always traceable to its report. */
export const labResults = sqliteTable(
  'lab_results',
  {
    id: text('id').primaryKey(),
    reportId: text('report_id').notNull(),
    markerId: text('marker_id').notNull(),
    value: real('value'),
    /** For non-numeric results such as "Negative". */
    valueText: text('value_text'),
    unit: text('unit'),
    refLow: real('ref_low'),
    refHigh: real('ref_high'),
    /** 'manual' — values are typed in, or read by Claude and confirmed one by one. */
    source: text('source').notNull().default('manual'),
  },
  (t) => ({ markerIdx: index('idx_lab_results_marker').on(t.markerId, t.reportId) }),
);

export type Exercise = typeof exercises.$inferSelect;
export type RoutineDay = typeof routineDays.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
