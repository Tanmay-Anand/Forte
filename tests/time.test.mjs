import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spokenDuration } from './time.mjs';

// What TalkBack says for a clock: words, not "zero one colon four two".

test('minutes and seconds', () => {
  assert.equal(spokenDuration(102), '1 minute 42 seconds');
  assert.equal(spokenDuration(120), '2 minutes');
});

test('singulars and zero', () => {
  assert.equal(spokenDuration(1), '1 second');
  assert.equal(spokenDuration(0), '0 seconds');
  assert.equal(spokenDuration(-5), '0 seconds');
});

test('hours, skipping empty units', () => {
  assert.equal(spokenDuration(3600), '1 hour');
  assert.equal(spokenDuration(3661), '1 hour 1 minute 1 second');
  assert.equal(spokenDuration(5405.9), '1 hour 30 minutes 5 seconds');
});
