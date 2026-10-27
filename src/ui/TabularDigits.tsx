import React, { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { TABULAR_DIGIT_EM, type, type Colors, type TypeName } from './tokens';

/**
 * Text whose digits each sit in a fixed-width cell, so a ticking clock never
 * changes width.
 *
 * Urbanist has no tabular figures: at displayM a "1" is ~10 dp narrower than a
 * "0", so "01:11" and "00:00" are different widths and the rest clock visibly
 * shuffled every second. Each digit here gets a cell as wide as the font's
 * widest digit (TABULAR_DIGIT_EM); separators such as ":" keep their natural
 * width. Cells scale with the OS font size, as the glyphs do.
 *
 * For clocks only. Static numbers (the number wells, set tables) keep
 * proportional figures: fixed cells would make "102.5" ~12 dp wider, past the
 * width budget of a number well on a 360 dp phone.
 *
 * Screen readers get one element with `accessibilityLabel`; the individual
 * glyphs are hidden from them.
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
  const base = type[variant];
  // The cell is the rendered width of a "0" — Urbanist's widest digit in every
  // weight — measured off-screen. Measuring rather than predicting matters:
  // Android 14+ scales large text non-linearly, so fontSize × fontScale
  // overshoots and spread the digits apart at 200% text. The token-based
  // estimate only covers the first frame, before the measurement lands.
  const [measured, setMeasured] = useState<number | null>(null);
  const cell = measured ?? Math.ceil(TABULAR_DIGIT_EM[base.weight] * base.fontSize + base.letterSpacing);

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
        style={{ position: 'absolute', opacity: 0 }}
        onLayout={(e) => {
          const width = Math.ceil(e.nativeEvent.layout.width);
          if (width > 0 && width !== measured) setMeasured(width);
        }}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        0
      </Text>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <View
            key={i}
            style={{ width: cell, alignItems: 'center' }}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Text variant={variant} color={color}>
              {ch}
            </Text>
          </View>
        ) : (
          <Text
            key={i}
            variant={variant}
            color={color}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {ch}
          </Text>
        ),
      )}
    </View>
  );
}
