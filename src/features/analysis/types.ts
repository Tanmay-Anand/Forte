/**
 * Shapes for the analysis engine.
 *
 * The engine is plain TypeScript with no React Native or database imports, so
 * the app, the PC companion (companion/server.mjs) and the tests (Node's
 * built-in TypeScript support) all run the same code. Inputs are rows as they
 * come from SQLite or from an export bundle, so either can feed it.
 *
 * Imports inside this folder use explicit `.ts` extensions and `import type`,
 * which is what lets Node load these files directly.
 */

// ------------------------------------------------------------------ inputs

export type SessionRowIn = {
  id: string;
  name: string;
  started_at: number;
  ended_at: number | null;
  status: string;
  note: string | null;
  /** 1–5, null when not rated. Missing in exports made before v3. */
  effort?: number | null;
};

export type ExerciseRowIn = {
  id: string;
  name: string;
  muscle_group: string;
  is_bodyweight: number;
  weight_step: number;
};

export type SessionExerciseRowIn = {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  skipped: number;
};

export type SetRowIn = {
  session_exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  completed_at: number;
  rest_before_s: number | null;
  /** Missing in some old exports; treated as performed. */
  skipped?: number | null;
  /** 0 or missing for a set; 1, 2… for drops done straight after it (same set_number). */
  drop_index?: number | null;
};

export type HistoryInput = {
  sessions: SessionRowIn[];
  exercises: ExerciseRowIn[];
  sessionExercises: SessionExerciseRowIn[];
  sets: SetRowIn[];
};

// ----------------------------------------------------------------- derived

export type PerformedSet = {
  setNumber: number;
  weightKg: number;
  reps: number;
  restBeforeS: number | null;
  /**
   * Drops done straight after this set at lower weights. They count toward
   * volume only: set counts, records, targets and top sets use the set itself.
   */
  drops?: { weightKg: number; reps: number }[];
};

/** One exercise within one session. Skipped sets are already removed. */
export type ExerciseEntry = {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  isBodyweight: boolean;
  weightStep: number;
  sets: PerformedSet[];
  /** Heaviest working set. */
  top: number;
  /** Most reps achieved at the top weight. */
  repsAtTop: number;
  totalReps: number;
  /** Sum of weight × reps, drops included. Zero for unloaded bodyweight work. */
  volume: number;
  avgRest: number | null;
  /** Best Epley estimate across the sets. For comparison only, never shown as a max. */
  e1rm: number;
};

export type SessionEntry = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  note: string | null;
  effort: number | null;
  exercises: ExerciseEntry[];
  setCount: number;
  volume: number;
};

export type ExercisePoint = ExerciseEntry & {
  sessionId: string;
  sessionName: string;
  at: number;
};

export type ExerciseHistory = {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  isBodyweight: boolean;
  /** Oldest first. */
  points: ExercisePoint[];
};

export type History = {
  /** Completed sessions with at least one performed set, oldest first. */
  sessions: SessionEntry[];
  exercises: Record<string, ExerciseHistory>;
};

/** Session effort scale, 1–5 (index + 1). */
export const EFFORT_LABELS = ['Easy', 'Moderate', 'Hard', 'Very hard', 'Maximal'] as const;

export function effortLabel(effort: number | null | undefined): string | null {
  if (effort == null) return null;
  return EFFORT_LABELS[effort - 1] ?? null;
}
