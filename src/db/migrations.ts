/**
 * Forward-only migration ladder keyed on SQLite's PRAGMA user_version.
 *
 * Why raw DDL rather than drizzle-kit generated migrations: it removes the
 * codegen step and the Metro .sql transformer from the build entirely, which
 * for a single-user app is a meaningful reduction in setup surface. Drizzle
 * still provides the typed query layer on top.
 *
 * Rule: never edit a shipped migration. Append a new one.
 */
export const MIGRATIONS: string[][] = [
  // ---- v1: initial schema ----
  [
    `CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      equipment TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0,
      weight_step REAL NOT NULL DEFAULT 2.5,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_name
       ON exercises(name COLLATE NOCASE);`,

    `CREATE TABLE IF NOT EXISTS routine_days (
      day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 1 AND 7),
      name TEXT,
      is_rest INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS routine_exercises (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL REFERENCES routine_days(day_of_week) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      position INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_rex_day ON routine_exercises(day_of_week, position);`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL,
      note TEXT,
      current_index INTEGER NOT NULL DEFAULT 0,
      rest_started_at INTEGER,
      rest_paused_at INTEGER,
      rest_accumulated_s INTEGER NOT NULL DEFAULT 0,
      pending_rest_s INTEGER
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);`,

    `CREATE TABLE IF NOT EXISTS session_exercises (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      position INTEGER NOT NULL,
      skipped INTEGER NOT NULL DEFAULT 0,
      ad_hoc INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sex_session ON session_exercises(session_id, position);`,

    `CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      reps INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      rest_before_s INTEGER
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sets_sex ON sets(session_exercise_id, set_number);`,

    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`,
  ],

  // ---- v2: a set can be skipped rather than performed ----
  // Skipped sets are recorded, not discarded: "I did not do set 3" is real
  // information. They carry no weight or reps and are excluded from every
  // volume and progression aggregate.
  [`ALTER TABLE sets ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;`],

  // ---- v3: session effort, profile and body measurements ----
  // Effort is one optional 1–5 rating per session, given after Finish — never
  // an input during the workout. Measurements are append-only rows, so a new
  // weigh-in adds history instead of overwriting the last one. Height is a
  // measurement for the same reason. Lengths are stored in cm, weights in kg.
  [
    `ALTER TABLE sessions ADD COLUMN effort INTEGER;`,
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      date_of_birth TEXT,
      sex TEXT,
      target_weight_kg REAL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS body_measurements (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      measured_at INTEGER NOT NULL,
      note TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_bm_kind ON body_measurements(kind, measured_at);`,
  ],

  // ---- v4: analyses kept with their session ----
  // Today this holds Claude replies the person pastes back (provider
  // 'pasted'). The other columns serve the optional API route
  // (docs/AI_TRAINER_PLAN.md, Part 4) so it needs no second migration.
  [
    `CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
      period_start INTEGER,
      period_end INTEGER,
      status TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      prompt_version INTEGER NOT NULL,
      input_hash TEXT,
      categories TEXT,
      content TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      error_code TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_session ON ai_analyses(session_id) WHERE kind = 'session';`,
    `CREATE INDEX IF NOT EXISTS idx_ai_kind ON ai_analyses(kind, created_at);`,
  ],

  // ---- v5: blood reports ----
  // A report is a dated record with an optional file kept in the app's private
  // storage. Results point at their report, so every value can be traced to
  // its source. Reference ranges are stored per result because labs differ.
  [
    `CREATE TABLE IF NOT EXISTS lab_markers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      default_unit TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_markers_name ON lab_markers(name COLLATE NOCASE);`,
    `CREATE TABLE IF NOT EXISTS lab_reports (
      id TEXT PRIMARY KEY,
      taken_at INTEGER NOT NULL,
      lab_name TEXT,
      category TEXT NOT NULL,
      file_name TEXT,
      file_path TEXT,
      mime_type TEXT,
      note TEXT,
      created_at INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lab_reports_taken ON lab_reports(taken_at DESC);`,
    `CREATE TABLE IF NOT EXISTS lab_results (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
      marker_id TEXT NOT NULL REFERENCES lab_markers(id),
      value REAL,
      value_text TEXT,
      unit TEXT,
      ref_low REAL,
      ref_high REAL,
      source TEXT NOT NULL DEFAULT 'manual'
    );`,
    `CREATE INDEX IF NOT EXISTS idx_lab_results_marker ON lab_results(marker_id, report_id);`,
  ],

  // ---- v6: drop sets ----
  // A drop (40 kg × 5, then straight down to 25 kg × 8) belongs to the set it
  // follows: same set_number, drop_index 1, 2… The set itself is drop_index 0,
  // so every existing row is already correct. Drops add volume; set counts,
  // records, targets and pre-fill use drop_index 0 only. Drops have no rest.
  [`ALTER TABLE sets ADD COLUMN drop_index INTEGER NOT NULL DEFAULT 0;`],
];
