import { sqlite } from '../client';
import { bumpRevision } from '@/lib/db-hooks';

export type SessionSummary = {
  id: string;
  name: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number;
  set_count: number;
  volume: number;
  exercise_count: number;
  note: string | null;
};

export function getSessionSummary(sessionId: string): SessionSummary | null {
  return (
    sqlite.getFirstSync<SessionSummary>(
      `SELECT sn.id, sn.name, sn.started_at, sn.ended_at, sn.note,
              COALESCE(sn.ended_at, sn.started_at) - sn.started_at AS duration_ms,
              COUNT(s.id) AS set_count,
              COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume,
              COUNT(DISTINCT se.id) AS exercise_count
         FROM sessions sn
         LEFT JOIN session_exercises se ON se.session_id = sn.id
         LEFT JOIN sets s ON s.session_exercise_id = se.id AND s.skipped = 0
        WHERE sn.id = ?
        GROUP BY sn.id;`,
      [sessionId],
    ) ?? null
  );
}

export function getHistory(limit = 200, nameFilter?: string): SessionSummary[] {
  const params: (string | number)[] = [];
  let where = `sn.status = 'completed'`;
  if (nameFilter) {
    where += ' AND sn.name = ?';
    params.push(nameFilter);
  }
  params.push(limit);
  return sqlite.getAllSync<SessionSummary>(
    `SELECT sn.id, sn.name, sn.started_at, sn.ended_at, sn.note,
            COALESCE(sn.ended_at, sn.started_at) - sn.started_at AS duration_ms,
            COUNT(s.id) AS set_count,
            COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume,
            COUNT(DISTINCT se.id) AS exercise_count
       FROM sessions sn
       LEFT JOIN session_exercises se ON se.session_id = sn.id
       LEFT JOIN sets s ON s.session_exercise_id = se.id AND s.skipped = 0
      WHERE ${where}
      GROUP BY sn.id
      ORDER BY sn.started_at DESC
      LIMIT ?;`,
    params,
  );
}

/** Distinct workout names, for the History filter chips. */
export function getWorkoutNames(): string[] {
  const rows = sqlite.getAllSync<{ name: string }>(
    `SELECT DISTINCT name FROM sessions WHERE status = 'completed' ORDER BY name;`,
  );
  return rows.map((r) => r.name);
}

/** The immediately preceding session of the same workout name. */
export function getPreviousSessionSummary(sessionId: string): SessionSummary | null {
  const current = sqlite.getFirstSync<{ name: string; started_at: number }>(
    `SELECT name, started_at FROM sessions WHERE id = ?;`,
    [sessionId],
  );
  if (!current) return null;
  const prev = sqlite.getFirstSync<{ id: string }>(
    `SELECT id FROM sessions
      WHERE name = ? AND status = 'completed' AND started_at < ?
      ORDER BY started_at DESC LIMIT 1;`,
    [current.name, current.started_at],
  );
  return prev ? getSessionSummary(prev.id) : null;
}

export type ExerciseComparison = {
  exercise_id: string;
  name: string;
  current_top: number;
  previous_top: number | null;
};

/**
 * Per-exercise top-weight comparison against the previous session of the same
 * name. Powers the Finish Workout screen (DESIGN.md 5.5) — unchanged lifts get
 * an em dash, never a red arrow.
 */
export function compareExercises(sessionId: string): ExerciseComparison[] {
  const previous = getPreviousSessionSummary(sessionId);
  const current = sqlite.getAllSync<{ exercise_id: string; name: string; top: number }>(
    `SELECT se.exercise_id, e.name, MAX(s.weight_kg) AS top
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
       JOIN sets s ON s.session_exercise_id = se.id AND s.skipped = 0
      WHERE se.session_id = ?
      GROUP BY se.exercise_id
      ORDER BY se.position;`,
    [sessionId],
  );
  if (!previous) {
    return current.map((c) => ({
      exercise_id: c.exercise_id,
      name: c.name,
      current_top: c.top,
      previous_top: null,
    }));
  }
  return current.map((c) => {
    const prev = sqlite.getFirstSync<{ top: number }>(
      `SELECT MAX(s.weight_kg) AS top
         FROM session_exercises se
         JOIN sets s ON s.session_exercise_id = se.id
        WHERE se.session_id = ? AND se.exercise_id = ? AND s.skipped = 0;`,
      [previous.id, c.exercise_id],
    );
    return {
      exercise_id: c.exercise_id,
      name: c.name,
      current_top: c.top,
      previous_top: prev?.top ?? null,
    };
  });
}

/** Full detail for a past session, grouped by exercise with rest values inline. */
export type HistoryExercise = {
  id: string;
  exercise_id: string;
  name: string;
  skipped: number;
  sets: {
    id: string;
    set_number: number;
    weight_kg: number;
    reps: number;
    rest_before_s: number | null;
    skipped: number;
  }[];
  volume: number;
  avgRest: number | null;
};

export function getSessionDetail(sessionId: string): HistoryExercise[] {
  const exercises = sqlite.getAllSync<{
    id: string;
    exercise_id: string;
    name: string;
    skipped: number;
  }>(
    `SELECT se.id, se.exercise_id, e.name, se.skipped
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = ?
      ORDER BY se.position;`,
    [sessionId],
  );

  return exercises.map((ex) => {
    const sets = sqlite.getAllSync<HistoryExercise['sets'][number]>(
      `SELECT id, set_number, weight_kg, reps, rest_before_s, skipped
         FROM sets WHERE session_exercise_id = ? ORDER BY set_number;`,
      [ex.id],
    );
    const volume = sets.reduce((sum, s) => sum + (s.skipped ? 0 : s.weight_kg * s.reps), 0);
    const rests = sets.map((s) => s.rest_before_s).filter((r): r is number => r != null);
    const avgRest = rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null;
    return { ...ex, sets, volume, avgRest };
  });
}

export function deleteSession(sessionId: string): void {
  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `DELETE FROM sets WHERE session_exercise_id IN
         (SELECT id FROM session_exercises WHERE session_id = ?);`,
      [sessionId],
    );
    sqlite.runSync(`DELETE FROM session_exercises WHERE session_id = ?;`, [sessionId]);
    sqlite.runSync(`DELETE FROM sessions WHERE id = ?;`, [sessionId]);
  });
  bumpRevision();
}

/** Last completed session of a given workout name — used on Today. */
export function getLastSessionByName(name: string): SessionSummary | null {
  const row = sqlite.getFirstSync<{ id: string }>(
    `SELECT id FROM sessions WHERE name = ? AND status = 'completed'
      ORDER BY started_at DESC LIMIT 1;`,
    [name],
  );
  return row ? getSessionSummary(row.id) : null;
}

/** Whether a session for this weekday was already completed today. */
export function getTodayCompletedSession(): SessionSummary | null {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = sqlite.getFirstSync<{ id: string }>(
    `SELECT id FROM sessions WHERE status = 'completed' AND started_at >= ?
      ORDER BY started_at DESC LIMIT 1;`,
    [start.getTime()],
  );
  return row ? getSessionSummary(row.id) : null;
}
