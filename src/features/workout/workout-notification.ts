import { Platform } from 'react-native';
import type { Event, Notification } from '@notifee/react-native';

import { initDatabase } from '@/db/client';
import {
  getActiveSession,
  getSessionExercises,
  getSets,
  logSet,
  pauseRest,
  prefillFor,
  resumeRest,
  stopRest,
  toRestState,
  type SessionRow,
} from '@/db/queries/session';
import { useSettings } from '@/store/settings';
import { formatWeight } from '@/lib/format';
import { formatDuration } from '@/lib/time';
import { isPaused, isResting, restElapsedSeconds } from './rest-timer';

/**
 * Lock-screen workout controls — FUTURE_ENHANCEMENTS.md 3.1.
 *
 * An ongoing notification, visible on the lock screen, that mirrors the active
 * workout: the rest stopwatch while resting, the next set otherwise, and the
 * two buttons that make up a set cycle (log the set / start the next one).
 *
 * The notification NEVER owns the clock. Android's own chronometer draws the
 * ticking digits from a start timestamp that is derived from the session row,
 * exactly as restElapsedSeconds() does — so nothing in JS runs per second, the
 * process can be asleep or dead, and the value is still right. Every button
 * writes through the same session queries the Active Workout screen uses,
 * then the notification is re-rendered from the database.
 */

const CHANNEL_ID = 'workout';
const NOTIFICATION_ID = 'forte-workout';

type ActionId = 'pause' | 'resume' | 'start-set' | 'log-set';

type NotifeeLib = typeof import('@notifee/react-native');

let lib: NotifeeLib | null | undefined;
let channelReady = false;
let queue: Promise<void> = Promise.resolve();

/**
 * Notifee throws at import time when its native module is absent — which is
 * the case in Expo Go. Loading it lazily keeps Expo Go usable for development;
 * there the feature is simply off. Every APK build includes the module.
 */
function notifeeLib(): NotifeeLib | null {
  if (lib === undefined) {
    try {
      lib = Platform.OS === 'android' ? (require('@notifee/react-native') as NotifeeLib) : null;
    } catch {
      lib = null;
    }
  }
  return lib;
}

/** Called once from index.js, before the app registers, so presses work from a killed process. */
export function registerBackgroundHandler(): void {
  notifeeLib()?.default.onBackgroundEvent(handleNotificationEvent);
}

/** Foreground presses arrive here instead. Returns the unsubscribe function. */
export function subscribeForegroundEvents(): () => void {
  return notifeeLib()?.default.onForegroundEvent((e) => void handleNotificationEvent(e)) ?? (() => {});
}

/** Re-renders the notification from the database. Safe to call often; calls are serialised. */
export function syncWorkoutNotification(): Promise<void> {
  const n = notifeeLib();
  if (!n) return Promise.resolve();
  queue = queue
    .then(() => render(n))
    .catch(() => {
      // A notification is a mirror, never the record — a failed post loses nothing.
    });
  return queue;
}

/** Asks for POST_NOTIFICATIONS (Android 13+). Returns whether notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const n = notifeeLib();
  if (!n) return false;
  try {
    const current = await n.default.getNotificationSettings();
    if (current.authorizationStatus === n.AuthorizationStatus.AUTHORIZED) return true;
    const asked = await n.default.requestPermission();
    return asked.authorizationStatus === n.AuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

/**
 * Handles a button press. Registered for both foreground events (root layout)
 * and background events (index.js) — the latter also runs when Android has
 * killed the process, as a headless task with no UI mounted.
 */
export async function handleNotificationEvent({ type, detail }: Event): Promise<void> {
  const n = notifeeLib();
  if (!n || type !== n.EventType.ACTION_PRESS) return;
  initDatabase();
  const session = getActiveSession();
  const action = detail.pressAction?.id as ActionId | undefined;

  if (session && action) {
    switch (action) {
      case 'pause':
        pauseRest(session.id);
        break;
      case 'resume':
        resumeRest(session.id);
        break;
      case 'start-set':
        stopRest(session.id);
        break;
      case 'log-set': {
        const current = currentExercise(session);
        // Only from the not-resting state, mirroring the screen: while resting
        // the primary action is START SET, never a second COMPLETE SET.
        if (current && !isResting(toRestState(session))) {
          const fill = prefillFor(session.id, current.id, current.exercise_id);
          logSet(session.id, current.id, fill.weightKg, fill.reps);
        }
        break;
      }
    }
  }
  await syncWorkoutNotification();
}

// ------------------------------------------------------------------ render

function currentExercise(session: SessionRow) {
  const exercises = getSessionExercises(session.id);
  if (!exercises.length) return null;
  return exercises[Math.min(session.current_index, exercises.length - 1)] ?? null;
}

async function render(n: NotifeeLib): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.loaded) settings.load();
  const { lockScreenControls, unit } = useSettings.getState();

  const session = lockScreenControls ? getActiveSession() : null;
  if (!session) {
    await n.default.cancelNotification(NOTIFICATION_ID);
    return;
  }

  if (!channelReady) {
    await n.default.createChannel({
      id: CHANNEL_ID,
      name: 'Active workout',
      description: 'Rest stopwatch and set controls while a workout is in progress',
      // LOW: shown on the lock screen and in the shade, but silent — it is
      // re-posted after every set and must never buzz.
      importance: n.AndroidImportance.LOW,
      visibility: n.AndroidVisibility.PUBLIC,
      vibration: false,
    });
    channelReady = true;
  }

  const current = currentExercise(session);
  const rest = toRestState(session);
  const sets = current ? getSets(current.id) : [];
  const nextNumber = sets.length + 1;

  let title: string;
  let body: string;
  let chronoFrom: number | null = null;
  const actions: { title: string; pressAction: { id: ActionId } }[] = [];

  if (!current) {
    title = session.name;
    body = 'Open Forte to add an exercise';
    chronoFrom = session.started_at;
  } else {
    const fill = prefillFor(session.id, current.id, current.exercise_id);
    const next = `${formatWeight(fill.weightKg, unit)} × ${fill.reps}`;

    if (isResting(rest)) {
      const done = `Set ${sets.length} done`;
      if (isPaused(rest)) {
        title = `Rest paused · ${formatDuration(restElapsedSeconds(rest, Date.now()))}`;
        actions.push({ title: 'Resume', pressAction: { id: 'resume' } });
      } else {
        title = `Resting · ${current.name}`;
        // The digits Android draws are (now - this). Banked seconds from earlier
        // pause cycles are folded in by moving the origin back — the same
        // arithmetic as restElapsedSeconds(), done once instead of every tick.
        chronoFrom = (rest.startedAt ?? Date.now()) - rest.accumulatedS * 1000;
        actions.push({ title: 'Pause', pressAction: { id: 'pause' } });
      }
      body = `${done} · next ${next}`;
      actions.push({ title: `Start set ${nextNumber}`, pressAction: { id: 'start-set' } });
    } else {
      title = `${current.name} · Set ${nextNumber}`;
      body = `Up next: ${next}`;
      chronoFrom = session.started_at;
      actions.push({ title: `Log ${next}`, pressAction: { id: 'log-set' } });
    }
  }

  const notification: Notification = {
    id: NOTIFICATION_ID,
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      category: n.AndroidCategory.PROGRESS,
      visibility: n.AndroidVisibility.PUBLIC,
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      showChronometer: chronoFrom != null,
      chronometerDirection: 'up',
      timestamp: chronoFrom ?? undefined,
      showTimestamp: false,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions,
    },
  };
  await n.default.displayNotification(notification);
}
