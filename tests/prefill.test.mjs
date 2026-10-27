import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePrefill } from './prefill.mjs';

const set = (set_number, weight_kg, reps, skipped = 0) => ({ set_number, weight_kg, reps, skipped });

// Last Chest + Triceps: a pyramid on bench press.
const lastTime = [set(1, 60, 10), set(2, 70, 8), set(3, 80, 6)];

test('set 1 pre-fills from set 1 of the last same workout', () => {
  assert.deepEqual(choosePrefill([], lastTime, false), { weightKg: 60, reps: 10 });
});

test('each later set pre-fills from the same set number last time', () => {
  assert.deepEqual(choosePrefill([set(1, 60, 10)], lastTime, false), { weightKg: 70, reps: 8 });
  assert.deepEqual(choosePrefill([set(1, 60, 10), set(2, 70, 8)], lastTime, false), {
    weightKg: 80,
    reps: 6,
  });
});

test('a skipped set today still advances the set number', () => {
  assert.deepEqual(choosePrefill([set(1, 0, 0, 1)], lastTime, false), { weightKg: 70, reps: 8 });
});

test('more sets than last time repeats today’s last set', () => {
  const today = [set(1, 60, 10), set(2, 70, 8), set(3, 82.5, 5)];
  assert.deepEqual(choosePrefill(today, lastTime, false), { weightKg: 82.5, reps: 5 });
});

test('a set skipped last time falls back to today’s last set', () => {
  const previous = [set(1, 60, 10), set(2, 0, 0, 1), set(3, 80, 6)];
  assert.deepEqual(choosePrefill([set(1, 62.5, 10)], previous, false), { weightKg: 62.5, reps: 10 });
});

test('set 1 skipped last time falls back to the first performed set', () => {
  const previous = [set(1, 0, 0, 1), set(2, 70, 8)];
  assert.deepEqual(choosePrefill([], previous, false), { weightKg: 70, reps: 8 });
});

test('no history repeats today’s last set, then uses the defaults', () => {
  assert.deepEqual(choosePrefill([set(1, 40, 12)], null, false), { weightKg: 40, reps: 12 });
  assert.deepEqual(choosePrefill([], null, false), { weightKg: 20, reps: 8 });
  assert.deepEqual(choosePrefill([], null, true), { weightKg: 0, reps: 8 });
});
