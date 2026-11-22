import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { backupJson } from './export';
import { useSettings } from '@/store/settings';

/**
 * Automatic backup after every workout, into a folder the person picks once
 * (Android's folder picker, Storage Access Framework). No timer, no
 * background task, no network: one small file write when a workout finishes,
 * which is when the data changed and the app is already open.
 *
 * A safety copy on the phone. The PC companion gets its backups over Wi-Fi
 * (src/features/sync), though a folder a sync app mirrors still works too.
 *
 * Keeps the newest KEEP automatic files and deletes older ones, so a bad
 * backup can never be the only one left. Files made by hand are never touched.
 */
const SAF = FileSystem.StorageAccessFramework;
const PREFIX = 'forte-backup-auto-';
const KEEP = 12;

export const autoBackupSupported = Platform.OS === 'android';

/** Asks for a folder. Returns false when the person cancels. */
export async function chooseBackupFolder(): Promise<boolean> {
  const result = await SAF.requestDirectoryPermissionsAsync();
  if (!result.granted) return false;
  useSettings.getState().set('autoBackupDir', result.directoryUri);
  return true;
}

/** "Documents/Forte" from a content:// tree URI — for display only. */
export function folderLabel(uri: string | null): string {
  if (!uri) return 'No folder chosen';
  const decoded = decodeURIComponent(uri);
  const tail = decoded.split('/tree/').pop() ?? decoded;
  const path = tail.split(':').slice(1).join(':') || tail;
  return path.replace(/\/document\/.*$/, '') || 'Chosen folder';
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** File name from a SAF document URI, decoded. */
function nameOf(uri: string): string {
  return decodeURIComponent(uri).split('/').pop() ?? '';
}

export type BackupResult = { ok: true; at: number } | { ok: false; error: string };

/**
 * Writes one backup if a folder is set and automatic backup is on (or when
 * forced from Settings). Never throws: a failed backup must never disturb
 * the summary screen it runs from.
 */
export async function runAutoBackup(force = false): Promise<BackupResult | null> {
  const s = useSettings.getState();
  if (!autoBackupSupported || !s.autoBackupDir || (!s.autoBackup && !force)) return null;
  try {
    const uri = await SAF.createFileAsync(s.autoBackupDir, `${PREFIX}${stamp()}`, 'application/json');
    await SAF.writeAsStringAsync(uri, backupJson());

    const files = (await SAF.readDirectoryAsync(s.autoBackupDir))
      .filter((f) => nameOf(f).startsWith(PREFIX))
      .sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
    for (const old of files.slice(KEEP)) {
      await SAF.deleteAsync(old, { idempotent: true }).catch(() => {});
    }

    const at = Date.now();
    s.set('lastAutoBackupAt', at);
    s.set('lastAutoBackupError', null);
    return { ok: true, at };
  } catch (error) {
    // Most often the folder was deleted or its permission revoked.
    const message = error instanceof Error ? error.message : String(error);
    s.set('lastAutoBackupError', message.slice(0, 200));
    return { ok: false, error: message };
  }
}
