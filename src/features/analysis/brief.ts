import { formatVolume, formatWeight, plural, trimNumber, type Unit } from '../../lib/format.ts';
import { formatDuration, formatMinutes, formatShortDate } from '../../lib/time.ts';
import { sessionBaseline } from './compare.ts';
import { exerciseFindings, rollingWeeks, weeklyVolume } from './findings.ts';
import { DAY_MS, MAX_REST_FOR_AVERAGES_S, findSession, previousSameName } from './history.ts';
import { balanceFindings, muscleBalance } from './balance.ts';
import { formatTarget, workoutTargets } from './targets.ts';
import { effortLabel, type History, type PerformedSet, type SessionEntry } from './types.ts';

/**
 * The text handed to Claude: rules first, then numbers the app has already
 * calculated. Claude is asked to explain, never to do arithmetic, and is given
 * only what the person's sharing settings allow.
 *
 * Used by the app (share sheet) and by the PC companion (`claude -p`), so both
 * send exactly the same thing.
 */

export type BodyContext = {
  ageYears?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  weightAt?: number | null;
  /** Change over the four weeks before the latest weigh-in. */
  weightChange4wKg?: number | null;
  targetKg?: number | null;
};

export type BriefOptions = {
  unit: Unit;
  includeNotes: boolean;
  /** Only passed when the person has allowed body data to be shared. */
  body?: BodyContext | null;
};

const TRAINING_RULES = `You are reviewing one person's strength-training log from the Forte app.
Rules:
- Use only the numbers given. Cite them with their dates. Do no arithmetic the log already shows.
- Be specific and factual. No praise, encouragement, motivational phrases or exclamation marks.
- Say when a change is small enough to be ordinary session-to-session variation, and when there is too little data to call a trend.
- "Calculated" lines come from fixed rules in the app; you may explain or question them.
- No medical advice. If a note mentions pain or discomfort, say only that it is worth keeping an eye on.
- Rest is the time before a set, in minutes:seconds. Effort is the person's own 1-5 rating of the whole session.
- "then drop" is a drop set: the same set continued straight away at a lower weight, with no rest. It counts as one set; its reps add to volume.
Answer in plain text with "- " bullets, in this shape:
One sentence on the overall picture.
What changed: up to 4 bullets.
What to watch or try next time: up to 3 bullets, each tied to a number above.`;

function setLine(sets: PerformedSet[], unit: Unit): string {
  return sets
    .map((s) => {
      const one = (w: number, r: number) => (w > 0 ? `${formatWeight(w, unit, false)}×${r}` : `BW×${r}`);
      // Drops follow their set with no rest: "40×5 then drop 25×8".
      const load = [one(s.weightKg, s.reps), ...(s.drops ?? []).map((d) => `drop ${one(d.weightKg, d.reps)}`)].join(' then ');
      if (s.restBeforeS == null) return load;
      // Same cut-off as the averages: a workout left open is a break, not a rest.
      return s.restBeforeS > MAX_REST_FOR_AVERAGES_S
        ? `${load} (after a break of over 20 min)`
        : `${load} (rest ${formatDuration(s.restBeforeS)})`;
    })
    .join(', ');
}

function sessionHeader(s: SessionEntry, unit: Unit, includeNotes: boolean): string[] {
  const effort = effortLabel(s.effort);
  const lines = [
    `${s.name}, ${formatShortDate(s.startedAt)}: ${formatMinutes(s.durationMs)}, ${plural(s.setCount, 'set')}, volume ${formatVolume(s.volume, unit)}${effort ? `, effort ${s.effort}/5 (${effort})` : ''}.`,
  ];
  if (includeNotes && s.note) lines.push(`Note: "${s.note}"`);
  return lines;
}

function bodyLines(body: BodyContext | null | undefined, unit: Unit): string[] {
  if (!body) return [];
  const parts: string[] = [];
  if (body.ageYears != null) parts.push(`age ${body.ageYears}`);
  if (body.heightCm != null) parts.push(`height ${trimNumber(body.heightCm, 1)} cm`);
  if (body.weightKg != null) {
    parts.push(
      `bodyweight ${formatWeight(body.weightKg, unit)}${body.weightAt ? ` on ${formatShortDate(body.weightAt)}` : ''}` +
        (body.weightChange4wKg != null
          ? ` (${body.weightChange4wKg >= 0 ? '+' : '−'}${formatWeight(Math.abs(body.weightChange4wKg), unit)} over four weeks)`
          : ''),
    );
  }
  if (body.targetKg != null) parts.push(`target bodyweight ${formatWeight(body.targetKg, unit)}`);
  return parts.length ? ['', `BODY: ${parts.join(', ')}.`] : [];
}

