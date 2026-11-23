import { test } from 'node:test';
import assert from 'node:assert/strict';
// The real engine, loaded through Node's built-in TypeScript support — no
// hand-kept copy to drift (docs/AI_TRAINER_PLAN.md, decision D10).
import {
  ageYears,
  balanceFindings,
  bodyContextFrom,
  bodyMuscle,
  buildHistory,
  changeOverFourWeeks,
  compareSession,
  exerciseFindings,
  insights,
  labFlag,
  MUSCLES,
  muscleBalance,
  muscleWeeks,
  musclesFor,
  nextTarget,
  parseLabReply,
  periodBrief,
  sessionBaseline,
  sessionBrief,
  sessionMuscles,
  sessionRecords,
  shadeLevels,
  weeklyVolume,
  workoutTargets,
} from '../src/features/analysis/index.ts';
import { MALE } from '../src/data/body/male.ts';
import { FEMALE } from '../src/data/body/female.ts';
import { EXERCISE_SEED } from '../src/data/exercises.seed.ts';

const DAY = 86_400_000;
const T0 = Date.parse('2026-09-07T18:00:00Z'); // a Monday

/**
 * Builds export-shaped rows. Each session: { day, name?, note?, effort?, status?,
 * lifts: { exerciseId: [[weight, reps, rest?, skipped?, drops?], ...] } }, where drops is
 * [[weight, reps], ...] done straight after that set.
 */
function log(sessions, exercises = {}) {
  const input = { sessions: [], exercises: [], sessionExercises: [], sets: [] };
  const ids = new Set();
  sessions.forEach((s, i) => {
    const sid = `s${i}`;
    const start = T0 + s.day * DAY;
    input.sessions.push({
      id: sid,
      name: s.name ?? 'Push',
      started_at: start,
      ended_at: start + (s.minutes ?? 60) * 60_000,
      status: s.status ?? 'completed',
      note: s.note ?? null,
      effort: s.effort ?? null,
    });
    Object.entries(s.lifts).forEach(([exId, sets], position) => {
      ids.add(exId);
      const seid = `${sid}_${exId}`;
      input.sessionExercises.push({ id: seid, session_id: sid, exercise_id: exId, position, skipped: s.skipExercise === exId ? 1 : 0 });
      sets.forEach(([weight, reps, rest = null, skipped = 0, drops = []], n) => {
        input.sets.push({
          session_exercise_id: seid,
          set_number: n + 1,
          weight_kg: weight,
          reps,
          completed_at: start + n * 180_000,
          rest_before_s: n === 0 ? null : rest,
          skipped,
        });
        drops.forEach(([dw, dr], d) => {
          input.sets.push({
            session_exercise_id: seid,
            set_number: n + 1,
            weight_kg: dw,
            reps: dr,
            completed_at: start + n * 180_000 + (d + 1) * 30_000,
            rest_before_s: null,
            skipped: 0,
            drop_index: d + 1,
          });
        });
      });
    });
  });
  for (const id of ids) {
    input.exercises.push({
      id,
      name: exercises[id]?.name ?? id,
      muscle_group: 'chest',
      is_bodyweight: exercises[id]?.bodyweight ? 1 : 0,
      weight_step: 2.5,
    });
  }
  return buildHistory(input);
}

const same = (w, r, rest = 120) => [[w, r], [w, r, rest], [w, r, rest]];

// ------------------------------------------------------------------ history

test('skipped sets, skipped exercises and unfinished sessions are left out', () => {
  const h = log([
    { day: 0, lifts: { bench: [[60, 8], [60, 8, 120], [0, 0, 90, 1]], fly: [[20, 12]] }, skipExercise: 'fly' },
    { day: 2, status: 'active', lifts: { bench: same(100, 1) } },
  ]);
  assert.equal(h.sessions.length, 1);
  const [bench] = h.sessions[0].exercises;
  assert.equal(h.sessions[0].exercises.length, 1);
  assert.equal(bench.sets.length, 2);
  assert.equal(bench.volume, 960);
  assert.equal(bench.avgRest, 120);
});

