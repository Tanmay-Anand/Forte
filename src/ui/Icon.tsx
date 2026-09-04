import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from './theme';
import type { Colors } from './tokens';

export type IconName = keyof typeof Feather.glyphMap;

/**
 * The only way to draw an icon.
 *
 * The app uses no emoji and no glyph characters as iconography. A "✓" typed
 * into a Text is at the mercy of whichever font the platform substitutes — it
 * shifts baseline, changes weight between devices, and on some Android builds
 * renders as a colour emoji in the middle of a monochrome UI. Feather strokes
 * are vectors: same weight, same size, same colour, everywhere.
 *
 * Multiplication signs in "62.5 × 8" are typography, not icons, and stay as
 * text.
 */
export function Icon({
  name,
  size = 18,
  color = 'textSecondary',
}: {
  name: IconName;
  size?: number;
  color?: keyof Colors;
}) {
  const { c } = useTheme();
  return <Feather name={name} size={size} color={c[color]} />;
}
