import React, { useState } from 'react';
import { Modal, View, Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';

const BACKSPACE = 'backspace';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', BACKSPACE];

/**
 * Purpose-built numeric pad rather than the OS keyboard — DESIGN.md 5.4.1.
 * The system keyboard is small, slow to appear, and puts the digits where a
 * typist expects them rather than where a thumb can reach them.
 */
export function NumericKeypad({
  visible,
  initial,
  title,
  unit,
  allowDecimal = true,
  onCancel,
  onDone,
}: {
  visible: boolean;
  initial: number;
  title: string;
  unit: string;
  allowDecimal?: boolean;
  onCancel: () => void;
  onDone: (value: number) => void;
}) {
  const { c } = useTheme();
  const [buffer, setBuffer] = useState('');

  // Fresh entry replaces the value rather than appending to it: the user
  // opened the pad because the number is wrong.
  const display = buffer === '' ? String(initial) : buffer;

  const press = (key: string) => {
    if (key === BACKSPACE) {
      setBuffer((b) => (b.length <= 1 ? '' : b.slice(0, -1)));
      return;
    }
    if (key === '.') {
      if (!allowDecimal) return;
      setBuffer((b) => (b.includes('.') ? b : (b === '' ? '0' : b) + '.'));
      return;
    }
    setBuffer((b) => (b === '0' ? key : b + key));
  };

  const commit = () => {
    const parsed = Number(buffer === '' ? initial : buffer);
    onDone(Number.isFinite(parsed) ? parsed : initial);
    setBuffer('');
  };

  const dismiss = () => {
    setBuffer('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={{ flex: 1, backgroundColor: '#000000B8' }} onPress={dismiss} />
      {/*
        Rounded top edge, matching the action sheet. With a square edge the
        pad sliced whatever control it happened to land on clean in half, which
        read as a clipped element rather than a sheet sliding over the screen.
      */}
      <View
        style={{
          backgroundColor: c.bgElevated,
          borderTopLeftRadius: radius.card + 8,
          borderTopRightRadius: radius.card + 8,
        }}
      >
        <View style={{ padding: space.l, alignItems: 'center' }}>
          <Text variant="label" color="textSecondary">
            {title}
          </Text>
          {/*
            Two sibling Texts on a baseline-aligned row, not a nested <Text>.
            Nesting a titleM inside a displayL makes Android collapse the outer
            line box to the inner lineHeight, so the digits overlapped the
            label above them.
          */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              marginTop: space.s,
            }}
          >
            <Text variant="displayL">{display}</Text>
            <Text variant="titleM" color="textTertiary" style={{ marginLeft: space.s }}>
              {unit}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.s }}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === BACKSPACE ? 'Delete' : key}
              disabled={key === '.' && !allowDecimal}
              style={({ pressed }) => ({
                width: '33.333%',
                height: 64,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: key === '.' && !allowDecimal ? 0.25 : 1,
                backgroundColor: pressed ? c.bgSunken : 'transparent',
              })}
            >
              {key === BACKSPACE ? (
                <Icon name="delete" size={24} color="textPrimary" />
              ) : (
                <Text variant="titleL">{key}</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', padding: space.l, gap: space.m }}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: c.lineStrong,
            }}
          >
            <Text variant="bodyStrong" color="textSecondary">
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={commit}
            accessibilityRole="button"
            style={{
              flex: 2,
              height: 56,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.input,
              backgroundColor: c.accent,
            }}
          >
            <Text variant="bodyStrong" color="accentInk">
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
