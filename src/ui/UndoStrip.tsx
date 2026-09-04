import React, { useEffect, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space } from './tokens';

const UNDO_WINDOW_MS = 5000;

export type PendingUndo = { message: string; undo: () => void } | null;

/**
 * Inline five-second undo — DESIGN.md 7.
 * This is the app's answer to confirmation dialogs. Only two genuinely
 * unrecoverable actions get a dialog: discard workout, and delete session.
 */
export function useUndo() {
  const [pending, setPending] = useState<PendingUndo>(null);

  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setPending(null), UNDO_WINDOW_MS);
    return () => clearTimeout(id);
  }, [pending]);

  const offer = useCallback((message: string, undo: () => void) => {
    setPending({ message, undo });
  }, []);

  const dismiss = useCallback(() => setPending(null), []);

  return { pending, offer, dismiss };
}

export function UndoStrip({ pending, onDismiss }: { pending: PendingUndo; onDismiss: () => void }) {
  const { c } = useTheme();
  if (!pending) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: c.bgRaised,
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: c.hairline,
        paddingHorizontal: space.m,
        height: 48,
        marginVertical: space.xs,
      }}
    >
      <Text variant="caption" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
        {pending.message}
      </Text>
      <Pressable
        onPress={() => {
          pending.undo();
          onDismiss();
        }}
        accessibilityRole="button"
        accessibilityLabel="Undo"
        hitSlop={12}
      >
        <Text variant="bodyStrong" color="accent">
          Undo
        </Text>
      </Pressable>
    </View>
  );
}
