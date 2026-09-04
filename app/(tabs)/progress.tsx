import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import {
  Divider,
  EmptyState,
  Screen,
  SectionLabel,
  Segmented,
  Spacer,
  StatGrid,
} from '@/ui/primitives';
import { LineChart, MIN_POINTS_FOR_TREND } from '@/ui/LineChart';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  getProgressSeries,
  getProgressSummary,
  getTrackedExercises,
  metricValue,
  type ProgressMetric,
} from '@/db/queries/progress';
import { formatVolume, formatWeight, toDisplayWeight, trimNumber } from '@/lib/format';
import { formatDuration, formatShortDate, relativeDays } from '@/lib/time';
import { useSettings } from '@/store/settings';

const METRICS: { value: ProgressMetric; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'reps', label: 'Reps' },
  { value: 'volume', label: 'Volume' },
  { value: 'rest', label: 'Rest' },
];

/**
 * Progress — DESIGN.md 5.6.
 * Answers exactly one question: am I getting stronger? Per-exercise, because
 * that is the only level at which progressive overload is actionable.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const [metric, setMetric] = useState<ProgressMetric>('weight');
  const [picking, setPicking] = useState(false);
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  const tracked = useQuery(() => getTrackedExercises(), []);
  const selectedId = exerciseId ?? tracked[0]?.id ?? null;
  const selected = tracked.find((t) => t.id === selectedId) ?? null;

  const series = useQuery(() => (selectedId ? getProgressSeries(selectedId) : []), [selectedId]);
  const summary = useQuery(() => (selectedId ? getProgressSummary(selectedId) : null), [selectedId]);

  if (tracked.length === 0) {
    return (
      <Screen navClearance>
        <Spacer h={space.l} />
        <Text variant="titleM">Progress</Text>
        <EmptyState
          title="Nothing to chart yet"
          body="Progress appears after your first logged workout."
          action={<Button label="Start today's workout" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  const formatMetric = (v: number) => {
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

  const points = series.map((p) => ({
    x: p.started_at,
    y: metric === 'weight' || metric === 'volume'
      ? toDisplayWeight(metricValue(p, metric), unit)
      : metricValue(p, metric),
    label: formatShortDate(p.started_at),
  }));

  const gain = summary ? summary.latestWeight - summary.firstWeight : 0;

  return (
    <Screen navClearance>
      <Spacer h={space.l} />
      <Text variant="titleM">Progress</Text>
      <Spacer h={space.m} />

      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Selected exercise ${selected?.name ?? ''}. Tap to change.`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <SelectorField label={selected?.name ?? 'Select exercise'} />
      </Pressable>

      <Spacer h={space.m} />
      <Segmented options={METRICS} value={metric} onChange={setMetric} />
      <Spacer h={space.xl} />

      {summary && series.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text variant="displayL">
              {formatMetric(
                metric === 'weight' || metric === 'volume'
                  ? toDisplayWeight(metricValue(series[series.length - 1]!, metric), unit)
                  : metricValue(series[series.length - 1]!, metric),
              )}
            </Text>
            {metric === 'weight' && gain !== 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: space.m,
                  marginBottom: 8,
                }}
              >
                <Icon
                  name={gain > 0 ? 'arrow-up' : 'arrow-down'}
                  size={16}
                  color={gain > 0 ? 'positive' : 'negative'}
                />
                <Text
                  variant="titleM"
                  color={gain > 0 ? 'positive' : 'negative'}
                  style={{ marginLeft: space.xs }}
                >
                  {trimNumber(Math.abs(toDisplayWeight(gain, unit)))}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" color="textTertiary">
            {metric === 'rest' ? 'Average rest' : 'Latest'} ·{' '}
            {formatShortDate(series[series.length - 1]!.started_at)}
          </Text>

          <Spacer h={space.l} />

          {/*
            The chart appears only once there is enough history to read as a
            trend. Two points are a line segment, not a direction — drawing one
            would imply progress the data cannot support (DESIGN.md 5.6).
          */}
          {series.length < MIN_POINTS_FOR_TREND ? (
            <NotEnoughYet
              name={selected?.name ?? 'this exercise'}
              have={series.length}
              need={MIN_POINTS_FOR_TREND}
            />
          ) : (
            <LineChart points={points} formatValue={formatMetric} />
          )}

          <Spacer h={space.xl} />
          <Divider />
          <Spacer h={space.l} />

          <StatGrid
            items={[
              {
                label: 'Latest',
                value: `${formatWeight(summary.latestWeight, unit, false)} × ${summary.latestReps}`,
              },
              { label: 'Best weight', value: formatWeight(summary.bestWeight, unit) },
              { label: 'Best reps', value: String(summary.bestReps) },
              { label: 'Total volume', value: formatVolume(summary.totalVolume, unit) },
            ]}
          />

          {summary.avgRest != null ? (
            <>
              <Text variant="caption" color="textSecondary">
                Average rest across all sets · {formatDuration(summary.avgRest)}
              </Text>
              <Spacer h={space.l} />
            </>
          ) : null}

          <Divider />
          <Spacer h={space.l} />

          <SectionLabel>History</SectionLabel>
          <HistoryTable series={series} unit={unit} />

          {gain !== 0 ? (
            <Text
              variant="caption"
              color={gain > 0 ? 'positive' : 'textSecondary'}
              style={{ marginTop: space.m }}
            >
              {gain > 0 ? '+' : ''}
              {trimNumber(toDisplayWeight(gain, unit))} {unit} since first recorded session
            </Text>
          ) : null}

          {summary.lastTrainedAt ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
              Last trained {relativeDays(summary.lastTrainedAt)}
            </Text>
          ) : null}
        </>
      ) : null}

      <ExerciseSelector
        visible={picking}
        exercises={tracked}
        selectedId={selectedId}
        onSelect={(id) => {
          setExerciseId(id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

/**
 * Pre-trend state. Says plainly how much more history is needed rather than
 * showing an empty axis, and keeps the summary numbers below visible — one
 * session is still worth reading, it just is not a trend.
 */
function NotEnoughYet({ name, have, need }: { name: string; have: number; need: number }) {
  const { c } = useTheme();
  const remaining = need - have;

  return (
    <View
      style={{
        borderRadius: radius.card,
        backgroundColor: c.bgRaised,
        padding: space.l,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.m }}>
        {Array.from({ length: need }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              marginRight: space.s,
              backgroundColor: i < have ? c.focus : 'transparent',
              borderWidth: 1,
              borderColor: i < have ? c.focus : c.lineStrong,
            }}
          />
        ))}
      </View>
      <Text variant="body" color="textSecondary">
        {have === 1 ? 'One session' : `${have} sessions`} recorded. Log {name}{' '}
        {remaining === 1 ? 'once more' : `${remaining} more times`} and the trend chart appears
        here.
      </Text>
    </View>
  );
}

