import React from 'react';
import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { HIT, PRIMARY_ACTION_HEIGHT, radius, space } from './tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'rest';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Full-bleed 64/72dp action, DESIGN.md 3.1. */
  height?: number;
  disabled?: boolean;
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Wide letter-spacing for the headline actions: START WORKOUT, COMPLETE SET. */
  shout?: boolean;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  height = PRIMARY_ACTION_HEIGHT,
  disabled,
  wide = true,
  style,
  shout,
  accessibilityLabel,
}: Props) {
  const { c } = useTheme();

  // A light fill with dark ink, rather than a saturated brand colour: the
  // primary action is the brightest thing on screen, and that is the whole
  // signal (DESIGN.md 3.2).
  const surface: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: c.accent },
    secondary: { backgroundColor: c.bgRaised },
    ghost: { backgroundColor: 'transparent' },
    rest: { backgroundColor: c.rest },
  };

  const ink: Record<Variant, keyof typeof c> = {
    primary: 'accentInk',
    secondary: 'textPrimary',
    ghost: 'textSecondary',
    rest: 'restInk',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          minHeight: HIT,
          alignSelf: wide ? 'stretch' : 'flex-start',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          borderRadius: radius.pill,
          opacity: disabled ? 0.35 : pressed ? 0.82 : 1,
        },
        surface[variant],
        style,
      ]}
    >
      <View pointerEvents="none">
        <Text
          variant={height >= PRIMARY_ACTION_HEIGHT ? 'titleM' : 'bodyStrong'}
          color={ink[variant]}
          style={shout ? { letterSpacing: 0.4 } : undefined}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