test('top weight, reps at top and volume', () => {
  const h = log([{ day: 0, lifts: { bench: [[60, 10], [70, 8, 120], [70, 6, 150]] } }]);
  const e = h.sessions[0].exercises[0];
  assert.equal(e.top, 70);
  assert.equal(e.repsAtTop, 8);
  assert.equal(e.totalReps, 24);
  assert.equal(e.volume, 600 + 560 + 420);
  assert.equal(e.avgRest, 135);
});

test('a rest from a workout left open overnight is left out of the average', () => {
  const h = log([{ day: 0, lifts: { bench: [[60, 8], [60, 8, 120], [60, 8, 36_000]] } }]);
  assert.equal(h.sessions[0].exercises[0].avgRest, 120);
});

// ------------------------------------------------------------------ records

test('a first session sets no records', () => {
  const h = log([{ day: 0, lifts: { bench: same(60, 8) } }]);
  assert.deepEqual(sessionRecords(h, 's0', 'kg'), []);
});

test('heavier weight is a weight record, and only one record per exercise', () => {
  const h = log([
    { day: 0, lifts: { bench: same(60, 8) } },
    { day: 7, lifts: { bench: same(62.5, 9) } },
  ]);
  const records = sessionRecords(h, 's1', 'kg');
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, 'weight');
  assert.match(records[0].detail, /Previous best 60 kg/);
});

test('more reps at the same weight is a reps record', () => {
  const h = log([
    { day: 0, lifts: { bench: same(62.5, 7) } },
    { day: 7, lifts: { bench: [[62.5, 8], [62.5, 7, 120], [62.5, 7, 120]] } },
  ]);
  const [r] = sessionRecords(h, 's1', 'kg');
  assert.equal(r.kind, 'reps_at_weight');
  assert.match(r.detail, /Previous best 7/);
});

test('matching the previous best is not a record', () => {
  const h = log([
    { day: 0, lifts: { bench: same(60, 8) } },
    { day: 7, lifts: { bench: same(60, 8) } },
  ]);
  assert.deepEqual(sessionRecords(h, 's1', 'kg'), []);
});

// --------------------------------------------------------------- comparison

test('comparison is against the previous session with the same name', () => {
  const h = log([
    { day: 0, name: 'Push', lifts: { bench: same(60, 8) } },
    { day: 2, name: 'Pull', lifts: { bench: same(40, 8) } },
    { day: 7, name: 'Push', lifts: { bench: same(60, 9), dips: same(0, 10) } },
  ]);
  const c = compareSession(h, 's2');
  assert.equal(c.previous.id, 's0');
  assert.equal(c.exercises.find((x) => x.exerciseId === 'bench').change, 'reps_up');
  assert.equal(c.exercises.find((x) => x.exerciseId === 'dips').change, 'new');
});

test('baseline needs three earlier sessions and flags only a large change', () => {
  const sessions = [0, 7, 14, 21].map((day) => ({ day, lifts: { bench: same(60, 8) } }));
  assert.equal(sessionBaseline(log(sessions.slice(0, 3)), 's2'), null);
  const normal = sessionBaseline(log(sessions), 's3');
  assert.equal(normal.sessions, 3);
  assert.equal(normal.volumeUnusual, false);
  const big = sessionBaseline(log([...sessions.slice(0, 3), { day: 21, lifts: { bench: same(60, 12) } }]), 's3');
  assert.equal(big.volumeUnusual, true);
  assert.ok(Math.abs(big.volumeChange - 0.5) < 1e-9);
});

// ----------------------------------------------------------------- findings

const findingsFor = (h, id) => exerciseFindings(h.exercises[id], 'kg');

test('nothing is said about a trend from fewer than three sessions', () => {
  const h = log([0, 7].map((day) => ({ day, lifts: { bench: same(60, 8) } })));
  assert.deepEqual(findingsFor(h, 'bench'), []);
});

