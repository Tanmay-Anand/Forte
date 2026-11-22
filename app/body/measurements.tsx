import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { NavRow } from '@/ui/NavRow';
import { Screen, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getLatestMeasurements } from '@/db/queries/profile';
import { KINDS, TAPE_KINDS, formatMeasure } from '@/features/profile/kinds';
import { formatShortDate } from '@/lib/time';
import { useSettings } from '@/store/settings';

/** Tape measurements, top to bottom, each with its latest value. */
export default function MeasurementsScreen() {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const latest = useQuery(() => getLatestMeasurements(), []);

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.m }}
      >
        <Icon name="chevron-left" size={18} />
        <Text variant="body" color="textSecondary" style={{ marginLeft: space.xs }}>
          Profile
        </Text>
      </Pressable>
      <Text variant="displayM">Measurements</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s, maxWidth: 460 }}>
        Measure at the same time of day each time, relaxed, with the tape level. Each entry is kept,
        so you can see the change.
      </Text>
      <Spacer h={space.l} />
      {TAPE_KINDS.map((kind) => {
        const m = latest[kind];
        return (
          <NavRow
            key={kind}
            label={KINDS[kind].label}
            sub={m ? formatShortDate(m.measured_at) : undefined}
            value={m ? formatMeasure(kind, m.value, unit) : 'Add'}
            onPress={() => router.push(`/body/${kind}`)}
          />
        );
      })}
    </Screen>
  );
}
