/**
 * Design tokens — DESIGN.md section 3, DESIGN_SYSTEM_FORTE.md section 2.
 * The single source of truth for colour, type, spacing and motion.
 * Nothing in the app may hard-code a colour or a font size.
 *
 * The Logbook direction (Nov 2026): a training notebook. Type, rules and
 * tables do the work; fills are rare and shadows absent. Light by default,
 * with a dark theme that keeps every role and re-tunes the values.
 */

export type ThemeName = 'dark' | 'light';

/**
 * Colour is scarce and always means something:
 *   accent    ink fill for the single primary action (and the set flash)
 *   now       lake blue from the logo: live data, today, the latest point
 *   rest      blue, only while a rest timer runs, and only as a strip or
 *             clock (it sits close to `now` in hue, so it never appears as a
 *             bare dot or marker); restSoft is the strip behind it
 *   positive / negative   beside a change, and for destructive actions
 * Everything else is neutral.
 *
 *   lineFloating  border of floating surfaces (tab bar, resume/update bars,
 *                 sheets). In light, bgElevated is white like bgRaised, so
 *                 this line is what separates them — depth by line, never
 *                 by shadow.
 *   scrim         behind modal sheets, both themes.
 *
 * Keep each palette a flat `key: '#hex'` object with the same keys in both:
 * tests/contrast.test.mjs reads this file with a regex and enforces floors.
 */
export const palette = {
  dark: {
    bgBase: '#111213',
    bgRaised: '#17181A',
    bgSunken: '#1B1C1F',
    bgElevated: '#1C1D20',
    hairline: '#24262A',
    lineStrong: '#393C41',
    lineFloating: '#2C2E33',
    textPrimary: '#ECECEA',
    textSecondary: '#A4A7AC',
    textTertiary: '#868A90',
    accent: '#ECECEA',
    accentInk: '#111213',
    now: '#6CC5D8',
    positive: '#72CBA4',
    negative: '#F08094',
    rest: '#8FB4E8',
    restInk: '#111213',
    restSoft: '#16202D',
    scrim: '#000000B8',
  },
  light: {
    bgBase: '#FCFCFB',
    bgRaised: '#FFFFFF',
    bgSunken: '#F2F2EF',
    bgElevated: '#FFFFFF',
    hairline: '#E8E8E5',
    lineStrong: '#D3D3CF',
    lineFloating: '#D3D3CF',
    textPrimary: '#141414',
    textSecondary: '#585B60',
    textTertiary: '#6B6E73',
    accent: '#141414',
    accentInk: '#FFFFFF',
    now: '#10708C',
    positive: '#1C7A55',
    negative: '#B3263E',
    rest: '#2A63BE',
    restInk: '#FFFFFF',
    restSoft: '#EEF3FB',
    scrim: '#000000B8',
  },
} as const;

/** Widened to string so the light and dark palettes share one type. */
export type Colors = Record<keyof (typeof palette)['dark'], string>;

/**
 * Colours that live outside the running app: the launcher icon's ground and
 * the body map's five shades (pale to deep, from the logo's tones). Read by
 * tools/bake-brand.mjs and tools/bake-body.mjs; app.json repeats iconGround
 * as the adaptive-icon background.
 */
export const brand = {
  iconGround: '#E9F5F8',
  bodyScale: {
    light: ['#D3EAF0', '#A9D5E1', '#6FB2C6', '#3A8FA8', '#10708C'],
    dark: ['#163640', '#1D5262', '#2A7489', '#4A9DB2', '#6CC5D8'],
  },
} as const;

/**
 * Geist for text, Geist Mono for numbers. Geist's digits are proportional
 * (0.38–0.69 em); Geist Mono's are all exactly 0.6 em, so anything that ticks
 * or lines up in a column (sets, weights, clocks) is set in mono.
 */
export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

export const monoFonts = {
  regular: 'GeistMono_400Regular',
  medium: 'GeistMono_500Medium',
  semibold: 'GeistMono_600SemiBold',
  bold: 'GeistMono_700Bold',
} as const;

export type FontWeightName = keyof typeof fonts;

/**
 * Type ramp. Few sizes, one weight for emphasis (600), sentence case
 * throughout — labels are no longer uppercased. `mono` entries use Geist Mono.
 */
export const type = {
  displayL: { fontSize: 32, lineHeight: 38, letterSpacing: -1.1, weight: 'semibold', mono: false },
  displayM: { fontSize: 26, lineHeight: 32, letterSpacing: -0.8, weight: 'semibold', mono: false },
  titleL: { fontSize: 22, lineHeight: 28, letterSpacing: -0.6, weight: 'semibold', mono: false },
  titleM: { fontSize: 17, lineHeight: 22, letterSpacing: -0.3, weight: 'semibold', mono: false },
  body: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1, weight: 'regular', mono: false },
  bodyStrong: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1, weight: 'semibold', mono: false },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0, weight: 'medium', mono: false },
  num: { fontSize: 14, lineHeight: 20, letterSpacing: 0, weight: 'medium', mono: true },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0, weight: 'regular', mono: false },
} as const;

export type TypeName = keyof typeof type;

/** Extra tracking for headline actions — Button's `shout`. Kept small in Geist. */
export const tracking = { shout: 0.2 } as const;

/**
 * Digit advance in Geist Mono, as a fraction of the font size: 0.6 em for
 * every digit in every weight (measured from the font files). TabularDigits
 * sizes each cell to this, so a ticking clock never changes width.
 */
export const TABULAR_DIGIT_EM: Record<FontWeightName, number> = {
  regular: 0.6,
  medium: 0.6,
  semibold: 0.6,
  bold: 0.6,
};

/** 4pt base grid. */
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Small, quiet radii: rules and type carry the layout, so shapes don't need
 * to be soft to feel friendly. Sheets use `card + 8` on their top corners.
 */
export const radius = { input: 10, card: 12, button: 12, chip: 8, pill: 999, none: 0 } as const;

export const gutter = { mobile: 20, tablet: 32, desktop: 40 } as const;

/** Minimum touch target, DESIGN.md section 9. */
export const HIT = 48;
export const PRIMARY_ACTION_HEIGHT = 56;
export const WORKOUT_ACTION_HEIGHT = 60;

/** The labelled tab bar, DESIGN.md section 4: fixed, outside the scroll area. */
export const TAB_BAR = { height: 64 } as const;


/** Motion durations in ms. Every timed animation reads one of these. */
export const duration = {
  instant: 100,
  fast: 120,
  base: 200,
  slow: 220,
  /** Set-completion flash: accent fill and inverted text fading back to the logged style. */
  flash: 520,
  /** Reduced motion: how long the flash holds, fully inverted, before clearing with no fade. */
  flashHold: 400,
} as const;

/**
 * Spring physics for motion that has no fixed duration. Just shy of
 * critically damped: it arrives quickly and settles without a bounce.
 */
export const spring = {
  tab: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;
