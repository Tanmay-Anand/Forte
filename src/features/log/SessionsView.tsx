import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Chip, EmptyState } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getHistory, getWorkoutNames, type SessionSummary } from '@/db/queries/history';
import { formatVolume } from '@/lib/format';
import { formatMinutes, monthName } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * Log · Sessions — DESIGN.md 5.7. Every completed session, newest first,
 * grouped by month, as ruled rows: the date, the workout, its numbers, and
 * the note when there is one. Filter chips narrow it to one workout.
 */
export function SessionsView() {
  const router = useRouter();
  const { c } = useTheme();
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
      <EmptyState
        title="No workouts logged yet"
        body="Your completed sessions will appear here."
        action={<Button label="Start today's workout" onPress={() => router.push('/')} />}
      />
    );
  }

  return (
    <View>
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
        <View key={group.key} style={{ marginBottom: space.l }}>
          <Text variant="label" color="textTertiary" style={{ marginBottom: space.xs }}>
            {group.label}
          </Text>
          <View style={{ borderTopWidth: 1, borderColor: c.hairline }}>
            {group.items.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/session/${s.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}, ${weekdayAndDate(s.started_at)}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  paddingVertical: space.m,
                  borderBottomWidth: 1,
                  borderColor: c.hairline,
                  backgroundColor: pressed ? c.bgSunken : 'transparent',
                })}
              >
                <Text variant="num" color="textTertiary" style={{ width: 64 }}>
                  {weekdayAndDate(s.started_at)}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text variant="num" color="textSecondary" style={{ marginTop: 2 }}>
                    {formatMinutes(s.duration_ms)} · {s.set_count} sets · {formatVolume(s.volume, unit)}
                  </Text>
                  {s.note ? (
                    <Text variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: space.xs }}>
                      “{s.note}”
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {sessions.length === 0 ? (
        <Text variant="body" color="textSecondary">
          No sessions match this filter.
        </Text>
      ) : null}
    </View>
  );
}

function weekdayAndDate(ms: number): string {
  const d = new Date(ms);
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${short} ${d.getDate()}`;
}
