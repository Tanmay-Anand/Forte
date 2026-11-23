import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { LineChart } from '@/ui/LineChart';
import { NavRow } from '@/ui/NavRow';
import { Divider, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  addMeasurement,
  ageYears,
  getLatestMeasurements,
  getMeasurements,
  getProfile,
  weightChange,
} from '@/db/queries/profile';
import { deleteAllHealthData, getReports } from '@/db/queries/labs';
import { NumericKeypad } from '@/features/workout/NumericKeypad';
import {
  KINDS,
  TAPE_KINDS,
  formatMeasure,
  fromDisplay,
  isPlausible,
  toDisplay,
} from '@/features/profile/kinds';
import type { Measurement } from '@/db/queries/profile';
import { formatWeight, toDisplayWeight, trimNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * You — body and health records kept on this phone, plus the PC companion and
 * Settings as plain rows (they used to hide behind a gear icon).
 *
 * Every reading is a dated row; nothing is overwritten, so each one has a
 * history.
 */
export default function YouScreen() {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const [logging, setLogging] = useState(false);

  const pcSync = useSettings((s) => s.pcSync);
  const pcLastSentAt = useSettings((s) => s.pcLastSentAt);
  const pcLastError = useSettings((s) => s.pcLastError);
  const paired = pcSync !== null;
  const pcLine = !pcSync
    ? 'Pair your PC to review training on a bigger screen'
    : pcLastError
      ? `${pcSync.name} · not sent: ${pcLastError}`
      : pcLastSentAt
        ? `${pcSync.name} · sent ${formatShortDate(pcLastSentAt)}`
        : `${pcSync.name} · nothing sent yet`;

  const profile = useQuery(() => getProfile(), []);
  const latest = useQuery(() => getLatestMeasurements(), []);
  const weights = useQuery(() => getMeasurements('weight'), []);
  const reports = useQuery(() => getReports(), []);

  const weight = latest.weight;
  const change = weightChange(weights);
  const age = ageYears(profile.date_of_birth);
  const tapeLatest = TAPE_KINDS.map((k) => latest[k]).filter((m): m is Measurement => m != null);
  const newestTape = tapeLatest.sort((a, b) => b.measured_at - a.measured_at).slice(0, 2);

  const deleteAll = () =>
    Alert.alert(
      'Delete all health data?',
      'Removes every body measurement, your date of birth and target, and every blood report with its file. Workouts are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void deleteAllHealthData().catch((e: unknown) =>
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e)),
            ),
        },
      ],
    );

  return (
    <Screen>
      <Spacer h={space.l} />
      <Text variant="displayM">You</Text>

      <Text variant="label" color="textTertiary" style={{ marginTop: space.l }}>
        Weight{weight ? ` · ${formatShortDate(weight.measured_at)}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: space.m }}>
        <Text variant="displayL">{weight ? formatWeight(weight.value, unit) : '—'}</Text>
        {change && change.change !== 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.s }}>
            <Icon name={change.change > 0 ? 'arrow-up' : 'arrow-down'} size={14} color="textSecondary" />
            <Text variant="num" color="textSecondary" style={{ marginLeft: space.xs }}>
              {trimNumber(Math.abs(toDisplayWeight(change.change, unit)), 1)} since {formatShortDate(change.since)}
            </Text>
          </View>
        ) : null}
      </View>

      {weights.length >= 2 ? (
        <View style={{ marginTop: space.m }}>
          <LineChart
            height={160}
            points={weights.slice(-24).map((m) => ({
              x: m.measured_at,
              y: toDisplay('weight', m.value, unit),
              label: formatShortDate(m.measured_at),
            }))}
            formatValue={(v) => trimNumber(v, 1)}
          />
        </View>
      ) : null}

      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s }}>
        {profile.target_weight_kg != null
          ? `Target ${formatWeight(profile.target_weight_kg, unit)}` +
            (weight
              ? ` · ${trimNumber(Math.abs(toDisplayWeight(weight.value - profile.target_weight_kg, unit)), 1)} ${unit} to go`
              : '')
          : weight
            ? 'No target set. Add one in About you.'
            : 'Log a weigh-in to start the chart. Every reading is kept.'}
      </Text>

      <Spacer h={space.l} />
      <Button label="Log weight" variant="secondary" onPress={() => setLogging(true)} />

      <Spacer h={space.xl} />
      <SectionLabel>Body</SectionLabel>
      <NavRow
        label="Weight history"
        value={weights.length ? `${weights.length} ${weights.length === 1 ? 'entry' : 'entries'}` : undefined}
        onPress={() => router.push('/body/weight')}
      />
      <NavRow
        label="Height"
        value={latest.height ? formatMeasure('height', latest.height.value, unit) : 'Add'}
        onPress={() => router.push('/body/height')}
      />
      <NavRow
        label="Body fat"
        value={latest.body_fat ? formatMeasure('body_fat', latest.body_fat.value, unit) : 'Add'}
        onPress={() => router.push('/body/body_fat')}
      />
      <NavRow
        label="Measurements"
        sub={
          newestTape.length
            ? newestTape.map((m) => `${KINDS[m.kind].label} ${formatMeasure(m.kind, m.value, unit)}`).join(' · ')
            : 'Waist, chest, arms and more'
        }
        onPress={() => router.push('/body/measurements')}
      />

      <Spacer h={space.xl} />
      <SectionLabel>Health</SectionLabel>
      <NavRow
        label="Blood reports"
        sub={
          reports.length
            ? `${reports.length} ${reports.length === 1 ? 'report' : 'reports'} · latest ${formatShortDate(reports[0]!.taken_at)}`
            : 'Keep your reports and track values over time'
        }
        onPress={() => router.push('/labs')}
      />

      <Spacer h={space.xl} />
      <SectionLabel>About you</SectionLabel>
      <NavRow
        label={profile.date_of_birth ? `Born ${profile.date_of_birth.slice(0, 4)}${age != null ? ` · ${age}` : ''}` : 'Date of birth'}
        sub={profile.sex ? (profile.sex === 'male' ? 'Male' : 'Female') : undefined}
        value={profile.date_of_birth ? 'Edit' : 'Add'}
        onPress={() => router.push('/body/about')}
      />

      <Spacer h={space.xl} />
      <SectionLabel>App</SectionLabel>
      <NavRow
        label="PC companion"
        sub={pcLine}
        onPress={() => router.push(paired ? '/settings' : '/pair')}
      />
      <NavRow label="Settings" sub="Units, appearance, workout, AI analysis, backup" onPress={() => router.push('/settings')} />

      <Spacer h={space.xl} />
      <Divider />
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.l, maxWidth: 460 }}>
        Stored on this phone. Nothing here leaves it unless you export a backup, share it with an AI
        app yourself, or pair your PC in Settings.
      </Text>
      <NavRow label="Delete all health data" tone="negative" onPress={deleteAll} />

      <NumericKeypad
        visible={logging}
        title="Weight"
        unit={unit}
        initial={weight ? Number(trimNumber(toDisplay('weight', weight.value, unit), 1)) : unit === 'kg' ? 70 : 155}
        onCancel={() => setLogging(false)}
        onDone={(v) => {
          setLogging(false);
          const kg = fromDisplay('weight', v, unit);
          if (isPlausible('weight', kg)) addMeasurement('weight', kg);
          else if (v > 0) Alert.alert('Check the number', `${v} ${unit} looks like a typo. Nothing was saved.`);
        }}
      />
    </Screen>
  );
}

