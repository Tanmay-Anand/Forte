import React, { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Divider, Screen, SectionLabel, Spacer, StatGrid } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  compareExercises,
  getPreviousSessionSummary,
  getSessionSummary,
} from '@/db/queries/history';
import { setSessionNote } from '@/db/queries/session';
import { deltaIcon, formatDelta, formatVolume, formatWeight, trimNumber, type Delta } from '@/lib/format';
import { formatClock, formatLongDate, formatMinutes, formatShortDate } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * Finish Workout — DESIGN.md 5.5.
 * Calm, factual, comparative. Unchanged lifts show an em dash, never a red
 * down-arrow: maintaining is not failing.
 */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);
  const [writingNote, setWritingNote] = useState(false);

  const summary = useQuery(() => (id ? getSessionSummary(id) : null), [id]);
  const previous = useQuery(() => (id ? getPreviousSessionSummary(id) : null), [id]);
  const comparisons = useQuery(() => (id ? compareExercises(id) : []), [id]);

  const [note, setNote] = useState(summary?.note ?? '');

  if (!summary) {
    return (
      <Screen>
        <Text variant="titleM">Workout not found</Text>
        <Spacer h={space.xl} />
        <Button label="Done" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const volumeDelta = previous ? formatDelta(summary.volume, previous.volume) : null;

  // Only lifts that moved appear, capped so this never becomes a report.
  const changed = comparisons
    .filter((x) => x.previous_top != null && x.current_top !== x.previous_top)
    .slice(0, 5);

  return (
    <Screen edges={['top', 'bottom']}>
      <Spacer h={space.xl} />
      <Text variant="titleM" color="textSecondary">
        Workout Complete
      </Text>
      <Text variant="displayL" style={{ marginTop: space.xs }}>
        {summary.name}
      </Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        {formatLongDate(summary.started_at)} · {formatClock(summary.started_at)}
      </Text>

      <Spacer h={space.xl} />
      <Divider />
      <Spacer h={space.xl} />

      <StatGrid
        items={[
          { label: 'Duration', value: formatMinutes(summary.duration_ms) },
          { label: 'Exercises', value: String(summary.exercise_count) },
          { label: 'Sets', value: String(summary.set_count) },
          { label: 'Total Volume', value: formatVolume(summary.volume, unit) },
        ]}
      />

      <Divider />
      <Spacer h={space.l} />

      {previous ? (
        <>
          <SectionLabel>Compared with {formatShortDate(previous.started_at)}</SectionLabel>

          <CompareRow
            label="Volume"
            value={`${formatVolume(previous.volume, unit, false)} → ${formatVolume(summary.volume, unit, false)}`}
            delta={volumeDelta}
          />

          {changed.map((x) => {
            const delta = formatDelta(x.current_top, x.previous_top ?? 0);
            const diff = x.current_top - (x.previous_top ?? 0);
            return (
              <CompareRow
                key={x.exercise_id}
                label={x.name}
                value={`${formatWeight(x.previous_top ?? 0, unit, false)} → ${formatWeight(x.current_top, unit)}`}
                delta={{
                  ...delta,
                  text: `${diff > 0 ? '+' : ''}${trimNumber(diff)}`,
                }}
              />
            );
          })}

          {changed.length === 0 ? (
            <Text variant="caption" color="textTertiary">
              Same weights as last time across the board.
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="body" color="textSecondary">
          First time logging {summary.name}. Next time you'll see your progress here.
        </Text>
      )}

      <Spacer h={space.xxl} />
      <Button
        label="Done"
        onPress={() => {
          // Belt and braces: the note is already persisted on every keystroke,
          // but leaving the screen must never be the thing that loses it.
          if (id) setSessionNote(id, note);
          router.replace('/');
        }}
        shout
      />

      <Spacer h={space.l} />
      {writingNote ? (
        <TextInput
          value={note}
          // Persist as you type. onBlur alone lost the note whenever the
          // keyboard was dismissed with the back button and the screen was
          // then left — which is the ordinary way to finish typing on Android.
          onChangeText={(v) => {
            setNote(v);
            if (id) setSessionNote(id, v);
          }}
          onBlur={() => setWritingNote(false)}
          autoFocus
          multiline
          placeholder="How did it feel?"
          placeholderTextColor={c.textTertiary}
          style={{
            minHeight: 72,
            color: c.textPrimary,
            fontSize: 16,
            borderWidth: 1,
            borderColor: c.hairline,
            borderRadius: 8,
            padding: space.m,
            textAlignVertical: 'top',
          }}
        />
      ) : (
        <Pressable onPress={() => setWritingNote(true)} accessibilityRole="button">
          <Text variant="caption" color={note ? 'textPrimary' : 'textSecondary'} align="center">
            {note || 'Add a note to this session'}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

function CompareRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: Delta | null;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: space.s,
      }}
    >
      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="num" color="textSecondary" style={{ marginRight: space.m }}>
        {value}
      </Text>
      {delta ? (
        <View
          style={{
            minWidth: 74,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <Icon
            name={deltaIcon(delta.direction)}
            size={14}
            color={
              delta.direction === 'up'
                ? 'positive'
                : delta.direction === 'down'
                  ? 'negative'
                  : 'textTertiary'
            }
          />
          {delta.text ? (
            <Text
              variant="num"
              color={delta.direction === 'up' ? 'positive' : 'negative'}
              style={{ marginLeft: space.xs }}
            >
              {delta.text}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
