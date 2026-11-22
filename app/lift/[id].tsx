import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { EmptyState, Screen, Segmented, Spacer } from '@/ui/primitives';
import { LineChart, MIN_POINTS_FOR_TREND } from '@/ui/LineChart';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getExercise } from '@/db/queries/routine';
import {
  getProgressSeries,
  getProgressSummary,
  metricValue,
  type ProgressMetric,
  type ProgressPoint,
} from '@/db/queries/progress';
import { formatVolume, formatWeight, toDisplayWeight, trimNumber, type Unit } from '@/lib/format';
import { formatDuration, formatShortDate, relativeDays } from '@/lib/time';
import { useSettings } from '@/store/settings';

const METRICS: { value: ProgressMetric; label: string }[] = [
  { value: 'weight', label: 'Top set' },
  { value: 'volume', label: 'Volume' },
  { value: 'reps', label: 'Reps' },
  { value: 'rest', label: 'Rest' },
];

/**
 * Lift — DESIGN.md 5.6. One exercise, one page: am I getting stronger at
 * this? A headline number with its change, the trend, a short ruled list of
 * facts, and every session's sets. Reached from Log · Lifts and from the
 * muscle detail; the PC companion has the same page, wider.
 */
export default function LiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);
  const [metric, setMetric] = useState<ProgressMetric>('weight');

  const exercise = useQuery(() => (id ? getExercise(id) : null), [id]);
  const series = useQuery(() => (id ? getProgressSeries(id) : []), [id]);
  const summary = useQuery(() => (id ? getProgressSummary(id) : null), [id]);

  const back = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/log?view=lifts'))}
      accessibilityRole="button"
      accessibilityLabel="Back to Log"
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginLeft: -6 }}
    >
      <Feather name="chevron-left" size={20} color={c.textSecondary} />
      <Text variant="body" color="textSecondary">
        Lifts
      </Text>
    </Pressable>
  );

  if (!exercise || !summary || series.length === 0) {
    return (
      <Screen>
        {back}
        <EmptyState
          title={exercise?.name ?? 'Lift'}
          body="No logged sessions for this lift yet. It appears here after its first workout."
        />
      </Screen>
    );
  }

  const value = (p: ProgressPoint) =>
    metric === 'weight' || metric === 'volume' ? toDisplayWeight(metricValue(p, metric), unit) : metricValue(p, metric);
  const format = (v: number) => {
    switch (metric) {
      case 'weight':
        return formatWeight(v, unit, false);
      case 'reps':
        return trimNumber(v, 0);
      case 'volume':
        return formatVolume(v, unit, false);
      case 'rest':
        return formatDuration(v);
    }
  };

  const last = series[series.length - 1]!;
  const gain = summary.latestWeight - summary.firstWeight;
  const headline =
    metric === 'weight' ? `${formatWeight(last.top_weight, unit)} × ${last.top_weight_reps}` : format(value(last));

  return (
    <Screen>
      {back}
      <Text variant="displayL">{exercise.name}</Text>
      <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
        {exercise.equipment} · {summary.sessionCount} {summary.sessionCount === 1 ? 'session' : 'sessions'}
        {summary.lastTrainedAt ? ` · last ${relativeDays(summary.lastTrainedAt)}` : ''}
      </Text>

      <Spacer h={space.l} />
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      <Spacer h={space.l} />

      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.m }}>
        <Text variant="displayM" mono>
          {headline}
        </Text>
        {metric === 'weight' && gain !== 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name={gain > 0 ? 'arrow-up' : 'arrow-down'} size={14} color={gain > 0 ? 'positive' : 'negative'} />
            <Text variant="bodyStrong" color={gain > 0 ? 'positive' : 'negative'} style={{ marginLeft: 2 }}>
              {trimNumber(Math.abs(toDisplayWeight(gain, unit)))} {unit} since {formatShortDate(series[0]!.started_at)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" color="textTertiary">
        {metric === 'rest' ? 'Average rest' : 'Latest'} · {formatShortDate(last.started_at)}
      </Text>

      <Spacer h={space.l} />
      {series.length < MIN_POINTS_FOR_TREND ? (
        <NotEnoughYet name={exercise.name} have={series.length} need={MIN_POINTS_FOR_TREND} />
      ) : (
        <LineChart
          points={series.map((p) => ({ x: p.started_at, y: value(p), label: formatShortDate(p.started_at) }))}
          formatValue={format}
        />
      )}

      <Spacer h={space.xl} />
      <Facts
        rows={[
          ['Latest', `${formatWeight(summary.latestWeight, unit, false)} × ${summary.latestReps}`],
          ['Best weight', formatWeight(summary.bestWeight, unit)],
          ['Best reps', String(summary.bestReps)],
          ['Total volume', formatVolume(summary.totalVolume, unit)],
          ...(summary.avgRest != null ? ([['Average rest', formatDuration(summary.avgRest)]] as [string, string][]) : []),
        ]}
      />

      <Spacer h={space.xl} />
      <Text variant="label" color="textTertiary" style={{ marginBottom: space.xs }}>
        Sessions
      </Text>
      <SessionsTable series={series} unit={unit} />
    </Screen>
  );
}

/** A ruled definition list: label left, value right. */
function Facts({ rows }: { rows: [string, string][] }) {
  const { c } = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
      {rows.map(([label, value]) => (
        <View
          key={label}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: space.m,
            borderBottomWidth: 1,
            borderColor: c.hairline,
          }}
        >
          <Text variant="body" color="textSecondary">
            {label}
          </Text>
          <Text variant="num">{value}</Text>
        </View>
      ))}
    </View>
  );
}

function SessionsTable({ series, unit }: { series: ProgressPoint[]; unit: Unit }) {
  const { c } = useTheme();
  const rows = [...series].reverse();
  return (
    <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
      {rows.map((row, i) => {
        // An arrow marks a session that beat the one before it on volume.
        const older = rows[i + 1];
        const improved = older ? row.volume > older.volume : false;
        return (
          <View
            key={row.session_id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              borderBottomWidth: 1,
              borderColor: c.hairline,
            }}
          >
            <Text variant="num" color="textSecondary" style={{ width: 72 }}>
              {formatShortDate(row.started_at)}
            </Text>
            <Text variant="num" style={{ flex: 1 }}>
              {formatWeight(row.top_weight, unit, false)} × {row.top_weight_reps}
            </Text>
            <Text variant="num" color="textSecondary" style={{ width: 84 }} align="right">
              {formatVolume(row.volume, unit, false)}
            </Text>
            <View style={{ width: 20, alignItems: 'flex-end' }}>
              {improved ? <Icon name="arrow-up" size={13} color="positive" /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Before there is a trend: says how much more history is needed instead of an
 * empty axis. Two points are a line segment, not a direction (DESIGN.md 5.6).
 */
function NotEnoughYet({ name, have, need }: { name: string; have: number; need: number }) {
  const { c } = useTheme();
  const remaining = need - have;
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: c.bgSunken, padding: space.l }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.m }}>
        {Array.from({ length: need }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: radius.pill,
              marginRight: space.s,
              backgroundColor: i < have ? c.now : 'transparent',
              borderWidth: 1,
              borderColor: i < have ? c.now : c.lineStrong,
            }}
          />
        ))}
      </View>
      <Text variant="body" color="textSecondary">
        {have === 1 ? 'One session' : `${have} sessions`} recorded. Log {name}{' '}
        {remaining === 1 ? 'once more' : `${remaining} more times`} and the trend chart appears here.
      </Text>
    </View>
  );
}
