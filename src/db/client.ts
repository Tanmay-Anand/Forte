import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { MIGRATIONS } from './migrations';
import * as schema from './schema';

export const DATABASE_NAME = 'forte.db';

export const sqlite = SQLite.openDatabaseSync(DATABASE_NAME);

export const db = drizzle(sqlite, { schema });

let initialised = false;

/**
 * Applies pending migrations and sets pragmas. Idempotent and synchronous —
 * SQLite reads here are sub-millisecond, so this runs before first paint
 * rather than behind a loading state.
 */
export function initDatabase(): void {
  if (initialised) return;

  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');

  const row = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const statements = MIGRATIONS[version];
    if (!statements) continue;
    sqlite.withTransactionSync(() => {
      for (const statement of statements) sqlite.execSync(statement);
      sqlite.execSync(`PRAGMA user_version = ${version + 1};`);
    });
  }

  initialised = true;
}

/**
 * WAL housekeeping — IMPLEMENTATION_PLAN.md section 6. Called when the app
 * backgrounds so the -wal sidecar does not creep over months of use.
 */
export function checkpoint(): void {
  try {
    sqlite.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Checkpointing is best-effort; a busy database simply retries next time.
  }
}

/** Annual compaction, exposed in Settings. */
export function vacuum(): void {
  sqlite.execSync('VACUUM;');
}
