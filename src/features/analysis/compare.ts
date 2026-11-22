import { formatVolume, formatWeight, type Unit } from '../../lib/format.ts';
import { formatShortDate } from '../../lib/time.ts';
import { findSession, median, previousSameName } from './history.ts';
import type { ExerciseEntry, History, SessionEntry } from './types.ts';

// ---------------------------------------------------------------- records

export type RecordKind = 'weight' | 'reps_at_weight' | 'e1rm' | 'volume';

export type SessionRecord = {
  exerciseId: string;
  name: string;
  kind: RecordKind;
  /** "62.5 kg × 8" */
  value: string;
  /** "Most reps at this weight. Previous best 7, on 4 Nov." */
  detail: string;
};

/**
 * Personal records set in one session, judged against every earlier completed
 * session. At most one per exercise — the strongest — so the list stays short.
 * A first-ever session sets no records: there is nothing to beat.
 */
export function sessionRecords(history: History, sessionId: string, unit: Unit): SessionRecord[] {
  const session = findSession(history, sessionId);
  if (!session) return [];
  const out: SessionRecord[] = [];

  for (const cur of session.exercises) {
    const earlier = (history.exercises[cur.exerciseId]?.points ?? []).filter((p) => p.at < session.startedAt);
    if (!earlier.length) continue;
    const loaded = cur.top > 0;
    const best = <T,>(pick: (p: (typeof earlier)[number]) => T, by: (v: T) => number) =>
      earlier.reduce((acc, p) => (by(pick(p)) > by(pick(acc)) ? p : acc), earlier[0]!);

    const topBest = best((p) => p.top, (v) => v);
    if (loaded && cur.top > topBest.top) {
      out.push({
        exerciseId: cur.exerciseId,
        name: cur.name,
        kind: 'weight',
        value: `${formatWeight(cur.top, unit)} × ${cur.repsAtTop}`,
        detail: `Heaviest yet. Previous best ${formatWeight(topBest.top, unit)}, on ${formatShortDate(topBest.at)}.`,
      });
      continue;
    }

    // Most reps at today's top weight, among earlier sets at exactly that weight.
    let repsBefore = -1;
    let repsAt = 0;
    for (const p of earlier) {
      for (const s of p.sets) {
        if (s.weightKg === cur.top && s.reps > repsBefore) {
          repsBefore = s.reps;
          repsAt = p.at;
        }
      }
    }
    if (repsBefore >= 0 && cur.repsAtTop > repsBefore) {
      out.push({
        exerciseId: cur.exerciseId,
        name: cur.name,
        kind: 'reps_at_weight',
        value: loaded ? `${formatWeight(cur.top, unit)} × ${cur.repsAtTop}` : `${cur.repsAtTop} reps`,
        detail: `Most reps at this weight. Previous best ${repsBefore}, on ${formatShortDate(repsAt)}.`,
      });
      continue;
    }

    const e1rmBest = best((p) => p.e1rm, (v) => v);
    if (loaded && cur.e1rm > e1rmBest.e1rm + 0.01) {
      out.push({
        exerciseId: cur.exerciseId,
        name: cur.name,
        kind: 'e1rm',
        value: `${formatWeight(cur.top, unit)} × ${cur.repsAtTop}`,
        detail: `Best estimated one-rep strength so far, ahead of ${formatShortDate(e1rmBest.at)}.`,
      });
      continue;
    }

    const volumeBest = best((p) => p.volume, (v) => v);
    if (loaded && cur.volume > volumeBest.volume) {
      out.push({
        exerciseId: cur.exerciseId,
        name: cur.name,
        kind: 'volume',
        value: formatVolume(cur.volume, unit),
        detail: `Most volume in one session. Previous best ${formatVolume(volumeBest.volume, unit)}, on ${formatShortDate(volumeBest.at)}.`,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------- comparison

export type ExerciseChange = 'weight_up' | 'weight_down' | 'reps_up' | 'reps_down' | 'same' | 'new';

export type ExerciseComparison = {
  exerciseId: string;
  name: string;
  current: ExerciseEntry;
  previous: ExerciseEntry | null;
  change: ExerciseChange;
};

export type SessionComparison = {
  previous: SessionEntry | null;
  exercises: ExerciseComparison[];
};

function classify(cur: ExerciseEntry, prev: ExerciseEntry | null): ExerciseChange {
  if (!prev) return 'new';
  if (cur.top > prev.top) return 'weight_up';
  if (cur.top < prev.top) return 'weight_down';
  if (cur.totalReps > prev.totalReps) return 'reps_up';
  if (cur.totalReps < prev.totalReps) return 'reps_down';
  return 'same';
}

/** Each exercise against the previous session of the same workout name. */
export function compareSession(history: History, sessionId: string): SessionComparison | null {
  const session = findSession(history, sessionId);
  if (!session) return null;
  const previous = previousSameName(history, session)[0] ?? null;
  return {
    previous,
    exercises: session.exercises.map((cur) => {
      const prev = previous?.exercises.find((e) => e.exerciseId === cur.exerciseId) ?? null;
      return { exerciseId: cur.exerciseId, name: cur.name, current: cur, previous: prev, change: classify(cur, prev) };
    }),
  };
}

// --------------------------------------------------------------- baseline

export type SessionBaseline = {
  /** How many earlier same-name sessions the baseline uses (3–6). */
  sessions: number;
  from: number;
  to: number;
  volume: number;
  durationMs: number;
  /** Today's volume against the baseline, as a fraction (0.06 = 6% above). */
  volumeChange: number;
  durationChange: number;
  /** True when the volume change is larger than normal variation for this workout. */
  volumeUnusual: boolean;
};

/**
 * The session against the median of the previous 3–6 sessions of the same
 * workout. "Unusual" means outside ±max(10%, the spread of those sessions),
 * so a workout that varies a lot needs a bigger change to count.
 */
export function sessionBaseline(history: History, sessionId: string): SessionBaseline | null {
  const session = findSession(history, sessionId);
  if (!session) return null;
  const prior = previousSameName(history, session).slice(0, 6);
  if (prior.length < 3) return null;
  const volumes = prior.map((s) => s.volume);
  const volume = median(volumes) ?? 0;
  const durationMs = median(prior.map((s) => s.durationMs)) ?? 0;
  if (volume <= 0) return null;
  const spread = (Math.max(...volumes) - Math.min(...volumes)) / 2 / volume;
  const volumeChange = (session.volume - volume) / volume;
  return {
    sessions: prior.length,
    from: prior[prior.length - 1]!.startedAt,
    to: prior[0]!.startedAt,
    volume,
    durationMs,
    volumeChange,
    durationChange: durationMs > 0 ? (session.durationMs - durationMs) / durationMs : 0,
    volumeUnusual: Math.abs(volumeChange) > Math.max(0.1, spread),
  };
}
