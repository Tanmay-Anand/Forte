import React, { useEffect, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, useTextStyle } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { ActionSheet } from '@/ui/ActionSheet';
import { Divider, Screen, SectionLabel, Spacer, StatGrid } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getPreviousSessionSummary, getSessionSummary } from '@/db/queries/history';
import { setSessionEffort, setSessionNote } from '@/db/queries/session';
import { loadHistory } from '@/db/queries/analysis';
import {
  compareSession,
  findSession,
  nextTarget,
  sessionBaseline,
  sessionBrief,
  sessionRecords,
  type NextTarget,
} from '@/features/analysis';
import { EffortPicker } from '@/features/summary/EffortPicker';
import { MusclesWorked } from '@/features/summary/MusclesWorked';
import {
  ComparisonRows,
  NextTimeList,
  RecordsList,
  comparisonTitle,
  usualVolumeLine,
} from '@/features/summary/SessionReview';
import {
  currentBriefOptions,
  sendBackupForCompanion,
  shareTrainingBrief,
} from '@/features/claude/share';
import { deltaIcon, formatDelta, formatVolume, type Delta } from '@/lib/format';
import { formatClock, formatLongDate, formatMinutes } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { folderLabel, runAutoBackup, type BackupResult } from '@/lib/auto-backup';

/**
 * Finish Workout — DESIGN.md 5.5.
 * Calm, factual, comparative. Unchanged lifts show an em dash, never a red
 * down-arrow: maintaining is not failing.
 *
 * Everything on this screen is calculated on the phone and works offline.
 * Claude is one optional action at the bottom, never something that arrives.
 */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const noteType = useTextStyle('body');
  const unit = useSettings((s) => s.unit);
  const [writingNote, setWritingNote] = useState(false);
  const [claudeMenu, setClaudeMenu] = useState(false);
  const [backup, setBackup] = useState<BackupResult | null>(null);
  const backupDir = useSettings((s) => s.autoBackupDir);

  // Automatic backup: once, when the finished workout is first shown. Off the
  // interaction path — the summary never waits for it.
  useEffect(() => {
    let alive = true;
    void runAutoBackup().then((r) => alive && setBackup(r));
    return () => {
      alive = false;
    };
  }, [id]);

  const summary = useQuery(() => (id ? getSessionSummary(id) : null), [id]);
  const previous = useQuery(() => (id ? getPreviousSessionSummary(id) : null), [id]);
  const history = useQuery(() => loadHistory(), []);
  const comparison = id ? compareSession(history, id) : null;
  const records = id ? sessionRecords(history, id, unit) : [];
  const baseline = id ? sessionBaseline(history, id) : null;
  const session = id ? findSession(history, id) : null;
  const targets = session
    ? session.exercises
        .map((e) => ({ name: e.name, target: nextTarget(e.sets, e.weightStep, unit) }))
        .filter((x): x is { name: string; target: NextTarget } => x.target !== null)
    : [];

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
  const saveNote = () => {
    // Belt and braces: the note is already persisted on every keystroke,
    // but leaving the screen must never be the thing that loses it.
    if (id) setSessionNote(id, note);
  };

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

      {baseline ? (
        <Text variant="caption" color="textSecondary" style={{ marginTop: -space.s, marginBottom: space.l }}>
          {usualVolumeLine(baseline, summary.name, unit)}
        </Text>
      ) : null}

      <SectionLabel>How hard was it?</SectionLabel>
      <EffortPicker value={summary.effort} onChange={(v) => id && setSessionEffort(id, v)} />

      <Spacer h={space.xl} />
      <Divider />
      <Spacer h={space.l} />

      <RecordsList records={records} />

      {previous && comparison ? (
        <>
          <SectionLabel>{comparisonTitle(comparison)}</SectionLabel>
          <CompareRow
            label="Volume"
            value={`${formatVolume(previous.volume, unit, false)} → ${formatVolume(summary.volume, unit, false)}`}
            delta={volumeDelta}
          />
          <ComparisonRows comparison={comparison} unit={unit} />
        </>
      ) : (
        <Text variant="body" color="textSecondary">
          First time logging {summary.name}. Next time you'll see your progress here.
        </Text>
      )}

      {session ? <MusclesWorked session={session} /> : null}

      <NextTimeList targets={targets} unit={unit} />

      <Spacer h={space.xxl} />
      <Button
        label="Done"
        onPress={() => {
          saveNote();
          router.replace('/');
        }}
        shout
      />
      <Spacer h={space.m} />
      <Button label="Analyse with AI" variant="secondary" onPress={() => setClaudeMenu(true)} />

      {backup ? (
        <Text variant="caption" color={backup.ok ? 'textTertiary' : 'negative'} align="center" style={{ marginTop: space.m }}>
          {backup.ok
            ? `Backed up to ${folderLabel(backupDir)}`
            : 'Automatic backup failed. Check the folder in Settings.'}
        </Text>
      ) : null}

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
            ...noteType,
            minHeight: 72,
            color: c.textPrimary,
            borderWidth: 1,
            borderColor: c.hairline,
            borderRadius: radius.input,
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

      <ActionSheet
        visible={claudeMenu}
        title="Analyse with AI"
        onClose={() => setClaudeMenu(false)}
        actions={[
          {
            label: 'Ask an AI app on this phone',
            hint: 'Opens the share menu. Pick Claude, ChatGPT or Gemini.',
            onPress: () => {
              saveNote();
              if (id) void shareTrainingBrief(sessionBrief(loadHistory(), id, currentBriefOptions()));
            },
          },
          {
            label: 'Send backup for Forte Companion',
            hint: 'Save it to Google Drive, then review on your PC.',
            onPress: () => {
              saveNote();
              void sendBackupForCompanion();
            },
          },
          {
            label: "Show what's shared",
            onPress: () => {
              if (id) router.push(`/claude/brief?kind=session&id=${id}`);
            },
          },
        ]}
      />
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