test('plateau needs four identical sessions, not three', () => {
  const three = log([0, 7, 14].map((day) => ({ day, lifts: { push: same(25, 12) } })));
  assert.equal(findingsFor(three, 'push').some((f) => f.kind === 'plateau'), false);
  const four = log([0, 7, 14, 21].map((day) => ({ day, lifts: { push: same(25, 12) } })));
  const plateau = findingsFor(four, 'push').find((f) => f.kind === 'plateau');
  assert.ok(plateau);
  assert.match(plateau.text, /25 kg × 12 on each of the last 4 sessions/);
});

test('more reps at an unchanged weight is reported, not a plateau', () => {
  const h = log([
    [7, 7, 6],
    [7, 7, 7],
    [8, 7, 7],
    [8, 8, 7],
  ].map((reps, i) => ({ day: i * 7, lifts: { bench: reps.map((r, n) => [62.5, r, n ? 120 : null]) } })));
  const kinds = findingsFor(h, 'bench').map((f) => f.kind);
  assert.ok(kinds.includes('reps_up_weight_flat'));
  assert.ok(!kinds.includes('plateau'));
});

test('a climb that has since stalled is a plateau, not progress', () => {
  const weights = [70, 72.5, 75, 75, 75, 75];
  const h = log(weights.map((w, i) => ({ day: i * 7, lifts: { rdl: same(w, 8) } })));
  const kinds = findingsFor(h, 'rdl').map((f) => f.kind);
  assert.ok(kinds.includes('plateau'));
  assert.ok(!kinds.includes('progressing'));
});

test('rest drift: last two sessions clearly longer than the ones before', () => {
  const rests = [120, 125, 118, 122, 170, 175];
  const h = log(rests.map((rest, i) => ({ day: i * 7, lifts: { row: same(50 + i * 2.5, 10, rest) } })));
  const drift = findingsFor(h, 'row').find((f) => f.kind === 'rest_drift');
  assert.ok(drift);
  assert.match(drift.text, /02:01 → 02:52/);
});

test('small rest changes are not reported', () => {
  const rests = [120, 125, 118, 122, 130, 128];
  const h = log(rests.map((rest, i) => ({ day: i * 7, lifts: { row: same(50 + i * 2.5, 10, rest) } })));
  assert.equal(findingsFor(h, 'row').some((f) => f.kind === 'rest_drift'), false);
});

test('a stalled lift with growing rests becomes one finding', () => {
  const rests = [120, 125, 118, 122, 170, 175];
  const h = log(rests.map((rest, i) => ({ day: i * 7, lifts: { row: same(50, 10, rest) } })));
  const found = findingsFor(h, 'row');
  assert.equal(found.filter((f) => f.kind === 'plateau').length, 1);
  assert.equal(found.some((f) => f.kind === 'rest_drift'), false);
  assert.match(found.find((f) => f.kind === 'plateau').text, /Average rest/);
});

test('regression: last two sessions under the ones before by more than 5%', () => {
  const tops = [100, 100, 100, 100, 90, 90];
  const h = log(tops.map((w, i) => ({ day: i * 7, lifts: { squat: [[w, 5], [w, 5, 180]] } })));
  assert.ok(findingsFor(h, 'squat').some((f) => f.kind === 'regressing'));
});

test('insights are capped at five and spread across exercises first', () => {
  const lifts = {};
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) lifts[id] = same(40, 10);
  const h = log([0, 7, 14, 21].map((day) => ({ day, lifts })));
  const list = insights(h, T0 + 22 * DAY, 'kg');
  assert.equal(list.length, 5);
  assert.equal(new Set(list.map((f) => f.exerciseId)).size, 5);
});

test('insights ignore exercises not trained in the last eight weeks', () => {
  const h = log([0, 7, 14, 21].map((day) => ({ day, lifts: { old: same(40, 10) } })));
  assert.deepEqual(insights(h, T0 + 120 * DAY, 'kg'), []);
});

