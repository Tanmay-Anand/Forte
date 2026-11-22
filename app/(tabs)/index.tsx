import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Divider, EmptyState, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getDay, getDayExercises } from '@/db/queries/routine';
import { getActiveSession, startSession } from '@/db/queries/session';
import { getLastSessionByName, getTodayCompletedSession } from '@/db/queries/history';
import { dayName, formatShortDate, relativeDays, todayDayOfWeek } from '@/lib/time';
import { formatMinutes } from '@/lib/time';
import { formatVolume } from '@/lib/format';
import { loadHistory } from '@/db/queries/analysis';
import { formatTarget, workoutTargets } from '@/features/analysis';
import { useSettings } from '@/store/settings';

/**
 * Today — DESIGN.md 5.1.
 * Answers "what am I doing right now" and starts it. Context sits below in
 * caption size: available at a glance, ignorable otherwise. Not a dashboard.
 */
export default function TodayScreen() {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const dow = todayDayOfWeek();

  const day = useQuery(() => getDay(dow), [dow]);
  const exercises = useQuery(() => getDayExercises(dow), [dow]);
  const active = useQuery(() => getActiveSession(), []);
  const completedToday = useQuery(() => getTodayCompletedSession(), []);
  const last = useQuery(() => (day?.name ? getLastSessionByName(day.name) : null), [day?.name]);
  const history = useQuery(() => loadHistory(), []);
  const targets = day?.name
    ? workoutTargets(history, day.name, exercises.map((e) => e.exercise_id), unit)
    : {};

  const begin = () => {
    const id = active?.id ?? startSession(dow);
    void id;
    router.push('/workout/active');
  };

  return (
    <Screen navClearance>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: space.l,
          // Settings moved to Profile; the row keeps its height so the title
          // below doesn't jump.
          minHeight: space.l + 48,
        }}
      >
        <Text variant="label" color="textSecondary">
          {dayName(dow)} · {formatShortDate(Date.now())}
        </Text>
      </View>

      {day?.state === 'unconfigured' ? (
        <NoRoutine onPlan={() => router.push('/week')} />
      ) : day?.state === 'rest' ? (
        <RestDay dow={dow} onAdd={() => router.push(`/day/${dow}`)} />
      ) : (
        <>
          <Text variant="displayL" style={{ marginTop: space.s }}>
            {day?.name ?? 'Workout'}
          </Text>

          {completedToday && !active ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}>
              <Icon name="check" size={16} color="positive" />
              <Text variant="body" color="positive" style={{ marginLeft: space.s }}>
                Completed · {formatMinutes(completedToday.duration_ms)} ·{' '}
                {completedToday.set_count} sets
              </Text>
            </View>
          ) : null}

          <Spacer h={space.xl} />
          <Divider />
          <Spacer h={space.l} />

          <SectionLabel right={`${exercises.length} exercises${Object.keys(targets).length ? ' · next target' : ''}`}>Today's workout</SectionLabel>
          {exercises.map((e) => {
            const target = targets[e.exercise_id];
            return (
              <View
                key={e.id}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', columnGap: space.m }}
              >
                <Text variant="body" style={{ flex: 1 }}>
                  {e.name}
                </Text>
                {/* The next-set target: a suggestion from last time, never a pre-fill. */}
                {target ? (
                  <Text variant="num" color={target.progress === 'weight' ? 'textPrimary' : 'textSecondary'}>
                    {formatTarget(target, unit)}
                  </Text>
                ) : null}
              </View>
            );
          })}

          <Spacer h={space.l} />
          <Divider />
          <Spacer h={space.l} />

          {last ? (
            <>
              <MetaRow
                label={`Last ${day?.name ?? 'session'}`}
                value={`${formatShortDate(last.started_at)} · ${relativeDays(last.started_at)}`}
              />
              <MetaRow label="Volume" value={formatVolume(last.volume, unit)} />
              <MetaRow label="Sets" value={String(last.set_count)} />
            </>
          ) : (
            <Text variant="caption" color="textTertiary">
              No previous session for this workout yet.
            </Text>
          )}

          <Spacer h={space.xxl} />

          {completedToday && !active ? (
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <Button
                label="View Summary"
                variant="secondary"
                onPress={() => router.push(`/session/${completedToday.id}`)}
                style={{ flex: 1 }}
              />
              <Button label="Train Again" variant="secondary" onPress={begin} style={{ flex: 1 }} />
            </View>
          ) : (
            <Button
              label={active ? 'Resume Workout' : 'Start Workout'}
              onPress={begin}
              shout
              accessibilityLabel={active ? 'Resume workout' : 'Start today’s workout'}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    // Wraps rather than collides at large font sizes; the value stays right-aligned.
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: space.m,
        paddingVertical: space.xs,
      }}
    >
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="caption" color="textPrimary" style={{ marginLeft: 'auto' }}>
        {value}
      </Text>
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
      <Text variant="displayL" style={{ marginTop: space.s }}>
        Rest Day
      </Text>
      <Spacer h={space.xl} />
      <Divider />
      <Spacer h={space.l} />
      {next ? (
        <Text variant="body" color="textSecondary">
          Next: {dayName(next.dow)} · {next.name}
        </Text>
      ) : (
        <Text variant="body" color="textSecondary">
          No other training days configured.
        </Text>
      )}
      <Spacer h={space.xl} />
      <Button label="+ Add Workout" variant="secondary" onPress={onAdd} />
    </>
  );
}

function NoRoutine({ onPlan }: { onPlan: () => void }) {
  return (
    <View style={{ marginTop: space.s }}>
      <Text variant="displayL">No routine yet</Text>
      <EmptyState
        title=""
        body="Set up which muscle groups you train on which days. You can change it any time."
        action={<Button label="Plan My Week" onPress={onPlan} shout />}
      />
    </View>
  );
}
