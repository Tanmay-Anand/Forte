import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { sqlite } from '@/db/client';
import { invalidateHistory } from '@/db/queries/analysis';
import { bumpRevision } from './db-hooks';
import { newId } from './id';

/**
 * Export and import — IMPLEMENTATION_PLAN.md phase 4.
 *
 * This is the answer to "what happens if I lose the phone", and it is the
 * reason the app needs no cloud. Treat it as non-optional, not a nice-to-have.
 */

/**
 * 2 adds profile, body measurements, saved Claude replies and blood-report
 * records (not the report files, which are binary), plus sessions.effort.
 * Version 1 files still import; they leave health data untouched.
 * 3 adds sets.drop_index (drop sets). An older app refuses a version 3 file
 * rather than reading each drop as an extra set.
 */
const SCHEMA_VERSION = 3;

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
  profile?: unknown[];
  bodyMeasurements?: unknown[];
  aiAnalyses?: unknown[];
  labMarkers?: unknown[];
  labReports?: unknown[];
  labResults?: unknown[];
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
    profile: all('profile'),
    bodyMeasurements: all('body_measurements'),
    aiAnalyses: all('ai_analyses'),
    // Results point at markers by id, and seeded ids differ per install, so
    // every marker a result uses travels with the backup and is matched by name.
    labMarkers: sqlite.getAllSync(
      `SELECT * FROM lab_markers
        WHERE is_custom = 1 OR id IN (SELECT marker_id FROM lab_results);`,
    ),
    labReports: all('lab_reports'),
    labResults: all('lab_results'),
  };
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The backup as text — what exportJson shares and the automatic backup writes. */
export function backupJson(): string {
  return JSON.stringify(collect(), null, 2);
}

/** Full JSON backup. Everything needed to rebuild the database. */
export async function exportJson(): Promise<string> {
  const path = `${FileSystem.cacheDirectory}forte-backup-${timestampSlug()}.json`;
  await FileSystem.writeAsStringAsync(path, backupJson());
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
    drop_index: number;
  }>(
    `SELECT sn.started_at, sn.name AS workout, e.name AS exercise,
            s.set_number, s.weight_kg, s.reps, s.rest_before_s, s.drop_index
       FROM sets s
       JOIN session_exercises se ON se.id = s.session_exercise_id
       JOIN sessions sn ON sn.id = se.session_id
       JOIN exercises e ON e.id = se.exercise_id
      WHERE sn.status = 'completed'
      ORDER BY sn.started_at, se.position, s.set_number, s.drop_index;`,
  );

  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['date,workout,exercise,set,drop,weight_kg,reps,rest_seconds,volume_kg'];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.started_at).toISOString(),
        escape(r.workout),
        escape(r.exercise),
        r.set_number,
        r.drop_index || '',
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

