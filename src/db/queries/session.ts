import { sqlite } from '../client';
import { newId } from '@/lib/id';
import { bumpRevision } from '@/lib/db-hooks';
import { getDay, getDayExercises, getExercise } from './routine';
import { restElapsedSeconds, type RestState } from '@/features/workout/rest-timer';
import { choosePrefill, type Prefill } from '@/features/workout/prefill';
import type { Equipment } from '@/data/exercises.seed';

export type SessionRow = {
  id: string;
  day_of_week: number | null;
  name: string;
  started_at: number;
  ended_at: number | null;
  status: 'active' | 'completed' | 'discarded';
  note: string | null;
  current_index: number;
  rest_started_at: number | null;
  rest_paused_at: number | null;
  rest_accumulated_s: number;
  pending_rest_s: number | null;
};

export type SessionExerciseRow = {
  id: string;
  exercise_id: string;
  position: number;
  skipped: number;
  ad_hoc: number;
  name: string;
  equipment: Equipment;
  weight_step: number;
  is_bodyweight: number;
};

export type SetRow = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  completed_at: number;
  rest_before_s: number | null;
  skipped: number;
};

// ------------------------------------------------------------- session read

export function getActiveSession(): SessionRow | null {
  return (
    sqlite.getFirstSync<SessionRow>(
      `SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1;`,
    ) ?? null
  );
}

export function getSession(id: string): SessionRow | null {
  return sqlite.getFirstSync<SessionRow>(`SELECT * FROM sessions WHERE id = ?;`, [id]) ?? null;
}

export function getSessionExercises(sessionId: string): SessionExerciseRow[] {
  return sqlite.getAllSync<SessionExerciseRow>(
    `SELECT se.id, se.exercise_id, se.position, se.skipped, se.ad_hoc,
            e.name, e.equipment, e.weight_step, e.is_bodyweight
       FROM session_exercises se
       JOIN exercises e ON e.id = se.exercise_id
      WHERE se.session_id = ?
      ORDER BY se.position;`,
    [sessionId],
  );
}

export function getSets(sessionExerciseId: string): SetRow[] {
  return sqlite.getAllSync<SetRow>(
    `SELECT * FROM sets WHERE session_exercise_id = ? ORDER BY set_number;`,
    [sessionExerciseId],
  );
}

/**
 * The previous session's sets for this exercise — the line that sits above
 * today's inputs and makes progressive overload the natural thing to attempt.
 *
 * Prefers the last session of the SAME workout (matched by name, the way
 * Today's "Last Chest + Triceps" is), so bench press on Chest day compares
 * with Chest day rather than a lighter accessory slot on another day. Falls
 * back to the most recent session of any workout that included the exercise.
 */
export function getPreviousPerformance(
  exerciseId: string,
  excludeSessionId: string,
): { startedAt: number; sets: SetRow[] } | null {
  const prev = sqlite.getFirstSync<{ id: string; started_at: number; se_id: string }>(
    `SELECT sn.id, sn.started_at, se.id AS se_id
       FROM session_exercises se
       JOIN sessions sn ON sn.id = se.session_id
      WHERE se.exercise_id = ?1
        AND sn.status = 'completed'
        AND sn.id != ?2
        AND EXISTS (SELECT 1 FROM sets s WHERE s.session_exercise_id = se.id)
      ORDER BY (sn.name = (SELECT name FROM sessions WHERE id = ?2)) DESC,
               sn.started_at DESC
      LIMIT 1;`,
    [exerciseId, excludeSessionId],
  );
  if (!prev) return null;
  return { startedAt: prev.started_at, sets: getSets(prev.se_id) };
}

// ------------------------------------------------------------ session write