export function sessionBrief(history: History, sessionId: string, options: BriefOptions): string {
  const { unit, includeNotes } = options;
  const session = findSession(history, sessionId);
  if (!session) return '';
  const previous = previousSameName(history, session).slice(0, 3).reverse();
  const baseline = sessionBaseline(history, sessionId);

  const lines = [TRAINING_RULES, '', 'LATEST SESSION', ...sessionHeader(session, unit, includeNotes)];
  for (const e of session.exercises) lines.push(`- ${e.name}: ${setLine(e.sets, unit)}`);

  if (baseline) {
    const pct = Math.round(baseline.volumeChange * 100);
    lines.push(
      '',
      `Calculated: volume is ${Math.abs(pct)}% ${pct >= 0 ? 'above' : 'below'} the median of the previous ${baseline.sessions} ${session.name} sessions (${formatShortDate(baseline.from)} – ${formatShortDate(baseline.to)}); the app ${baseline.volumeUnusual ? 'counts this as outside normal variation' : 'counts this as within normal variation'}.`,
    );
  }

  lines.push(
    '',
    previous.length
      ? `THE PREVIOUS ${previous.length} ${session.name.toUpperCase()} SESSIONS, oldest first`
      : 'There are no earlier sessions of this workout to compare with.',
  );
  for (const s of previous) {
    lines.push(...sessionHeader(s, unit, includeNotes));
    for (const e of s.exercises) lines.push(`- ${e.name}: ${setLine(e.sets, unit)}`);
  }

  const findings = session.exercises.flatMap((e) => {
    const eh = history.exercises[e.exerciseId];
    if (!eh) return [];
    const upTo = { ...eh, points: eh.points.filter((p) => p.at <= session.startedAt) };
    return exerciseFindings(upTo, unit).map((f) => `- ${e.name}: ${f.title}. ${f.text}`);
  });
  if (findings.length) lines.push('', 'CALCULATED FROM ALL HISTORY', ...findings);

  const targets = workoutTargets(
    history,
    session.name,
    session.exercises.map((e) => e.exerciseId),
    unit,
  );
  const targetLines = session.exercises
    .filter((e) => targets[e.exerciseId])
    .map((e) => `- ${e.name}: ${formatTarget(targets[e.exerciseId]!, unit)}. ${targets[e.exerciseId]!.reason}`);
  if (targetLines.length) {
    lines.push('', 'CALCULATED NEXT-SESSION TARGETS (double progression: add weight once every set reaches the same reps)', ...targetLines);
  }

  lines.push(...bodyLines(options.body, unit));
  lines.push('', 'Review the latest session against the previous ones.');
  return lines.join('\n');
}

export function periodBrief(history: History, end: number, options: BriefOptions, days = 56): string {
  const { unit, includeNotes } = options;
  const from = end - days * DAY_MS;
  const sessions = history.sessions.filter((s) => s.startedAt > from && s.startedAt <= end);
  if (!sessions.length) return '';

  const lines = [
    TRAINING_RULES,
    '',
    `PERIOD: ${formatShortDate(sessions[0]!.startedAt)} to ${formatShortDate(sessions[sessions.length - 1]!.startedAt)}, ${sessions.length} sessions.`,
    '',
    'ROLLING WEEKLY VOLUME, oldest first',
    ...rollingWeeks(history, end, Math.round(days / 7)).map(
      (w) => `- 7 days to ${formatShortDate(w.end)}: ${plural(w.sessions, 'session')}, ${formatVolume(w.volume, unit)}`,
    ),
  ];
  const weekly = weeklyVolume(history, end);
  if (weekly.change != null) {
    const pct = Math.round(weekly.change * 100);
    lines.push(`Calculated: the last 7 days are ${Math.abs(pct)}% ${pct >= 0 ? 'above' : 'below'} the four-week average.`);
  }

  const balance = muscleBalance(history, end);
  if (balance.total) {
    lines.push(
      '',
      'SETS PER MUSCLE GROUP, last 4 weeks',
      ...balance.groups.map((g) => `- ${g.label}: ${g.sets}`),
      ...balanceFindings(balance).map((f) => `Calculated: ${f.title}. ${f.text}`),
    );
  }

  const rated = sessions.filter((s) => s.effort != null);
  if (rated.length) {
    lines.push('', 'EFFORT RATINGS', ...rated.map((s) => `- ${formatShortDate(s.startedAt)} ${s.name}: ${s.effort}/5`));
  }

  lines.push(
    '',
    'PER EXERCISE, one line per session: date, top set, total reps, volume, average rest',
  );
  const exercises = Object.values(history.exercises)
    .map((eh) => ({ ...eh, points: eh.points.filter((p) => p.at > from && p.at <= end) }))
    .filter((eh) => eh.points.length)
    .sort((a, b) => b.points.length - a.points.length);
  for (const eh of exercises) {
    lines.push(`${eh.name}:`);
    for (const p of eh.points) {
      const top = p.top > 0 ? `${formatWeight(p.top, unit, false)}×${p.repsAtTop}` : `BW×${p.repsAtTop}`;
      lines.push(
        `- ${formatShortDate(p.at)}: ${top}, ${p.totalReps} reps, ${formatVolume(p.volume, unit)}, rest ${p.avgRest != null ? formatDuration(p.avgRest) : '—'}`,
      );
    }
    const full = history.exercises[eh.exerciseId];
    const found = full ? exerciseFindings({ ...full, points: full.points.filter((p) => p.at <= end) }, unit) : [];
    for (const f of found) lines.push(`  Calculated: ${f.title}. ${f.text}`);
  }

  if (includeNotes) {
    const notes = sessions.filter((s) => s.note);
    if (notes.length) {
      lines.push('', 'SESSION NOTES', ...notes.map((s) => `- ${formatShortDate(s.startedAt)} ${s.name}: "${s.note}"`));
    }
  }

  lines.push(...bodyLines(options.body, unit));
  lines.push('', 'Review the whole period: progress, stalls, and anything in rest, volume or effort worth attention.');
  return lines.join('\n');
}

