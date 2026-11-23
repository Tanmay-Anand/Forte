import { formatVolume, formatWeight, plural, trimNumber, type Unit } from '../../lib/format.ts';
import { formatDuration, formatShortDate } from '../../lib/time.ts';
import { DAY_MS, mean, median } from './history.ts';
import { balanceFindings, muscleBalance } from './balance.ts';
import type { ExerciseHistory, History } from './types.ts';

/**
 * Detectors that turn history into short, specific observations.
 *
 * Every rule is deliberately plain and has a floor of evidence: nothing about
 * a trend is said from fewer than three sessions of an exercise, and a change
 * has to beat a stated threshold before it is mentioned. Thresholds live here
 * and nowhere else.
 */
export const MIN_POINTS_FOR_FINDINGS = 3;
const PLATEAU_SESSIONS = 4;
const REST_DRIFT_RATIO = 1.2;
const REST_DRIFT_MIN_S = 15;
const REGRESSION_RATIO = 0.95;
const WEEKLY_VOLUME_RATIO = 1.25;

export type FindingKind =
  | 'plateau'
  | 'reps_up_weight_flat'
  | 'progressing'
  | 'rest_drift'
  | 'regressing'
  | 'weekly_volume_high'
  | 'weekly_volume_low'
  | 'muscle_balance';

export type Finding = {
  id: string;
  kind: FindingKind;
  /** "Plateau" — the card's label. */
  title: string;
  exerciseId?: string;
  exerciseName?: string;
  /** One or two factual sentences with the numbers and the period. */
  text: string;
  /** "4 sessions", "3 weeks" */
  span: string;
  /** Ranking weight; larger is more worth reading. */
  strength: number;
  from: number;
  to: number;
};

const sessionsLabel = (n: number) => `${n} session${n === 1 ? '' : 's'}`;
const range = (from: number, to: number) => `${formatShortDate(from)} – ${formatShortDate(to)}`;

