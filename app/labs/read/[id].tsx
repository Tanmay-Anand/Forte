import React, { useMemo, useState } from 'react';
import { View, TextInput, Pressable, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Text, useTextStyle } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { ControlChip, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { trimNumber } from '@/lib/format';
import { addResult, createMarker, getReport, matchMarker, reportFileUri } from '@/db/queries/labs';
import { LAB_READ_PROMPT, labFlag, parseLabReply, type ParsedLabRow } from '@/features/analysis';
import { BackLink } from '@/features/labs/BackLink';
import { FlagChip } from '@/features/labs/FlagChip';

/**
 * Read a report's values with Claude, no API: send the request to the Claude
 * app, attach the report there, paste the reply back. Forte turns the reply
 * into draft rows, and nothing is saved until each one is ticked. Saved rows
 * are marked as read by Claude.
 */
export default function ReadReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const inputType = useTextStyle('caption');
  const report = useQuery(() => (id ? getReport(id) : null), [id]);
  const [reply, setReply] = useState('');
  const [rows, setRows] = useState<ParsedLabRow[] | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const matches = useMemo(() => (rows ?? []).map((r) => matchMarker(r.name)), [rows]);

  if (!report || !id) {
    return (
      <Screen>
        <BackLink label="Report" />
        <Text variant="titleM">Report not found</Text>
      </Screen>
    );
  }

  const sendRequest = () =>
    void Share.share({ message: LAB_READ_PROMPT, title: 'Forte' }).catch((e: unknown) =>
      Alert.alert('Could not open the share menu', e instanceof Error ? e.message : String(e)),
    );

  const saveCopy = async () => {
    const uri = await reportFileUri(report);
    if (!uri) {
      Alert.alert('File not on this device', 'Attach the report in the AI app from wherever you saved it.');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: report.mime_type ?? undefined, dialogTitle: report.file_name ?? 'Report' });
  };

  const read = () => {
    const parsed = parseLabReply(reply);
    if (!parsed.length) {
      Alert.alert(
        'No values found',
        'Forte looks for lines like "LDL cholesterol | 138 | mg/dL | - | 100". Check that you pasted the whole reply.',
      );
      return;
    }
    setRows(parsed);
    setTicked(new Set());
  };

  const save = () => {
    if (!rows) return;
    let saved = 0;
    rows.forEach((r, i) => {
      if (!ticked.has(i)) return;
      const markerId = matches[i]?.id ?? createMarker(r.name, report.category, r.unit);
      addResult({
        reportId: id,
        markerId,
        value: r.value,
        valueText: r.valueText,
        unit: r.unit,
        refLow: r.low,
        refHigh: r.high,
        source: 'ai_confirmed',
      });
      saved++;
    });
    Alert.alert('Saved', `${saved} ${saved === 1 ? 'value' : 'values'} added to this report.`);
    router.back();
  };

  const toggle = (i: number) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink label="Report" />
      <Text variant="displayM">Read values with AI</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s, maxWidth: 480 }}>
        This sends the report, including your name and anything else printed on it, to the AI app you pick
        (Claude, ChatGPT or Gemini). Forte saves nothing until you tick each value below.
      </Text>

      {rows == null ? (
        <>
          <Spacer h={space.xl} />
          <Step n={1} title="Send the request to an AI app" body="Opens the share menu. Pick Claude, ChatGPT or Gemini.">
            <ControlChip label="Send the request" icon="share" onPress={sendRequest} />
          </Step>
          <Step
            n={2}
            title="Attach the report in that chat"
            body="In that chat, tap + or the attach button and choose the report. If it's only in Forte, save a copy first."
          >
            {report.file_name ? <ControlChip label="Save a copy of the file" icon="download" onPress={() => void saveCopy()} /> : null}
          </Step>
          <Step n={3} title="Copy the reply and paste it here" body="Long-press the answer, Copy, then come back.">
            <TextInput
              value={reply}
              onChangeText={setReply}
              multiline
              placeholder="LDL cholesterol | 138 | mg/dL | - | 100"
              placeholderTextColor={c.textTertiary}
              accessibilityLabel="The AI's reply"
              style={{
                ...inputType,
                width: '100%',
                minHeight: 140,
                color: c.textPrimary,
                borderWidth: 1,
                borderColor: c.lineStrong,
                borderRadius: radius.input,
                padding: space.m,
                textAlignVertical: 'top',
              }}
            />
          </Step>
          <Button label="Read the reply" variant="secondary" disabled={!reply.trim()} onPress={read} />
        </>
      ) : (
        <>
          <Spacer h={space.xl} />
          <SectionLabel right={`${ticked.size} of ${rows.length} ticked`}>Check each value</SectionLabel>
          <Text variant="caption" color="textTertiary" style={{ marginBottom: space.m, maxWidth: 480 }}>
            Compare with the report. Tick only what matches it exactly.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.s, marginBottom: space.m }}>
            <ControlChip label="Tick all" onPress={() => setTicked(new Set(rows.map((_, i) => i)))} />
            <ControlChip label="Clear" onPress={() => setTicked(new Set())} />
          </View>
          {rows.map((r, i) => {
            const on = ticked.has(i);
            const match = matches[i];
            const flag = labFlag({ value: r.value, refLow: r.low, refHigh: r.high });
            const range =
              r.low != null && r.high != null
                ? `${trimNumber(r.low, 2)}–${trimNumber(r.high, 2)}`
                : r.high != null
                  ? `below ${trimNumber(r.high, 2)}`
                  : r.low != null
                    ? `above ${trimNumber(r.low, 2)}`
                    : 'no range';
            return (
              <Pressable
                key={`${r.name}-${i}`}
                onPress={() => toggle(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{
                  minHeight: 60,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.m,
                  borderBottomWidth: 1,
                  borderColor: c.hairline,
                  paddingVertical: space.s,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.input / 2,
                    borderWidth: 1,
                    borderColor: on ? c.textPrimary : c.lineStrong,
                    backgroundColor: on ? c.bgElevated : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <Icon name="check" size={14} color="textPrimary" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{match?.name ?? r.name}</Text>
                  <Text variant="caption" color="textTertiary">
                    {match ? (match.name !== r.name ? `Read as "${r.name}" · ` : '') : 'New marker · '}
                    Range {range}
                  </Text>
                </View>
                {flag ? <FlagChip label={flag} /> : null}
                <Text variant="num" color="textSecondary">
                  {r.value != null ? trimNumber(r.value, 2) : r.valueText}
                  {r.unit ? ` ${r.unit}` : ''}
                </Text>
              </Pressable>
            );
          })}
          <Spacer h={space.l} />
          <Button
            label={ticked.size ? `Save ${ticked.size} ${ticked.size === 1 ? 'value' : 'values'}` : 'Tick the values to save'}
            variant="secondary"
            disabled={!ticked.size}
            onPress={save}
          />
          <Pressable onPress={() => setRows(null)} accessibilityRole="button" style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" color="textSecondary">
              Paste a different reply
            </Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <Text variant="label" color="textSecondary">
        Step {n}
      </Text>
      <Text variant="bodyStrong" style={{ marginTop: space.xs }}>
        {title}
      </Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: 2, marginBottom: space.m }}>
        {body}
      </Text>
      {children ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View> : null}
    </View>
  );
}
