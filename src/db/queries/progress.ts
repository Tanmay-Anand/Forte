import { sqlite } from '../client';

/**
 * Progression aggregates — IMPLEMENTATION_PLAN.md section 4.
 *
 * Metric definitions are deliberately few and plain (DESIGN.md 5.6):
 *   weight — heaviest working set of the session
 *   reps   — reps achieved on that heaviest set
 *   volume — sum of weight x reps for the exercise in that session
 *   rest   — mean rest between sets of that exercise in that session
 * No estimated 1RM, no intensity scores, no fatigue index.
 */

export type ProgressPoint = {
  session_id: string;
  started_at: number;
  top_weight: number;
  top_weight_reps: number;
  total_reps: number;
  volume: number;
  avg_rest: number | null;
  set_count: number;
};

export type ProgressMetric = 'weight' | 'reps' | 'volume' | 'rest';

export function getProgressSeries(exerciseId: string): ProgressPoint[] {
  const rows = sqlite.getAllSync<ProgressPoint>(
    `SELECT sn.id AS session_id,
            sn.started_at,
            MAX(s.weight_kg)                              AS top_weight,
            SUM(s.weight_kg * s.reps)                     AS volume,
            SUM(s.reps)                                   AS total_reps,
            AVG(s.rest_before_s)                          AS avg_rest,
            COUNT(s.id)                                   AS set_count,
            0                                             AS top_weight_reps
       FROM sets s
       JOIN session_exercises se ON se.id = s.session_exercise_id
       JOIN sessions sn ON sn.id = se.session_id
      WHERE se.exercise_id = ? AND sn.status = 'completed' AND s.skipped = 0
      GROUP BY sn.id
      ORDER BY sn.started_at;`,
    [exerciseId],
  );

  // Reps-at-top-weight needs a second pass; doing it here keeps the main
  // aggregate a single scan rather than a correlated subquery per row.
  return rows.map((row) => {
    const best = sqlite.getFirstSync<{ reps: number }>(
      `SELECT MAX(s.reps) AS reps
         FROM sets s
         JOIN session_exercises se ON se.id = s.session_exercise_id
        WHERE se.session_id = ? AND se.exercise_id = ? AND s.weight_kg = ? AND s.skipped = 0;`,
      [row.session_id, exerciseId, row.top_weight],
    );
    return { ...row, top_weight_reps: best?.reps ?? 0 };
  });
}

export type ProgressSummary = {
  latestWeight: number;
  latestReps: number;
  bestWeight: number;
  bestReps: number;
  totalVolume: number;
  firstWeight: number;
  sessionCount: number;
  lastTrainedAt: number | null;
  avgRest: number | null;
};

export function getProgressSummary(exerciseId: string): ProgressSummary | null {
  const agg = sqlite.getFirstSync<{
    best_weight: number | null;
    best_reps: number | null;
    total_volume: number | null;
    session_count: number;
    avg_rest: number | null;
  }>(
    `SELECT MAX(s.weight_kg) AS best_weight,
            MAX(s.reps) AS best_reps,
            SUM(s.weight_kg * s.reps) AS total_volume,
            COUNT(DISTINCT sn.id) AS session_count,
            AVG(s.rest_before_s) AS avg_rest
       FROM sets s
       JOIN session_exercises se ON se.id = s.session_exercise_id
       JOIN sessions sn ON sn.id = se.session_id
      WHERE se.exercise_id = ? AND sn.status = 'completed' AND s.skipped = 0;`,
    [exerciseId],
  );
  if (!agg || agg.session_count === 0) return null;

  const series = getProgressSeries(exerciseId);
  const first = series[0];
  const last = series[series.length - 1];

  return {
    latestWeight: last?.top_weight ?? 0,
    latestReps: last?.top_weight_reps ?? 0,
    bestWeight: agg.best_weight ?? 0,
    bestReps: agg.best_reps ?? 0,
    totalVolume: agg.total_volume ?? 0,
    firstWeight: first?.top_weight ?? 0,
    sessionCount: agg.session_count,
    lastTrainedAt: last?.started_at ?? null,
    avgRest: agg.avg_rest,
  };
}

/** Exercises with at least one logged set, most recently trained first. */
export function getTrackedExercises(): { id: string; name: string; last_at: number }[] {
  return sqlite.getAllSync(
    `SELECT e.id, e.name, MAX(sn.started_at) AS last_at
       FROM exercises e
       JOIN session_exercises se ON se.exercise_id = e.id
       JOIN sessions sn ON sn.id = se.session_id AND sn.status = 'completed'
       JOIN sets s ON s.session_exercise_id = se.id AND s.skipped = 0
      GROUP BY e.id
      ORDER BY last_at DESC;`,
  );
}

/** Value for the selected segmented control, per session. */
export function metricValue(point: ProgressPoint, metric: ProgressMetric): number {
  switch (metric) {
    case 'weight':
      return point.top_weight;
    case 'reps':
      return point.top_weight_reps;
    case 'volume':
      return point.volume;
    case 'rest':
      return point.avg_rest ?? 0;
  }
}
