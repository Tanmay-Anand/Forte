import type {
  ExerciseEntry,
  ExerciseHistory,
  History,
  HistoryInput,
  PerformedSet,
  SessionEntry,
} from './types.ts';

export const DAY_MS = 86_400_000;

/**
 * Rests longer than this are left out of averages. They happen when a workout
 * is left open — the phone put down, the session resumed the next day — and
 * one of them would swamp every real rest it's averaged with. The set itself
 * still counts; only its rest is ignored.
 */
export const MAX_REST_FOR_AVERAGES_S = 20 * 60;

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Epley. Equals the weight for a single; zero for unloaded work. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * Joins the flat tables into completed sessions with their performed sets.
 * Skipped sets and skipped exercises are excluded, as in every Forte query.
 */
export function buildHistory(input: HistoryInput): History {
  const exerciseById = new Map(input.exercises.map((e) => [e.id, e]));

  const setsBySe = new Map<string, PerformedSet[]>();
  for (const s of input.sets) {
    if (s.skipped || s.drop_index) continue;
    const list = setsBySe.get(s.session_exercise_id) ?? [];
    list.push({ setNumber: s.set_number, weightKg: s.weight_kg, reps: s.reps, restBeforeS: s.rest_before_s });
    setsBySe.set(s.session_exercise_id, list);
  }
  // Drops join the set they followed (same set_number), in order.
  for (const s of [...input.sets].sort((a, b) => (a.drop_index ?? 0) - (b.drop_index ?? 0))) {
    if (s.skipped || !s.drop_index) continue;
    const parent = setsBySe.get(s.session_exercise_id)?.find((x) => x.setNumber === s.set_number);
    if (!parent) continue;
    (parent.drops ??= []).push({ weightKg: s.weight_kg, reps: s.reps });
  }

  const seBySession = new Map<string, HistoryInput['sessionExercises']>();
  for (const se of input.sessionExercises) {
    if (se.skipped) continue;
    const list = seBySession.get(se.session_id) ?? [];
    list.push(se);
    seBySession.set(se.session_id, list);
  }

  const sessions: SessionEntry[] = input.sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.started_at - b.started_at)
    .map((s) => {
      const exercises = (seBySession.get(s.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((se): ExerciseEntry | null => {
          const sets = (setsBySe.get(se.id) ?? []).sort((a, b) => a.setNumber - b.setNumber);
          if (!sets.length) return null;
          const exercise = exerciseById.get(se.exercise_id);
          const top = Math.max(...sets.map((x) => x.weightKg));
          const rests = sets
            .map((x) => x.restBeforeS)
            .filter((r): r is number => r != null && r <= MAX_REST_FOR_AVERAGES_S);
          return {
            exerciseId: se.exercise_id,
            name: exercise?.name ?? 'Unknown exercise',
            muscleGroup: exercise?.muscle_group ?? 'full',
            isBodyweight: Boolean(exercise?.is_bodyweight),
            weightStep: exercise?.weight_step ?? 2.5,
            sets,
            top,
            repsAtTop: Math.max(...sets.filter((x) => x.weightKg === top).map((x) => x.reps)),
            totalReps: sets.reduce((a, x) => a + x.reps, 0),
            volume: sets.reduce(
              (a, x) => a + x.weightKg * x.reps + (x.drops ?? []).reduce((d, y) => d + y.weightKg * y.reps, 0),
              0,
            ),
            avgRest: mean(rests),
            e1rm: Math.max(...sets.map((x) => estimateOneRepMax(x.weightKg, x.reps))),
          };
        })
        .filter((e): e is ExerciseEntry => e !== null);
      return {
        id: s.id,
        name: s.name,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationMs: Math.max(0, (s.ended_at ?? s.started_at) - s.started_at),
        note: s.note,
        effort: s.effort ?? null,
        exercises,
        setCount: exercises.reduce((a, e) => a + e.sets.length, 0),
        volume: exercises.reduce((a, e) => a + e.volume, 0),
      };
    })
    .filter((s) => s.setCount > 0);

  const exercises: Record<string, ExerciseHistory> = {};
  for (const s of sessions) {
    for (const e of s.exercises) {
      const entry = (exercises[e.exerciseId] ??= {
        exerciseId: e.exerciseId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        isBodyweight: e.isBodyweight,
        points: [],
      });
      entry.points.push({ ...e, sessionId: s.id, sessionName: s.name, at: s.startedAt });
    }
  }

  return { sessions, exercises };
}

export function findSession(history: History, sessionId: string): SessionEntry | null {
  return history.sessions.find((s) => s.id === sessionId) ?? null;
}

/** Earlier completed sessions of the same workout name, newest first. */
export function previousSameName(history: History, session: SessionEntry): SessionEntry[] {
  return history.sessions
    .filter((s) => s.name === session.name && s.startedAt < session.startedAt)
    .reverse();
}

/** A history cut off at a moment, so a past session is judged by what was known then. */
export function historyUntil(history: History, at: number): History {
  const sessions = history.sessions.filter((s) => s.startedAt <= at);
  const exercises: Record<string, ExerciseHistory> = {};
  for (const [id, eh] of Object.entries(history.exercises)) {
    const points = eh.points.filter((p) => p.at <= at);
    if (points.length) exercises[id] = { ...eh, points };
  }
  return { sessions, exercises };
}
