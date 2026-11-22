import React, { useState } from 'react';
import { View, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Text, useTextStyle } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Chip, ControlChip, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { addReport } from '@/db/queries/labs';
import { LAB_CATEGORIES, type LabCategory } from '@/data/lab-markers.seed';
import { BackLink } from '@/features/labs/BackLink';
import { isoToday, parseIsoDate } from '@/features/labs/format';

type PickedFile = { uri: string; name: string; mimeType: string | null };

/** New report: date, category, optional lab name and file. Values are added on the next screen. */
export default function NewReportScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { lineHeight: _lh, ...inputType } = useTextStyle('body');
  const [date, setDate] = useState(isoToday());
  const [category, setCategory] = useState<LabCategory>('Blood count');
  const [lab, setLab] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const takenAt = parseIsoDate(date);

  const pick = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    const asset = picked.canceled ? null : picked.assets?.[0];
    if (asset) setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null });
  };

  const save = async () => {
    if (takenAt == null) return;
    setSaving(true);
    try {
      const id = await addReport({ takenAt, category, labName: lab, file });
      router.replace(`/labs/${id}`);
    } catch (error) {
      Alert.alert('Could not save the report', error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  const input = {
    ...inputType,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    paddingHorizontal: space.m,
    height: 52,
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink label="Blood reports" />
      <Text variant="displayM">New report</Text>

      <Spacer h={space.xl} />
      <SectionLabel>Date the sample was taken</SectionLabel>
      <TextInput
        value={date}
        onChangeText={(v) => setDate(v.replace(/[^\d-]/g, '').slice(0, 10))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.textTertiary}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Sample date, year month day"
        style={{ ...input, borderColor: takenAt == null ? c.negative : c.lineStrong }}
      />
      {takenAt == null ? (
        <Text variant="caption" color="negative" style={{ marginTop: space.xs }}>
          Use the form 2026-09-12, and not a future date.
        </Text>
      ) : null}

      <Spacer h={space.xl} />
      <SectionLabel>Type</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {LAB_CATEGORIES.map((cat) => (
          <Chip key={cat} label={cat} active={category === cat} onPress={() => setCategory(cat)} />
        ))}
      </ScrollView>

      <Spacer h={space.xl} />
      <SectionLabel>Lab (optional)</SectionLabel>
      <TextInput
        value={lab}
        onChangeText={setLab}
        placeholder="Lab or clinic name"
        placeholderTextColor={c.textTertiary}
        accessibilityLabel="Lab name"
        style={input}
      />

      <Spacer h={space.xl} />
      <SectionLabel>File (optional)</SectionLabel>
      {file ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
            {file.name}
          </Text>
          <ControlChip label="Remove" onPress={() => setFile(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <ControlChip label="Attach PDF or image" icon="paperclip" onPress={() => void pick()} />
        </View>
      )}
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.s, maxWidth: 460 }}>
        The file is copied into Forte's private storage on this phone, where other apps can't read it.
        Forte's backup file holds the report's details and values, not the file itself.
      </Text>

      <Spacer h={space.xxl} />
      <Button label="Save report" onPress={() => void save()} disabled={takenAt == null || saving} />
    </Screen>
  );
}
