/**
 * Writes sample/forte-backup-sample.json: eight weeks of invented training in
 * Forte's export format, so the companion can be tried before a real backup
 * exists. Deterministic, so the sample is the same on every run.
 *
 * Format v2, with effort ratings, body measurements and three blood reports,
 * so every part of the companion has something to show.
 *
 * Patterns built in on purpose, for the analysis to find:
 *   Bench Press      weight flat at 62.5 kg, reps rising
 *   Tricep Pushdown  25 kg x 12 for the last five sessions (plateau)
 *   Barbell Row      rest creeping up, numbers unchanged
 *   Squat            steady weight increases
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (s) => Math.round(s * (0.85 + rand() * 0.3));

const ex = (id, name, equipment, muscle_group, weight_step = 2.5) => ({
  id, name, equipment, muscle_group, is_custom: 0, weight_step, is_bodyweight: 0, archived_at: null,
});
const exercises = [
  ex('ex_bench', 'Bench Press', 'barbell', 'chest'),
  ex('ex_incline', 'Incline Dumbbell Press', 'dumbbell', 'chest', 2),
  ex('ex_pushdown', 'Tricep Pushdown', 'cable', 'arms'),
  ex('ex_row', 'Barbell Row', 'barbell', 'back'),
  ex('ex_pulldown', 'Lat Pulldown', 'cable', 'back'),
  ex('ex_curl', 'Barbell Curl', 'barbell', 'arms'),
  ex('ex_squat', 'Squat', 'barbell', 'legs'),
  ex('ex_rdl', 'Romanian Deadlift', 'barbell', 'legs'),
  ex('ex_legpress', 'Leg Press', 'machine', 'legs', 5),
];

const days = {
  1: ['Chest + Triceps', ['ex_bench', 'ex_incline', 'ex_pushdown']],
  3: ['Back + Biceps', ['ex_row', 'ex_pulldown', 'ex_curl']],
  5: ['Legs', ['ex_squat', 'ex_rdl', 'ex_legpress']],
};

/** Per exercise and week index (0..7): [weight, reps per set, base rest seconds]. */
function plan(id, w) {
  switch (id) {
    case 'ex_bench': return w < 2 ? [60, [8, 8, 7], 140] : [62.5, w < 5 ? [7, 7, 6] : [8, 8, 7 + (w > 6 ? 1 : 0)], 140];
    case 'ex_incline': return [w < 4 ? 22 : 24, [10, 9, 8], 110];
    case 'ex_pushdown': return w < 3 ? [22.5 + w * 1.25 > 25 ? 25 : 22.5, [12, 12, 11], 90] : [25, [12, 12, 12], 90];
    case 'ex_row': return [50, [10, 10, 10], 120 + w * 7];
    case 'ex_pulldown': return [55 + (w >= 4 ? 5 : 0), [10, 10, 9], 100];
    case 'ex_curl': return [30, [10, 9, 8], 90];
    case 'ex_squat': return [80 + w * 2.5, [6, 6, 5], 180];
    case 'ex_rdl': return [70 + (w >= 3 ? 5 : 0), [8, 8, 8], 150];
    case 'ex_legpress': return [140 + Math.floor(w / 2) * 10, [12, 12, 10], 120];
  }
}

const sessions = [];
const sessionExercises = [];
const sets = [];
const start = new Date('2026-09-21T18:00:00+05:30'); // a Monday

for (let w = 0; w < 8; w++) {
  for (const [dowText, [name, exIds]] of Object.entries(days)) {
    const dow = Number(dowText);
    const day = new Date(start.getTime() + (w * 7 + dow - 1) * 86_400_000);
    if (w === 5 && dow === 3) continue; // one missed session, as real logs have
    const sid = `s_${w}_${dow}`;
    let t = day.getTime() + Math.round(rand() * 20) * 60_000;
    const startedAt = t;
    exIds.forEach((exId, position) => {
      const seid = `sx_${w}_${dow}_${position}`;
      sessionExercises.push({ id: seid, session_id: sid, exercise_id: exId, position, skipped: 0, ad_hoc: 0 });
      const [weight, repsList, baseRest] = plan(exId, w);
      repsList.forEach((reps, i) => {
        const rest = i === 0 ? null : jitter(baseRest);
        t += (rest ?? 120) * 1000 + 40_000;
        sets.push({
          id: `set_${w}_${dow}_${position}_${i}`, session_exercise_id: seid, set_number: i + 1,
          weight_kg: weight, reps, completed_at: t, rest_before_s: rest, skipped: 0,
        });
      });
      t += 90_000;
    });
    sessions.push({
      id: sid, day_of_week: dow, name, started_at: startedAt, ended_at: t + 120_000, status: 'completed',
      note: w === 6 && dow === 1 ? 'Shoulder felt tight on the last bench set.' : null,
      effort: w < 2 ? null : 2 + ((w + dow) % 3),
      current_index: 0, rest_started_at: null, rest_paused_at: null, rest_accumulated_s: 0, pending_rest_s: null,
    });
  }
}