function SelectorField({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        height: 56,
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: c.lineStrong,
        backgroundColor: c.bgRaised,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.m,
      }}
    >
      <Text variant="titleM" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={18} color={c.textSecondary} />
    </View>
  );
}

function HistoryTable({
  series,
  unit,
}: {
  series: ReturnType<typeof getProgressSeries>;
  unit: ReturnType<typeof useSettings.getState>['unit'];
}) {
  const { c } = useTheme();
  const rows = [...series].reverse();

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: space.s }}>
        <Text variant="label" color="textTertiary" style={{ width: 72 }}>
          Date
        </Text>
        <Text variant="label" color="textTertiary" style={{ flex: 1 }}>
          Weight
        </Text>
        <Text variant="label" color="textTertiary" style={{ width: 56 }}>
          Reps
        </Text>
        <Text variant="label" color="textTertiary" style={{ width: 84 }} align="right">
          Volume
        </Text>
      </View>

      {rows.map((row, i) => {
        // An up-arrow marks a session that beat the one before it on volume —
        // improvements should be visually obvious without a second chart.
        const older = rows[i + 1];
        const improved = older ? row.volume > older.volume : false;
        return (
          <View
            key={row.session_id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 40,
              borderTopWidth: 1,
              borderColor: c.hairline,
            }}
          >
            <Text variant="num" color="textSecondary" style={{ width: 72 }}>
              {formatShortDate(row.started_at)}
            </Text>
            <Text variant="num" style={{ flex: 1 }}>
              {formatWeight(row.top_weight, unit)}
            </Text>
            <Text variant="num" color="textSecondary" style={{ width: 56 }}>
              {row.top_weight_reps}
            </Text>
            <Text variant="num" color="textSecondary" style={{ width: 68 }} align="right">
              {formatVolume(row.volume, unit, false)}
            </Text>
            <View style={{ width: 18, alignItems: 'flex-end' }}>
              {improved ? <Icon name="arrow-up" size={13} color="positive" /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ExerciseSelector({
  visible,
  exercises,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  exercises: { id: string; name: string; last_at: number }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: space.l,
          }}
        >
          <Text variant="titleM">Select exercise</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color="textSecondary">
              Close
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.l }}>
          {exercises.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => onSelect(e.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: e.id === selectedId }}
              style={{
                minHeight: 56,
                justifyContent: 'center',
                borderBottomWidth: 1,
                borderColor: c.hairline,
              }}
            >
              <Text variant="body" color={e.id === selectedId ? 'accent' : 'textPrimary'}>
                {e.name}
              </Text>
              <Text variant="caption" color="textTertiary">
                {relativeDays(e.last_at)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
