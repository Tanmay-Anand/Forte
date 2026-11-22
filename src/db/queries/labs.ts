import * as FileSystem from 'expo-file-system';
import { sqlite } from '../client';
import { newId } from '@/lib/id';
import { bumpRevision } from '@/lib/db-hooks';
import { labFlag, type LabSeries } from '@/features/analysis';

/**
 * Blood reports. Everything stays on the device: the database rows here, and
 * any attached file in the app's private `reports/` folder, which other apps
 * cannot read. Nothing in this module touches the network.
 */

export type LabMarker = {
  id: string;
  name: string;
  category: string;
  default_unit: string | null;
  is_custom: number;
};

export type LabReport = {
  id: string;
  taken_at: number;
  lab_name: string | null;
  category: string;
  file_name: string | null;
  file_path: string | null;
  mime_type: string | null;
  note: string | null;
  created_at: number;
  result_count: number;
  flagged_count: number;
};

export type LabResult = {
  id: string;
  report_id: string;
  marker_id: string;
  marker: string;
  category: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  source: string;
};

const REPORTS_DIR = 'reports/';

/** "Above range" / "Below range" from the lab's own range, or null. Arithmetic, never AI. */
export function resultFlag(x: Pick<LabResult, 'value' | 'ref_low' | 'ref_high'>): string | null {
  return labFlag({ value: x.value, refLow: x.ref_low, refHigh: x.ref_high });
}

// ----------------------------------------------------------------- markers

export function getMarkers(query = ''): LabMarker[] {
  const like = `%${query.trim()}%`;
  return sqlite.getAllSync<LabMarker>(
    `SELECT id, name, category, default_unit, is_custom FROM lab_markers
      WHERE name LIKE ? ORDER BY category, name;`,
    [like],
  );
}

export function getMarker(id: string): LabMarker | null {
  return sqlite.getFirstSync<LabMarker>(`SELECT * FROM lab_markers WHERE id = ?;`, [id]) ?? null;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The library marker a name read off a report most likely means: an exact
 * (case-insensitive) match first, then one name containing the other —
 * "SGPT" finds "ALT (SGPT)". Null when nothing is close; the caller then
 * offers it as a new marker rather than guessing.
 */
export function matchMarker(name: string): LabMarker | null {
  const all = getMarkers();
  const want = normalise(name);
  if (want.length < 2) return null;
  const exact = all.find((m) => normalise(m.name) === want);
  if (exact) return exact;
  const close = all.filter((m) => {
    const have = normalise(m.name);
    return (have.includes(want) && want.length >= 3) || (want.includes(have) && have.length >= 3);
  });
  return close.length === 1 ? close[0]! : null;
}

export function createMarker(name: string, category: string, unit: string | null): string {
  const existing = sqlite.getFirstSync<{ id: string }>(
    `SELECT id FROM lab_markers WHERE name = ? COLLATE NOCASE;`,
    [name.trim()],
  );
  if (existing) return existing.id;
  const id = newId('lm_');
  sqlite.runSync(
    `INSERT INTO lab_markers (id, name, category, default_unit, is_custom) VALUES (?, ?, ?, ?, 1);`,
    [id, name.trim(), category, unit],
  );
  bumpRevision();
  return id;
}

// ----------------------------------------------------------------- reports

export function getReports(): LabReport[] {
  const reports = sqlite.getAllSync<Omit<LabReport, 'flagged_count'>>(
    `SELECT r.*, (SELECT COUNT(*) FROM lab_results x WHERE x.report_id = r.id) AS result_count
       FROM lab_reports r ORDER BY r.taken_at DESC;`,
  );
  return reports.map((r) => ({
    ...r,
    flagged_count: getResults(r.id).filter((x) => resultFlag(x) !== null).length,
  }));
}

export function getReport(id: string): LabReport | null {
  return getReports().find((r) => r.id === id) ?? null;
}

/**
 * Saves a report and, when one is given, copies its file into private storage.
 * The picker's copy lives in the cache, which Android may clear at any time.
 */
export async function addReport(input: {
  takenAt: number;
  category: string;
  labName: string | null;
  file: { uri: string; name: string; mimeType: string | null } | null;
}): Promise<string> {
  const id = newId('lr_');
  let filePath: string | null = null;
  if (input.file) {
    const dir = `${FileSystem.documentDirectory}${REPORTS_DIR}`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const ext = /\.[a-z0-9]{1,5}$/i.exec(input.file.name)?.[0]?.toLowerCase() ?? '';
    filePath = `${REPORTS_DIR}${id}${ext}`;
    await FileSystem.copyAsync({ from: input.file.uri, to: `${FileSystem.documentDirectory}${filePath}` });
  }
  sqlite.runSync(
    `INSERT INTO lab_reports (id, taken_at, lab_name, category, file_name, file_path, mime_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.takenAt,
      input.labName?.trim() || null,
      input.category,
      input.file?.name ?? null,
      filePath,
      input.file?.mimeType ?? null,
      Date.now(),
    ],
  );
  bumpRevision();
  return id;
}

/** Full local URI of a report's file, or null if it has none or it is missing (e.g. after a restore). */
export async function reportFileUri(report: Pick<LabReport, 'file_path'>): Promise<string | null> {
  if (!report.file_path) return null;
  const uri = `${FileSystem.documentDirectory}${report.file_path}`;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

export async function deleteReport(id: string): Promise<void> {
  const report = sqlite.getFirstSync<{ file_path: string | null }>(
    `SELECT file_path FROM lab_reports WHERE id = ?;`,
    [id],
  );
  sqlite.runSync(`DELETE FROM lab_reports WHERE id = ?;`, [id]);
  if (report?.file_path) {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${report.file_path}`, {
      idempotent: true,
    });
  }
  bumpRevision();
}