export type ImportResult = { sessions: number; sets: number; reports: number };

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
  const withHealth = bundle.schemaVersion >= 2;

  sqlite.withTransactionSync(() => {
    if (withHealth) {
      sqlite.execSync('DELETE FROM ai_analyses;');
      sqlite.execSync('DELETE FROM lab_results;');
      sqlite.execSync('DELETE FROM lab_reports;');
      sqlite.execSync('DELETE FROM body_measurements;');
      sqlite.execSync('DELETE FROM profile;');
    }
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
                               rest_accumulated_s, pending_rest_s, effort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, ?);`,
        [
          s.id as string,
          (s.day_of_week ?? null) as number | null,
          s.name as string,
          s.started_at as number,
          (s.ended_at ?? null) as number | null,
          s.status as string,
          (s.note ?? null) as string | null,
          (s.current_index ?? 0) as number,
          (s.effort ?? null) as number | null,
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
                           completed_at, rest_before_s, skipped, drop_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          set.id as string,
          set.session_exercise_id as string,
          set.set_number as number,
          set.weight_kg as number,
          set.reps as number,
          set.completed_at as number,
          (set.rest_before_s ?? null) as number | null,
          // Missing before this fix: a skipped set came back as a performed 0 × 0.
          (set.skipped ?? 0) as number,
          // Missing before backup format 3: every row was a set.
          (set.drop_index ?? 0) as number,
        ],
      );
    }

    if (withHealth) importHealth(bundle);
  });

  invalidateHistory();
  bumpRevision();
  return {
    sessions: bundle.sessions.length,
    sets: bundle.sets.length,
    reports: bundle.labReports?.length ?? 0,
  };
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v ?? null) as string | null;
const num = (v: unknown) => (v ?? null) as number | null;

/** Profile, measurements, Claude replies and blood-report records. Runs inside the import transaction. */
function importHealth(bundle: Bundle): void {
  for (const p of (bundle.profile ?? []) as Row[]) {
    sqlite.runSync(
      `INSERT INTO profile (id, date_of_birth, sex, target_weight_kg, updated_at) VALUES (1, ?, ?, ?, ?);`,
      [str(p.date_of_birth), str(p.sex), num(p.target_weight_kg), num(p.updated_at) ?? Date.now()],
    );
  }

  for (const m of (bundle.bodyMeasurements ?? []) as Row[]) {
    sqlite.runSync(
      `INSERT INTO body_measurements (id, kind, value, measured_at, note) VALUES (?, ?, ?, ?, ?);`,
      [m.id as string, m.kind as string, m.value as number, m.measured_at as number, str(m.note)],
    );
  }

  for (const a of (bundle.aiAnalyses ?? []) as Row[]) {
    // A reply whose session did not come across has nothing to belong to.
    if (a.session_id && !sqlite.getFirstSync(`SELECT 1 FROM sessions WHERE id = ?;`, [a.session_id as string])) {
      continue;
    }
    sqlite.runSync(
      `INSERT INTO ai_analyses (id, kind, session_id, period_start, period_end, status, provider, model,
                                prompt_version, input_hash, categories, content, input_tokens,
                                output_tokens, error_code, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        a.id as string,
        a.kind as string,
        str(a.session_id),
        num(a.period_start),
        num(a.period_end),
        a.status as string,
        str(a.provider),
        str(a.model),
        num(a.prompt_version) ?? 1,
        str(a.input_hash),
        str(a.categories),
        str(a.content),
        num(a.input_tokens),
        num(a.output_tokens),
        str(a.error_code),
        num(a.attempts) ?? 0,
        a.created_at as number,
        a.updated_at as number,
      ],
    );
  }

  // Markers are matched by name, so seeded markers link up on any install.
  const markerMap = new Map<string, string>();
  for (const m of (bundle.labMarkers ?? []) as Row[]) {
    const found = sqlite.getFirstSync<{ id: string }>(
      `SELECT id FROM lab_markers WHERE name = ? COLLATE NOCASE;`,
      [m.name as string],
    );
    if (found) {
      markerMap.set(m.id as string, found.id);
      continue;
    }
    const id = newId('lm_');
    sqlite.runSync(
      `INSERT INTO lab_markers (id, name, category, default_unit, is_custom) VALUES (?, ?, ?, ?, 1);`,
      [id, m.name as string, m.category as string, str(m.default_unit)],
    );
    markerMap.set(m.id as string, id);
  }

  // Report files are binary and not in the backup. The rows keep their path,
  // and the report screen says the file isn't on this device until it is
  // attached again.
  for (const r of (bundle.labReports ?? []) as Row[]) {
    sqlite.runSync(
      `INSERT INTO lab_reports (id, taken_at, lab_name, category, file_name, file_path, mime_type, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        r.id as string,
        r.taken_at as number,
        str(r.lab_name),
        r.category as string,
        str(r.file_name),
        str(r.file_path),
        str(r.mime_type),
        str(r.note),
        r.created_at as number,
      ],
    );
  }

  for (const x of (bundle.labResults ?? []) as Row[]) {
    const marker = markerMap.get(x.marker_id as string);
    if (!marker) continue;
    sqlite.runSync(
      `INSERT INTO lab_results (id, report_id, marker_id, value, value_text, unit, ref_low, ref_high, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        x.id as string,
        x.report_id as string,
        marker,
        num(x.value),
        str(x.value_text),
        str(x.unit),
        num(x.ref_low),
        num(x.ref_high),
        str(x.source) ?? 'manual',
      ],
    );
  }
}
