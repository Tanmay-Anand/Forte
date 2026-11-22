import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { EmptyState, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getDay, getDayExercises, getWeek } from '@/db/queries/routine';
import { getActiveSession, getPreviousPerformance, startSession } from '@/db/queries/session';
import { getHistory, getTodayCompletedSession } from '@/db/queries/history';
import { dayName, formatShortDate, todayDayOfWeek } from '@/lib/time';
import { formatMinutes } from '@/lib/time';
import { formatVolume, formatWeight, toDisplayWeight, trimNumber } from '@/lib/format';
import { loadHistory } from '@/db/queries/analysis';
import { formatTarget, insights, workoutTargets } from '@/features/analysis';
import { useSettings } from '@/store/settings';

const DAY_MS = 86_400_000;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Today — DESIGN.md 5.1. Answers "what am I doing right now" and starts it.
 *
 * The week sits under the title so "am I on track?" is answered before
 * anything is read; each target shows what you did last time beside it, so
 * the jump is visible; one line says what Forte noticed. Start lives at the
 * bottom of the content, above a tab bar that never covers it.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);
  const dow = todayDayOfWeek();

  const day = useQuery(() => getDay(dow), [dow]);
  const week = useQuery(() => getWeek(), []);
  const exercises = useQuery(() => getDayExercises(dow), [dow]);
  const active = useQuery(() => getActiveSession(), []);
  const completedToday = useQuery(() => getTodayCompletedSession(), []);
  const recent = useQuery(() => getHistory(40), []);
  const history = useQuery(() => loadHistory(), []);
  const targets = day?.name
    ? workoutTargets(history, day.name, exercises.map((e) => e.exercise_id), unit)
    : {};
  const lastTime = useQuery(
    () =>
      Object.fromEntries(
        exercises.map((e) => [e.exercise_id, getPreviousPerformance(e.exercise_id, active?.id ?? '')]),
      ),
    [exercises.map((e) => e.exercise_id).join(','), active?.id],
  );
  const noticed = insights(history, Date.now(), unit, 1)[0] ?? null;

  // This week and last, Monday first.
  const monday = startOfWeek(Date.now());
  const thisWeek = recent.filter((s) => s.started_at >= monday);
  const lastWeek = recent.filter((s) => s.started_at >= monday - 7 * DAY_MS && s.started_at < monday);
  const plannedDays = week.filter((d) => d.state === 'workout').length;
  const lastSession = recent[0] ?? null;

  const begin = () => {
    if (!active) startSession(dow);
    router.push('/workout/active');
  };

  return (
    <Screen>
      <Spacer h={space.l} />
      <Text variant="label" color="textTertiary">
        {dayName(dow)} {formatShortDate(Date.now())} · Week {isoWeek(Date.now())}
      </Text>

      {day?.state === 'unconfigured' ? (
        <NoRoutine onPlan={() => router.push('/plan')} />
      ) : (
        <>
          <Text variant="displayL" style={{ marginTop: space.xs }}>
            {day?.state === 'rest' ? 'Rest day' : (day?.name ?? 'Workout')}
          </Text>

          <WeekStrip
            week={week}
            today={dow}
            doneDays={new Set(thisWeek.map((s) => ((new Date(s.started_at).getDay() + 6) % 7) + 1))}
          />
          {plannedDays > 0 ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.s }}>
              {lastWeek.length
                ? `Last week ${lastWeek.length} of ${plannedDays} · ${formatVolume(lastWeek.reduce((a, s) => a + s.volume, 0), unit)}`
                : `${plannedDays} training ${plannedDays === 1 ? 'day' : 'days'} a week`}
            </Text>
          ) : null}

          {completedToday && !active ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.l }}>
              <Icon name="check" size={16} color="positive" />
              <Text variant="bodyStrong" color="positive" style={{ marginLeft: space.s }}>
                Done today · {formatMinutes(completedToday.duration_ms)} · {completedToday.set_count} sets
              </Text>
            </View>
          ) : null}

          {day?.state === 'rest' ? (
            <RestDay dow={dow} onAdd={() => router.push(`/day/${dow}`)} />
          ) : (
            <>
              <Spacer h={space.xl} />
              <SectionLabel right={Object.values(lastTime).some(Boolean) ? 'Last time' : undefined}>
                {Object.keys(targets).length ? "Today's targets" : "Today's exercises"}
              </SectionLabel>
              <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
                {exercises.map((e) => {
                  const target = targets[e.exercise_id];
                  const prev = lastTime[e.exercise_id];
                  const prevSets = prev?.sets.filter((s) => !s.skipped) ?? [];
                  const topPrev = prevSets.reduce((m, s) => Math.max(m, s.weight_kg), 0);
                  const delta = target && topPrev > 0 ? toDisplayWeight(target.weightKg - topPrev, unit) : 0;
                  return (
                    <TargetRow
                      key={e.id}
                      name={e.name}
                      last={
                        prevSets.length
                          ? `${formatWeight(prevSets[0]!.weight_kg, unit, false)} × ${prevSets.map((s) => s.reps).join(' · ')}`
                          : 'First time'
                      }
                      target={target ? formatTarget(target, unit) : null}
                      delta={delta}
                      unit={unit}
                    />
                  );
                })}
              </View>
            </>
          )}

          {noticed ? (
            <>
              <Spacer h={space.xl} />
              <SectionLabel>Noticed</SectionLabel>
              <Text variant="body">
                <Text variant="bodyStrong">{noticed.exerciseName ? `${noticed.exerciseName}: ` : ''}</Text>
                {noticed.text}
              </Text>
            </>
          ) : null}

          {lastSession ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.l }}>
              Last session · {lastSession.name}, {formatShortDate(lastSession.started_at)} ·{' '}
              {formatMinutes(lastSession.duration_ms)} · {formatVolume(lastSession.volume, unit)}
            </Text>
          ) : null}

          <Spacer h={space.xl} />
          {day?.state === 'rest' && !active ? null : completedToday && !active ? (
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <Button
                label="View summary"
                variant="secondary"
                onPress={() => router.push(`/session/${completedToday.id}`)}
                style={{ flex: 1 }}
              />
              <Button label="Train again" variant="secondary" onPress={begin} style={{ flex: 1 }} />
            </View>
          ) : (
            <Button
              label={active ? 'Resume workout' : 'Start workout'}
              onPress={begin}
              accessibilityLabel={active ? 'Resume workout' : 'Start today’s workout'}
            />
          )}
        </>
      )}
    </Screen>
  );
}

