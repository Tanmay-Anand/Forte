import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Divider, IconButton, Screen, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  deleteSession,
  getSessionDetail,
  getSessionSummary,
  type HistoryExercise,
} from '@/db/queries/history';
import { formatVolume, formatWeight } from '@/lib/format';
import { formatClock, formatDuration, formatLongDate, formatMinutes } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * Session detail — DESIGN.md 5.7.
 * Rest values render BETWEEN the sets they separate rather than as a column:
 * the vertical gap is the information.
 */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);

  const summary = useQuery(() => (id ? getSessionSummary(id) : null), [id]);
  const detail = useQuery(() => (id ? getSessionDetail(id) : []), [id]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const firstId = detail[0]?.id ?? null;
  const isOpen = (exId: string) => (expanded === null ? exId === firstId : expanded === exId);

  if (!summary) {
    return (
      <Screen>
        <Text variant="titleM">Session not found</Text>
      </Screen>
    );
  }

  const remove = () => {
    Alert.alert('Delete this session?', 'The logged sets cannot be recovered.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (id) deleteSession(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: space.s,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Icon name="chevron-left" size={18} />
          <Text variant="body" color="textSecondary" style={{ marginLeft: space.xs }}>
            Back
          </Text>
        </Pressable>
        <IconButton label="Session options" onPress={remove}>
          <Feather name="trash-2" size={18} color={c.textTertiary} />
        </IconButton>
      </View>

      <Spacer h={space.m} />
      <Text variant="displayM">{summary.name}</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        {formatLongDate(summary.started_at)} · {formatClock(summary.started_at)}
        {summary.ended_at ? ` – ${formatClock(summary.ended_at)}` : ''}
      </Text>

      <Spacer h={space.l} />
      <Text variant="num" color="textSecondary">
        {formatMinutes(summary.duration_ms)} · {summary.exercise_count} exercises ·{' '}
        {summary.set_count} sets
      </Text>
      <Text variant="num" color="textSecondary">
        {formatVolume(summary.volume, unit)} total volume
      </Text>

      <Spacer h={space.l} />
      <Divider />

      {summary.note ? (
        <View
          style={{
            marginTop: space.l,
            borderLeftWidth: 2,
            borderLeftColor: c.lineStrong,
            paddingLeft: space.m,
          }}
        >
          <Text variant="label" color="textTertiary">
            Note
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: space.xs }}>
            {summary.note}
          </Text>
        </View>
      ) : null}

      {detail.map((ex) => (
        <ExerciseBlock
          key={ex.id}
          exercise={ex}
          unit={unit}
          open={isOpen(ex.id)}
          onToggle={() => setExpanded(isOpen(ex.id) ? '' : ex.id)}
        />
      ))}
    </Screen>
  );
}

function ExerciseBlock({
  exercise,
  unit,
  open,
  onToggle,
}: {
  exercise: HistoryExercise;
  unit: ReturnType<typeof useSettings.getState>['unit'];
  open: boolean;
  onToggle: () => void;
}) {
  const { c } = useTheme();

  return (
    <View style={{ borderBottomWidth: 1, borderColor: c.hairline }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.m }}
      >
        <View style={{ width: 22 }}>
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color="textTertiary" />
        </View>
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text variant="caption" color="textTertiary">
          {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ paddingLeft: 20, paddingBottom: space.m }}>
          {exercise.sets.map((set, i) => (
            <View key={set.id}>
              {i > 0 && set.rest_before_s != null ? (
                <Text
                  variant="caption"
                  color="textTertiary"
                  style={{ paddingLeft: space.xl, paddingVertical: 2 }}
                >
                  rest {formatDuration(set.rest_before_s)}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                <Text variant="num" color="textTertiary" style={{ width: 28 }}>
                  {set.set_number}
                </Text>
                {set.skipped ? (
                  <Text variant="num" color="textTertiary">
                    Skipped
                  </Text>
                ) : (
                  <Text variant="num">
                    {formatWeight(set.weight_kg, unit)} × {set.reps}
                  </Text>
                )}
              </View>
            </View>
          ))}

          <Text variant="caption" color="textTertiary" style={{ marginTop: space.s }}>
            Volume {formatVolume(exercise.volume, unit)}
            {exercise.avgRest != null ? ` · Avg rest ${formatDuration(exercise.avgRest)}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
