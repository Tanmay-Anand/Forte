import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { type Colors, type TypeName } from './tokens';

/**
 * Text that never changes width as its digits change — for clocks.
 *
 * Set in Geist Mono, where every digit and the colon are exactly 0.6 em wide
 * (TABULAR_DIGIT_EM, measured from the font files), so "01:11" and "00:00"
 * occupy the same width and a ticking rest clock never shuffles. Under the
 * previous typeface each digit needed its own fixed-width cell; with a
 * monospaced face one run of text is enough, and it scales with the OS font
 * size like any other text.
 *
 * Screen readers get one element with `accessibilityLabel` (for example
 * "1 minute 42 seconds" for "01:42"); the glyphs themselves are hidden.
 */
export function TabularDigits({
  text,
  accessibilityLabel,
  variant = 'num',
  color = 'textPrimary',
  style,
  accessibilityLiveRegion,
}: {
  text: string;
  /** What a screen reader says, e.g. "1 minute 42 seconds" for "01:42". */
  accessibilityLabel: string;
  variant?: TypeName;
  color?: keyof Colors;
  style?: StyleProp<ViewStyle>;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={accessibilityLiveRegion}
      style={[{ flexDirection: 'row' }, style]}
    >
      <Text
        variant={variant}
        color={color}
        mono
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {text}
      </Text>
    </View>
  );
}
