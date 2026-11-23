import { DAY_MS } from './history.ts';
import type { History, SessionEntry } from './types.ts';

/**
 * Which muscles an exercise trains, from its name.
 *
 * The library only records one group per exercise ("legs"), which can't tell
 * a leg curl from a squat. These rules read the name instead: first match
 * wins, so specific names come before general ones ("Romanian deadlift"
 * before "deadlift", "dumbbell kickback" before "kickback"). A set counts 1
 * for each primary muscle and 0.5 for each secondary one — the usual way of
 * crediting compound lifts. Names no rule knows fall back to the library's
 * group, so custom exercises still count somewhere.
 */

export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'traps'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'front_delts', label: 'Front delts' },
  { id: 'side_delts', label: 'Side delts' },
  { id: 'rear_delts', label: 'Rear delts' },
  { id: 'traps', label: 'Traps' },
  { id: 'lats', label: 'Lats' },
  { id: 'upper_back', label: 'Upper back' },
  { id: 'lower_back', label: 'Lower back' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'abs', label: 'Abs' },
  { id: 'obliques', label: 'Obliques' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'adductors', label: 'Adductors' },
  { id: 'calves', label: 'Calves' },
];

type Work = { primary: Muscle[]; secondary?: Muscle[] };

const RULES: [RegExp, Work][] = [
  // Legs, most specific first.
  [/calf/, { primary: ['calves'] }],
  [/leg curl|nordic/, { primary: ['hamstrings'], secondary: ['calves'] }],
  [/leg extension/, { primary: ['quads'] }],
  [/hip adduction/, { primary: ['adductors'] }],
  [/hip abduction/, { primary: ['glutes'] }],
  [/hip thrust|glute bridge/, { primary: ['glutes'], secondary: ['hamstrings'] }],
  [/dumbbell kickback|tricep kickback/, { primary: ['triceps'] }],
  [/kickback/, { primary: ['glutes'] }],
  [/pull-?through/, { primary: ['glutes', 'hamstrings'] }],
  [/romanian|stiff-?leg|good morning/, { primary: ['hamstrings'], secondary: ['glutes', 'lower_back'] }],
  [/sumo deadlift/, { primary: ['glutes', 'quads', 'hamstrings'], secondary: ['adductors', 'lower_back', 'traps'] }],
  // A rack pull starts above the knee, so the quads barely work; a deadlift
  // from the floor needs them to break the bar off the ground.
  [/rack pull/, { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['traps', 'upper_back', 'forearms'] }],
  [/deadlift/, { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['quads', 'traps', 'upper_back', 'forearms'] }],
  [/thruster/, { primary: ['quads', 'glutes', 'front_delts'], secondary: ['triceps', 'side_delts'] }],
  [/squat|leg press|lunge|step-?up/, { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'adductors'] }],
  [/back extension|hyperextension/, { primary: ['lower_back'], secondary: ['glutes', 'hamstrings'] }],

  // Shoulders and traps.
  [/shrug/, { primary: ['traps'] }],
  [/upright row/, { primary: ['side_delts', 'traps'] }],
  [/face pull|rear delt|reverse pec deck|reverse fly/, { primary: ['rear_delts'], secondary: ['upper_back', 'traps'] }],
  [/lateral raise/, { primary: ['side_delts'] }],
  [/front raise/, { primary: ['front_delts'] }],
  // Before the presses: the clean half is a hip-and-leg lift, not a shoulder one.
  [/clean and (press|jerk)/,
    { primary: ['glutes', 'hamstrings', 'front_delts', 'traps'], secondary: ['quads', 'side_delts', 'triceps', 'upper_back'] }],
  [/overhead press|push press|shoulder press|military|arnold|pike push|behind-the-neck|(seated|standing) dumbbell press/,
    { primary: ['front_delts', 'side_delts'], secondary: ['triceps', 'traps'] }],

  // Back.
  // The free-weight pullover is mainly a chest exercise; the machine one is a lat exercise.
  [/dumbbell pullover/, { primary: ['chest'], secondary: ['lats'] }],
  [/pullover/, { primary: ['lats'], secondary: ['chest'] }],
  [/straight-?arm/, { primary: ['lats'] }],
  [/chin-?up/, { primary: ['lats', 'biceps'], secondary: ['upper_back'] }],
  [/pulldown|pull-?up/, { primary: ['lats'], secondary: ['biceps', 'upper_back'] }],
  [/row/, { primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'] }],

  // Arms.
  [/close-?grip bench|diamond push|tricep dip|bench dip/, { primary: ['triceps'], secondary: ['chest', 'front_delts'] }],
  [/skull ?crusher|tricep|pushdown|overhead (cable )?extension|french press/, { primary: ['triceps'] }],
  [/wrist curl/, { primary: ['forearms'] }],
  [/reverse curl/, { primary: ['forearms'], secondary: ['biceps'] }],
  [/farmer/, { primary: ['forearms', 'traps'] }],
  [/hammer curl/, { primary: ['biceps', 'forearms'] }],
  [/curl/, { primary: ['biceps'], secondary: ['forearms'] }],

  // Chest.
  [/chest dip|^dip/, { primary: ['chest'], secondary: ['triceps', 'front_delts'] }],
  [/fly|crossover|pec deck/, { primary: ['chest'], secondary: ['front_delts'] }],
  // Push-up angles run opposite to bench angles: hands raised (incline) is the
  // easier, lower-chest version; feet raised (decline) loads the upper chest
  // and front delts, like an incline press.
  [/incline push-?up/, { primary: ['chest'], secondary: ['triceps', 'front_delts'] }],
  [/decline push-?up/, { primary: ['chest', 'front_delts'], secondary: ['triceps'] }],
  [/incline.*(press|push)/, { primary: ['chest', 'front_delts'], secondary: ['triceps'] }],
  [/decline.*(press|bench)/, { primary: ['chest'], secondary: ['triceps'] }],
  [/bench|chest press|floor press|push-?up/, { primary: ['chest'], secondary: ['triceps', 'front_delts'] }],

  // Core.
  [/side plank|russian twist|woodchop|pallof|bicycle/, { primary: ['obliques'], secondary: ['abs'] }],
  [/crunch|sit-?up|leg raise|knee raise|plank|ab wheel|rollout|dead bug|hollow/, { primary: ['abs'] }],

  // Whole-body lifts.
  [/power clean|hang clean|snatch/, { primary: ['glutes', 'hamstrings', 'traps'], secondary: ['quads', 'upper_back'] }],
  [/kettlebell swing/, { primary: ['glutes', 'hamstrings'], secondary: ['lower_back'] }],
  [/burpee/, { primary: ['quads', 'chest'], secondary: ['front_delts', 'triceps'] }],
  [/sled/, { primary: ['quads', 'glutes'], secondary: ['calves'] }],
  [/battle rope/, { primary: ['front_delts', 'side_delts'], secondary: ['forearms'] }],
  [/get-?up/, { primary: ['front_delts', 'abs'], secondary: ['glutes'] }],
];

const BY_GROUP: Record<string, Work> = {
  chest: { primary: ['chest'], secondary: ['triceps'] },
  back: { primary: ['lats', 'upper_back'], secondary: ['biceps'] },
  legs: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  shoulders: { primary: ['front_delts', 'side_delts'] },
  arms: { primary: ['biceps', 'triceps'] },
  core: { primary: ['abs'] },
  full: { primary: ['quads', 'glutes', 'upper_back'] },
};

/** The muscles one exercise trains. */
export function musclesFor(name: string, group: string): Work {
  const n = name.toLowerCase();
  for (const [pattern, work] of RULES) if (pattern.test(n)) return work;
  return BY_GROUP[group] ?? { primary: [] };
}

/** Credited sets per muscle in one session: 1 per primary set, 0.5 per helper set. */
export function sessionMuscles(session: SessionEntry): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as Record<Muscle, number>;
  for (const e of session.exercises) {
    const work = musclesFor(e.name, e.muscleGroup);
    for (const m of work.primary) out[m] += e.sets.length;
    for (const m of work.secondary ?? []) out[m] += e.sets.length * 0.5;
  }
  return out;
}

