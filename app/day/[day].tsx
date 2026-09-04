import React, { useState } from 'react';
import { View, Pressable, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { Divider, IconButton, Screen, SectionLabel, Spacer } from '@/ui/primitives';
import { UndoStrip, useUndo } from '@/ui/UndoStrip';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import {
  addExerciseToDay,
  getDay,
  getDayExercises,
  moveRoutineExercise,
  removeRoutineExercise,
  renameDay,
  replaceRoutineExercise,
  setRestDay,
  type RoutineExerciseRow,
} from '@/db/queries/routine';
import { ExercisePicker } from '@/features/routine/ExercisePicker';
import { dayName } from '@/lib/time';

/**
 * Customize Day — DESIGN.md 5.3.
 *
 * Deliberately shallow. A routine is an ordered list of exercises and nothing
 * else: no target sets, reps, RPE, RIR, tempo or rest targets. Everything
 * numeric is decided in the gym and recorded during the workout. This is the
 * strongest simplification in the product.
 */
export default function CustomizeDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dow = Number(day);
  const router = useRouter();
  const { c } = useTheme();
  const undo = useUndo();

  const [picking, setPicking] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const summary = useQuery(() => getDay(dow), [dow]);
  const exercises = useQuery(() => getDayExercises(dow), [dow]);

  if (!Number.isFinite(dow) || dow < 1 || dow > 7) {
    return (
      <Screen>
        <Text variant="titleM">Unknown day</Text>
      </Screen>
    );
  }

  const commitName = () => {
    renameDay(dow, draftName);
    setEditingName(false);
  };

  const remove = (item: RoutineExerciseRow) => {
    removeRoutineExercise(item.id);
    undo.offer(`${item.name} removed`, () => addExerciseToDay(dow, item.exercise_id));
  };

  const makeRestDay = () => {
    if (exercises.length === 0) {
      setRestDay(dow, true);
      router.back();
      return;
    }
    Alert.alert(
      'Make this a rest day?',
      `This clears the ${exercises.length} exercises planned for ${dayName(dow)}. Past workouts are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make rest day',
          style: 'destructive',
          onPress: () => {
            setRestDay(dow, true);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: space.s,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Week"
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Icon name="chevron-left" size={18} />
          <Text variant="body" color="textSecondary" style={{ marginLeft: space.xs }}>
            Week
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text variant="bodyStrong" color="accent">
            Done
          </Text>
        </Pressable>
      </View>

      <Spacer h={space.m} />
      <Text variant="label" color="textSecondary">
        {dayName(dow)}
      </Text>

      {editingName ? (
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          onBlur={commitName}
          onSubmitEditing={commitName}
          autoFocus
          placeholder="Chest + Triceps"
          placeholderTextColor={c.textTertiary}
          style={{
            marginTop: space.xs,
            fontSize: 32,
            fontWeight: '700',
            color: c.textPrimary,
            borderBottomWidth: 1,
            borderColor: c.accent,
            paddingVertical: space.xs,
          }}
        />
      ) : (
        <Pressable
          onPress={() => {
            setDraftName(summary?.name ?? '');
            setEditingName(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Rename this day"
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}
        >
          <Text
            variant="displayM"
            color={summary?.name ? 'textPrimary' : 'textTertiary'}
            style={{ flex: 1 }}
          >
            {summary?.name ?? 'Name this day'}
          </Text>
          <Feather name="edit-2" size={16} color={c.textTertiary} />
        </Pressable>
      )}

      <Spacer h={space.xl} />
      <SectionLabel right={String(exercises.length)}>Exercises</SectionLabel>

      {exercises.length === 0 ? (
        <Text variant="body" color="textSecondary" style={{ paddingVertical: space.l }}>
          This day is empty. Add exercises, or leave it as a rest day.
        </Text>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: c.hairline,
            borderRadius: radius.card,
            overflow: 'hidden',
          }}
        >
          {exercises.map((item, index) => (
            <ExerciseRow
              key={item.id}
              item={item}
              first={index === 0}
              last={index === exercises.length - 1}
              onUp={() => moveRoutineExercise(dow, item.id, -1)}
              onDown={() => moveRoutineExercise(dow, item.id, 1)}
              onRemove={() => remove(item)}
              onReplace={() => setReplacingId(item.id)}
            />
          ))}
        </View>
      )}

      <UndoStrip pending={undo.pending} onDismiss={undo.dismiss} />

      <Spacer h={space.l} />
      <Button label="+ Add Exercise" variant="secondary" onPress={() => setPicking(true)} />

      <Spacer h={space.xl} />
      <Divider />
      <Spacer h={space.l} />
      <Pressable onPress={makeRestDay} accessibilityRole="button">
        <Text variant="body" color="negative">
          Make this a rest day
        </Text>
      </Pressable>

      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onAdd={(exerciseId) => addExerciseToDay(dow, exerciseId)}
      />

      {/*
        Replacing here changes the routine for every future week. To swap just
        one day's session, use "Replace exercise" during the workout instead.
      */}
      <ExercisePicker
        visible={replacingId !== null}
        title="Replace exercise"
        onClose={() => setReplacingId(null)}
        onAdd={(exerciseId) => {
          if (replacingId) replaceRoutineExercise(replacingId, exerciseId);
          setReplacingId(null);
        }}
      />
    </Screen>
  );
}

function ExerciseRow({
  item,
  first,
  last,
  onUp,
  onDown,
  onRemove,
  onReplace,
}: {
  item: RoutineExerciseRow;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: space.m,
        borderTopWidth: first ? 0 : 1,
        borderColor: c.hairline,
        backgroundColor: c.bgRaised,
      }}
    >
      <Pressable
        onPress={onReplace}
        accessibilityRole="button"
        accessibilityLabel={`Replace ${item.name}`}
        style={{ flex: 1, paddingVertical: space.m }}
      >
        <Text variant="body" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
          {item.equipment} · {item.muscle_group} · tap to replace
        </Text>
      </Pressable>

      <IconButton label={`Move ${item.name} up`} onPress={onUp} style={{ opacity: first ? 0.25 : 1 }}>
        <Feather name="chevron-up" size={18} color={c.textSecondary} />
      </IconButton>
      <IconButton
        label={`Move ${item.name} down`}
        onPress={onDown}
        style={{ opacity: last ? 0.25 : 1 }}
      >
        <Feather name="chevron-down" size={18} color={c.textSecondary} />
      </IconButton>
      <IconButton label={`Remove ${item.name}`} onPress={onRemove}>
        <Feather name="x" size={18} color={c.textTertiary} />
      </IconButton>
    </View>
  );
}
