import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { EFFORT_LABELS } from '@/features/analysis';

/**
 * "How hard was it?" — one optional tap after the workout, never during it.
 *
 * Five labelled steps rather than RPE 1–10: ten 48 dp targets don't fit a
 * 360 dp row, and a word is quicker to answer than a number. Tapping the
 * selected step again clears it. Same selected treatment as Segmented.
 */
export function EffortPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (effort: number | null) => void;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="How hard was it?"
      style={{
        flexDirection: 'row',
        backgroundColor: c.bgSunken,
        borderRadius: radius.pill,
        padding: space.xs,
      }}
    >
      {EFFORT_LABELS.map((label, i) => {
        const effort = i + 1;
        const active = value === effort;
        return (
          <Pressable
            key={label}
            onPress={() => onChange(active ? null : effort)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label}, ${effort} of 5`}
            style={{
              flex: 1,
              minHeight: 44,
              paddingHorizontal: 2,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: active ? c.textSecondary : 'transparent',
              backgroundColor: active ? c.bgElevated : 'transparent',
            }}
          >
            <Text
              variant="caption"
              color={active ? 'textPrimary' : 'textSecondary'}
              align="center"
              numberOfLines={2}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
