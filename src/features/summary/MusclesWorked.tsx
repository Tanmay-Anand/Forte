import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { SectionLabel } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getProfile } from '@/db/queries/profile';
import { MUSCLES, sessionMuscles, shadeLevels, type SessionEntry } from '@/features/analysis';
import { BodyFigures } from '@/features/body/BodyFigures';
import { trimNumber } from '@/lib/format';

/**
 * The muscles one workout trained, on the body, shaded relative to the
 * session's most-trained muscle, with the sets per muscle underneath.
 * Drawn once when the summary opens.
 */
export function MusclesWorked({ session, compact }: { session: SessionEntry; compact?: boolean }) {
  const sex = useQuery(() => getProfile().sex, []);
  const worked = useMemo(() => {
    const sets = sessionMuscles(session);
    const list = MUSCLES.filter((m) => sets[m.id] > 0)
      .map((m) => ({ ...m, sets: sets[m.id] }))
      .sort((a, b) => b.sets - a.sets);
    return { levels: shadeLevels(sets), list };
  }, [session]);

  if (!worked.list.length) return null;
  const line = worked.list.map((m) => `${m.label} ${trimNumber(m.sets, 1)}`).join(' · ');

  return (
    <View style={{ marginTop: space.l }}>
      <SectionLabel right="Sets">Muscles worked</SectionLabel>
      <BodyFigures
        levels={worked.levels}
        sex={sex}
        maxWidth={compact ? 132 : 220}
        accessibilityLabel={`Muscles worked: ${line} sets.`}
      />
      <Text variant="caption" color="textSecondary" style={{ marginTop: space.m }}>
        {line}
      </Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        Helper muscles count half a set.
      </Text>
    </View>
  );
}