test('weekly volume needs three earlier weeks of training for an average', () => {
  const two = log([0, 7, 14].map((day) => ({ day, lifts: { bench: same(60, 8) } })));
  assert.equal(weeklyVolume(two, T0 + 14 * DAY).average, null);
  const four = log([0, 7, 14, 21, 28].map((day) => ({ day, lifts: { bench: same(60, 8) } })));
  const w = weeklyVolume(four, T0 + 28 * DAY);
  assert.equal(w.thisWeek.sessions, 1);
  assert.equal(w.average, 1440);
  assert.equal(w.change, 0);
});

// ------------------------------------------------------------------- briefs

test('session brief respects the sharing settings and carries no ids', () => {
  const h = log([
    { day: 0, lifts: { bench: same(60, 8) }, note: 'Felt strong' },
    { day: 7, lifts: { bench: same(62.5, 8) }, note: 'Shoulder tight', effort: 4 },
  ]);
  const body = { ageYears: 28, weightKg: 78.4, weightAt: T0, weightChange4wKg: -0.6, heightCm: 178, targetKg: 75 };
  const withAll = sessionBrief(h, 's1', { unit: 'kg', includeNotes: true, body });
  assert.match(withAll, /Shoulder tight/);
  assert.match(withAll, /effort 4\/5 \(Very hard\)/);
  assert.match(withAll, /BODY: age 28/);
  assert.doesNotMatch(withAll, /\bs1\b|\bs0\b/);

  const minimal = sessionBrief(h, 's1', { unit: 'kg', includeNotes: false, body: null });
  assert.doesNotMatch(minimal, /Shoulder tight|Felt strong/);
  assert.doesNotMatch(minimal, /BODY:/);
});

test('briefs use the display unit', () => {
  const h = log([0, 7, 14].map((day) => ({ day, lifts: { bench: same(100, 5) } })));
  const lb = periodBrief(h, T0 + 15 * DAY, { unit: 'lb', includeNotes: true });
  assert.match(lb, /220\.5×5/);
  assert.doesNotMatch(lb, / kg/);
});

test('a brief for a period with no sessions is empty', () => {
  const h = log([{ day: 0, lifts: { bench: same(60, 8) } }]);
  assert.equal(periodBrief(h, T0 + 200 * DAY, { unit: 'kg', includeNotes: true }), '');
});

// ----------------------------------------------------------------- health

test('lab flags come from the lab range, open ends allowed', () => {
  assert.equal(labFlag({ value: 138, refLow: null, refHigh: 100 }), 'Above range');
  assert.equal(labFlag({ value: 18, refLow: 30, refHigh: 100 }), 'Below range');
  assert.equal(labFlag({ value: 46, refLow: 40, refHigh: null }), null);
  assert.equal(labFlag({ value: null, refLow: 1, refHigh: 2 }), null);
});

test('age is whole years and rejects malformed dates', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  assert.equal(ageYears('1998-04-21', now), 28);
  assert.equal(ageYears('1998-12-01', now), 27);
  assert.equal(ageYears('21/04/1998', now), null);
  assert.equal(ageYears(null, now), null);
});

test('weight change needs a reading at least four weeks older', () => {
  const at = (d) => T0 + d * DAY;
  assert.equal(changeOverFourWeeks([{ value: 80, measured_at: at(0) }, { value: 79, measured_at: at(10) }]), null);
  const c = changeOverFourWeeks([
    { value: 80, measured_at: at(0) },
    { value: 79.5, measured_at: at(20) },
    { value: 79, measured_at: at(30) },
  ]);
  assert.equal(c.change, -1);
  const body = bodyContextFrom({ date_of_birth: '1998-04-21', target_weight_kg: 75 }, [
    { kind: 'weight', value: 80, measured_at: at(0) },
    { kind: 'height', value: 178, measured_at: at(0) },
    { kind: 'weight', value: 79, measured_at: at(30) },
  ], at(31));
  assert.equal(body.weightKg, 79);
  assert.equal(body.heightCm, 178);
  assert.equal(body.weightChange4wKg, -1);
  assert.equal(body.targetKg, 75);
});

