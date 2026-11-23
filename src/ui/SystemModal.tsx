import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { create } from 'zustand';
import { useTheme } from './theme';
import { duration } from './tokens';

/**
 * The only way to open a modal in Forte: a drop-in for React Native's <Modal>
 * (same `visible`, `transparent`, `animationType`, `onRequestClose`) that draws
 * the sheet inside the app's own window instead of a separate Android dialog.
 *
 * Why: a <Modal> is its own window, and opening one while the activity has its
 * navigation bar hidden kept going wrong on Android with the new architecture.
 * Sheets drew nothing yet swallowed every tap, or laid out as a sliver in the
 * corner with the keyboard up, until Back was pressed. Revealing the bar
 * first and waiting 150 ms made it rarer, not gone (observed again on
 * 23 Nov 2026 with the add-exercise picker and the workout menu). With no
 * second window there is nothing to race: the sheet is an ordinary view on
 * top of the screen, it opens instantly, and the bar can stay hidden.
 *
 * <ModalHost /> (mounted once in app/_layout.tsx) renders every open sheet,
 * newest on top, and sends the hardware Back button to the top one.
 */

type Animation = 'none' | 'slide' | 'fade';

/** The subset of React Native's ModalProps that Forte's sheets use. */
type SystemModalProps = {
  visible: boolean;
  children?: React.ReactNode;
  transparent?: boolean;
  animationType?: Animation;
  /** Hardware Back while this sheet is on top. */
  onRequestClose?: () => void;
};

type Entry = {
  id: number;
  node: React.ReactNode;
  transparent: boolean;
  animation: Animation;
  onRequestClose?: () => void;
  /** Still on screen while its exit animation runs. */
  closing: boolean;
};

type ModalState = {
  entries: Entry[];
  upsert: (entry: Omit<Entry, 'closing'>) => void;
  close: (id: number) => void;
  remove: (id: number) => void;
};

export const useModals = create<ModalState>((set) => ({
  entries: [],
  upsert: (entry) =>
    set((s) => {
      const i = s.entries.findIndex((e) => e.id === entry.id);
      if (i < 0) return { entries: [...s.entries, { ...entry, closing: false }] };
      const entries = s.entries.slice();
      entries[i] = { ...entry, closing: false };
      return { entries };
    }),
  close: (id) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, closing: true } : e)) })),
  remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));

let nextId = 1;

export function SystemModal({
  visible,
  children,
  transparent = false,
  animationType = 'none',
  onRequestClose,
}: SystemModalProps) {
  const id = useRef(nextId++).current;
  const { upsert, close } = useModals.getState();

  // Every render while open hands the host the latest children, so the sheet
  // stays in step with the screen that owns it.
  useLayoutEffect(() => {
    if (visible) {
      upsert({ id, node: children, transparent, animation: animationType, onRequestClose });
    } else if (useModals.getState().entries.some((e) => e.id === id && !e.closing)) {
      close(id);
    }
  });

  // The owner left the screen with the sheet open: take it away at once.
  useEffect(() => () => useModals.getState().remove(id), [id]);

  return null;
}

/** Renders every open sheet over the app. Mount once, after the navigator. */
export function ModalHost() {
  const entries = useModals((s) => s.entries);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const top = [...useModals.getState().entries].reverse().find((e) => !e.closing);
      if (!top) return false;
      top.onRequestClose?.();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!entries.length) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {entries.map((e) => (
        <Layer key={e.id} entry={e} />
      ))}
    </View>
  );
}

function Layer({ entry }: { entry: Entry }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(entry.animation === 'none' ? 1 : 0)).current;

  useEffect(() => {
    const target = entry.closing ? 0 : 1;
    if (entry.animation === 'none') {
      progress.setValue(target);
      if (entry.closing) useModals.getState().remove(entry.id);
      return;
    }
    const run = Animated.timing(progress, {
      toValue: target,
      duration: duration.slow,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished && entry.closing) useModals.getState().remove(entry.id);
    });
    return () => run.stop();
  }, [entry.closing, entry.animation, entry.id, progress]);

  const motion =
    entry.animation === 'slide'
      ? { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }
      : entry.animation === 'fade'
        ? { opacity: progress }
        : null;

  return (
    <Animated.View
      // A closing sheet no longer takes touches, so the screen is usable at once.
      pointerEvents={entry.closing ? 'none' : 'auto'}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, entry.transparent ? null : { backgroundColor: c.bgBase }, motion]}
    >
      {entry.node}
    </Animated.View>
  );
}