// ------------------------------------------------------------------ health

export type LabValue = {
  at: number;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
};

export type LabSeries = { marker: string; category: string; values: LabValue[] };

const HEALTH_RULES = `You are looking at one person's recorded blood-test results from the Forte app, alongside a short summary of their training.
Rules:
- You are not giving a diagnosis or medical advice. Say so once, briefly, at the end.
- Use only the values given, with their dates and each lab's own reference range.
- "Outside range" flags were worked out by the app from the lab's range; repeat them, don't recalculate.
- Describe changes between reports and whether they are large relative to the range. Say when there are too few reports to call a trend.
- Where a marker is commonly affected by training, bodyweight change or recent hard exercise, say so plainly and as a possibility, not a conclusion.
- Suggest which results would be worth discussing with a doctor, without alarm.
Answer in plain text with "- " bullets: a one-sentence overview, then "Worth noting" (up to 5 bullets), then "Questions to take to a doctor" (up to 3 bullets).`;

function labValueText(v: LabValue): string {
  const value = v.value != null ? trimNumber(v.value, 2) : (v.valueText ?? '—');
  const unit = v.unit ? ` ${v.unit}` : '';
  const rangeText =
    v.refLow != null && v.refHigh != null
      ? `range ${trimNumber(v.refLow, 2)}–${trimNumber(v.refHigh, 2)}`
      : v.refLow != null
        ? `range above ${trimNumber(v.refLow, 2)}`
        : v.refHigh != null
          ? `range below ${trimNumber(v.refHigh, 2)}`
          : 'no range recorded';
  const flag = labFlag(v);
  return `${formatShortDate(v.at)}: ${value}${unit} (${rangeText})${flag ? `, ${flag}` : ''}`;
}

/** "Above range" / "Below range" from the lab's own range; null when inside or unknown. */
export function labFlag(v: Pick<LabValue, 'value' | 'refLow' | 'refHigh'>): string | null {
  if (v.value == null) return null;
  if (v.refHigh != null && v.value > v.refHigh) return 'Above range';
  if (v.refLow != null && v.value < v.refLow) return 'Below range';
  return null;
}

export function healthBrief(
  labs: LabSeries[],
  history: History | null,
  end: number,
  options: BriefOptions,
): string {
  const { unit } = options;
  const lines = [HEALTH_RULES, '', 'RESULTS, oldest first for each marker'];
  for (const series of labs) {
    lines.push(`${series.marker} (${series.category}):`);
    for (const v of series.values) lines.push(`- ${labValueText(v)}`);
  }
  if (history && history.sessions.length) {
    const recent = history.sessions.filter((s) => s.startedAt > end - 56 * DAY_MS);
    const weekly = weeklyVolume(history, end);
    lines.push(
      '',
      `TRAINING, last 8 weeks: ${recent.length} strength sessions` +
        (weekly.average != null ? `, about ${formatVolume(weekly.average, unit)} lifted per week` : '') +
        (recent.length ? `, last session ${formatShortDate(recent[recent.length - 1]!.startedAt)}.` : '.'),
    );
  }
  lines.push(...bodyLines(options.body, unit));
  lines.push('', 'Review these results.');
  return lines.join('\n');
}