const bundle = {
  format: 'forte-export',
  schemaVersion: 3,
  exportedAt: Date.parse('2026-11-14T20:00:00+05:30'),
  exercises,
  routineDays: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day_of_week: d, name: days[d]?.[0] ?? null, is_rest: days[d] ? 0 : 1, updated_at: start.getTime(),
  })),
  routineExercises: Object.entries(days).flatMap(([d, [, ids]]) =>
    ids.map((exercise_id, position) => ({ id: `rx_${d}_${position}`, day_of_week: Number(d), exercise_id, position })),
  ),
  sessions,
  sessionExercises,
  sets,
  settings: [
    { key: 'unit', value: '"kg"' },
    { key: 'claudeIncludeNotes', value: 'true' },
    { key: 'claudeIncludeBody', value: 'true' },
  ],
  profile: [{ id: 1, date_of_birth: '1998-04-21', sex: 'male', target_weight_kg: 75, updated_at: start.getTime() }],
  bodyMeasurements: [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `bm_w${i}`,
      kind: 'weight',
      value: Math.round((79.6 - i * 0.18 + (rand() - 0.5) * 0.4) * 10) / 10,
      measured_at: start.getTime() + i * 7 * 86_400_000 - 12 * 3_600_000,
      note: null,
    })),
    { id: 'bm_h', kind: 'height', value: 178, measured_at: start.getTime(), note: null },
    { id: 'bm_waist', kind: 'waist', value: 84, measured_at: start.getTime() + 40 * 86_400_000, note: null },
  ],
  aiAnalyses: [],
  labMarkers: [
    { id: 'lm_ldl', name: 'LDL cholesterol', category: 'Lipids', default_unit: 'mg/dL', is_custom: 0 },
    { id: 'lm_hdl', name: 'HDL cholesterol', category: 'Lipids', default_unit: 'mg/dL', is_custom: 0 },
    { id: 'lm_vitd', name: 'Vitamin D (25-OH)', category: 'Vitamins and minerals', default_unit: 'ng/mL', is_custom: 0 },
  ],
  labReports: [
    ['lr_mar', '2026-03-14'],
    ['lr_jun', '2026-06-20'],
    ['lr_sep', '2026-09-12'],
  ].map(([id, date]) => ({
    id, taken_at: Date.parse(`${date}T12:00:00+05:30`), lab_name: null, category: 'Lipids',
    file_name: null, file_path: null, mime_type: null, note: null, created_at: Date.parse(`${date}T12:00:00+05:30`),
  })),
  labResults: [
    ['lr_mar', 'lm_ldl', 152, null, 100], ['lr_jun', 'lm_ldl', 145, null, 100], ['lr_sep', 'lm_ldl', 138, null, 100],
    ['lr_mar', 'lm_hdl', 44, 40, null], ['lr_jun', 'lm_hdl', 45, 40, null], ['lr_sep', 'lm_hdl', 46, 40, null],
    ['lr_sep', 'lm_vitd', 18, 30, 100],
  ].map(([report_id, marker_id, value, ref_low, ref_high], i) => ({
    id: `lx_${i}`, report_id, marker_id, value, value_text: null,
    unit: marker_id === 'lm_vitd' ? 'ng/mL' : 'mg/dL', ref_low, ref_high, source: 'manual',
  })),
};

mkdirSync(path.join(ROOT, 'sample'), { recursive: true });
const out = path.join(ROOT, 'sample', 'forte-backup-sample.json');
writeFileSync(out, JSON.stringify(bundle, null, 2));
console.log(`Wrote ${sessions.length} sessions, ${sets.length} sets to ${out}`);
