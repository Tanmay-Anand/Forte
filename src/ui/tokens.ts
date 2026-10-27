/**
 * Design tokens — DESIGN.md section 3.
 * The single source of truth for colour, type, spacing and motion.
 * Nothing in the app may hard-code a colour or a font size.
 */

export type ThemeName = 'dark' | 'light';

/**
 * Near-monochrome by design. Colour is a scarce resource here:
 *   accent   a light fill for the single primary action (dark ink on top)
 *   focus    one restrained teal, for data and "now" indicators only
 *   rest     one restrained blue, and only while a rest timer runs
 * Everything else is neutral. No large saturated fields anywhere.
 *
 *   lineFloating  border of floating surfaces (pill nav, resume/update bars).
 *                 In light, bgElevated is white like the cards beneath it, so
 *                 this border (lineStrong, ~1.5:1 on white) is what lifts it —
 *                 depth by line, never by shadow. In dark the tone step does
 *                 that work and the border stays a hairline.
 *   scrim         behind modal sheets, both themes.
 *
 * Contrast floors are enforced by tests/contrast.test.mjs.
 */
export const palette = {
  dark: {
    bgBase: '#0A0A0B',
    bgRaised: '#141517',
    bgSunken: '#101113',
    bgElevated: '#1B1D20',
    hairline: '#1F2124',
    lineStrong: '#2C3034',
    lineFloating: '#1F2124',
    textPrimary: '#F3F4F6',
    textSecondary: '#9AA0A6',
    textTertiary: '#80868E',
    accent: '#F3F4F6',
    accentInk: '#0A0A0B',
    focus: '#5FD3BC',
    positive: '#72CBA4',
    negative: '#DD8B80',
    rest: '#8FB4E8',
    restInk: '#0A0A0B',
    scrim: '#000000B8',
  },
  light: {
    bgBase: '#FAFAFA',
    bgRaised: '#FFFFFF',
    bgSunken: '#F2F3F5',
    bgElevated: '#FFFFFF',
    hairline: '#E7E8EB',
    lineStrong: '#D2D5D9',
    lineFloating: '#D2D5D9',
    textPrimary: '#111214',
    textSecondary: '#5B6068',
    textTertiary: '#686E76',
    accent: '#16181B',
    accentInk: '#FFFFFF',
    focus: '#0B7F6F',
    positive: '#1C7A55',
    negative: '#B4463A',
    rest: '#2A63BE',
    restInk: '#FFFFFF',
    scrim: '#000000B8',
  },
} as const;

/** Widened to string so the light and dark palettes share one type. */
export type Colors = Record<keyof (typeof palette)['dark'], string>;

/** Urbanist, with a system fallback until the font finishes loading. */
export const fonts = {
  regular: 'Urbanist_400Regular',
  medium: 'Urbanist_500Medium',
  semibold: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
} as const;

export type FontWeightName = keyof typeof fonts;

/** Type ramp. Numeric styles use tabular figures so digits do not jitter. */
export const type = {
  displayL: { fontSize: 44, lineHeight: 48, letterSpacing: -1.2, weight: 'bold' },
  displayM: { fontSize: 30, lineHeight: 36, letterSpacing: -0.7, weight: 'bold' },
  titleL: { fontSize: 23, lineHeight: 29, letterSpacing: -0.4, weight: 'semibold' },
  titleM: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, weight: 'semibold' },
  body: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, weight: 'regular' },
  bodyStrong: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, weight: 'semibold' },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.7, weight: 'medium' },
  num: { fontSize: 15, lineHeight: 20, letterSpacing: -0.1, weight: 'medium' },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: -0.1, weight: 'regular' },
} as const;

export type TypeName = keyof typeof type;

/** Extra tracking for headline actions (START WORKOUT, COMPLETE SET) — Button's `shout`. */
export const tracking = { shout: 0.4 } as const;

/**
 * Widest digit advance in each Urbanist weight, as a fraction of the font
 * size, measured from the font files. Urbanist has no tabular figures (no
 * `tnum`), so TabularDigits sizes every digit cell to this to stop a ticking
 * clock from changing width. Re-measure if the typeface changes.
 */
export const TABULAR_DIGIT_EM: Record<FontWeightName, number> = {
  regular: 0.5955,
  medium: 0.598,
  semibold: 0.601,
  bold: 0.6045,
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

/** Softer, larger radii than the original spec — the minimal reference language. */
export const radius = { input: 14, card: 20, pill: 999, none: 0 } as const;

export const gutter = { mobile: 20, tablet: 32, desktop: 40 } as const;

/** Minimum touch target, DESIGN.md section 9. */
export const HIT = 48;
export const PRIMARY_ACTION_HEIGHT = 60;
export const WORKOUT_ACTION_HEIGHT = 68;

/** Floating pill navigation, DESIGN.md section 4. */
export const NAV = {
  height: 64,
  button: 52,
  inset: 18,
  /**
   * Fallback bottom space for tab screens, used only until PillNav has been
   * measured (src/ui/nav-overlay.ts). It omits the bars and the safe-area inset.
   */
  clearance: 64 + 18 + 16,
} as const;

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
 * Spring physics for motion that has no fixed duration. The nav disc is just
 * shy of critically damped: it arrives quickly and settles without a bounce,
 * which would read as playful rather than precise.
 */
export const spring = {
  nav: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;
