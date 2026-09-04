import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Card, Chip, EmptyState, Screen, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getHistory, getWorkoutNames, type SessionSummary } from '@/db/queries/history';
import { formatVolume } from '@/lib/format';
import { formatMinutes, monthName } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * History — DESIGN.md 5.7. Chronological, read-mostly, grouped by month.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const [filter, setFilter] = useState<string | null>(null);

  const names = useQuery(() => getWorkoutNames(), []);
  const sessions = useQuery(() => getHistory(200, filter ?? undefined), [filter]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: SessionSummary[] }[] = [];
    for (const s of sessions) {
      const d = new Date(s.started_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${monthName(d.getMonth())}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
      const existing = groups.find((g) => g.key === key);
      if (existing) existing.items.push(s);
      else groups.push({ key, label, items: [s] });
    }
    return groups;
  }, [sessions]);

  if (sessions.length === 0 && !filter) {
    return (
      <Screen navClearance>
        <Spacer h={space.l} />
        <Text variant="titleM">History</Text>
        <EmptyState
          title="No workouts logged yet"
          body="Your completed sessions will appear here."
          action={<Button label="Start today's workout" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen navClearance>
      <Spacer h={space.l} />
      <Text variant="titleM">History</Text>
      <Spacer h={space.m} />

      {names.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, marginBottom: space.l }}
        >
          <Chip label="All" active={filter === null} onPress={() => setFilter(null)} />
          {names.map((n) => (
            <Chip key={n} label={n} active={filter === n} onPress={() => setFilter(n)} />
          ))}
        </ScrollView>
      ) : null}

      {grouped.map((group) => (
        <View key={group.key}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: space.s }}>
            {group.label}
          </Text>
          {group.items.map((s) => (
            <View key={s.id} style={{ marginBottom: space.s }}>
              <Card onPress={() => router.push(`/session/${s.id}`)}>
                {/*
                  The note sits to the right of the session, sharing the row
                  with the name and stats. It is capped at three lines and
                  given at most half the card, so a long note cannot push the
                  numbers around — the log is still the point.
                */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: s.note ? space.m : 0 }}>
                    <Text variant="caption" color="textTertiary">
                      {weekdayAndDate(s.started_at)}
                    </Text>
                    <Text variant="titleM" style={{ marginTop: 2 }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text variant="num" color="textSecondary" style={{ marginTop: space.xs }}>
                      {formatMinutes(s.duration_ms)} · {s.set_count} sets ·{' '}
                      {formatVolume(s.volume, unit)}
                    </Text>
                  </View>

                  {s.note ? <SessionNote note={s.note} /> : null}
                </View>
              </Card>
            </View>
          ))}
          <Spacer h={space.m} />
        </View>
      ))}

      {sessions.length === 0 ? (
        <Text variant="body" color="textSecondary">
          No sessions match this filter.
        </Text>
      ) : null}
    </Screen>
  );
}

/** The session note, as a quiet marginal annotation rather than a headline. */
function SessionNote({ note }: { note: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        // An explicit width, not maxWidth: as an auto-sized sibling of a
        // flex:1 column this shrank to its first word.
        width: '44%',
        flexShrink: 0,
        borderLeftWidth: 2,
        borderLeftColor: c.lineStrong,
        paddingLeft: space.m,
      }}
    >
      <Text variant="caption" color="textSecondary" numberOfLines={3}>
        {note}
      </Text>
    </View>
  );
}

function weekdayAndDate(ms: number): string {
  const d = new Date(ms);
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${short} ${d.getDate()}`;
}