/** Starts a session from a routine day, or an empty ad-hoc session. */
export function startSession(dayOfWeek: number, nameOverride?: string): string {
  const existing = getActiveSession();
  if (existing) return existing.id;

  const day = getDay(dayOfWeek);
  const planned = getDayExercises(dayOfWeek);
  const id = newId('s_');
  const name = nameOverride ?? day?.name ?? 'Workout';

  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO sessions (id, day_of_week, name, started_at, status, current_index,
                             rest_accumulated_s)
       VALUES (?, ?, ?, ?, 'active', 0, 0);`,
      [id, dayOfWeek, name, Date.now()],
    );
    planned.forEach((item, index) => {
      sqlite.runSync(
        `INSERT INTO session_exercises (id, session_id, exercise_id, position, skipped, ad_hoc)
         VALUES (?, ?, ?, ?, 0, 0);`,
        [newId('sx_'), id, item.exercise_id, index],
      );
    });
  });
  bumpRevision();
  return id;
}

export function setCurrentIndex(sessionId: string, index: number): void {
  sqlite.runSync(`UPDATE sessions SET current_index = ? WHERE id = ?;`, [index, sessionId]);
  bumpRevision();
}

export function addExerciseToSession(sessionId: string, exerciseId: string): void {
  const max = sqlite.getFirstSync<{ m: number | null }>(
    `SELECT MAX(position) AS m FROM session_exercises WHERE session_id = ?;`,
    [sessionId],
  );
  sqlite.runSync(
    `INSERT INTO session_exercises (id, session_id, exercise_id, position, skipped, ad_hoc)
     VALUES (?, ?, ?, ?, 0, 1);`,
    [newId('sx_'), sessionId, exerciseId, (max?.m ?? -1) + 1],
  );
  bumpRevision();
}

export function setExerciseSkipped(sessionExerciseId: string, skipped: boolean): void {
  sqlite.runSync(`UPDATE session_exercises SET skipped = ? WHERE id = ?;`, [
    skipped ? 1 : 0,
    sessionExerciseId,
  ]);
  bumpRevision();
}

// ----------------------------------------------------------------- set write

/**
 * Logs a set and immediately starts the rest stopwatch.
 *
 * The rest that preceded this set was measured when the user tapped START SET
 * and parked in sessions.pending_rest_s; it is attached here and cleared.
 * Nothing about rest is ever typed by the user (DESIGN.md 5.4.2).
 */
export function logSet(
  sessionId: string,
  sessionExerciseId: string,
  weightKg: number,
  reps: number,
): string {
  const now = Date.now();
  const session = getSession(sessionId);
  const setId = newId('set_');
  const max = sqlite.getFirstSync<{ m: number | null }>(
    `SELECT MAX(set_number) AS m FROM sets WHERE session_exercise_id = ?;`,
    [sessionExerciseId],
  );
  const setNumber = (max?.m ?? 0) + 1;

  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO sets (id, session_exercise_id, set_number, weight_kg, reps,
                         completed_at, rest_before_s)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        setId,
        sessionExerciseId,
        setNumber,
        weightKg,
        reps,
        now,
        setNumber === 1 ? null : (session?.pending_rest_s ?? null),
      ],
    );
    // Consume the pending rest and start the stopwatch in one write.
    sqlite.runSync(
      `UPDATE sessions
          SET pending_rest_s = NULL,
              rest_started_at = ?,
              rest_paused_at = NULL,
              rest_accumulated_s = 0
        WHERE id = ?;`,
      [now, sessionId],
    );
  });
  bumpRevision();
  // Returned so the UI can flash the row: with haptics removed, that flash is
  // the confirmation that the set was committed.
  return setId;
}

export function updateSet(setId: string, weightKg: number, reps: number): void {
  sqlite.runSync(`UPDATE sets SET weight_kg = ?, reps = ? WHERE id = ?;`, [weightKg, reps, setId]);
  bumpRevision();
}

export function deleteSet(setId: string): void {
  const row = sqlite.getFirstSync<SetRow>(`SELECT * FROM sets WHERE id = ?;`, [setId]);
  if (!row) return;
  sqlite.withTransactionSync(() => {
    sqlite.runSync(`DELETE FROM sets WHERE id = ?;`, [setId]);
    // Keep set numbers contiguous so the table never shows a gap.
    sqlite.runSync(
      `UPDATE sets SET set_number = set_number - 1
        WHERE session_exercise_id = ? AND set_number > ?;`,
      [row.session_exercise_id, row.set_number],
    );
  });
  bumpRevision();
}

/**
 * Records a set the user chose not to perform.
 *
 * Deliberately stored rather than silently omitted: a session where set 3 was
 * skipped is a different session from one with three sets, and the difference
 * matters when reading the log back weeks later. Skipped sets carry no load and
 * are excluded from every volume and progression aggregate.
 */
export function skipSet(sessionId: string, sessionExerciseId: string): string {
  const now = Date.now();
  const session = getSession(sessionId);
  const setId = newId('set_');
  const max = sqlite.getFirstSync<{ m: number | null }>(
    `SELECT MAX(set_number) AS m FROM sets WHERE session_exercise_id = ?;`,
    [sessionExerciseId],
  );
  const setNumber = (max?.m ?? 0) + 1;

  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO sets (id, session_exercise_id, set_number, weight_kg, reps,
                         completed_at, rest_before_s, skipped)
       VALUES (?, ?, ?, 0, 0, ?, ?, 1);`,
      [
        setId,
        sessionExerciseId,
        setNumber,
        now,
        setNumber === 1 ? null : (session?.pending_rest_s ?? null),
      ],
    );
    sqlite.runSync(
      `UPDATE sessions
          SET pending_rest_s = NULL,
              rest_started_at = ?,
              rest_paused_at = NULL,
              rest_accumulated_s = 0
        WHERE id = ?;`,
      [now, sessionId],
    );
  });
  bumpRevision();
  return setId;
}

/**
 * Swaps the exercise for TODAY only — the "no free lat pulldown machine, doing
 * pull-ups instead" case. The weekly routine is untouched.
 *
 * Refuses once sets are logged: those sets belong to the old exercise, and
 * silently reattributing them would corrupt both exercises' history. The caller
 * surfaces this so the user can remove the sets first if they really mean it.
 */
