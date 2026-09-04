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
];
