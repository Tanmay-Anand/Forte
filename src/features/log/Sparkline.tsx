import React from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '@/ui/theme';
import type { Colors } from '@/ui/tokens';

/**
 * A trend in a list row: one line, no axes, scaled to its own min and max.
 * A flat series draws a flat line in the middle — a plateau should look like
 * one — in a quieter colour than a moving one.
 */
export function Sparkline({
  values,
  width = 64,
  height = 18,
  color,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: keyof Colors;
}) {
  const { c } = useTheme();
  if (values.length < 2) return <Svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + ((width - pad * 2) * i) / (values.length - 1);
      const y = flat ? height / 2 : height - pad - ((height - pad * 2) * (v - min)) / (max - min);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = c[color ?? (flat ? 'textTertiary' : 'textPrimary')];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={points} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
