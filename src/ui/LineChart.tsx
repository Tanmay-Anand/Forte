import React, { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from './theme';
import { space } from './tokens';

export type ChartPoint = { x: number; y: number; label: string };

/** Minimum sessions before a line is a trend rather than a coincidence. */
export const MIN_POINTS_FOR_TREND = 3;

/**
 * Rounds an axis to values a person would actually choose — 35 and 40, not
 * 33.75 and 41.25. Steps come from the 1 / 2 / 2.5 / 5 family so gym weights
 * (2.5 kg plates) and rep counts both land on sensible marks.
 */
function niceAxis(min: number, max: number, intervals = 2): { lo: number; hi: number; step: number } {
  const span = max - min;
  if (span <= 0) {
    const pad = Math.max(Math.abs(max) * 0.1, 1);
    return { lo: max - pad, hi: max + pad, step: pad };
  }
  // Head-room so the top point never touches the frame.
  const target = (span * 1.35) / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalised = target / magnitude;
  const stepFactor = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  const step = stepFactor * magnitude;

  // The floor sits near the data, not at zero: 60 -> 67.5 kg must read as a
  // climb rather than a flat line. It is always labelled, so it cannot mislead.
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return { lo, hi: hi === lo ? lo + step : hi, step };
}

/**
 * Single-series line chart — DESIGN.md 5.6.
 * No area fill, no gradient, no legend, no dual axis. Hand-rolled on
 * react-native-svg rather than a charting library: the shapes here are simple,
 * and it keeps Skia out of the bundle (IMPLEMENTATION_PLAN.md 6.3).
 */
export function LineChart({
  points,
  height = 220,
  formatValue,
  onSelect,
}: {
  points: ChartPoint[];
  height?: number;
  formatValue: (v: number) => string;
  onSelect?: (index: number) => void;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const padding = { top: 14, right: 10, bottom: 30, left: 52 };

  const geometry = useMemo(() => {
    if (points.length === 0 || width === 0) return null;

    const values = points.map((p) => p.y);
    const { lo, hi, step } = niceAxis(Math.min(...values), Math.max(...values));

    const plotW = Math.max(1, width - padding.left - padding.right);
    const plotH = Math.max(1, height - padding.top - padding.bottom);

    const xFor = (i: number) =>
      padding.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const yFor = (v: number) => padding.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

    const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.y) }));
    const path = coords
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(' ');

    // Gridlines on the rounded steps, so every horizontal has a readable value.
    const lines: { v: number; y: number }[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) lines.push({ v, y: yFor(v) });

    // Up to four date ticks, always including the first and last session.
    const maxTicks = Math.min(4, points.length);
    const tickIdx =
      points.length <= maxTicks
        ? points.map((_, i) => i)
        : Array.from({ length: maxTicks }, (_, k) =>
            Math.round((k * (points.length - 1)) / (maxTicks - 1)),
          );

    return { coords, path, lines, xFor, tickIdx };
  }, [points, width, height]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry ? (
        <>
          <Svg width={width} height={height}>
            {geometry.lines.map((g, i) => (
              <Line
                key={i}
                x1={padding.left}
                y1={g.y}
                x2={width - padding.right}
                y2={g.y}
                stroke={c.hairline}
                strokeWidth={1}
              />
            ))}
            <Path
              d={geometry.path}
              stroke={c.textPrimary}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            {geometry.coords.map((pt, i) => {
              const isLast = i === points.length - 1;
              const active = selected === i || (selected === null && isLast);
              return (
                <Circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 6 : 4}
                  // The most recent session is filled — it is the one the user
                  // is trying to beat next time.
                  fill={active ? c.focus : c.bgBase}
                  stroke={active ? c.focus : c.textPrimary}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>

          {/* Axis values sit outside the SVG so they use the type ramp. */}
          {geometry.lines.map((g, i) => (
            <View
              key={i}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: g.y - 8, width: padding.left - 8 }}
            >
              <Text variant="caption" color="textTertiary" align="right">
                {formatValue(g.v)}
              </Text>
            </View>
          ))}

          {/* Touch targets sized for a gym, not for a mouse. */}
          <View
            style={{
              position: 'absolute',
              left: padding.left,
              right: padding.right,
              top: 0,
              height: height - padding.bottom,
              flexDirection: 'row',
            }}
          >
            {points.map((p, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}, ${formatValue(p.y)}`}
                onPress={() => {
                  setSelected(selected === i ? null : i);
                  onSelect?.(i);
                }}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          {/*
            Date ticks. Laid out with flex across the plot width rather than
            absolutely positioned per point: absolute children inside the
            short tick row were being dropped on Android, and evenly spaced
            labels read the same at this density.
          */}
          <View
            pointerEvents="none"
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: -padding.bottom + 14,
              marginLeft: padding.left,
              marginRight: padding.right,
            }}
          >
            {geometry.tickIdx.map((idx, k) => (
              <Text
                key={idx}
                variant="caption"
                color="textTertiary"
                align={k === 0 ? 'left' : k === geometry.tickIdx.length - 1 ? 'right' : 'center'}
              >
                {points[idx]?.label ?? ''}
              </Text>
            ))}
          </View>

          {selected !== null && points[selected] ? (
            <View style={{ marginTop: space.m }}>
              <Text variant="num" color="focus">
                {points[selected]?.label} · {formatValue(points[selected]?.y ?? 0)}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
