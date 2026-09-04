import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE,
  isPaused,
  isResting,
  pause,
  reset,
  restElapsedSeconds,
  resume,
  start,
  stop,
} from './rest-timer.mjs';

const T0 = 1_700_000_000_000; // fixed epoch so tests are deterministic
const sec = (n) => n * 1000;

test('idle state reports no rest', () => {
  assert.equal(restElapsedSeconds(IDLE, T0), 0);
  assert.equal(isResting(IDLE), false);
});

test('counts upward from zero', () => {
  const s = start(T0);
  assert.equal(restElapsedSeconds(s, T0), 0);
  assert.equal(restElapsedSeconds(s, T0 + sec(1)), 1);
  assert.equal(restElapsedSeconds(s, T0 + sec(92)), 92);
});

test('elapsed is derived, so a 10-minute background gap is counted correctly', () => {
  // The critical case: no interval ran during this period at all.
  const s = start(T0);
  assert.equal(restElapsedSeconds(s, T0 + sec(600)), 600);
});

test('pause freezes the count', () => {
  const s = pause(start(T0), T0 + sec(30));
  assert.equal(isPaused(s), true);
  assert.equal(restElapsedSeconds(s, T0 + sec(30)), 30);
  // Time passes while paused; the value must not move.
  assert.equal(restElapsedSeconds(s, T0 + sec(300)), 30);
});

test('resume continues from the frozen value', () => {
  let s = start(T0);
  s = pause(s, T0 + sec(30));
  s = resume(s, T0 + sec(300)); // resumed after 4.5 minutes of pause
  assert.equal(isPaused(s), false);
  assert.equal(restElapsedSeconds(s, T0 + sec(300)), 30);
  assert.equal(restElapsedSeconds(s, T0 + sec(310)), 40);
});

test('pause and resume can cycle repeatedly without drift', () => {
  let s = start(T0);
  let clock = T0;
  for (let i = 0; i < 5; i++) {
    clock += sec(10);
    s = pause(s, clock);
    clock += sec(120); // long pause, must contribute nothing
    s = resume(s, clock);
  }
  assert.equal(restElapsedSeconds(s, clock), 50);
});

test('reset returns to zero and keeps running', () => {
  let s = start(T0);
  s = reset(T0 + sec(45));
  assert.equal(restElapsedSeconds(s, T0 + sec(45)), 0);
  assert.equal(restElapsedSeconds(s, T0 + sec(50)), 5);
  assert.equal(isResting(s), true);
});

test('reset while paused clears the pause', () => {
  let s = pause(start(T0), T0 + sec(20));
  s = reset(T0 + sec(25));
  assert.equal(isPaused(s), false);
  assert.equal(restElapsedSeconds(s, T0 + sec(35)), 10);
});

test('stop returns the duration to store and clears the timer', () => {
  const s = start(T0);
  const { state, elapsedS } = stop(s, T0 + sec(102));
  assert.equal(elapsedS, 102);
  assert.equal(isResting(state), false);
  assert.equal(restElapsedSeconds(state, T0 + sec(200)), 0);
});

test('stop while paused stores the frozen duration', () => {
  const s = pause(start(T0), T0 + sec(60));
  const { elapsedS } = stop(s, T0 + sec(999));
  assert.equal(elapsedS, 60);
});

test('the documented worked example: set 3 done, rest 1:42, start set 4', () => {
  // DESIGN.md 5.4.2
  const s = start(T0);
  const { elapsedS } = stop(s, T0 + sec(102));
  assert.equal(elapsedS, 102); // 1:42
});

test('surviving process death: state rebuilt from stored fields is unchanged', () => {
  const live = start(T0);
  // Simulate a kill and relaunch: only the three columns come back.
  const rehydrated = {
    startedAt: live.startedAt,
    pausedAt: live.pausedAt,
    accumulatedS: live.accumulatedS,
  };
  assert.equal(restElapsedSeconds(rehydrated, T0 + sec(75)), 75);
});

test('a clock that moves backwards never produces negative rest', () => {
  const s = start(T0);
  assert.equal(restElapsedSeconds(s, T0 - sec(30)), 0);
});
