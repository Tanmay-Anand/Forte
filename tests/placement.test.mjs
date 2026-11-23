import { test } from 'node:test';
import assert from 'node:assert/strict';
// The real rules, loaded through Node's built-in TypeScript support.
import { placementSlots } from '../src/features/workout/placement.ts';

const day = ['Bench Press', 'Incline Dumbbell Press', 'Tricep Pushdown'];
const pick = (slots) => slots.map((s) => [s.key, s.index]);

test('on the first of three: Next, Second to last and Last, named by neighbours', () => {
  const slots = placementSlots(day, 0);
  assert.deepEqual(pick(slots), [
    ['next', 1],
    ['second-last', 2],
    ['last', 3],
  ]);
  assert.equal(slots[0].hint, 'Right after Bench Press, before Incline Dumbbell Press');
  assert.equal(slots[1].hint, 'Before Tricep Pushdown');
  assert.equal(slots[2].hint, 'After Tricep Pushdown');
});

test('second to last merges into Next when they are the same place', () => {
  assert.deepEqual(pick(placementSlots(day, 1)), [
    ['next', 2],
    ['last', 3],
  ]);
});

test('on the last exercise there is one place, so nothing to ask', () => {
  const slots = placementSlots(day, 2);
  assert.deepEqual(pick(slots), [['next', 3]]);
  assert.equal(slots[0].hint, 'After Tricep Pushdown, at the end');
});

test('never offers a place before the exercise being worked on', () => {
  const long = ['A', 'B', 'C', 'D', 'E'];
  for (let current = 0; current < long.length; current++) {
    for (const slot of placementSlots(long, current)) assert.ok(slot.index > current);
  }
});

test('slots are distinct and in order', () => {
  const long = ['A', 'B', 'C', 'D', 'E'];
  for (let current = 0; current < long.length; current++) {
    const idx = placementSlots(long, current).map((s) => s.index);
    assert.deepEqual(idx, [...new Set(idx)].sort((a, b) => a - b));
  }
});

test('an empty workout just adds', () => {
  assert.deepEqual(pick(placementSlots([], -1)), [['last', 0]]);
  assert.deepEqual(pick(placementSlots([], 0)), [['last', 0]]);
});

test('an out-of-range current index is treated as the last exercise', () => {
  assert.deepEqual(pick(placementSlots(day, 9)), [['next', 3]]);
});
