import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui/theme';
import { radius } from '@/ui/tokens';

/**
 * Where a value sits against the lab's own range, drawn as a line: the range
 * is the darker stretch, the value an ink tick. Neutral on purpose, like
 * FlagChip: it is arithmetic, not a judgement, so nothing turns red. The
 * words beside it ("Above range", the numbers) carry the meaning; the bar is
 * a glance aid and is hidden from screen readers.
 *
 * Renders nothing when there is no numeric value or no bound to compare with.
 */
export function RangeBar({
  value,
  low,
  high,
  width = 96,
}: {
  value: number | null;
  low: number | null;
  high: number | null;
  width?: number;
}) {
  const { c } = useTheme();
  if (value == null || (low == null && high == null)) return null;

  // The scale runs half a range beyond each bound, or from zero to twice the
  // one bound there is, so an in-range value sits near the middle.
  let min: number;
  let max: number;
  if (low != null && high != null && high > low) {
    const span = high - low;
    min = low - span / 2;
    max = high + span / 2;
  } else if (high != null) {
    min = 0;
    max = high * 2;
  } else {
    min = low! / 2;
    max = low! * 2;
  }
  if (!(max > min)) return null;
  const at = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min))) * width;

  const from = low != null ? at(low) : 0;
  const to = high != null ? at(high) : width;
  const tick = at(value);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height: 12, justifyContent: 'center' }}
    >
      <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: c.hairline }} />
      <View
        style={{
          position: 'absolute',
          left: from,
          width: Math.max(2, to - from),
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: c.lineStrong,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - 3, tick - 1.5)),
          width: 3,
          height: 12,
          borderRadius: radius.pill,
          backgroundColor: c.textPrimary,
        }}
      />
    </View>
  );
}
