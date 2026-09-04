import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { fonts, type TypeName, type } from './tokens';
import { useTheme } from './theme';
import type { Colors } from './tokens';

type Props = TextProps & {
  variant?: TypeName;
  color?: keyof Colors;
  /** Tabular figures so digits do not jitter as a timer counts. */
  tabular?: boolean;
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
};

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
  const { c, fontsReady } = useTheme();
  const base = type[variant];
  const isNumeric =
    tabular ?? (variant === 'displayXl' || variant === 'displayL' || variant === 'num');

  return (
    <RNText
      {...rest}
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          letterSpacing: base.letterSpacing,
          // Falls back to the platform font until Urbanist has loaded, so the
          // first frame is never blank.
          fontFamily: fontsReady ? fonts[base.weight] : undefined,
          fontWeight: fontsReady ? undefined : mapWeight(base.weight),
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