// ------------------------------------------------------------------ targets


const sets = (...pairs) => pairs.map(([weightKg, reps]) => ({ weightKg, reps }));

test('every set at the top weight hit the same reps: add one step', () => {
  const t = nextTarget(sets([62.5, 8], [62.5, 8], [62.5, 8]), 2.5, 'kg');
  assert.equal(t.weightKg, 65);
  assert.equal(t.reps, 8);
  assert.equal(t.progress, 'weight');
});

test('a set fell short: same weight, match the best set', () => {
  const t = nextTarget(sets([62.5, 8], [62.5, 8], [62.5, 6]), 2.5, 'kg');
  assert.deepEqual([t.weightKg, t.reps, t.progress], [62.5, 8, 'reps']);
  assert.match(t.reason, /from 6 to 8/);
});

test('a pyramid with one top set: one more rep there', () => {
  const t = nextTarget(sets([60, 10], [70, 8], [80, 6]), 2.5, 'kg');
  assert.deepEqual([t.weightKg, t.reps], [80, 7]);
});

test('unloaded bodyweight: one more rep than the best set', () => {
  const t = nextTarget(sets([0, 22], [0, 17]), 2.5, 'kg');
  assert.deepEqual([t.weightKg, t.reps], [0, 23]);
});

test('workout targets come from the last session of that workout', () => {
  const h = log([
    { day: 0, name: 'Push', lifts: { bench: same(60, 8) } },
    { day: 2, name: 'Pull', lifts: { bench: same(40, 5) } },
  ]);
  assert.equal(workoutTargets(h, 'Push', ['bench'], 'kg').bench.weightKg, 62.5);
});

// ------------------------------------------------------------------ balance

test('muscle balance counts sets per group and flags a push/pull gap', () => {
  const ex = { press: { name: 'Press' }, row: { name: 'Row' }, squat: { name: 'Squat' } };
  const input = log(
    [0, 7, 14, 21].map((day) => ({ day, lifts: { press: [[60, 8], [60, 8], [60, 8], [60, 8], [60, 8], [60, 8], [60, 8], [60, 8], [60, 8]], row: same(50, 10) } })),
    ex,
  );
  // log() files every exercise under chest; give the row its own group.
  for (const s of input.sessions) for (const e of s.exercises) if (e.exerciseId === 'row') e.muscleGroup = 'back';
  const b = muscleBalance(input, T0 + 22 * DAY);
  assert.equal(b.groups.find((g) => g.group === 'chest').sets, 36);
  assert.equal(b.groups.find((g) => g.group === 'back').sets, 12);
  const kinds = balanceFindings(b).map((f) => f.id);
  assert.ok(kinds.includes('balance:push_pull'));
  assert.ok(kinds.includes('balance:no_legs'));
});

test('too few sets for a balance finding says nothing', () => {
  const h = log([{ day: 0, lifts: { press: same(60, 8) } }]);
  assert.deepEqual(balanceFindings(muscleBalance(h, T0 + DAY)), []);
});

// ------------------------------------------------------------------ lab reply

test("Claude's lab reply parses, including a Markdown table and open ranges", () => {
  const rows = parseLabReply(`Here you go:
| Marker | value | unit | low | high |
|---|---|---|---|---|
| **LDL cholesterol** | 138 | mg/dL | - | 100 |
| HDL cholesterol | 46 | mg/dL | 40 | - |
| Haemoglobin | 14,2 | g/dL | 13 | 17 |
| HIV | Negative | - | - | - |
some trailing text`);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { name: 'LDL cholesterol', value: 138, valueText: null, unit: 'mg/dL', low: null, high: 100 });
  assert.equal(rows[1].low, 40);
  assert.equal(rows[2].value, 14.2);
  assert.deepEqual([rows[3].value, rows[3].valueText, rows[3].unit], [null, 'Negative', null]);
});