/** One target row: the exercise and what you did last time, the target and its change. */
function TargetRow({
  name,
  last,
  target,
  delta,
  unit,
}: {
  name: string;
  last: string;
  target: string | null;
  delta: number;
  unit: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: space.m,
        paddingVertical: space.m,
        borderBottomWidth: 1,
        borderColor: c.hairline,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body">{name}</Text>
        <Text variant="num" color="textTertiary" numberOfLines={1}>
          {last}
        </Text>
      </View>
      {target ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="num">
            {target}
          </Text>
          <Text variant="num" color={delta > 0 ? 'positive' : 'textTertiary'}>
            {delta > 0 ? `+${trimNumber(delta)} ${unit}` : 'same'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The week at a glance: each day's letter over a mark. Today is ringed in the
 * "now" colour; planned training days are ringed with their first letter;
 * days already trained this week carry a tick; rest days are a dash.
 */
function WeekStrip({
  week,
  today,
  doneDays,
}: {
  week: ReturnType<typeof getWeek>;
  today: number;
  doneDays: Set<number>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.l }}
      accessibilityRole="summary"
      accessibilityLabel={`This week: ${week
        .map((d) => `${dayName(d.day_of_week)} ${doneDays.has(d.day_of_week) ? 'done' : d.state === 'workout' ? (d.name ?? 'workout') : 'rest'}`)
        .join(', ')}`}
    >
      {LETTERS.map((letter, i) => {
        const dow = i + 1;
        const d = week.find((w) => w.day_of_week === dow);
        const isToday = dow === today;
        const planned = d?.state === 'workout';
        const done = doneDays.has(dow);
        return (
          <View key={dow} style={{ alignItems: 'center', flex: 1 }} importantForAccessibility="no-hide-descendants">
            <Text variant="label" color={isToday ? 'textPrimary' : 'textTertiary'}>
              {letter}
            </Text>
            <View
              style={{
                marginTop: space.xs,
                width: 32,
                height: 32,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: isToday ? c.now : planned && !done ? c.lineStrong : 'transparent',
                backgroundColor: done ? c.bgSunken : 'transparent',
              }}
            >
              {done ? (
                <Icon name="check" size={14} color="positive" />
              ) : planned ? (
                <Text variant="label" color={isToday ? 'now' : 'textPrimary'}>
                  {(d?.name ?? 'W').slice(0, 1).toUpperCase()}
                </Text>
              ) : (
                <Text variant="label" color="textTertiary">
                  –
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RestDay({ dow, onAdd }: { dow: number; onAdd: () => void }) {
  const next = useQuery(() => {
    for (let i = 1; i <= 7; i++) {
      const candidate = ((dow - 1 + i) % 7) + 1;
      const d = getDay(candidate);
      if (d?.state === 'workout') return { dow: candidate, name: d.name };
    }
    return null;
  }, [dow]);

  return (
    <>
      <Spacer h={space.xl} />
      <Text variant="body" color="textSecondary">
        {next ? `Next: ${dayName(next.dow)} · ${next.name}` : 'No other training days planned.'}
      </Text>
      <Spacer h={space.l} />
      <Button label="Add a workout today" variant="secondary" onPress={onAdd} />
    </>
  );
}

function NoRoutine({ onPlan }: { onPlan: () => void }) {
  return (
    <View style={{ marginTop: space.xs }}>
      <Text variant="displayL">No plan yet</Text>
      <EmptyState
        title=""
        body="Choose which days you train and what you do on each. You can change it any time."
        action={<Button label="Plan my week" onPress={onPlan} />}
      />
    </View>
  );
}

/** Local midnight on the Monday of the week containing `ms`. */
function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** ISO 8601 week number. */
function isoWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}