/** Findings for one exercise from its whole history (oldest point first). */
export function exerciseFindings(eh: ExerciseHistory, unit: Unit): Finding[] {
  const p = eh.points;
  if (p.length < MIN_POINTS_FOR_FINDINGS) return [];
  const last = p[p.length - 1]!;
  const out: Finding[] = [];
  const base = { exerciseId: eh.exerciseId, exerciseName: eh.name };
  const load = (w: number, r: number) => (w > 0 ? `${formatWeight(w, unit)} × ${r}` : plural(r, 'rep'));

  // Plateau: the same top weight and reps at it, session after session.
  let flat = 1;
  for (let i = p.length - 2; i >= 0; i--) {
    const q = p[i]!;
    if (q.top !== last.top || q.repsAtTop !== last.repsAtTop) break;
    flat++;
  }
  if (flat >= PLATEAU_SESSIONS) {
    const first = p[p.length - flat]!;
    out.push({
      ...base,
      id: `plateau:${eh.exerciseId}`,
      kind: 'plateau',
      title: 'Plateau',
      text: `${load(last.top, last.repsAtTop)} on each of the last ${flat} sessions, ${range(first.at, last.at)}.`,
      span: sessionsLabel(flat),
      strength: 30 + flat,
      from: first.at,
      to: last.at,
    });
  }

  // More reps at an unchanged weight: progress the weight column hides.
  const window = p.slice(-PLATEAU_SESSIONS);
  const w0 = window[0]!;
  if (
    flat < PLATEAU_SESSIONS &&
    window.length === PLATEAU_SESSIONS &&
    window.every((q) => q.top === w0.top) &&
    last.totalReps > w0.totalReps
  ) {
    const volumeChange = w0.volume > 0 ? Math.round(((last.volume - w0.volume) / w0.volume) * 100) : 0;
    out.push({
      ...base,
      id: `reps_up:${eh.exerciseId}`,
      kind: 'reps_up_weight_flat',
      title: 'More reps, same weight',
      text:
        `Total reps ${w0.totalReps} → ${last.totalReps} since ${formatShortDate(w0.at)} at an unchanged ${w0.top > 0 ? formatWeight(w0.top, unit) : 'bodyweight'}` +
        (volumeChange > 0 ? `; volume up ${volumeChange}%.` : '.'),
      span: sessionsLabel(PLATEAU_SESSIONS),
      strength: 22,
      from: w0.at,
      to: last.at,
    });
  }

  // Weight going up across the recent window.
  const recent = p.slice(-6);
  const r0 = recent[0]!;
  const step = Math.max(0.5, Math.min(...p.map((q) => q.weightStep)));
  // A climb that has since stalled is reported as the plateau, not as progress.
  if (flat < PLATEAU_SESSIONS && last.top - r0.top >= step * 2 && recent.length >= MIN_POINTS_FOR_FINDINGS) {
    out.push({
      ...base,
      id: `progressing:${eh.exerciseId}`,
      kind: 'progressing',
      title: 'Weight going up',
      text: `Top set ${load(r0.top, r0.repsAtTop)} → ${load(last.top, last.repsAtTop)} since ${formatShortDate(r0.at)}.`,
      span: sessionsLabel(recent.length),
      strength: 12,
      from: r0.at,
      to: last.at,
    });
  }

  // Rest creeping up: the last two sessions against the ones before.
  const rested = p.filter((q) => q.avgRest != null);
  if (rested.length >= 5) {
    const before = rested.slice(-6, -2).map((q) => q.avgRest as number);
    const lateValues = rested.slice(-2).map((q) => q.avgRest as number);
    const baseRest = median(before);
    const late = mean(lateValues);
    if (baseRest != null && late != null && late > baseRest * REST_DRIFT_RATIO && late - baseRest > REST_DRIFT_MIN_S) {
      const from = rested[rested.length - 2 - before.length]!.at;
      const unchanged = rested.slice(-6).every((q) => q.top === last.top);
      out.push({
        ...base,
        id: `rest:${eh.exerciseId}`,
        kind: 'rest_drift',
        title: 'Longer rests',
        text:
          `Average rest ${formatDuration(baseRest)} → ${formatDuration(late)} in the last two sessions.` +
          (unchanged ? ` Weight unchanged at ${formatWeight(last.top, unit)}.` : ''),
        span: `since ${formatShortDate(from)}`,
        strength: 15 + Math.min(10, Math.round(((late - baseRest) / baseRest) * 20)),
        from,
        to: last.at,
      });
    }
  }

  // Strength slipping: the last two sessions both clearly under the ones before.
  if (last.top > 0 && p.length >= 5) {
    const before = p.slice(-6, -2).map((q) => q.e1rm);
    const baseE = median(before);
    const lastTwo = p.slice(-2);
    if (baseE != null && baseE > 0 && lastTwo.every((q) => q.e1rm < baseE * REGRESSION_RATIO)) {
      const drop = Math.round((1 - (mean(lastTwo.map((q) => q.e1rm)) ?? 0) / baseE) * 100);
      out.push({
        ...base,
        id: `regressing:${eh.exerciseId}`,
        kind: 'regressing',
        title: 'Lifting less',
        text: `The last two sessions came in about ${drop}% under the ${before.length} before, judged on weight and reps together. Last: ${load(last.top, last.repsAtTop)}.`,
        span: sessionsLabel(before.length + 2),
        strength: 40,
        from: p[p.length - 2 - before.length]!.at,
        to: last.at,
      });
    }
  }

  // A stalled lift whose rests are also growing is one story, not two cards.
  const plateau = out.find((f) => f.kind === 'plateau');
  const rest = out.find((f) => f.kind === 'rest_drift');
  if (plateau && rest) {
    plateau.text += ` ${rest.text.split('.')[0]}.`;
    out.splice(out.indexOf(rest), 1);
  }

  return out;
}

export type WeekWindow = { start: number; end: number; sessions: number; volume: number };

/**
 * Rolling seven-day windows ending with the day of `end`, oldest first. The
 * last one is "this week". Whole local days, so a session at 18:05 and one at
 * 18:20 a week later never land in the same window.
 */
