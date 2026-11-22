import { formatShortDate } from '../../lib/time.ts';
import { DAY_MS } from './history.ts';
import type { Finding } from './findings.ts';
import type { History } from './types.ts';

/**
 * Muscle-group balance: performed sets per group over the last four weeks,
 * from each exercise's muscle group in the library. Sets, not volume, because
 * a set of leg press and a set of curls are not comparable in kilograms.
 */

export const BALANCE_DAYS = 28;

const LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full: 'Full body',
};

export type MuscleBalance = {
  from: number;
  to: number;
  total: number;
  groups: { group: string; label: string; sets: number }[];
};

export function muscleBalance(history: History, now: number, days = BALANCE_DAYS): MuscleBalance {
  const from = now - days * DAY_MS;
  const counts = new Map<string, number>();
  for (const s of history.sessions) {
    if (s.startedAt <= from || s.startedAt > now) continue;
    for (const e of s.exercises) counts.set(e.muscleGroup, (counts.get(e.muscleGroup) ?? 0) + e.sets.length);
  }
  const groups = [...counts.entries()]
    .map(([group, sets]) => ({ group, label: LABELS[group] ?? group, sets }))
    .sort((a, b) => b.sets - a.sets);
  return { from, to: now, total: groups.reduce((a, g) => a + g.sets, 0), groups };
}

/** Below this many sets in the window, nothing is said: too little to call a pattern. */
const MIN_SETS = 24;
/** Chest and back count as uneven when one has more than 1.5 times the other. */
const PUSH_PULL_RATIO = 1.5;

/**
 * The two imbalances worth a card: chest against back (the classic push/pull
 * gap), and no leg work at all while everything else is trained.
 */
export function balanceFindings(b: MuscleBalance): Finding[] {
  if (b.total < MIN_SETS) return [];
  const sets = (g: string) => b.groups.find((x) => x.group === g)?.sets ?? 0;
  const span = `${formatShortDate(b.from)} – ${formatShortDate(b.to)}`;
  const out: Finding[] = [];

  const chest = sets('chest');
  const back = sets('back');
  const more = Math.max(chest, back);
  const less = Math.min(chest, back);
  if (more >= 12 && more > less * PUSH_PULL_RATIO) {
    const [hi, lo] = chest >= back ? (['Chest', 'back'] as const) : (['Back', 'chest'] as const);
    out.push({
      id: 'balance:push_pull',
      kind: 'muscle_balance',
      title: 'Uneven split',
      text: `${hi} ${more} sets against ${lo} ${less} in the last four weeks, ${span}.`,
      span: '4 weeks',
      strength: 21,
      from: b.from,
      to: b.to,
    });
  }

  if (sets('legs') === 0) {
    out.push({
      id: 'balance:no_legs',
      kind: 'muscle_balance',
      title: 'No leg work',
      text: `No leg sets in the last four weeks, against ${b.total} sets for the rest of the body.`,
      span: '4 weeks',
      strength: 20,
      from: b.from,
      to: b.to,
    });
  }
  return out;
}
