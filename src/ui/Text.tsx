import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fonts, type TypeName, type } from './tokens';
import { useTheme } from './theme';
import type { Colors } from './tokens';

type Props = TextProps & {
  variant?: TypeName;
  color?: keyof Colors;
  /**
   * Requests the font's tabular figures. Urbanist ships none (no `tnum`
   * feature), so today this does nothing — a "1" is 14.5 dp and a "0" 26.6 dp
   * at displayL. Anything that ticks must use TabularDigits instead.
   */
  tabular?: boolean;
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
};

export type VariantTextStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight' | 'letterSpacing'
>;

/**
 * The type-ramp entry for a variant, as a style object — for components that
 * cannot use Text, such as TextInput.
 *
 * Once Urbanist has loaded it returns the weight-specific family and NO
 * fontWeight: on Android, setting a weight on top of a custom family can make
 * the platform fall back to the system font. Before load it returns the
 * system font at the mapped weight, so the first frame is never blank.
 *
 * Single-line TextInputs on Android can clip or misalign text when given a
 * lineHeight; drop it at those call sites.
 */
export function useTextStyle(variant: TypeName): VariantTextStyle {
  const { fontsReady } = useTheme();
  const base = type[variant];
  return {
    fontSize: base.fontSize,
    lineHeight: base.lineHeight,
    letterSpacing: base.letterSpacing,
    ...(fontsReady ? { fontFamily: fonts[base.weight] } : { fontWeight: mapWeight(base.weight) }),
  };
}

/**
 * The only text component. Every size, weight and colour comes from tokens, so
 * the type ramp in DESIGN.md 3.3 cannot drift.
 */
export function Text({
  variant = 'body',
  color = 'textPrimary',
  tabular,
  uppercase,
  align,
  style,
  children,
  ...rest
}: Props) {
  const { c } = useTheme();
  const typeStyle = useTextStyle(variant);
  const isNumeric =
    tabular ?? (variant === 'displayL' || variant === 'num');

  return (
    <RNText
      {...rest}
      style={[
        typeStyle,
        {
          color: c[color],
          textAlign: align,
          textTransform: uppercase || variant === 'label' ? 'uppercase' : undefined,
          fontVariant: isNumeric ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

function mapWeight(weight: keyof typeof fonts): TextStyle['fontWeight'] {
  switch (weight) {
    case 'regular':
      return '400';
    case 'medium':
      return '500';
    case 'semibold':
      return '600';
    case 'bold':
      return '700';
  }
}
