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
 */
export const palette = {
  dark: {
    bgBase: '#0A0A0B',
    bgRaised: '#141517',
    bgSunken: '#101113',
    bgElevated: '#1B1D20',
    hairline: '#1F2124',
    lineStrong: '#2C3034',
    textPrimary: '#F3F4F6',
    textSecondary: '#9AA0A6',
    textTertiary: '#62676E',
    accent: '#F3F4F6',
    accentInk: '#0A0A0B',
    focus: '#5FD3BC',
    positive: '#72CBA4',
    negative: '#DD8B80',
    rest: '#8FB4E8',
    restInk: '#0A0A0B',
  },
  light: {
    bgBase: '#FAFAFA',
    bgRaised: '#FFFFFF',
    bgSunken: '#F2F3F5',
    bgElevated: '#FFFFFF',
    hairline: '#E7E8EB',
    lineStrong: '#D2D5D9',
    textPrimary: '#111214',
    textSecondary: '#5B6068',
    textTertiary: '#8B9199',
    accent: '#16181B',
    accentInk: '#FFFFFF',
    focus: '#0F9E8A',
    positive: '#1C7A55',
    negative: '#B4463A',
    rest: '#2A63BE',
    restInk: '#FFFFFF',
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
  displayXl: { fontSize: 68, lineHeight: 72, letterSpacing: -2.5, weight: 'bold' },
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
export const radius = { chip: 10, input: 14, card: 20, pill: 999, none: 0 } as const;

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
  /** Space screens must leave at the bottom so content clears the floating bar. */
  clearance: 64 + 18 + 16,
} as const;

export const duration = {
  instant: 100,
  fast: 120,
  base: 200,
  slow: 220,
} as const;
