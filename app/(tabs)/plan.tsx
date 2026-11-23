import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Screen, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useBreakpoint } from '@/ui/primitives';
import { useQuery } from '@/lib/db-hooks';
import { plural } from '@/lib/format';
import { getWeek, type RoutineDaySummary } from '@/db/queries/routine';
import { dayName, dayShort, todayDayOfWeek } from '@/lib/time';

/**
 * Plan (the weekly split) — DESIGN.md 5.2.
 * A schedule, not a calendar: seven fixed ruled rows, no dates, no month
 * grid. This is the recurring template, not a diary.
 */
export default function PlanScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const week = useQuery(() => getWeek(), []);
  const today = todayDayOfWeek();
  const breakpoint = useBreakpoint();

  const trainingDays = week.filter((d) => d.state === 'workout').length;
  const totalExercises = week.reduce((sum, d) => sum + d.exercise_count, 0);

  // Tablet and desktop show the whole week without scrolling (DESIGN.md 8).
  const columns = breakpoint === 'mobile' ? 1 : 2;

  return (
    <Screen>
      <Spacer h={space.l} />
      <Text variant="displayM">Plan</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        {trainingDays} training {trainingDays === 1 ? 'day' : 'days'} · {totalExercises}{' '}
        {totalExercises === 1 ? 'exercise' : 'exercises'} a week
      </Text>
      <Spacer h={space.l} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl }}>
        {[0, 1].slice(0, columns).map((col) => (
          <View key={col} style={{ flex: 1, minWidth: 0, borderTopWidth: 1, borderColor: c.hairline }}>
            {week
              .filter((_, i) => (columns === 1 ? true : col === 0 ? i < 4 : i >= 4))
              .map((day) => (
                <DayRow
                  key={day.day_of_week}
                  day={day}
                  isToday={day.day_of_week === today}
                  onPress={() => router.push(`/day/${day.day_of_week}`)}
                />
              ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

/**
 * Three distinct states, per DESIGN.md 5.2, told apart by words and weight
 * rather than by boxes:
 *   workout       ink name, exercise count
 *   rest          secondary "Rest", no count
 *   unconfigured  tertiary "Not planned", an inline "Add workout"
 * Today is named in the "now" colour, beside the day.
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
  const title = unconfigured ? 'Not planned' : rest ? 'Rest' : (day.name ?? 'Workout');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayName(day.day_of_week)}${isToday ? ', today' : ''}: ${title}${
        day.state === 'workout' ? `, ${plural(day.exercise_count, 'exercise')}` : ''
      }`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: space.m,
        minHeight: 64,
        paddingVertical: space.m,
        borderBottomWidth: 1,
        borderColor: c.hairline,
        backgroundColor: pressed ? c.bgSunken : 'transparent',
      })}
    >
      <View style={{ width: 44 }}>
        <Text variant="label" color={isToday ? 'now' : 'textTertiary'}>
          {dayShort(day.day_of_week)}
        </Text>
        {isToday ? (
          <Text variant="label" color="now">
            Today
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant={day.state === 'workout' ? 'bodyStrong' : 'body'}
          color={unconfigured ? 'textTertiary' : rest ? 'textSecondary' : 'textPrimary'}
          numberOfLines={1}
        >
          {title}
        </Text>
        {day.state === 'workout' ? (
          <Text variant="caption" color="textTertiary">
            {day.exercise_count} {day.exercise_count === 1 ? 'exercise' : 'exercises'}
          </Text>
        ) : unconfigured ? (
          <Text variant="caption" color="textPrimary" style={{ textDecorationLine: 'underline' }}>
            Add workout
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color="textTertiary" />
    </Pressable>
  );
}
