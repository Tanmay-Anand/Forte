import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SystemModal } from '@/ui/SystemModal';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { ControlChip } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { getLabSeries, resultFlag, type MarkerPoint } from '@/db/queries/labs';
import { loadHistory } from '@/db/queries/analysis';
import { healthBrief } from '@/features/analysis';
import { currentBriefOptions, shareHealthBrief } from '@/features/claude/share';
import { resultValue } from './format';

/**
 * Pick the markers to ask Claude about. Nothing is ticked to start with: the
 * person chooses what leaves the phone, marker by marker.
 */
export function MarkerShareSheet({
  visible,
  markers,
  onClose,
}: {
  visible: boolean;
  markers: (MarkerPoint & { count: number })[];
  onClose: () => void;
}) {
  const { c, reducedMotion } = useTheme();
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    setPicked(new Set());
    onClose();
  };

  const ids = markers.map((m) => m.marker_id).filter((id) => picked.has(id));

  const share = () => {
    const text = healthBrief(getLabSeries(ids), loadHistory(), Date.now(), currentBriefOptions());
    close();
    void shareHealthBrief(text, ids.length);
  };

  return (
    <SystemModal visible={visible} animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.l }}>
          <Text variant="titleM">Ask AI about</Text>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color="textSecondary">
              Close
            </Text>
          </Pressable>
        </View>
        <Text variant="caption" color="textTertiary" style={{ paddingHorizontal: space.l, maxWidth: 480 }}>
          Tick the markers to share. Each goes with its dates, values and the lab's range, plus a short
          training summary. Report files and lab names are never included.
        </Text>

        <View style={{ flexDirection: 'row', gap: space.s, paddingHorizontal: space.l, marginTop: space.m }}>
          <ControlChip label="Select all" onPress={() => setPicked(new Set(markers.map((m) => m.marker_id)))} />
          <ControlChip label="Clear" onPress={() => setPicked(new Set())} />
        </View>

        <ScrollView contentContainerStyle={{ padding: space.l }}>
          {markers.map((m) => {
            const on = picked.has(m.marker_id);
            const flag = resultFlag(m);
            return (
              <Pressable
                key={m.marker_id}
                onPress={() => toggle(m.marker_id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${m.marker}, ${resultValue(m)}${flag ? `, ${flag}` : ''}`}
                style={{
                  minHeight: 56,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.m,
                  borderBottomWidth: 1,
                  borderColor: c.hairline,
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
                  <Text variant="body">{m.marker}</Text>
                  <Text variant="caption" color="textTertiary">
                    {m.count} {m.count === 1 ? 'result' : 'results'}
                    {flag ? ` · latest ${flag.toLowerCase()}` : ''}
                  </Text>
                </View>
                <Text variant="num" color="textSecondary">
                  {resultValue(m)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ padding: space.l, gap: space.s }}>
          <Button
            label={ids.length ? `Share ${ids.length} ${ids.length === 1 ? 'marker' : 'markers'}` : 'Tick at least one marker'}
            variant="secondary"
            disabled={!ids.length}
            onPress={share}
          />
          <Pressable
            disabled={!ids.length}
            onPress={() => {
              close();
              router.push(`/claude/brief?kind=health&ids=${ids.join(',')}`);
            }}
            accessibilityRole="button"
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: ids.length ? 1 : 0.4 }}
          >
            <Text variant="caption" color="textSecondary">
              Show what's shared
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SystemModal>
  );
}
