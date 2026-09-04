/**
 * Rest stopwatch — IMPLEMENTATION_PLAN.md section 5.
 *
 * The whole design rests on one rule: elapsed time is DERIVED from stored
 * timestamps, never accumulated by a ticking interval. A JS interval is a
 * rendering concern only. This is what makes the timer survive backgrounding,
 * screen sleep, and process death, and it is what allows the screen-awake
 * setting in section 6.2 to exist at all.
 *
 * These functions are pure so they can be tested without a database or a
 * React tree — see tests/rest-timer.test.mjs.
 */

export type RestState = {
  /** null = not resting */
  startedAt: number | null;
  /** null = running */
  pausedAt: number | null;
  /** seconds banked across previous pause cycles */
  accumulatedS: number;
};

export const IDLE: RestState = { startedAt: null, pausedAt: null, accumulatedS: 0 };

export function isResting(s: RestState): boolean {
  return s.startedAt !== null;
}

export function isPaused(s: RestState): boolean {
  return s.startedAt !== null && s.pausedAt !== null;
}

/** Seconds of rest so far. Correct regardless of how long the app was asleep. */
export function restElapsedSeconds(s: RestState, now: number): number {
  if (s.startedAt == null) return 0;
  const end = s.pausedAt ?? now;
  const live = Math.floor((end - s.startedAt) / 1000);
  return s.accumulatedS + Math.max(0, live);
}

// ---- transitions: pure counterparts of the writes in queries/session.ts ----

export function start(now: number): RestState {
  return { startedAt: now, pausedAt: null, accumulatedS: 0 };
}

export function pause(s: RestState, now: number): RestState {
  if (s.startedAt == null || s.pausedAt != null) return s;
  return { ...s, pausedAt: now };
}

export function resume(s: RestState, now: number): RestState {
  if (s.startedAt == null || s.pausedAt == null) return s;
  const banked = s.accumulatedS + Math.max(0, Math.floor((s.pausedAt - s.startedAt) / 1000));
  return { startedAt: now, pausedAt: null, accumulatedS: banked };
}

export function reset(now: number): RestState {
  return { startedAt: now, pausedAt: null, accumulatedS: 0 };
}

/** Ends the rest period and returns the duration to store on the next set. */
export function stop(s: RestState, now: number): { state: RestState; elapsedS: number } {
  return { state: IDLE, elapsedS: restElapsedSeconds(s, now) };
}