export function replaceSessionExercise(
  sessionExerciseId: string,
  exerciseId: string,
): { ok: true } | { ok: false; reason: 'has-sets'; performed: number } {
  const performed = sqlite.getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sets WHERE session_exercise_id = ? AND skipped = 0;`,
    [sessionExerciseId],
  );
  const count = performed?.n ?? 0;
  if (count > 0) return { ok: false, reason: 'has-sets', performed: count };

  sqlite.withTransactionSync(() => {
    // Skipped placeholders carry no data and belonged to the old exercise;
    // they have nothing to say about the new one.
    sqlite.runSync(`DELETE FROM sets WHERE session_exercise_id = ? AND skipped = 1;`, [
      sessionExerciseId,
    ]);
    sqlite.runSync(`UPDATE session_exercises SET exercise_id = ? WHERE id = ?;`, [
      exerciseId,
      sessionExerciseId,
    ]);
  });
  bumpRevision();
  return { ok: true };
}

// --------------------------------------------------------------- rest timer

/** Snapshot of the timer fields, for the pure helpers in rest-timer.ts. */
export function toRestState(s: SessionRow): RestState {
  return {
    startedAt: s.rest_started_at,
    pausedAt: s.rest_paused_at,
    accumulatedS: s.rest_accumulated_s,
  };
}

export function pauseRest(sessionId: string): void {
  sqlite.runSync(
    `UPDATE sessions SET rest_paused_at = ?
      WHERE id = ? AND rest_started_at IS NOT NULL AND rest_paused_at IS NULL;`,
    [Date.now(), sessionId],
  );
  bumpRevision();
}

export function resumeRest(sessionId: string): void {
  const s = getSession(sessionId);
  if (!s || s.rest_paused_at == null || s.rest_started_at == null) return;
  const banked = s.rest_accumulated_s + Math.floor((s.rest_paused_at - s.rest_started_at) / 1000);
  sqlite.runSync(
    `UPDATE sessions SET rest_accumulated_s = ?, rest_started_at = ?, rest_paused_at = NULL
      WHERE id = ?;`,
    [banked, Date.now(), sessionId],
  );
  bumpRevision();
}

export function resetRest(sessionId: string): void {
  sqlite.runSync(
    `UPDATE sessions SET rest_started_at = ?, rest_accumulated_s = 0, rest_paused_at = NULL
      WHERE id = ?;`,
    [Date.now(), sessionId],
  );
  bumpRevision();
}

/**
 * Stops the stopwatch and parks the measured duration. Called by both
 * START SET and SKIP — they differ only in what the UI does next.
 */
export function stopRest(sessionId: string): number {
  const s = getSession(sessionId);
  if (!s || s.rest_started_at == null) return 0;
  const elapsed = restElapsedSeconds(toRestState(s), Date.now());
  sqlite.runSync(
    `UPDATE sessions
        SET pending_rest_s = ?, rest_started_at = NULL, rest_paused_at = NULL,
            rest_accumulated_s = 0
      WHERE id = ?;`,
    [elapsed, sessionId],
  );
  bumpRevision();
  return elapsed;
}

// ------------------------------------------------------------ session close

export function completeSession(sessionId: string): void {
  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `UPDATE sessions SET status = 'completed', ended_at = ?,
              rest_started_at = NULL, rest_paused_at = NULL, pending_rest_s = NULL
        WHERE id = ?;`,
      [Date.now(), sessionId],
    );
    // Discard exercises that were never touched, so the log reflects reality.
    sqlite.runSync(
      `DELETE FROM session_exercises
        WHERE session_id = ?
          AND NOT EXISTS (SELECT 1 FROM sets s WHERE s.session_exercise_id = session_exercises.id);`,
      [sessionId],
    );
  });
  bumpRevision();
}

export function discardSession(sessionId: string): void {
  sqlite.runSync(`DELETE FROM sessions WHERE id = ?;`, [sessionId]);
  sqlite.runSync(
    `DELETE FROM session_exercises WHERE session_id NOT IN (SELECT id FROM sessions);`,
  );
  sqlite.runSync(
    `DELETE FROM sets WHERE session_exercise_id NOT IN (SELECT id FROM session_exercises);`,
  );
  bumpRevision();
}

export function setSessionNote(sessionId: string, note: string): void {
  sqlite.runSync(`UPDATE sessions SET note = ? WHERE id = ?;`, [note.trim() || null, sessionId]);
  bumpRevision();
}

// ----------------------------------------------------------------- prefill

/**
 * What the number wells should show for the next set: the same set number
 * from the last time this workout was done, so repeating last session costs
 * zero taps. Rules and fallbacks live in features/workout/prefill.ts.
 */
export function prefillFor(
  sessionId: string,
  sessionExerciseId: string,
  exerciseId: string,
): Prefill {
  const previous = getPreviousPerformance(exerciseId, sessionId);
  const exercise = getExercise(exerciseId);
  return choosePrefill(
    getSets(sessionExerciseId),
    previous?.sets ?? null,
    Boolean(exercise?.is_bodyweight),
  );
}