test('lines without a value are skipped, not guessed', () => {
  assert.deepEqual(parseLabReply('TSH | - | mIU/L | 0.4 | 4\nno pipes here'), []);
});

// ------------------------------------------------------------------ muscles

test('exercise names map to the muscles they train, specific names first', () => {
  assert.deepEqual(musclesFor('Romanian Deadlift', 'legs').primary, ['hamstrings']);
  assert.deepEqual(musclesFor('Deadlift', 'back').primary, ['hamstrings', 'glutes', 'lower_back']);
  assert.deepEqual(musclesFor('Dumbbell Kickback', 'arms').primary, ['triceps']);
  assert.deepEqual(musclesFor('Cable Kickback', 'legs').primary, ['glutes']);
  assert.deepEqual(musclesFor('Barbell Upright Row', 'shoulders').primary, ['side_delts', 'traps']);
  assert.deepEqual(musclesFor('Incline Dumbbell Curl', 'arms').primary, ['biceps']);
  assert.deepEqual(musclesFor('Lying Leg Curl', 'legs').primary, ['hamstrings']);
});

test('the corrected mappings (review of 22 Nov 2026)', () => {
  const w = (name, group) => musclesFor(name, group);
  // Push-up angles run opposite to bench angles.
  assert.deepEqual(w('Incline Push-up', 'chest'), { primary: ['chest'], secondary: ['triceps', 'front_delts'] });
  assert.deepEqual(w('Decline Push-up', 'chest'), { primary: ['chest', 'front_delts'], secondary: ['triceps'] });
  // The clean half counts: hips, legs and traps, not only shoulders.
  assert.deepEqual(w('Clean and Press', 'full').primary, ['glutes', 'hamstrings', 'front_delts', 'traps']);
  assert.ok(w('Clean and Press', 'full').secondary.includes('quads'));
  // Free-weight pullover is chest-led; the machine one stays a lat exercise.
  assert.deepEqual(w('Dumbbell Pullover', 'chest'), { primary: ['chest'], secondary: ['lats'] });
  assert.deepEqual(w('Machine Pullover', 'back').primary, ['lats']);
  // Deadlift from the floor credits quads as a helper; a rack pull doesn't.
  assert.ok(w('Deadlift', 'back').secondary.includes('quads'));
  assert.ok(!w('Rack Pull', 'back').secondary.includes('quads'));
  // Reverse curl helps the biceps; wrist curls stay forearms only.
  assert.deepEqual(w('Reverse Curl', 'arms'), { primary: ['forearms'], secondary: ['biceps'] });
  assert.deepEqual(w('Reverse Wrist Curl', 'arms'), { primary: ['forearms'] });
  // Decline presses have a rule of their own instead of the group fallback.
  assert.deepEqual(w('Decline Barbell Press', 'none'), { primary: ['chest'], secondary: ['triceps'] });
  assert.deepEqual(w('Decline Dumbbell Press', 'none'), { primary: ['chest'], secondary: ['triceps'] });
});

test('every seeded exercise is matched by a named rule, not the group fallback', () => {
  // An unknown group makes the fallback return nothing, so a gap shows up here.
  const unmatched = EXERCISE_SEED.map(([name]) => name).filter((name) => musclesFor(name, 'none').primary.length === 0);
  assert.deepEqual(unmatched, []);
});

test('an unknown custom exercise falls back to its library group', () => {
  assert.deepEqual(musclesFor('My Weird Machine', 'back').primary, ['lats', 'upper_back']);
});

