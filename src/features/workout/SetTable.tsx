import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';
import { duration, space } from '@/ui/tokens';
import { formatWeight } from '@/lib/format';
import { formatDuration } from '@/lib/time';
import type { SetRow } from '@/db/queries/session';
import type { Unit } from '@/lib/format';

/**
 * Fixed column widths, scaled with the OS font size like the text in them —
 * at 44 dp the "SET" header wrapped to "SE / T" on large text settings.
 */
function useColumns() {
  const { fontScale } = useWindowDimensions();
  // Capped: Android 14+ scales large text non-linearly, so the reported scale
  // (up to 2) overstates how much the glyphs actually grow.
  const k = Math.min(1.5, Math.max(1, fontScale));
  return { set: Math.round(44 * k), reps: Math.round(72 * k) };
}

/**
 * Logged sets for the current exercise.
 * Deliberately recessive: logged rows use secondary tone so the eye is never
 * pulled backwards away from the active row (DESIGN.md 5.4.1).
 */
export function SetTable({
  sets,
  drops = [],
  unit,
  onEdit,
  onRemove,
  showRest = false,
  flashId = null,
}: {
  sets: SetRow[];
  /** Drops (drop_index > 0), shown under the set with the same set_number. */
  drops?: SetRow[];
  unit: Unit;
  onEdit?: (set: SetRow) => void;
  onRemove?: (set: SetRow) => void;
  showRest?: boolean;
  /** Row to flash once, confirming a set was committed. */
  flashId?: string | null;
}) {
  const cols = useColumns();
  if (sets.length === 0) return null;

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: space.s }}>
        <Text variant="label" color="textTertiary" style={{ width: cols.set }}>
          Set
        </Text>
        <Text variant="label" color="textTertiary" style={{ flex: 1 }}>
          Weight
        </Text>
        <Text variant="label" color="textTertiary" style={{ width: cols.reps }}>
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
          {drops
            .filter((d) => d.set_number === set.set_number)
            .map((d) => (
              <LoggedRow
                key={d.id}
                set={d}
                unit={unit}
                flash={flashId === d.id}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}

          {showRest && set.rest_before_s != null ? (
            <Text variant="caption" color="textTertiary" style={{ paddingLeft: cols.set }}>
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
 *
 * Runs on the UI thread (Reanimated): the flash starts in the same frame as the
 * set's database write and the revision bump that re-renders the screen, and a
 * JS-driven fade stuttered under that load. Only opacities animate:
 *   - an accent fill behind the row,
 *   - the normal-ink row fading out while
 *   - an accentInk copy of the row fades in on top.
 * The fill and the copy are mounted only while this row is flashing, and the
 * copy is hidden from screen readers so the set is announced once.
 *
 * Reduced motion: inverted instantly, held for duration.flashHold, cleared
 * with no fade.
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
  const { c, reducedMotion } = useTheme();
  const cols = useColumns();
  const glow = useSharedValue(0);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!flash) return;
    setFlashing(true);
    const settle = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setFlashing)(false);
    };
    glow.value = withSequence(
      withTiming(1, { duration: 0 }),
      reducedMotion
        ? withDelay(duration.flashHold, withTiming(0, { duration: 0 }, settle))
        : withDelay(duration.instant, withTiming(0, { duration: duration.flash }, settle)),
    );
    return () => {
      // Another row took the flash, or this one unmounted: never leave the
      // overlay stuck half-visible.
      cancelAnimation(glow);
      glow.value = 0;
      setFlashing(false);
    };
  }, [flash, glow, reducedMotion]);

  const drop = set.drop_index > 0;
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const baseStyle = useAnimatedStyle(() => ({ opacity: 1 - glow.value }));

  const cells = (ink: boolean) => (
    <>
      {drop ? (
        // The number font has no arrow glyph; the icon set does.
        <View style={{ width: cols.set }}>
          <Icon name="corner-down-right" size={16} color={ink ? 'accentInk' : 'textTertiary'} />
        </View>
      ) : (
        <Text variant="num" color={ink ? 'accentInk' : 'textTertiary'} style={{ width: cols.set }}>
          {set.set_number}
        </Text>
      )}
      {set.skipped ? (
        <Text variant="num" color={ink ? 'accentInk' : 'textTertiary'} style={{ flex: 1 }}>
          Skipped
        </Text>
      ) : (
        <>
          <Text variant="num" color={ink ? 'accentInk' : 'textSecondary'} style={{ flex: 1 }}>
            {formatWeight(set.weight_kg, unit)}
          </Text>
          <Text variant="num" color={ink ? 'accentInk' : 'textSecondary'} style={{ width: cols.reps }}>
            {set.reps}
          </Text>
        </>
      )}
      <View style={{ width: 28, alignItems: 'flex-end' }}>
        <Icon
          name={set.skipped ? 'minus' : 'check'}
          size={16}
          color={ink ? 'accentInk' : set.skipped ? 'textTertiary' : 'positive'}
        />
      </View>
    </>
  );

  return (
    <View>
      {flashing ? (
        <Reanimated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }, glowStyle]}
        />
      ) : null}
      <Pressable
        onPress={() => (set.skipped ? onRemove?.(set) : onEdit?.(set))}
        onLongPress={() => onRemove?.(set)}
        accessibilityRole="button"
        accessibilityLabel={
          set.skipped
            ? `Set ${set.set_number}, skipped. Tap to remove.`
            : `${drop ? `Drop ${set.drop_index} of set ${set.set_number}` : `Set ${set.set_number}`}, ${formatWeight(set.weight_kg, unit)} for ${set.reps} reps. Tap to edit, hold to remove.`
        }
        style={({ pressed }) => [
          ROW,
          { borderColor: c.hairline, backgroundColor: pressed ? c.bgRaised : 'transparent' },
        ]}
      >
        <Reanimated.View style={[ROW_CELLS, baseStyle]}>{cells(false)}</Reanimated.View>
      </Pressable>
      {flashing ? (
        <Reanimated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, ROW, { borderColor: 'transparent' }, glowStyle]}
        >
          <View style={ROW_CELLS}>{cells(true)}</View>
        </Reanimated.View>
      ) : null}
    </View>
  );
}

