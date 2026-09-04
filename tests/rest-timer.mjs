// Plain-JS mirror of src/features/workout/rest-timer.ts so the pure logic can
// be tested with `node --test` without a TypeScript or React Native toolchain.
export const IDLE = { startedAt: null, pausedAt: null, accumulatedS: 0 };

export function isResting(s) { return s.startedAt !== null; }
export function isPaused(s) { return s.startedAt !== null && s.pausedAt !== null; }

export function restElapsedSeconds(s, now) {
  if (s.startedAt == null) return 0;
  const end = s.pausedAt ?? now;
  const live = Math.floor((end - s.startedAt) / 1000);
  return s.accumulatedS + Math.max(0, live);
}

export function start(now) { return { startedAt: now, pausedAt: null, accumulatedS: 0 }; }

export function pause(s, now) {
  if (s.startedAt == null || s.pausedAt != null) return s;
  return { ...s, pausedAt: now };
}

export function resume(s, now) {
  if (s.startedAt == null || s.pausedAt == null) return s;
  const banked = s.accumulatedS + Math.max(0, Math.floor((s.pausedAt - s.startedAt) / 1000));
  return { startedAt: now, pausedAt: null, accumulatedS: banked };
}

export function reset(now) { return { startedAt: now, pausedAt: null, accumulatedS: 0 }; }

export function stop(s, now) { return { state: IDLE, elapsedS: restElapsedSeconds(s, now) }; }