test('primary sets count 1 and secondary 0.5, per week', () => {
  const h = log([{ day: 0, lifts: { bench: same(60, 8) } }], { bench: { name: 'Bench Press' } });
  const w = muscleWeeks(h, T0 + DAY, 2);
  const row = (id) => w.muscles.find((m) => m.id === id);
  assert.deepEqual(row('chest').weekly, [0, 3]);
  assert.deepEqual(row('triceps').weekly, [0, 1.5]);
  assert.equal(row('chest').lastAt, T0);
  assert.equal(row('triceps').lastAt, null);
  assert.equal(row('chest').exercises[0].name, 'Bench Press');
});

test('one session credits its muscles: 1 per primary set, 0.5 per helper set', () => {
  const h = log([{ day: 0, lifts: { bench: same(60, 8), curl: same(12, 10) } }], {
    bench: { name: 'Bench Press' },
    curl: { name: 'Barbell Curl' },
  });
  const m = sessionMuscles(h.sessions[0]);
  assert.equal(m.chest, 3);
  assert.equal(m.triceps, 1.5);
  assert.equal(m.biceps, 3);
  assert.equal(m.forearms, 1.5);
  assert.equal(m.calves, 0);
});

// ------------------------------------------------------------------ body figure

test('shade levels run 1–5 relative to the most trained; untrained stays 0', () => {
  assert.deepEqual(shadeLevels({ a: 30, b: 24, c: 4.5, d: 0 }), { a: 5, b: 4, c: 1, d: 0 });
  assert.deepEqual(shadeLevels({ a: 0, b: 0 }), { a: 0, b: 0 });
});

test('body regions map to Forte muscles; the abductor region depends on the view', () => {
  assert.equal(bodyMuscle('RHOMBOIDS', 'back'), 'upper_back');
  assert.equal(bodyMuscle('ABDUCTORS', 'front'), 'quads');
  assert.equal(bodyMuscle('ABDUCTORS', 'back'), 'glutes');
  assert.equal(bodyMuscle('HIP_FLEXORS', 'front'), null);
});

test('the generated body outlines draw every tracked muscle on some view', () => {
  for (const body of [MALE, FEMALE]) {
    const drawn = new Set([...body.front, ...body.back].map((m) => m.muscle));
    assert.deepEqual(MUSCLES.map((m) => m.id).filter((id) => !drawn.has(id)), []);
    for (const view of [body.front, body.back]) assert.equal(new Set(view.map((m) => m.muscle)).size, view.length);
  }
});

// ------------------------------------------------------------------ drop sets

test('a drop adds volume but not a set, a top weight or reps at the top', () => {
  const h = log([{ day: 0, lifts: { bench: [[40, 5, null, 0, [[25, 8], [15, 10]]], [40, 5, 120]] } }]);
  const e = h.sessions[0].exercises[0];
  assert.equal(e.sets.length, 2);
  assert.equal(h.sessions[0].setCount, 2);
  assert.equal(e.volume, 40 * 5 + 25 * 8 + 15 * 10 + 40 * 5);
  assert.equal(e.top, 40);
  assert.equal(e.repsAtTop, 5);
  assert.equal(e.totalReps, 10);
  assert.deepEqual(e.sets[0].drops, [{ weightKg: 25, reps: 8 }, { weightKg: 15, reps: 10 }]);
  assert.equal(e.sets[1].drops, undefined);
});

test('the brief writes a drop after its set, with no rest of its own', () => {
  const h = log([{ day: 0, lifts: { bench: [[40, 5, null, 0, [[25, 8]]], [40, 5, 120]] } }], {
    bench: { name: 'Bench Press' },
  });
  const text = sessionBrief(h, 's0', { unit: 'kg', includeNotes: true, body: null });
  assert.ok(text.includes('40×5 then drop 25×8, 40×5 (rest 02:00)'));
});

test('a drop never counts toward muscle sets', () => {
  const h = log([{ day: 0, lifts: { bench: [[60, 8, null, 0, [[40, 10]]]] } }], { bench: { name: 'Bench Press' } });
  assert.equal(sessionMuscles(h.sessions[0]).chest, 1);
});