/** Shared by the row and its flash copy, so the two lay out identically. */
const ROW = { flexDirection: 'row', alignItems: 'center', height: 48, borderTopWidth: 1 } as const;
const ROW_CELLS = { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' } as const;

/**
 * Last session's sets, above today's inputs — DESIGN.md 5.4.1.
 *
 * Secondary, not tertiary: this is the number the user is trying to match or
 * beat, read at arm's length between sets, so it must be plainly legible. It
 * still sits a step below today's primary-tone values and in a smaller variant.
 */
export function PreviousLine({
  sets,
  drops = [],
  unit,
  when,
  target,
}: {
  sets: SetRow[];
  drops?: SetRow[];
  unit: Unit;
  when: string;
  /** "Target 65 × 8" — on the same line, so the screen gains no height. */
  target?: string;
}) {
  if (sets.length === 0) return null;
  const one = (s: SetRow) => `${formatWeight(s.weight_kg, unit, false)} × ${s.reps}`;
  // A drop follows its set in words, "40 × 5 then 25 × 8": an arrow glyph sits
  // visibly smaller than the digits around it in Geist.
  const text = sets
    .map((s) => [s, ...drops.filter((d) => d.set_number === s.set_number)].map(one).join(' then '))
    .join('    ');
  return (
    <View style={{ marginBottom: space.l }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.m }}>
        <Text variant="label" color="textSecondary">
          Last time · {when}
        </Text>
        {target ? (
          <Text variant="label" color="textPrimary" style={{ marginLeft: 'auto' }}>
            {target}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: space.xs }}>
        {text}
      </Text>
    </View>
  );
}
