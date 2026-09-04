import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

export type SheetAction = {
  label: string;
  onPress: () => void;
  /** Rendered in the negative tone. Use only for genuinely destructive items. */
  destructive?: boolean;
  hint?: string;
};

/**
 * Themed action sheet.
 *
 * Replaces Alert-as-a-menu, which had two problems: Android's AlertDialog
 * renders at most three buttons — so a five-item menu silently dropped two of
 * them, including "Discard workout" — and the system dialog is a white card in
 * the middle of a dark, minimal app.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#000000B8', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="Dismiss menu"
      >
        {/* Swallow taps inside the sheet so they do not dismiss it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.bgElevated,
            borderTopLeftRadius: radius.card + 8,
            borderTopRightRadius: radius.card + 8,
            paddingTop: space.s,
            paddingBottom: Math.max(insets.bottom, space.l),
            paddingHorizontal: space.m,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.lineStrong,
              marginBottom: space.m,
            }}
          />

          {title ? (
            <Text
              variant="label"
              color="textTertiary"
              style={{ paddingHorizontal: space.m, marginBottom: space.s }}
            >
              {title}
            </Text>
          ) : null}

          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onClose();
                // Let the sheet close before the action pushes a screen or
                // opens another modal.
                setTimeout(action.onPress, 10);
              }}
              style={({ pressed }) => ({
                minHeight: 56,
                justifyContent: 'center',
                paddingHorizontal: space.m,
                borderRadius: radius.input,
                backgroundColor: pressed ? c.bgSunken : 'transparent',
              })}
            >
              <Text variant="body" color={action.destructive ? 'negative' : 'textPrimary'}>
                {action.label}
              </Text>
              {action.hint ? (
                <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
                  {action.hint}
                </Text>
              ) : null}
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({
              height: 56,
              marginTop: space.s,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: pressed ? c.bgSunken : c.bgRaised,
            })}
          >
            <Text variant="bodyStrong" color="textSecondary">
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
