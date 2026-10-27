// Plain-JS mirror of spokenDuration from src/lib/time.ts so the screen-reader
// wording can be tested with `node --test` without a React Native toolchain.
export function spokenDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const parts = [
    [Math.floor(s / 3600), 'hour'],
    [Math.floor((s % 3600) / 60), 'minute'],
    [s % 60, 'second'],
  ];
  const spoken = parts.filter(([n]) => n > 0).map(([n, u]) => `${n} ${u}${n === 1 ? '' : 's'}`);
  return spoken.length ? spoken.join(' ') : '0 seconds';
}