export function rollingWeeks(history: History, end: number, count: number): WeekWindow[] {
  const dayEnd = new Date(end);
  dayEnd.setHours(24, 0, 0, 0);
  const out: WeekWindow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const to = dayEnd.getTime() - i * 7 * DAY_MS;
    const from = to - 7 * DAY_MS;
    const inWeek = history.sessions.filter((s) => s.startedAt >= from && s.startedAt < to);
    out.push({ start: from, end: to, sessions: inWeek.length, volume: inWeek.reduce((a, s) => a + s.volume, 0) });
  }
  return out;
}

export type WeeklyVolume = {
  thisWeek: WeekWindow;
  /** Mean of the previous four weeks that had any training. Null with fewer than three. */
  average: number | null;
  change: number | null;
};

export function weeklyVolume(history: History, end: number): WeeklyVolume {
  const weeks = rollingWeeks(history, end, 5);
  const thisWeek = weeks[weeks.length - 1]!;
  const prior = weeks.slice(0, -1).filter((w) => w.sessions > 0);
  const average = prior.length >= 3 ? (mean(prior.map((w) => w.volume)) ?? null) : null;
  return {
    thisWeek,
    average,
    change: average ? (thisWeek.volume - average) / average : null,
  };
}

function weeklyFinding(history: History, end: number, unit: Unit): Finding | null {
  const w = weeklyVolume(history, end);
  if (w.average == null || w.change == null || w.thisWeek.sessions === 0) return null;
  const pct = Math.round(Math.abs(w.change) * 100);
  const high = w.thisWeek.volume > w.average * WEEKLY_VOLUME_RATIO;
  const low = w.thisWeek.volume < w.average / WEEKLY_VOLUME_RATIO;
  if (!high && !low) return null;
  return {
    id: `weekly:${high ? 'high' : 'low'}`,
    kind: high ? 'weekly_volume_high' : 'weekly_volume_low',
    title: high ? 'Heavy week' : 'Light week',
    text: `${formatVolume(w.thisWeek.volume, unit)} in the last seven days across ${sessionsLabel(w.thisWeek.sessions)}, ${pct}% ${high ? 'above' : 'below'} the four-week average of ${formatVolume(w.average, unit)}.`,
    span: '7 days',
    strength: 25,
    from: w.thisWeek.start,
    to: w.thisWeek.end,
  };
}

/**
 * The Insights list: the strongest findings across every exercise trained in
 * the last eight weeks, plus the weekly-volume check. Capped, so the screen
 * never turns into a report.
 */
export function insights(history: History, now: number, unit: Unit, limit = 5): Finding[] {
  const cutoff = now - 56 * DAY_MS;
  const all: Finding[] = [];
  for (const eh of Object.values(history.exercises)) {
    const last = eh.points[eh.points.length - 1];
    if (!last || last.at < cutoff) continue;
    all.push(...exerciseFindings(eh, unit));
  }
  const weekly = weeklyFinding(history, now, unit);
  if (weekly) all.push(weekly);
  all.push(...balanceFindings(muscleBalance(history, now)));
  all.sort((a, b) => b.strength - a.strength || b.to - a.to);

  // Breadth first. Five plateaus in a row tell you less than a plateau, a rest
  // change and a heavy week: first the strongest finding of each kind, then the
  // strongest for each exercise not yet shown, then the rest by strength.
  const picked: Finding[] = [];
  const kinds = new Set<FindingKind>();
  const shown = new Set<string>();
  const take = (f: Finding) => {
    picked.push(f);
    kinds.add(f.kind);
    if (f.exerciseId) shown.add(f.exerciseId);
  };
  for (const f of all) if (!kinds.has(f.kind) && !(f.exerciseId && shown.has(f.exerciseId))) take(f);
  for (const f of all) if (!picked.includes(f) && !(f.exerciseId && shown.has(f.exerciseId))) take(f);
  for (const f of all) if (!picked.includes(f)) take(f);
  return picked.slice(0, limit);
}

/** "+2.5", "−5" — for compact deltas. */
export function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${trimNumber(Math.abs(n))}`;
}
