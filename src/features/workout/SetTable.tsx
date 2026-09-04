import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { formatWeight } from '@/lib/format';
import { formatDuration } from '@/lib/time';
import type { SetRow } from '@/db/queries/session';
import type { Unit } from '@/lib/format';

/**
 * Logged sets for the current exercise.
 * Deliberately recessive: logged rows use secondary tone so the eye is never
 * pulled backwards away from the active row (DESIGN.md 5.4.1).
 */
export function SetTable({
  sets,
  unit,
  onEdit,
  onRemove,
  showRest = false,
  flashId = null,
}: {
  sets: SetRow[];
  unit: Unit;
  onEdit?: (set: SetRow) => void;
  onRemove?: (set: SetRow) => void;
  showRest?: boolean;
  /** Row to flash once, confirming a set was committed. */
  flashId?: string | null;
}) {
  if (sets.length === 0) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: space.s }}>
        <Text variant="label" color="textTertiary" style={{ width: 44 }}>
          Set
        </Text>
        <Text variant="label" color="textTertiary" style={{ flex: 1 }}>
          Weight
        </Text>
        <Text variant="label" color="textTertiary" style={{ width: 72 }}>
          Reps
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {sets.map((set) => (
        <View key={set.id}>
          <LoggedRow
            set={set}
            unit={unit}
            flash={flashId === set.id}
            onEdit={onEdit}
            onRemove={onRemove}
          />

          {showRest && set.rest_before_s != null ? (
            <Text variant="caption" color="textTertiary" style={{ paddingLeft: 44 }}>
              rest {formatDuration(set.rest_before_s)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * A single logged set.
 *
 * The one-shot accent flash is the confirmation that the set was committed.
 * It used to be a haptic tick; with haptics removed this is the only channel
 * left, so it is deliberately visible rather than subtle — but it fades to the
 * recessive logged style within half a second so it never competes with the
 * active row.
 */
function LoggedRow({
  set,
  unit,
  flash,
  onEdit,
  onRemove,
}: {
  set: SetRow;
  unit: Unit;
  flash: boolean;
  onEdit?: (set: SetRow) => void;
  onRemove?: (set: SetRow) => void;
}) {
  const { c } = useTheme();
  const glow = useRef(new Animated.Value(flash ? 1 : 0)).current;
  // The row's own text must invert while the accent is behind it, or the set
  // you just logged is unreadable for the half-second it is being confirmed.
  const [hot, setHot] = useState(flash);

  useEffect(() => {
    if (!flash) return;
    glow.setValue(1);
    setHot(true);
    Animated.timing(glow, {
      toValue: 0,
      duration: 520,
      delay: 80,
      useNativeDriver: false,
    }).start();
    const id = setTimeout(() => setHot(false), 460);
    return () => clearTimeout(id);
  }, [flash, glow]);

  return (
    <Animated.View
      style={{
        backgroundColor: glow.interpolate({
          inputRange: [0, 1],
          outputRange: ['transparent', c.accent],
        }),
      }}
    >
      <Pressable
        onPress={() => (set.skipped ? onRemove?.(set) : onEdit?.(set))}
        onLongPress={() => onRemove?.(set)}
        accessibilityRole="button"
        accessibilityLabel={
          set.skipped
            ? `Set ${set.set_number}, skipped. Tap to remove.`
            : `Set ${set.set_number}, ${formatWeight(set.weight_kg, unit)} for ${set.reps} reps. Tap to edit.`
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          height: 48,
          borderTopWidth: 1,
          borderColor: c.hairline,
          backgroundColor: pressed ? c.bgRaised : 'transparent',
        })}
      >
        <Text variant="num" color={hot ? 'accentInk' : 'textTertiary'} style={{ width: 44 }}>
          {set.set_number}
        </Text>
        {set.skipped ? (
          <Text variant="num" color="textTertiary" style={{ flex: 1 }}>
            Skipped
          </Text>
        ) : (
          <>
            <Text variant="num" color={hot ? 'accentInk' : 'textSecondary'} style={{ flex: 1 }}>
              {formatWeight(set.weight_kg, unit)}
            </Text>
            <Text variant="num" color={hot ? 'accentInk' : 'textSecondary'} style={{ width: 72 }}>
              {set.reps}
            </Text>
          </>
        )}
        <View style={{ width: 28, alignItems: 'flex-end' }}>
          <Icon
            name={set.skipped ? 'minus' : 'check'}
            size={16}
            color={set.skipped ? 'textTertiary' : hot ? 'accentInk' : 'positive'}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Last session's sets, above today's inputs — DESIGN.md 5.4.1.
 * One line, always tertiary. It must never compete with today's numbers.
 */
export function PreviousLine({
  sets,
  unit,
  when,
}: {
  sets: SetRow[];
  unit: Unit;
  when: string;
}) {
  if (sets.length === 0) return null;
  const text = sets
    .map((s) => `${formatWeight(s.weight_kg, unit, false)} × ${s.reps}`)
    .join('    ');
  return (
    <View style={{ marginBottom: space.l }}>
      <Text variant="label" color="textTertiary">
        Last time · {when}
      </Text>
      <Text variant="caption" color="textTertiary" numberOfLines={2} style={{ marginTop: space.xs }}>
        {text}
      </Text>
    </View>
  );
}
