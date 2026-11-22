import { sqlite } from '../client';
import { newId } from '@/lib/id';
import { bumpRevision } from '@/lib/db-hooks';
import { ageYears, bodyContextFrom, changeOverFourWeeks, type BodyContext } from '@/features/analysis';
import type { MeasureKind } from '@/features/profile/kinds';

export type ProfileRow = {
  date_of_birth: string | null;
  sex: 'male' | 'female' | null;
  target_weight_kg: number | null;
};

export type Measurement = {
  id: string;
  kind: MeasureKind;
  value: number;
  measured_at: number;
  note: string | null;
};

const EMPTY: ProfileRow = { date_of_birth: null, sex: null, target_weight_kg: null };

export function getProfile(): ProfileRow {
  return (
    sqlite.getFirstSync<ProfileRow>(
      `SELECT date_of_birth, sex, target_weight_kg FROM profile WHERE id = 1;`,
    ) ?? EMPTY
  );
}

export function saveProfile(patch: Partial<ProfileRow>): void {
  const next = { ...getProfile(), ...patch };
  sqlite.runSync(
    `INSERT INTO profile (id, date_of_birth, sex, target_weight_kg, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET date_of_birth = excluded.date_of_birth, sex = excluded.sex,
       target_weight_kg = excluded.target_weight_kg, updated_at = excluded.updated_at;`,
    [next.date_of_birth, next.sex, next.target_weight_kg, Date.now()],
  );
  bumpRevision();
}

export { ageYears };

// ------------------------------------------------------------ measurements

/** Every entry of one kind, oldest first. */
export function getMeasurements(kind: MeasureKind): Measurement[] {
  return sqlite.getAllSync<Measurement>(
    `SELECT id, kind, value, measured_at, note FROM body_measurements
      WHERE kind = ? ORDER BY measured_at;`,
    [kind],
  );
}

/** The newest entry of each kind that has one. */
export function getLatestMeasurements(): Partial<Record<MeasureKind, Measurement>> {
  const rows = sqlite.getAllSync<Measurement>(
    `SELECT bm.id, bm.kind, bm.value, bm.measured_at, bm.note
       FROM body_measurements bm
       JOIN (SELECT kind, MAX(measured_at) AS m FROM body_measurements GROUP BY kind) latest
         ON latest.kind = bm.kind AND latest.m = bm.measured_at;`,
  );
  const out: Partial<Record<MeasureKind, Measurement>> = {};
  for (const r of rows) out[r.kind] = r;
  return out;
}

/** Never overwrites: a new reading is a new row. */
export function addMeasurement(kind: MeasureKind, value: number, measuredAt = Date.now()): void {
  sqlite.runSync(
    `INSERT INTO body_measurements (id, kind, value, measured_at) VALUES (?, ?, ?, ?);`,
    [newId('bm_'), kind, value, measuredAt],
  );
  bumpRevision();
}

export function deleteMeasurement(id: string): void {
  sqlite.runSync(`DELETE FROM body_measurements WHERE id = ?;`, [id]);
  bumpRevision();
}

/** Change since the last weigh-in at least four weeks before the latest (src/features/analysis/body.ts). */
export function weightChange(entries: Measurement[]): { change: number; since: number } | null {
  return changeOverFourWeeks(entries);
}

/** What the brief may say about the body, when the person has allowed it. */
export function getBodyContext(): BodyContext {
  const measurements = sqlite.getAllSync<{ kind: string; value: number; measured_at: number }>(
    `SELECT kind, value, measured_at FROM body_measurements WHERE kind IN ('weight', 'height');`,
  );
  return bodyContextFrom(getProfile(), measurements);
}
