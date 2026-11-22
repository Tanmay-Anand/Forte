import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { LineChart } from '@/ui/LineChart';
import { NavRow } from '@/ui/NavRow';
import { Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getMarker, getMarkerSeries, resultFlag } from '@/db/queries/labs';
import { BackLink } from '@/features/labs/BackLink';
import { FlagChip } from '@/features/labs/FlagChip';
import { reportDate, resultRange, resultValue } from '@/features/labs/format';
import { trimNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/time';

/**
 * One marker across reports, with the latest report's reference range shaded
 * behind the line. Each value opens the report it came from.
 */
export default function MarkerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const marker = useQuery(() => (id ? getMarker(id) : null), [id]);
  const series = useQuery(() => (id ? getMarkerSeries(id) : []), [id]);

  const latest = series[series.length - 1];
  const numeric = series.filter((p) => p.value != null);
  const unitsDiffer = new Set(numeric.map((p) => p.unit ?? '')).size > 1;
  const latestFlag = latest ? resultFlag(latest) : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink />
      <Text variant="displayM">{marker?.name ?? 'Marker'}</Text>
      {latest ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.s, flexWrap: 'wrap' }}>
            <Text variant="displayL">{resultValue(latest)}</Text>
            {latestFlag ? <FlagChip label={latestFlag} /> : null}
          </View>
          <Text variant="caption" color="textTertiary">
            Latest · {reportDate(latest.taken_at)} · {resultRange(latest)}
          </Text>
        </>
      ) : (
        <Text variant="body" color="textSecondary" style={{ marginTop: space.m }}>
          No values recorded for this marker.
        </Text>
      )}

      {numeric.length >= 2 && !unitsDiffer ? (
        <View style={{ marginTop: space.l }}>
          <LineChart
            height={200}
            points={numeric.map((p) => ({ x: p.taken_at, y: p.value as number, label: formatShortDate(p.taken_at) }))}
            formatValue={(v) => trimNumber(v, 1)}
            band={latest ? { low: latest.ref_low, high: latest.ref_high } : undefined}
          />
          <Text variant="caption" color="textTertiary" style={{ marginTop: space.s }}>
            Shaded: the latest report's range. Labs' ranges can differ.
          </Text>
        </View>
      ) : unitsDiffer ? (
        <Text variant="caption" color="textTertiary" style={{ marginTop: space.l }}>
          These results use different units, so they aren't drawn on one chart.
        </Text>
      ) : null}

      {series.length ? (
        <>
          <Spacer h={space.xl} />
          <SectionLabel right={`${series.length}`}>Results</SectionLabel>
          {[...series].reverse().map((p) => (
            <NavRow
              key={p.id}
              label={resultValue(p)}
              sub={[reportDate(p.taken_at), resultFlag(p)].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/labs/${p.report_id}`)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
