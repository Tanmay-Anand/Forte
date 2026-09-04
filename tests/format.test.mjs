import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimNumber } from './format.mjs';

// Regression suite for a bug found on the emulator: the original implementation
// stripped trailing zeroes unconditionally, so reps of 10 rendered as "1" and a
// skipped set's 0 rendered as an empty box.

test('integers survive intact — the 10-reps regression', () => {
  assert.equal(trimNumber(10, 0), '10');
  assert.equal(trimNumber(20, 0), '20');
  assert.equal(trimNumber(100, 0), '100');
  assert.equal(trimNumber(8, 0), '8');
});

test('zero renders as a zero, not an empty string', () => {
  assert.equal(trimNumber(0, 0), '0');
  assert.equal(trimNumber(0, 2), '0');
});

test('trailing zeroes after a decimal point are dropped', () => {
  assert.equal(trimNumber(60.0), '60');
  assert.equal(trimNumber(62.5), '62.5');
  assert.equal(trimNumber(62.25), '62.25');
  assert.equal(trimNumber(1.5, 2), '1.5');
});

test('weights that end in zero keep their magnitude', () => {
  assert.equal(trimNumber(20), '20');
  assert.equal(trimNumber(100), '100');
  assert.equal(trimNumber(110), '110');
  assert.equal(trimNumber(2.5), '2.5');
});

test('rounds to the requested precision', () => {
  assert.equal(trimNumber(62.499, 2), '62.5');
  assert.equal(trimNumber(8.6, 0), '9');
});

test('non-finite input degrades to zero rather than NaN on screen', () => {
  assert.equal(trimNumber(Number.NaN), '0');
  assert.equal(trimNumber(Number.POSITIVE_INFINITY), '0');
});
