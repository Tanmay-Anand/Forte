import { sqlite } from '../client';
import { buildHistory, type History, type HistoryInput } from '@/features/analysis';

/**
 * Everything the analysis engine needs, read in four flat queries.
 *
 * Cached against a cheap fingerprint of the completed sessions. Every set
 * logged bumps the global revision, and screens that show analysis re-run
 * their reads on each bump — but a set in an ACTIVE session never changes
 * completed history, so the full read happens only when it actually moved.
 * Logging speed is the one thing this must never cost.
 */
let cached: { key: string; history: History } | null = null;

function fingerprint(): string {
  const row = sqlite.getFirstSync<{ n: number; m: number; e: number; t: number; x: number }>(
    `SELECT COUNT(*) AS n,
            COALESCE(MAX(ended_at), 0) AS m,
            COALESCE(SUM(effort), 0) AS e,
            COALESCE(SUM(LENGTH(note)), 0) AS t,
            (SELECT COUNT(*) FROM exercises) AS x
       FROM sessions WHERE status = 'completed';`,
  );
  return row ? `${row.n}:${row.m}:${row.e}:${row.t}:${row.x}` : '';
}

export function loadHistory(): History {
  const key = fingerprint();
  if (cached && cached.key === key) return cached.history;

  const input: HistoryInput = {
    sessions: sqlite.getAllSync(
      `SELECT id, name, started_at, ended_at, status, note, effort
         FROM sessions WHERE status = 'completed';`,
    ),
    exercises: sqlite.getAllSync(
      `SELECT id, name, muscle_group, is_bodyweight, weight_step FROM exercises;`,
    ),
    sessionExercises: sqlite.getAllSync(
      `SELECT se.id, se.session_id, se.exercise_id, se.position, se.skipped
         FROM session_exercises se
         JOIN sessions sn ON sn.id = se.session_id AND sn.status = 'completed';`,
    ),
    sets: sqlite.getAllSync(
      `SELECT s.session_exercise_id, s.set_number, s.weight_kg, s.reps, s.completed_at,
              s.rest_before_s, s.skipped, s.drop_index
         FROM sets s
         JOIN session_exercises se ON se.id = s.session_exercise_id
         JOIN sessions sn ON sn.id = se.session_id AND sn.status = 'completed';`,
    ),
  };
  const history = buildHistory(input);
  cached = { key, history };
  return history;
}

/** Drops the cache — after an import, which can replace history wholesale. */
export function invalidateHistory(): void {
  cached = null;
}
