import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { NavRow } from '@/ui/NavRow';
import { Card, ControlChip, IconButton, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  deleteReport,
  deleteResult,
  getReport,
  getResults,
  reportFileUri,
  resultFlag,
} from '@/db/queries/labs';
import { AddResultSheet } from '@/features/labs/AddResultSheet';
import { BackLink } from '@/features/labs/BackLink';
import { FlagChip } from '@/features/labs/FlagChip';
import { RangeBar } from '@/features/labs/RangeBar';
import { reportDate, resultRange, resultValue } from '@/features/labs/format';

/**
 * One report: its file, and the values recorded from it. Each value links to
 * that marker's trend; each point on a trend links back here.
 */
export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const [adding, setAdding] = useState(false);

  const report = useQuery(() => (id ? getReport(id) : null), [id]);
  const results = useQuery(() => (id ? getResults(id) : []), [id]);

  if (!report || !id) {
    return (
      <Screen>
        <BackLink label="Blood reports" />
        <Text variant="titleM">Report not found</Text>
      </Screen>
    );
  }

  const open = async () => {
    const uri = await reportFileUri(report);
    if (!uri) {
      Alert.alert('File not on this device', 'This report was restored from a backup, which keeps the values but not the file.');
      return;
    }
    // Android shows its "open with" sheet; Forte has no file viewer of its own.
    await Sharing.shareAsync(uri, { mimeType: report.mime_type ?? undefined, dialogTitle: report.file_name ?? 'Report' });
  };

  const remove = () =>
    Alert.alert('Delete this report?', 'Its recorded values and its file are deleted too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteReport(id).then(() => router.back());
        },
      },
    ]);

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink label="Blood reports" />
      <Text variant="displayM">{report.category}</Text>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        Sample taken {reportDate(report.taken_at)}
        {report.lab_name ? ` · ${report.lab_name}` : ''}
      </Text>

      {report.file_name ? (
        <>
          <Spacer h={space.l} />
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <Icon name="file-text" size={20} />
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={1}>
                  {report.file_name}
                </Text>
                <Text variant="caption" color="textTertiary">
                  Stored on this phone only
                </Text>
              </View>
              <ControlChip label="Open" onPress={() => void open()} />
            </View>
          </Card>
        </>
      ) : null}

      <Spacer h={space.xl} />
      <SectionLabel right="Recorded by you">Values</SectionLabel>
      {results.length === 0 ? (
        <Text variant="body" color="textSecondary">
          No values recorded from this report yet.
        </Text>
      ) : (
        results.map((x) => {
          const flag = resultFlag(x);
          return (
            <View
              key={x.id}
              style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.hairline }}
            >
              <Pressable
                onPress={() => router.push(`/labs/marker/${x.marker_id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${x.marker}, ${resultValue(x)}${flag ? `, ${flag}` : ''}. Open trend.`}
                style={{ flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="body">{x.marker}</Text>
                  <Text variant="caption" color="textTertiary">
                    {resultRange(x)}
                    {x.source === 'ai_confirmed' ? ' · read by AI, checked by you' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                    {flag ? <FlagChip label={flag} /> : null}
                    <Text variant="num" color={flag ? 'textPrimary' : 'textSecondary'}>
                      {resultValue(x)}
                    </Text>
                  </View>
                  <RangeBar value={x.value} low={x.ref_low} high={x.ref_high} />
                </View>
              </Pressable>
              <IconButton
                label={`Delete ${x.marker}`}
                onPress={() =>
                  Alert.alert(`Delete ${x.marker}?`, resultValue(x), [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteResult(x.id) },
                  ])
                }
              >
                <Icon name="trash-2" size={16} color="textTertiary" />
              </IconButton>
            </View>
          );
        })
      )}

      <Spacer h={space.l} />
      <Button label="Add value" variant="secondary" onPress={() => setAdding(true)} />
      <View style={{ flexDirection: 'row', marginTop: space.m }}>
        <ControlChip label="Read values with AI" icon="file-text" onPress={() => router.push(`/labs/read/${id}`)} />
      </View>

      <Spacer h={space.xl} />
      <NavRow label="Delete report" tone="negative" onPress={remove} />

      <AddResultSheet visible={adding} reportId={id} onClose={() => setAdding(false)} />
    </Screen>
  );
}
