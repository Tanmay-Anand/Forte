import React, { useEffect, useRef } from 'react';
import { View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';
import { HIT, radius, space } from '@/ui/tokens';
import { trimNumber } from '@/lib/format';

/**
 * Well height: two 48 dp steppers stacked with the 8 dp gap DESIGN.md 9
 * requires between adjacent targets, plus the 1 dp border top and bottom.
 */
const WELL_HEIGHT = HIT * 2 + space.s + 2;

/**
 * Large numeric input — DESIGN.md 5.4.1.
 *
 * Two ways to change a value, both live at once:
 *   1. the +/− steppers, with hold-to-repeat  (the "+2.5 kg" case)
 *   2. tap the number for the keypad         (the "it is 47.5 today" case)
 *
 * The steppers stand in a single column on the right rather than flanking the
 * value. Flanking cost 112 dp of width and left 40 dp for the number on a
 * 360 dp phone, so "102.5" shrank to 42% of displayL. A column costs 48 dp:
 * the value area is ~103 dp there, and "102.5" (95.5 dp in Urbanist Bold at
 * 44 pt) renders at full size. adjustsFontSizeToFit stays as the backstop for
 * wider values such as "247.5".
 *
 * There used to be a third mode, vertical drag-to-scrub. It was removed: the
 * native ScrollView claimed the gesture first whenever the screen could
 * scroll — i.e. once a few sets were logged — so it only worked sometimes, and
 * the steppers and keypad already cover every input.
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
  style,
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
  /** Outer sizing, owned by the caller: flex: 1 side by side, auto when stacked. */
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // The hold interval outlives renders, so it reads the live value through a
  // ref rather than a captured prop.
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

  return (
    <View style={style}>
      <View
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
        <Pressable
          onPress={onPressValue}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, ${trimNumber(value, decimals)} ${unit}. Tap to type a value.`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <Text variant="displayL" mono numberOfLines={1} adjustsFontSizeToFit>
            {trimNumber(value, decimals)}
          </Text>
        </Pressable>
        {/*
          A hairline between value and column, so the + of the weight well
          does not read as part of the reps value beside it.
        */}
        <View
          style={{
            // +1 for the hairline, so each stepper keeps a full 48 dp target.
            width: HIT + 1,
            height: '100%',
            justifyContent: 'center',
            gap: space.s,
            borderLeftWidth: 1,
            borderColor: c.hairline,
          }}
        >
          <Stepper
            icon="plus"
            onPress={() => bump(1)}
            onHold={() => startHold(1)}
            onRelease={stopHold}
            label={`Increase ${accessibilityLabel}`}
          />
          <Stepper
            icon="minus"
            onPress={() => bump(-1)}
            onHold={() => startHold(-1)}
            onRelease={stopHold}
            label={`Decrease ${accessibilityLabel}`}
          />
        </View>
      </View>
      <Text variant="label" color="textTertiary" align="center" style={{ marginTop: space.s }}>
        {unit}
      </Text>
    </View>
  );
}

function Stepper({
  icon,
  onPress,
  onHold,
  onRelease,
  label,
}: {
  icon: IconName;
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
        width: HIT,
        height: HIT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.bgRaised : 'transparent',
      })}
    >
      <Icon name={icon} size={20} color="textSecondary" />
    </Pressable>
  );
}
