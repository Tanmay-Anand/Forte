import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';
import { bumpRevision } from './db-hooks';
import { newId } from './id';

/**
 * Export and import — IMPLEMENTATION_PLAN.md phase 4.
 *
 * This is the answer to "what happens if I lose the phone", and it is the
 * reason the app needs no cloud. Treat it as non-optional, not a nice-to-have.
 */

const SCHEMA_VERSION = 1;

type Bundle = {
  format: 'forte-export';
  schemaVersion: number;
  exportedAt: number;
  exercises: unknown[];
  routineDays: unknown[];
  routineExercises: unknown[];
  sessions: unknown[];
  sessionExercises: unknown[];
  sets: unknown[];
  settings: unknown[];
};

function collect(): Bundle {
  const all = <T>(table: string) => sqlite.getAllSync<T>(`SELECT * FROM ${table};`);
  return {
    format: 'forte-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    exercises: all('exercises'),
    routineDays: all('routine_days'),
    routineExercises: all('routine_exercises'),
    sessions: all('sessions'),
    sessionExercises: all('session_exercises'),
    sets: all('sets'),
    settings: all('settings'),
  };
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Full JSON backup. Everything needed to rebuild the database. */
export async function exportJson(): Promise<string> {
  const path = `${FileSystem.cacheDirectory}forte-backup-${timestampSlug()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(collect(), null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Forte backup' });
  }
  return path;
}

/** Flat CSV of every set, for spreadsheets and for outliving this app. */
export async function exportCsv(): Promise<string> {
  const rows = sqlite.getAllSync<{
    started_at: number;
    workout: string;
    exercise: string;
    set_number: number;
    weight_kg: number;
    reps: number;
    rest_before_s: number | null;
  }>(
    `SELECT sn.started_at, sn.name AS workout, e.name AS exercise,
            s.set_number, s.weight_kg, s.reps, s.rest_before_s
       FROM sets s
       JOIN session_exercises se ON se.id = s.session_exercise_id
       JOIN sessions sn ON sn.id = se.session_id
       JOIN exercises e ON e.id = se.exercise_id
      WHERE sn.status = 'completed'
      ORDER BY sn.started_at, se.position, s.set_number;`,
  );

  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['date,workout,exercise,set,weight_kg,reps,rest_seconds,volume_kg'];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.started_at).toISOString(),
        escape(r.workout),
        escape(r.exercise),
        r.set_number,
        r.weight_kg,
        r.reps,
        r.rest_before_s ?? '',
        (r.weight_kg * r.reps).toFixed(1),
      ].join(','),
    );
  }

  const path = `${FileSystem.cacheDirectory}forte-sets-${timestampSlug()}.csv`;
  await FileSystem.writeAsStringAsync(path, lines.join('\n'));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Forte sets' });
  }
  return path;
}

export type ImportResult = { sessions: number; sets: number };

/**
 * Restores a bundle, replacing everything. Exercise ids are remapped by name
 * so a backup taken on another install still links up correctly.
 */
export function importJson(raw: string): ImportResult {
  const bundle = JSON.parse(raw) as Bundle;
  if (bundle.format !== 'forte-export') {
    throw new Error('Not a Forte backup file.');
  }
  if (bundle.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer version of Forte.');
  }

  const exercises = bundle.exercises as {
    id: string;
    name: string;
    equipment: string;
    muscle_group: string;
    is_custom: number;
    weight_step: number;
    is_bodyweight: number;
  }[];

  const idMap = new Map<string, string>();

  sqlite.withTransactionSync(() => {
    sqlite.execSync('DELETE FROM sets;');
    sqlite.execSync('DELETE FROM session_exercises;');
    sqlite.execSync('DELETE FROM sessions;');
    sqlite.execSync('DELETE FROM routine_exercises;');

    for (const e of exercises) {
      const found = sqlite.getFirstSync<{ id: string }>(
        `SELECT id FROM exercises WHERE name = ? COLLATE NOCASE;`,
        [e.name],
      );
      if (found) {
        idMap.set(e.id, found.id);
      } else {
        const id = newId('ex_');
        sqlite.runSync(
          `INSERT INTO exercises (id, name, equipment, muscle_group, is_custom, weight_step, is_bodyweight)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [id, e.name, e.equipment, e.muscle_group, e.is_custom, e.weight_step, e.is_bodyweight],
        );
        idMap.set(e.id, id);
      }
    }

    for (const d of bundle.routineDays as {
      day_of_week: number;
      name: string | null;
      is_rest: number;
    }[]) {
      sqlite.runSync(
        `UPDATE routine_days SET name = ?, is_rest = ?, updated_at = ? WHERE day_of_week = ?;`,
        [d.name, d.is_rest, Date.now(), d.day_of_week],
      );
    }

    for (const r of bundle.routineExercises as {
      id: string;
      day_of_week: number;
      exercise_id: string;
      position: number;
    }[]) {
      const mapped = idMap.get(r.exercise_id);
      if (!mapped) continue;
      sqlite.runSync(
        `INSERT INTO routine_exercises (id, day_of_week, exercise_id, position)
         VALUES (?, ?, ?, ?);`,
        [r.id, r.day_of_week, mapped, r.position],
      );
    }

    for (const s of bundle.sessions as Record<string, unknown>[]) {
      sqlite.runSync(
        `INSERT INTO sessions (id, day_of_week, name, started_at, ended_at, status, note,
                               current_index, rest_started_at, rest_paused_at,
                               rest_accumulated_s, pending_rest_s)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL);`,
        [
          s.id as string,
          (s.day_of_week ?? null) as number | null,
          s.name as string,
          s.started_at as number,
          (s.ended_at ?? null) as number | null,
          s.status as string,
          (s.note ?? null) as string | null,
          (s.current_index ?? 0) as number,
        ],
      );
    }

    for (const se of bundle.sessionExercises as Record<string, unknown>[]) {
      const mapped = idMap.get(se.exercise_id as string);
      if (!mapped) continue;
      sqlite.runSync(
        `INSERT INTO session_exercises (id, session_id, exercise_id, position, skipped, ad_hoc)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          se.id as string,
          se.session_id as string,
          mapped,
          se.position as number,
          (se.skipped ?? 0) as number,
          (se.ad_hoc ?? 0) as number,
        ],
      );
    }

    for (const set of bundle.sets as Record<string, unknown>[]) {
      sqlite.runSync(
        `INSERT INTO sets (id, session_exercise_id, set_number, weight_kg, reps,
                           completed_at, rest_before_s)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          set.id as string,
          set.session_exercise_id as string,
          set.set_number as number,
          set.weight_kg as number,
          set.reps as number,
          set.completed_at as number,
          (set.rest_before_s ?? null) as number | null,
        ],
      );
    }
  });

  bumpRevision();
  return { sessions: bundle.sessions.length, sets: bundle.sets.length };
}
