import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contrast floors for every colour pair the app actually renders.
//
// Unlike the other suites this reads src/ui/tokens.ts itself rather than a
// hand-kept mirror, so editing a token cannot slip past the check. A failure
// here means a token change made some real text unreadable — fix the token,
// do not lower the floor.

const source = readFileSync(new URL('../src/ui/tokens.ts', import.meta.url), 'utf8');

function readPalette(name) {
  const block = source.match(new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`));
  assert.ok(block, `palette "${name}" not found in tokens.ts`);
  const colours = {};
  for (const [, key, hex] of block[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6,8})'/g)) {
    colours[key] = hex;
  }
  return colours;
}

const palettes = { dark: readPalette('dark'), light: readPalette('light') };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const BACKGROUNDS = ['bgBase', 'bgRaised', 'bgSunken', 'bgElevated'];

/** [foreground, background, floor, where it is rendered] */
const PAIRS = [
  // Body text tokens can land on any surface.
  ...['textPrimary', 'textSecondary', 'textTertiary'].flatMap((fg) =>
    BACKGROUNDS.map((bg) => [fg, bg, 4.5, 'text on any surface']),
  ),
  ['accentInk', 'accent', 4.5, 'primary button label, set flash'],
  ['restInk', 'rest', 4.5, 'rest-variant button label'],
  ['rest', 'bgRaised', 4.5, 'REST label in RestPanel'],
  ['rest', 'bgElevated', 4.5, 'REST label in ResumeBar'],
  ['positive', 'bgBase', 4.5, 'progression deltas'],
  ['positive', 'bgRaised', 4.5, 'deltas inside cards'],
  ['negative', 'bgBase', 4.5, 'regression deltas'],
  ['negative', 'bgRaised', 4.5, 'regressions inside cards'],
  ['negative', 'bgElevated', 4.5, 'destructive ActionSheet items'],
  // Non-text graphics: WCAG 1.4.11 asks 3:1.
  ['focus', 'bgBase', 3, 'progress dots, chart point'],
  ['focus', 'bgRaised', 3, 'chart point inside a card'],
  ['focus', 'lineStrong', 3, 'workout progress bar fill on its track'],
  ['bgRaised', 'textSecondary', 3, 'settings switch on: thumb on track'],
  ['textTertiary', 'lineStrong', 3, 'settings switch off: thumb on track'],
];

for (const [theme, colours] of Object.entries(palettes)) {
  for (const [fg, bg, floor, where] of PAIRS) {
    test(`${theme}: ${fg} on ${bg} ≥ ${floor}:1 (${where})`, () => {
      assert.ok(colours[fg], `${theme}.${fg} missing`);
      assert.ok(colours[bg], `${theme}.${bg} missing`);
      const ratio = contrast(colours[fg], colours[bg]);
      assert.ok(ratio >= floor, `${ratio.toFixed(2)}:1 is below ${floor}:1`);
    });
  }
}

test('light: floating border visibly separates white surfaces (≥ 1.4:1)', () => {
  // bgElevated and bgRaised are both white in light; lineFloating is the only
  // thing that lifts the pill nav and bars off the cards beneath them.
  const { lineFloating, bgRaised, bgBase } = palettes.light;
  assert.ok(contrast(lineFloating, bgRaised) >= 1.4);
  assert.ok(contrast(lineFloating, bgBase) >= 1.4);
});

test('both palettes define exactly the same tokens', () => {
  assert.deepEqual(Object.keys(palettes.light).sort(), Object.keys(palettes.dark).sort());
});
