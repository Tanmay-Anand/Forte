import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getProgressSeries, getTrackedExercises } from '@/db/queries/progress';
import { formatWeight, toDisplayWeight, trimNumber } from '@/lib/format';
import { relativeDays } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { Sparkline } from './Sparkline';

/**
 * Log · Lifts. Every lift you have logged, at once: its top-set trend, the
 * latest top set, and how far it has moved since the first session. The
 * previous design showed one lift at a time behind a dropdown; scanning the
 * whole list is what tells you which lifts are moving and which have stalled.
 * A row opens the lift's own page (app/lift/[id].tsx).
 */
export function LiftsView() {
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);

  const lifts = useQuery(
    () =>
      getTrackedExercises().map((e) => {
        const series = getProgressSeries(e.id);
        const first = series[0];
        const last = series[series.length - 1];
        return {
          ...e,
          tops: series.map((p) => p.top_weight),
          sessions: series.length,
          latest: last ? { weight: last.top_weight, reps: last.top_weight_reps } : null,
          change: first && last ? last.top_weight - first.top_weight : 0,
        };
      }),
    [],
  );

  if (lifts.length === 0) {
    return (
      <EmptyState
        title="Nothing to chart yet"
        body="Lifts appear here after your first logged workout."
        action={<Button label="Start today's workout" onPress={() => router.push('/')} />}
      />
    );
  }

  return (
    <View>
      <Text variant="label" color="textTertiary" style={{ marginBottom: space.xs }}>
        {lifts.length} {lifts.length === 1 ? 'lift' : 'lifts'} · most recent first
      </Text>
      <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
        {lifts.map((l) => {
          const change = toDisplayWeight(l.change, unit);
          return (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/lift/${l.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${l.name}. Latest ${l.latest ? `${formatWeight(l.latest.weight, unit)} times ${l.latest.reps}` : 'none'}. ${
                change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${trimNumber(Math.abs(change))} ${unit}`
              }`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                columnGap: space.m,
                paddingVertical: space.m,
                borderBottomWidth: 1,
                borderColor: c.hairline,
                backgroundColor: pressed ? c.bgSunken : 'transparent',
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="body" numberOfLines={1}>
                  {l.name}
                </Text>
                <Text variant="caption" color="textTertiary">
                  {change === 0 && l.sessions > 2 ? `Same for ${l.sessions}` : `${l.sessions} sessions`} ·{' '}
                  {relativeDays(l.last_at)}
                </Text>
              </View>
              <Sparkline values={l.tops} />
              <View style={{ width: 84, alignItems: 'flex-end' }}>
                <Text variant="num">
                  {l.latest ? `${formatWeight(l.latest.weight, unit, false)} × ${l.latest.reps}` : '—'}
                </Text>
                <Text variant="num" color={change > 0 ? 'positive' : change < 0 ? 'negative' : 'textTertiary'}>
                  {change === 0 ? 'same' : `${change > 0 ? '+' : '−'}${trimNumber(Math.abs(change))}`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
