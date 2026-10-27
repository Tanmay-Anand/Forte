import React, { useState } from 'react';
import { View, Pressable, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Divider, Screen, SectionLabel, Segmented, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useSettings, type ThemePreference } from '@/store/settings';
import { exportCsv, exportJson, importJson } from '@/lib/export';
import { vacuum } from '@/db/client';
import { ensureNotificationPermission } from '@/features/workout/workout-notification';
import type { Unit } from '@/lib/format';

export default function SettingsScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const s = useSettings();
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert(`${label} failed`, error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const pickAndImport = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (picked.canceled || !picked.assets?.[0]) return;
    const uri = picked.assets[0].uri;
    Alert.alert(
      'Replace all data?',
      'Importing overwrites every workout currently on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () =>
            void run('Import', async () => {
              const raw = await FileSystem.readAsStringAsync(uri);
              const result = importJson(raw);
              Alert.alert('Import complete', `${result.sessions} sessions, ${result.sets} sets.`);
            }),
        },
      ],
    );
  };

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

      <Text variant="displayM">Settings</Text>
      <Spacer h={space.xl} />

      <SectionLabel>Units</SectionLabel>
      <Segmented<Unit>
        options={[
          { value: 'kg', label: 'Kilograms' },
          { value: 'lb', label: 'Pounds' },
        ]}
        value={s.unit}
        onChange={(v) => s.set('unit', v)}
      />
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s }}>
        Weight is always stored in kilograms. This changes display only, so your history stays
        consistent if you switch.
      </Text>

      <Spacer h={space.xl} />
      <SectionLabel>Appearance</SectionLabel>
      <Segmented<ThemePreference>
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={s.theme}
        onChange={(v) => s.set('theme', v)}
      />

      <Spacer h={space.xl} />
      <SectionLabel>During a workout</SectionLabel>

      <Toggle
        label="Keep screen awake"
        help="Off saves roughly 4x the battery over an hour. Rest times stay exactly correct either way, because the timer reads the clock rather than counting ticks — so you can lock the phone between sets and lose nothing."
        value={s.keepAwake}
        onChange={(v) => s.set('keepAwake', v)}
      />
      <Toggle
        label="Lock-screen controls"
        help="During a workout, shows the rest stopwatch with Pause, Start set and Log set buttons on the lock screen and in the notification shade. Android draws the ticking digits itself from the saved start time, so it costs no battery and stays correct with the app closed."
        value={s.lockScreenControls}
        onChange={(v) => {
          s.set('lockScreenControls', v);
          if (v) void ensureNotificationPermission();
        }}
      />
      <Toggle
        label="Reduce motion"
        help="Replaces transitions with plain fades. No state information is lost."
        value={s.reducedMotion}
        onChange={(v) => s.set('reducedMotion', v)}
      />

      <Spacer h={space.xl} />
      <Divider />
      <Spacer h={space.l} />
      <SectionLabel>Your data</SectionLabel>
      <Text variant="caption" color="textTertiary" style={{ marginBottom: space.m }}>
        Everything lives on this device only. Nothing is uploaded anywhere. Export regularly — a
        backup is the only thing standing between you and a lost phone.
      </Text>

      <Action label="Export backup (JSON)" onPress={() => void run('Export', exportJson)} disabled={busy} />
      <Action label="Export sets (CSV)" onPress={() => void run('Export', exportCsv)} disabled={busy} />
      <Action label="Import backup" onPress={() => void pickAndImport()} disabled={busy} />
      <Action
        label="Compact database"
        onPress={() =>
          void run('Compact', async () => {
            vacuum();
            Alert.alert('Done', 'Database compacted.');
          })
        }
        disabled={busy}
      />

      <Spacer h={space.xxl} />
      <Text variant="caption" color="textTertiary" align="center">
        Forte · personal training log
      </Text>
    </Screen>
  );
}

function Toggle({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: space.m, borderBottomWidth: 1, borderColor: c.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="body" style={{ flex: 1 }}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: c.accent, false: c.lineStrong }}
          thumbColor={c.bgRaised}
          accessibilityLabel={label}
        />
      </View>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs, maxWidth: 460 }}>
        {help}
      </Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderColor: c.hairline,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}
