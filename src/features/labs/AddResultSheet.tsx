import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemModal } from '@/ui/SystemModal';
import { Text, useTextStyle } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { SectionLabel, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { addResult, createMarker, getMarkers, type LabMarker } from '@/db/queries/labs';

/** "12,5" and "12.5" both parse; empty is null. */
function parseNumber(value: string): number | null {
  const t = value.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Record one value from a report: pick the marker, then value, unit and the
 * lab's range exactly as printed. A non-numeric result ("Negative") goes in as
 * text. Ranges are optional because some reports don't print one.
 */
export function AddResultSheet({
  visible,
  reportId,
  onClose,
}: {
  visible: boolean;
  reportId: string;
  onClose: () => void;
}) {
  const { c, reducedMotion } = useTheme();
  const { lineHeight: _lh, ...inputType } = useTextStyle('body');
  const [query, setQuery] = useState('');
  const [marker, setMarker] = useState<LabMarker | null>(null);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');

  const markers = useQuery(() => (visible && !marker ? getMarkers(query) : []), [visible, marker, query]);

  const reset = () => {
    setQuery('');
    setMarker(null);
    setValue('');
    setUnit('');
    setLow('');
    setHigh('');
  };
  const close = () => {
    reset();
    onClose();
  };
  const choose = (m: LabMarker) => {
    setMarker(m);
    setUnit(m.default_unit ?? '');
  };

  const numeric = parseNumber(value);
  const canSave = marker != null && value.trim() !== '';
  const save = () => {
    if (!marker) return;
    addResult({
      reportId,
      markerId: marker.id,
      value: numeric,
      valueText: numeric == null ? value.trim() : null,
      unit: unit.trim() || null,
      refLow: parseNumber(low),
      refHigh: parseNumber(high),
    });
    close();
  };

  const field = {
    ...inputType,
    color: c.textPrimary,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    paddingHorizontal: space.m,
    height: 52,
  };
  const exact = markers.some((m) => m.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <SystemModal visible={visible} animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.l }}>
          <Text variant="titleM">{marker ? marker.name : 'Add value'}</Text>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color="textSecondary">
              Close
            </Text>
          </Pressable>
        </View>

        {!marker ? (
          <>
            <View style={{ paddingHorizontal: space.l }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Search markers, e.g. LDL"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="Search markers"
                style={field}
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: space.l }} keyboardShouldPersistTaps="handled">
              {query.trim().length > 1 && !exact ? (
                <Pressable
                  onPress={() => {
                    const id = createMarker(query, 'Other', null);
                    choose({ id, name: query.trim(), category: 'Other', default_unit: null, is_custom: 1 });
                  }}
                  accessibilityRole="button"
                  style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.s }}
                >
                  <Icon name="plus" size={16} color="textPrimary" />
                  <Text variant="body">Add “{query.trim()}” as a new marker</Text>
                </Pressable>
              ) : null}
              {markers.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => choose(m)}
                  accessibilityRole="button"
                  style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderColor: c.hairline }}
                >
                  <Text variant="body">{m.name}</Text>
                  <Text variant="caption" color="textTertiary">
                    {m.category}
                    {m.default_unit ? ` · ${m.default_unit}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={{ padding: space.l }} keyboardShouldPersistTaps="handled">
            <SectionLabel>Result</SectionLabel>
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <TextInput
                value={value}
                onChangeText={setValue}
                autoFocus
                placeholder="Value"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="Value"
                style={[field, { flex: 2 }]}
              />
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="Unit"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="Unit"
                autoCapitalize="none"
                style={[field, { flex: 1 }]}
              />
            </View>
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
              {value.trim() && numeric == null ? 'Saved as text, e.g. “Negative”.' : 'Type it as printed on the report.'}
            </Text>

            <Spacer h={space.l} />
            <SectionLabel>Lab's reference range (optional)</SectionLabel>
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <TextInput
                value={low}
                onChangeText={setLow}
                keyboardType="decimal-pad"
                placeholder="Low"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="Range low"
                style={[field, { flex: 1 }]}
              />
              <TextInput
                value={high}
                onChangeText={setHigh}
                keyboardType="decimal-pad"
                placeholder="High"
                placeholderTextColor={c.textTertiary}
                accessibilityLabel="Range high"
                style={[field, { flex: 1 }]}
              />
            </View>
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
              For “below 100” fill only High; for “above 40” only Low.
            </Text>

            <Spacer h={space.xl} />
            <View style={{ flexDirection: 'row', gap: space.m }}>
              <Button label="Back" variant="ghost" height={52} style={{ flex: 1 }} onPress={() => setMarker(null)} />
              <Button label="Save" variant="secondary" height={52} style={{ flex: 2 }} disabled={!canSave} onPress={save} />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </SystemModal>
  );
}