// ----------------------------------------------------------------- results

export function getResults(reportId: string): LabResult[] {
  return sqlite.getAllSync<LabResult>(
    `SELECT x.*, m.name AS marker, m.category
       FROM lab_results x JOIN lab_markers m ON m.id = x.marker_id
      WHERE x.report_id = ? ORDER BY m.category, m.name;`,
    [reportId],
  );
}

export function addResult(input: {
  reportId: string;
  markerId: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  source?: 'manual' | 'ai_confirmed';
}): void {
  sqlite.runSync(
    `INSERT INTO lab_results (id, report_id, marker_id, value, value_text, unit, ref_low, ref_high, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      newId('lx_'),
      input.reportId,
      input.markerId,
      input.value,
      input.valueText,
      input.unit,
      input.refLow,
      input.refHigh,
      input.source ?? 'manual',
    ],
  );
  bumpRevision();
}

export function deleteResult(id: string): void {
  sqlite.runSync(`DELETE FROM lab_results WHERE id = ?;`, [id]);
  bumpRevision();
}

export type MarkerPoint = LabResult & { taken_at: number };

/** One marker across every report, oldest first. */
export function getMarkerSeries(markerId: string): MarkerPoint[] {
  return sqlite.getAllSync<MarkerPoint>(
    `SELECT x.*, m.name AS marker, m.category, r.taken_at
       FROM lab_results x
       JOIN lab_markers m ON m.id = x.marker_id
       JOIN lab_reports r ON r.id = x.report_id
      WHERE x.marker_id = ? ORDER BY r.taken_at;`,
    [markerId],
  );
}

/** Markers that have at least one result, with their latest value. */
export function getTrackedMarkers(): (MarkerPoint & { count: number })[] {
  return sqlite.getAllSync<MarkerPoint & { count: number }>(
    `SELECT x.*, m.name AS marker, m.category, r.taken_at,
            (SELECT COUNT(*) FROM lab_results y WHERE y.marker_id = x.marker_id) AS count
       FROM lab_results x
       JOIN lab_markers m ON m.id = x.marker_id
       JOIN lab_reports r ON r.id = x.report_id
      WHERE r.taken_at = (SELECT MAX(r2.taken_at) FROM lab_results x2
                            JOIN lab_reports r2 ON r2.id = x2.report_id
                           WHERE x2.marker_id = x.marker_id)
      GROUP BY x.marker_id
      ORDER BY m.category, m.name;`,
  );
}

/** Every marker's history, for the health brief. Only markers in `ids` are included. */
export function getLabSeries(ids: string[]): LabSeries[] {
  return ids
    .map((id) => {
      const points = getMarkerSeries(id);
      const first = points[0];
      if (!first) return null;
      return {
        marker: first.marker,
        category: first.category,
        values: points.map((p) => ({
          at: p.taken_at,
          value: p.value,
          valueText: p.value_text,
          unit: p.unit,
          refLow: p.ref_low,
          refHigh: p.ref_high,
        })),
      };
    })
    .filter((s): s is LabSeries => s !== null);
}

// ------------------------------------------------------------ delete all

/**
 * Profile → Delete all health data. Body measurements, the profile row, every
 * report, result and custom marker, and the report files. Training is kept.
 */
export async function deleteAllHealthData(): Promise<void> {
  sqlite.withTransactionSync(() => {
    sqlite.runSync(`DELETE FROM lab_results;`);
    sqlite.runSync(`DELETE FROM lab_reports;`);
    sqlite.runSync(`DELETE FROM lab_markers WHERE is_custom = 1;`);
    sqlite.runSync(`DELETE FROM body_measurements;`);
    sqlite.runSync(`DELETE FROM profile;`);
    sqlite.runSync(`DELETE FROM ai_analyses WHERE kind = 'health';`);
  });
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${REPORTS_DIR}`, { idempotent: true });
  bumpRevision();
}
