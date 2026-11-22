import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { useRevision } from '@/lib/db-hooks';
import { collectBackup } from '@/lib/export';
import { getActiveSession } from '@/db/queries/session';
import { useSettings } from '@/store/settings';
import { SYNC_PATH, type Envelope, type Pairing, type SyncReply, type SyncRequest } from './link';
import { open, seal } from './seal';

/**
 * Wi-Fi sync to Forte Companion: an outbox of one.
 *
 * Every backup is the whole database, so only the newest matters. Rather than
 * a queue of changes there is one flag, pcPending, set by any write and
 * cleared only when the PC confirms (with a sealed reply) the backup it
 * received. Whatever goes wrong in between, the next attempt simply sends
 * the newest data again, and the PC overwrites by export time.
 *
 * When it tries: a few seconds after data changes (never during a workout,
 * so a set logged at the bench never waits on the network), whenever Forte
 * comes back to the foreground, and from Settings. Failures retry while the
 * app is open, at growing gaps, then wait for the next change or return.
 * No background task, no polling while closed: battery cost is a few HTTP
 * requests per workout.
 */

const SETTLE_MS = 5_000;
const RETRY_MS = [30_000, 120_000, 600_000];
const PING_TIMEOUT_MS = 4_000;
const SEND_TIMEOUT_MS = 60_000;

export type SendResult = { ok: true; at: number } | { ok: false; error: string } | null;

let inFlight: Promise<SendResult> | null = null;
/** Bumped by every data change; a send clears pcPending only if none came in meanwhile. */
let changes = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

class SyncError extends Error {}

async function post(host: string, port: number, body: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`http://${host}:${port}${SYNC_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one sealed message to one address and opens the sealed reply. */
async function exchange(p: Pairing, host: string, msg: SyncRequest, timeoutMs: number): Promise<SyncReply> {
  const env = seal(p.key, p.id, 'req', JSON.stringify(msg), getRandomBytes(12));
  const res = await post(host, p.port, JSON.stringify(env), timeoutMs);
  if (res.status === 401) throw new SyncError('The PC has a new key. Scan the code on its Setup page again.');
  if (res.status === 413) throw new SyncError('The backup is too large for the PC to accept.');
  if (res.status === 429) throw new SyncError('The PC is refusing for a minute after failed attempts.');
  if (!res.ok) throw new SyncError(`The PC answered with an error (${res.status}).`);
  let reply: SyncReply;
  try {
    reply = JSON.parse(open(p.key, p.id, 'res', (await res.json()) as Envelope)) as SyncReply;
  } catch {
    // Something answered, but not our PC: it could not seal with our key.
    throw new SyncError('Something else answered at the PC address. Scan the code again.');
  }
  if (!reply.ok || reply.type !== msg.type) throw new SyncError('The PC did not confirm.');
  return reply;
}

/** The address that answers a ping, last good one first. */
async function reachable(p: Pairing): Promise<string> {
  const last = useSettings.getState().pcLastHost;
  const order = last && p.hosts.includes(last) ? [last, ...p.hosts.filter((h) => h !== last)] : p.hosts;
  let keyError: unknown = null;
  for (const host of order) {
    try {
      await exchange(p, host, { type: 'ping', sentAt: Date.now() }, PING_TIMEOUT_MS);
      return host;
    } catch (e) {
      if (e instanceof SyncError) keyError = e;
    }
  }
  if (keyError) throw keyError;
  throw new SyncError('PC not reachable. Is it on, on the same Wi-Fi, with Forte Companion running?');
}

async function sendOnce(): Promise<SendResult> {
  const s = useSettings.getState();
  const p = s.pcSync;
  if (!p) return null;
  const startedAt = changes;
  try {
    const host = await reachable(p);
    const backup = collectBackup();
    const reply = await exchange(p, host, { type: 'backup', sentAt: Date.now(), backup }, SEND_TIMEOUT_MS);
    if (reply.exportedAt !== backup.exportedAt) throw new SyncError('The PC confirmed a different backup.');
    const at = Date.now();
    if (host !== s.pcLastHost) s.set('pcLastHost', host);
    s.set('pcLastSentAt', at);
    s.set('pcLastError', null);
    if (changes === startedAt) s.set('pcPending', false);
    attempt = 0;
    return { ok: true, at };
  } catch (e) {
    const message =
      e instanceof SyncError ? e.message : 'PC not reachable. Is it on, on the same Wi-Fi, with Forte Companion running?';
    s.set('pcLastError', message);
    return { ok: false, error: message };
  }
}

/** One send at a time; a second caller shares the one in progress. */
export function sendToPc(): Promise<SendResult> {
  if (!inFlight) inFlight = sendOnce().finally(() => (inFlight = null));
  return inFlight;
}

function clearTimers() {
  if (retryTimer) clearTimeout(retryTimer);
  if (settleTimer) clearTimeout(settleTimer);
  retryTimer = settleTimer = null;
}

/** Sends if something is waiting and no workout is in progress; schedules a retry on failure. */
async function trySend(): Promise<void> {
  const s = useSettings.getState();
  if (!s.pcSync || !s.pcPending || getActiveSession()) return;
  if (AppState.currentState !== 'active') return;
  const r = await sendToPc();
  if (r && !r.ok && attempt < RETRY_MS.length) {
    retryTimer = setTimeout(() => void trySend(), RETRY_MS[attempt++]);
  }
}

/** Saves a pairing and sends at once. Scanning the same PC again only refreshes its addresses. */
export function pairWith(p: Pairing): Promise<SendResult> {
  const s = useSettings.getState();
  if (s.pcSync?.id !== p.id) {
    s.set('pcLastSentAt', null);
    s.set('pcLastHost', null);
  }
  s.set('pcSync', p);
  s.set('pcLastError', null);
  s.set('pcPending', true);
  changes++;
  attempt = 0;
  return sendToPc();
}

export function unpair(): void {
  clearTimers();
  const s = useSettings.getState();
  for (const k of ['pcSync', 'pcLastSentAt', 'pcLastHost', 'pcLastError'] as const) s.set(k, null);
  s.set('pcPending', false);
}

/**
 * Mounted once at the root. Marks the outbox on every data change and sends
 * once things settle; tries again whenever the app returns to the foreground.
 */
export function useSyncEngine(): void {
  const rev = useRevision((r) => r.rev);
  const paired = useSettings((s) => s.pcSync !== null);

  useEffect(() => {
    if (!paired || rev === 0) return;
    changes++;
    if (!useSettings.getState().pcPending) useSettings.getState().set('pcPending', true);
    clearTimers();
    attempt = 0;
    settleTimer = setTimeout(() => void trySend(), SETTLE_MS);
  }, [rev, paired]);

  useEffect(() => {
    if (!paired) return;
    void trySend();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        attempt = 0;
        void trySend();
      } else {
        clearTimers();
      }
    });
    return () => {
      sub.remove();
      clearTimers();
    };
  }, [paired]);
}
