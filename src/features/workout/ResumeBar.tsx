import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { useGutter } from '@/ui/primitives';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getActiveSession, toRestState } from '@/db/queries/session';
import { RestClock, WorkoutClock } from './RestPanel';

/**
 * Resume bar — DESIGN.md 4. A strip docked on top of the tab bar whenever a
 * workout is minimised, carrying the live clocks so the rest timer is never
 * lost by wandering into Log mid-set.
 *
 * While resting the whole strip turns to the rest colour with its clock — the
 * only form rest ever takes (a strip with a running clock, never a bare dot),
 * because the rest blue sits close to the "now" lake blue in hue.
 */
export function ResumeBar() {
  const router = useRouter();
  const { c } = useTheme();
  const gutter = useGutter();
  const session = useQuery(() => getActiveSession(), []);

  if (!session) return null;
  const rest = toRestState(session);
  const resting = rest.startedAt !== null;

  return (
    <Pressable
      onPress={() => router.push('/workout/active')}
      accessibilityRole="button"
      accessibilityLabel={`Resume ${session.name} workout${resting ? ', resting' : ''}`}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: gutter,
        borderTopWidth: 1,
        borderColor: c.hairline,
        backgroundColor: pressed ? c.bgSunken : resting ? c.restSoft : c.bgBase,
      })}
    >
      {resting ? null : (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: radius.pill,
            backgroundColor: c.now,
            marginRight: space.s,
          }}
        />
      )}
      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1, marginRight: space.s }}>
        {session.name}
      </Text>
      {resting ? (
        <>
          <Text variant="bodyStrong" color="rest" style={{ marginRight: space.xs }}>
            Rest
          </Text>
          <RestClock state={rest} variant="num" />
        </>
      ) : (
        <WorkoutClock startedAt={session.started_at} />
      )}
      <Feather name="chevron-up" size={18} color={c.textSecondary} style={{ marginLeft: space.s }} />
    </Pressable>
  );
}
