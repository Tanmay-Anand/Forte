import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Card, Divider, Screen, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useBreakpoint } from '@/ui/primitives';
import { useQuery } from '@/lib/db-hooks';
import { getWeek, type RoutineDaySummary } from '@/db/queries/routine';
import { dayShort, todayDayOfWeek } from '@/lib/time';

/**
 * Week — DESIGN.md 5.2.
 * A schedule, not a calendar: seven fixed rows, no dates, no month grid. This
 * is the recurring template, not a diary.
 */
export default function WeekScreen() {
  const router = useRouter();
  const week = useQuery(() => getWeek(), []);
  const today = todayDayOfWeek();
  const breakpoint = useBreakpoint();

  const trainingDays = week.filter((d) => d.state === 'workout').length;
  const totalExercises = week.reduce((sum, d) => sum + d.exercise_count, 0);

  // Tablet and desktop show the whole week without scrolling (DESIGN.md 8).
  const columns = breakpoint === 'mobile' ? 1 : 2;

  return (
    <Screen navClearance>
      <Spacer h={space.l} />
      <Text variant="titleM">Week</Text>
      <Text variant="caption" color="textSecondary" style={{ marginTop: space.xs }}>
        Your training split
      </Text>
      <Spacer h={space.l} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {week.map((day) => (
          <View
            key={day.day_of_week}
            style={{
              width: columns === 1 ? '100%' : '50%',
              paddingRight: columns === 1 ? 0 : space.s,
              marginBottom: space.s,
            }}
          >
            <DayRow
              day={day}
              isToday={day.day_of_week === today}
              onPress={() => router.push(`/day/${day.day_of_week}`)}
            />
          </View>
        ))}
      </View>

      <Spacer h={space.m} />
      <Divider />
      <Spacer h={space.m} />
      <Text variant="caption" color="textTertiary">
        {trainingDays} training {trainingDays === 1 ? 'day' : 'days'} · {totalExercises} exercises /
        week
      </Text>
    </Screen>
  );
}

/**
 * Three visually distinct states, per DESIGN.md 5.2:
 *   workout       raised surface, full contrast, exercise count
 *   rest          flat surface, secondary type, no count
 *   unconfigured  dashed hairline, tertiary type, inline add
 */
function DayRow({
  day,
  isToday,
  onPress,
}: {
  day: RoutineDaySummary;
  isToday: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const unconfigured = day.state === 'unconfigured';
  const rest = day.state === 'rest';

  return (
    <Card onPress={onPress} dashed={unconfigured} muted={unconfigured || rest}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="label" color="textTertiary" style={{ flex: 1 }}>
          {dayShort(day.day_of_week)}
        </Text>
        {isToday ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: c.accent,
                marginRight: space.xs,
              }}
            />
            <Text variant="label" color="accent">
              Today
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: space.xs,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            variant="titleM"
            color={unconfigured ? 'textTertiary' : rest ? 'textSecondary' : 'textPrimary'}
            numberOfLines={1}
          >
            {unconfigured ? 'Not configured' : rest ? 'Rest' : (day.name ?? 'Workout')}
          </Text>
          {day.state === 'workout' ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
              {day.exercise_count} {day.exercise_count === 1 ? 'exercise' : 'exercises'}
            </Text>
          ) : unconfigured ? (
            <Text variant="caption" color="accent" style={{ marginTop: 2 }}>
              + Add workout
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-right" size={20} color="textTertiary" />
      </View>
    </Card>
  );
}
