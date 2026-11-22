import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { NavRow } from '@/ui/NavRow';
import { ControlChip, EmptyState, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getReports, getTrackedMarkers, resultFlag } from '@/db/queries/labs';
import { BackLink } from '@/features/labs/BackLink';
import { MarkerShareSheet } from '@/features/labs/MarkerShareSheet';
import { reportDate, resultValue } from '@/features/labs/format';
import { formatShortDate } from '@/lib/time';

/**
 * Blood reports — the list of reports and every marker that has a value.
 * Recorded values only; anything Claude says lives in the Claude app.
 */
export default function LabsScreen() {
  const router = useRouter();
  const reports = useQuery(() => getReports(), []);
  const markers = useQuery(() => getTrackedMarkers(), []);
  const [choosing, setChoosing] = useState(false);

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink label="Profile" />
      <Text variant="displayM">Blood reports</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s, maxWidth: 460 }}>
        Kept on this phone only. Values are what you record from each report; ranges are the lab's own.
      </Text>

      <Spacer h={space.l} />
      <Button label="Add report" variant="secondary" onPress={() => router.push('/labs/new')} />

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Add a report with its date, attach the PDF or a photo if you have one, then record the values you want to follow."
        />
      ) : (
        <>
          <Spacer h={space.xl} />
          <SectionLabel right={`${reports.length}`}>Reports</SectionLabel>
          {reports.map((r) => (
            <NavRow
              key={r.id}
              label={r.category}
              sub={[
                reportDate(r.taken_at),
                r.lab_name,
                `${r.result_count} ${r.result_count === 1 ? 'value' : 'values'}`,
                r.flagged_count ? `${r.flagged_count} outside range` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(`/labs/${r.id}`)}
            />
          ))}
        </>
      )}

      {markers.length ? (
        <>
          <Spacer h={space.xl} />
          <SectionLabel right="Latest">Markers</SectionLabel>
          {markers.map((m) => {
            const flag = resultFlag(m);
            return (
              <NavRow
                key={m.marker_id}
                label={m.marker}
                sub={[formatShortDate(m.taken_at), m.count > 1 ? `${m.count} results` : null, flag]
                  .filter(Boolean)
                  .join(' · ')}
                value={resultValue(m)}
                onPress={() => router.push(`/labs/marker/${m.marker_id}`)}
              />
            );
          })}

          <Spacer h={space.xl} />
          <SectionLabel>Ask AI</SectionLabel>
          <Text variant="caption" color="textTertiary" style={{ marginBottom: space.m, maxWidth: 460 }}>
            Choose the markers, and Forte shares their values, dates and the labs' ranges with an AI app
            such as Claude, ChatGPT or Gemini, with a short training summary. Not medical advice. Report files are never included.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            <ControlChip label="Ask about my results" icon="share" onPress={() => setChoosing(true)} />
          </View>
        </>
      ) : null}

      <MarkerShareSheet visible={choosing} markers={markers} onClose={() => setChoosing(false)} />
    </Screen>
  );
}