export type MuscleWeeks = {
  /** Week windows, oldest first; the last ends with the day of `now`. */
  weeks: { start: number; end: number }[];
  muscles: {
    id: Muscle;
    label: string;
    /** Credited sets per week, aligned with `weeks`. */
    weekly: number[];
    /** When it last got a primary set; null if never in the history. */
    lastAt: number | null;
    /** Exercises that trained it in the whole window, most sets first. */
    exercises: { name: string; sets: number; primary: boolean }[];
  }[];
};

/**
 * Credited sets per muscle per week. Whole local days, like rollingWeeks,
 * so a 18:05 and an 18:20 session a week apart never share a window.
 */
export function muscleWeeks(history: History, now: number, weeks = 12): MuscleWeeks {
  const dayEnd = new Date(now);
  dayEnd.setHours(24, 0, 0, 0);
  const windows = Array.from({ length: weeks }, (_, i) => {
    const end = dayEnd.getTime() - (weeks - 1 - i) * 7 * DAY_MS;
    return { start: end - 7 * DAY_MS, end };
  });
  const first = windows[0]!.start;

  const rows = new Map(
    MUSCLES.map((m) => [
      m.id,
      { ...m, weekly: new Array<number>(weeks).fill(0), lastAt: null as number | null, ex: new Map<string, { sets: number; primary: boolean }>() },
    ]),
  );

  for (const s of history.sessions) {
    for (const e of s.exercises) {
      const work = musclesFor(e.name, e.muscleGroup);
      const credit: [Muscle, number][] = [
        ...work.primary.map((m): [Muscle, number] => [m, 1]),
        ...(work.secondary ?? []).map((m): [Muscle, number] => [m, 0.5]),
      ];
      for (const [m, weight] of credit) {
        const row = rows.get(m)!;
        if (weight === 1 && (row.lastAt == null || s.startedAt > row.lastAt)) row.lastAt = s.startedAt;
        if (s.startedAt < first || s.startedAt >= windows[weeks - 1]!.end) continue;
        const w = windows.findIndex((x) => s.startedAt >= x.start && s.startedAt < x.end);
        if (w < 0) continue;
        row.weekly[w]! += e.sets.length * weight;
        const seen = row.ex.get(e.name) ?? { sets: 0, primary: weight === 1 };
        seen.sets += e.sets.length;
        row.ex.set(e.name, seen);
      }
    }
  }

  return {
    weeks: windows,
    muscles: [...rows.values()].map((r) => ({
      id: r.id,
      label: r.label,
      weekly: r.weekly,
      lastAt: r.lastAt,
      exercises: [...r.ex.entries()]
        .map(([name, v]) => ({ name, sets: v.sets, primary: v.primary }))
        .sort((a, b) => Number(b.primary) - Number(a.primary) || b.sets - a.sets),
    })),
  };
}
