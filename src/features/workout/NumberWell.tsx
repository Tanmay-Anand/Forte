import React, { useEffect, useRef } from 'react';
import { View, Pressable, PanResponder } from 'react-native';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { trimNumber } from '@/lib/format';

const WELL_HEIGHT = 88;
/** Pixels of vertical travel per increment when scrubbing. */
const DRAG_PIXELS_PER_STEP = 12;

/**
 * Large numeric input — DESIGN.md 5.4.1.
 *
 * Three ways to change a value, all live simultaneously, because which one is
 * fastest depends on the situation:
 *   1. steppers, with hold-to-repeat  (the "+2.5 kg" case)
 *   2. tap the number for the keypad  (the "it is 47.5 today" case)
 *   3. vertical drag to scrub         (the "jump 20 kg" case)
 */
export function NumberWell({
  value,
  step,
  min = 0,
  max = 999,
  decimals = 2,
  unit,
  onChange,
  onPressValue,
  accessibilityLabel,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  unit: string;
  onChange: (next: number) => void;
  onPressValue: () => void;
  accessibilityLabel: string;
}) {
  const { c } = useTheme();
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // PanResponder and the hold interval are created once, so they must read the
  // live value through a ref rather than a captured prop.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const round = (n: number) => Number(n.toFixed(decimals));
  const apply = (n: number) => {
    const next = round(clamp(n));
    valueRef.current = next;
    onChange(next);
  };

  const bump = (direction: 1 | -1) => {
    apply(valueRef.current + direction * step);
  };

  const stopHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  };

  /** Hold-to-repeat, accelerating so long adjustments stay quick. */
  const startHold = (direction: 1 | -1) => {
    stopHold();
    let ticks = 0;
    holdTimer.current = setInterval(() => {
      ticks += 1;
      const multiplier = ticks > 12 ? 4 : ticks > 6 ? 2 : 1;
      apply(valueRef.current + direction * step * multiplier);
    }, 90);
  };

  useEffect(() => stopHold, []);

  const dragOrigin = useRef(value);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        dragOrigin.current = valueRef.current;
      },
      onPanResponderMove: (_, g) => {
        const steps = Math.round(-g.dy / DRAG_PIXELS_PER_STEP);
        apply(dragOrigin.current + steps * step);
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }}>
      <View
        {...pan.panHandlers}
        style={{
          height: WELL_HEIGHT,
          backgroundColor: c.bgSunken,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: c.lineStrong,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <Stepper
          glyph="−"
          onPress={() => bump(-1)}
          onHold={() => startHold(-1)}
          onRelease={stopHold}
          label={`Decrease ${accessibilityLabel}`}
        />
        <Pressable
          onPress={onPressValue}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, ${trimNumber(value, decimals)} ${unit}. Tap to type a value.`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <Text variant="displayL" numberOfLines={1} adjustsFontSizeToFit>
            {trimNumber(value, decimals)}
          </Text>
        </Pressable>
        <Stepper
          glyph="+"
          onPress={() => bump(1)}
          onHold={() => startHold(1)}
          onRelease={stopHold}
          label={`Increase ${accessibilityLabel}`}
        />
      </View>
      <Text variant="label" color="textTertiary" align="center" style={{ marginTop: space.s }}>
        {unit}
      </Text>
    </View>
  );
}

function Stepper({
  glyph,
  onPress,
  onHold,
  onRelease,
  label,
}: {
  glyph: string;
  onPress: () => void;
  onHold: () => void;
  onRelease: () => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onHold}
      delayLongPress={320}
      onPressOut={onRelease}
      style={({ pressed }) => ({
        width: 56,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.bgRaised : 'transparent',
      })}
    >
      <Text variant="titleL" color="textSecondary">
        {glyph}
      </Text>
    </Pressable>
  );
}
