import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getActiveSession, toRestState } from '@/db/queries/session';
import { RestClock, WorkoutClock } from './RestPanel';

/**
 * Persistent resume bar — DESIGN.md 4.
 * Docks above the tab bar whenever a workout is minimised, carrying the live
 * rest value so the timer is never lost by wandering into Progress mid-set.
 */
export function ResumeBar() {
  const router = useRouter();
  const { c } = useTheme();
  const session = useQuery(() => getActiveSession(), []);

  if (!session) return null;
  const rest = toRestState(session);
  const resting = rest.startedAt !== null;

  return (
    <Pressable
      onPress={() => router.push('/workout/active')}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${session.name} workout`}
      style={({ pressed }) => ({
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.l,
        marginBottom: space.s,
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.bgSunken : c.bgElevated,
        borderWidth: 1,
        borderColor: c.hairline,
      })}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: resting ? c.rest : c.focus,
          marginRight: space.s,
        }}
      />
      <Text variant="caption" color="textPrimary" numberOfLines={1} style={{ flex: 1 }}>
        {session.name}
      </Text>
      <WorkoutClock startedAt={session.started_at} />
      {resting ? (
        <>
          <Text variant="caption" color="rest" style={{ marginLeft: space.m, marginRight: space.xs }}>
            REST
          </Text>
          <RestClock state={rest} variant="num" />
        </>
      ) : null}
    </Pressable>
  );
}
