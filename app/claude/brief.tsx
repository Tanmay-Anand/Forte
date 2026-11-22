import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Card, Screen, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { loadHistory } from '@/db/queries/analysis';
import { getLabSeries, getTrackedMarkers } from '@/db/queries/labs';
import { healthBrief, periodBrief, sessionBrief } from '@/features/analysis';
import {
  currentBriefOptions,
  shareHealthBrief,
  shareTrainingBrief,
} from '@/features/claude/share';

type Kind = 'session' | 'period' | 'health';

/**
 * "Show what's shared" — the exact text a share to Claude would contain,
 * built the same way as the real thing. Nothing is sent from this screen
 * unless Share is tapped.
 */
export default function BriefScreen() {
  const { kind = 'session', id, ids } = useLocalSearchParams<{ kind?: Kind; id?: string; ids?: string }>();
  const router = useRouter();

  const brief = useQuery(() => {
    const options = currentBriefOptions();
    const history = loadHistory();
    if (kind === 'health') {
      // Only the markers ticked in Blood reports; all of them when opened without a choice.
      const markers = ids ? ids.split(',').filter(Boolean) : getTrackedMarkers().map((m) => m.marker_id);
      return { text: healthBrief(getLabSeries(markers), history, Date.now(), options), count: markers.length };
    }
    if (kind === 'period') return { text: periodBrief(history, Date.now(), options), count: 0 };
    const sessionId = id ?? history.sessions[history.sessions.length - 1]?.id;
    return { text: sessionId ? sessionBrief(history, sessionId, options) : '', count: 0 };
  }, [kind, id, ids]);

  const title =
    kind === 'health' ? 'Blood results brief' : kind === 'period' ? 'Last 8 weeks brief' : 'Session brief';

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
          Back
        </Text>
      </Pressable>

      <Text variant="displayM">{title}</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s, maxWidth: 460 }}>
        This is exactly what Forte would put in the share menu. It goes nowhere unless you tap Share
        and pick an app. Change what's included in Settings → AI analysis.
      </Text>

      <Spacer h={space.l} />
      {brief.text ? (
        <Card muted>
          <Text variant="caption" color="textSecondary" selectable>
            {brief.text}
          </Text>
        </Card>
      ) : (
        <Text variant="body" color="textSecondary">
          {kind === 'health' ? 'No blood results recorded yet.' : 'No finished workouts yet.'}
        </Text>
      )}

      {brief.text ? (
        <View style={{ marginTop: space.xl }}>
          <Button
            label="Share"
            variant="secondary"
            onPress={() =>
              void (kind === 'health' ? shareHealthBrief(brief.text, brief.count) : shareTrainingBrief(brief.text))
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
