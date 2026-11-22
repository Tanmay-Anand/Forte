import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { LineChart } from '@/ui/LineChart';
import { IconButton, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { addMeasurement, deleteMeasurement, getMeasurements } from '@/db/queries/profile';
import { NumericKeypad } from '@/features/workout/NumericKeypad';
import {
  KINDS,
  displayUnit,
  formatMeasure,
  fromDisplay,
  isMeasureKind,
  isPlausible,
  toDisplay,
} from '@/features/profile/kinds';
import { trimNumber } from '@/lib/format';
import { formatLongDate, formatShortDate } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * One measurement's full history: chart, every entry, add and delete.
 * Entries are never edited in place — a wrong reading is deleted and added
 * again, so the history only ever contains values someone actually entered.
 */
export default function MeasurementScreen() {
  const { kind: raw = '' } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const unit = useSettings((s) => s.unit);
  const [adding, setAdding] = useState(false);

  const kind = isMeasureKind(raw) ? raw : null;
  const entries = useQuery(() => (kind ? getMeasurements(kind) : []), [kind]);

  if (!kind) {
    return (
      <Screen>
        <Text variant="titleM">Unknown measurement</Text>
      </Screen>
    );
  }

  const info = KINDS[kind];
  const last = entries[entries.length - 1];
  const remove = (id: string, label: string) =>
    Alert.alert('Delete this entry?', label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(id) },
    ]);

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

      <Text variant="displayM">{info.label}</Text>
      <Text variant="displayL" style={{ marginTop: space.s }}>
        {last ? formatMeasure(kind, last.value, unit) : '—'}
      </Text>
      <Text variant="caption" color="textTertiary">
        {last ? `Latest · ${formatLongDate(last.measured_at)}` : 'No entries yet.'}
      </Text>

      {entries.length >= 2 ? (
        <View style={{ marginTop: space.l }}>
          <LineChart
            height={180}
            points={entries.map((m) => ({
              x: m.measured_at,
              y: toDisplay(kind, m.value, unit),
              label: formatShortDate(m.measured_at),
            }))}
            formatValue={(v) => trimNumber(v, 1)}
          />
        </View>
      ) : null}

      <Spacer h={space.l} />
      <Button label={`Add ${info.label.toLowerCase()}`} variant="secondary" onPress={() => setAdding(true)} />

      {entries.length ? (
        <>
          <Spacer h={space.xl} />
          <SectionLabel right={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}>
            History
          </SectionLabel>
          {[...entries].reverse().map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
                borderBottomWidth: 1,
                borderColor: c.hairline,
              }}
            >
              <Text variant="num" color="textSecondary" style={{ width: 110 }}>
                {formatShortDate(m.measured_at)} {new Date(m.measured_at).getFullYear()}
              </Text>
              <Text variant="num" style={{ flex: 1 }}>
                {formatMeasure(kind, m.value, unit)}
              </Text>
              <IconButton
                label={`Delete entry from ${formatShortDate(m.measured_at)}`}
                onPress={() => remove(m.id, `${formatMeasure(kind, m.value, unit)} on ${formatLongDate(m.measured_at)}`)}
              >
                <Icon name="trash-2" size={16} color="textTertiary" />
              </IconButton>
            </View>
          ))}
        </>
      ) : null}

      <NumericKeypad
        visible={adding}
        title={info.label}
        unit={displayUnit(kind, unit)}
        initial={last ? Number(trimNumber(toDisplay(kind, last.value, unit), 1)) : 0}
        onCancel={() => setAdding(false)}
        onDone={(v) => {
          setAdding(false);
          const metric = fromDisplay(kind, v, unit);
          if (isPlausible(kind, metric)) addMeasurement(kind, metric);
          else if (v > 0) Alert.alert('Check the number', `${v} ${displayUnit(kind, unit)} looks like a typo. Nothing was saved.`);
        }}
      />
    </Screen>
  );
}
