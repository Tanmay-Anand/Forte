import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Feather from '@expo/vector-icons/Feather';

import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { ControlChip, Divider, IconButton, useGutter } from '@/ui/primitives';
import { UndoStrip, useUndo } from '@/ui/UndoStrip';
import { ActionSheet, type SheetAction } from '@/ui/ActionSheet';
import { useTheme } from '@/ui/theme';
import { space, WORKOUT_ACTION_HEIGHT } from '@/ui/tokens';

import { useQuery } from '@/lib/db-hooks';
import { useSettings } from '@/store/settings';
import { fromDisplayWeight, toDisplayWeight, formatWeight } from '@/lib/format';
import { formatDuration, formatShortDate } from '@/lib/time';

import {
  addExerciseToSession,
  completeSession,
  deleteSet,
  discardSession,
  getActiveSession,
  getPreviousPerformance,
  getSessionExercises,
  getSets,
  logSet,
  pauseRest,
  prefillFor,
  resetRest,
  resumeRest,
  setCurrentIndex,
  replaceSessionExercise,
  setExerciseSkipped,
  skipSet,
  stopRest,
  toRestState,
  updateSet,
  type SetRow,
} from '@/db/queries/session';
import { NumberWell } from '@/features/workout/NumberWell';
import { NumericKeypad } from '@/features/workout/NumericKeypad';
import { RestPanel, WorkoutClock } from '@/features/workout/RestPanel';
import { PreviousLine, SetTable } from '@/features/workout/SetTable';
import { ExercisePicker } from '@/features/routine/ExercisePicker';
import { ensureNotificationPermission } from '@/features/workout/workout-notification';

type Keypad = { field: 'weight' | 'reps' } | null;

const KEEP_AWAKE_TAG = 'forte-workout';

/**
 * Active Workout — DESIGN.md 5.4. The screen everything else feeds.
 *
 * Optimised for one-handed use at a 30cm viewing distance by someone whose
 * attention is on a barbell. Two taps per set in the steady state:
 * COMPLETE SET starts the rest stopwatch; START SET stops it and stores the
 * duration. Rest is never typed.
 */
export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const gutter = useGutter();
  const unit = useSettings((s) => s.unit);
  const keepAwakeEnabled = useSettings((s) => s.keepAwake);
  const undo = useUndo();

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
  const [keypad, setKeypad] = useState<Keypad>(null);
  const [editingSet, setEditingSet] = useState<SetRow | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  const session = useQuery(() => getActiveSession(), []);
  const exercises = useQuery(() => (session ? getSessionExercises(session.id) : []), [session?.id]);

  const index = Math.min(session?.current_index ?? 0, Math.max(0, exercises.length - 1));
  const current = exercises[index];

  const sets = useQuery(() => (current ? getSets(current.id) : []), [current?.id]);
  const previous = useQuery(
    () => (current && session ? getPreviousPerformance(current.exercise_id, session.id) : null),
    [current?.exercise_id, session?.id],
  );

  const isLastExercise = index >= exercises.length - 1;
  const rest = session ? toRestState(session) : null;
  const resting = rest?.startedAt != null;

  // useKeepAwake() activates on mount regardless of its argument, so the
  // setting has to be applied imperatively for section 6.2 to mean anything.
  useEffect(() => {
    if (!keepAwakeEnabled) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepAwakeEnabled]);

  // Lock-screen controls need POST_NOTIFICATIONS on Android 13+. Asked here,
  // the first time a workout opens, because that is when the request makes sense.
  const lockScreenControls = useSettings((s) => s.lockScreenControls);
  useEffect(() => {
    if (lockScreenControls) void ensureNotificationPermission();
  }, [lockScreenControls]);

  // Pre-fill the wells so repeating a set costs zero taps (DESIGN.md 5.4.1).
  useEffect(() => {
    if (!session || !current) return;
    const fill = prefillFor(session.id, current.id, current.exercise_id);
    setWeight(Number(toDisplayWeight(fill.weightKg, unit).toFixed(2)));
    setReps(fill.reps);
  }, [session?.id, current?.id, sets.length, unit]);

  const doneCount = useMemo(
    () => exercises.filter((e) => getSets(e.id).length > 0).length,
    [exercises, sets.length],
  );

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase, padding: gutter }}>
        <Text variant="titleM">No active workout</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: space.s }}>
          This session has already been finished or discarded.
        </Text>
        <View style={{ marginTop: space.xl }}>
          <Button label="Back to Today" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------- actions

  const completeSet = () => {
    if (!current) return;
    if (editingSet) {
      updateSet(editingSet.id, fromDisplayWeight(weight, unit), reps);
      setEditingSet(null);
      return;
    }
    setFlashId(logSet(session.id, current.id, fromDisplayWeight(weight, unit), reps));
  };

  /** START SET and SKIP differ only in what the UI does next. */
  const endRest = () => {
    stopRest(session.id);
  };

  /**
   * Skip this set: record that it was not performed and move straight into
   * rest, exactly as completing it would. Cheaper than deleting a set
   * afterwards, and it keeps the log honest.
   */
  const skipThisSet = () => {
    if (!current) return;
    setEditingSet(null);
    setFlashId(skipSet(session.id, current.id));
  };

  /**
   * Swap the exercise for today only — "no lat pulldown machine free, doing
   * pull-ups instead". The weekly routine is untouched.
   */
  const replaceToday = (exerciseId: string) => {
    if (!current) return;
    const result = replaceSessionExercise(current.id, exerciseId);
    if (!result.ok) {
      Alert.alert(
        'Sets already logged',
        `${current.name} has ${result.performed} performed ${result.performed === 1 ? 'set' : 'sets'} today. Remove them first, or add the other exercise instead so both are recorded.`,
      );
    }
  };

  const nextExercise = () => {
    if (resting) stopRest(session.id);
    if (isLastExercise) {
      finish();
      return;
    }
    setJustCompleted(true);
  };

  const advance = () => {
    setJustCompleted(false);
    setCurrentIndex(session.id, Math.min(index + 1, exercises.length - 1));
  };

  const goBack = () => {
    if (index === 0) return;
    setJustCompleted(false);
    setCurrentIndex(session.id, index - 1);
  };

  const finish = () => {
    completeSession(session.id);
    router.replace(`/workout/summary?id=${session.id}`);
  };

  const discard = () => {
    // One of only two confirmation dialogs in the app, because this is the one
    // genuinely unrecoverable action (DESIGN.md 5.4.5).
    Alert.alert('Discard this workout?', 'Every set logged in this session will be deleted.', [
      { text: 'Keep training', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardSession(session.id);
          router.replace('/');
        },
      },
    ]);
  };

  const removeSet = (set: SetRow) => {
    deleteSet(set.id);
    undo.offer(`Set ${set.set_number} removed`, () => {
      if (current) setFlashId(logSet(session.id, current.id, set.weight_kg, set.reps));
    });
  };

  const menuActions: SheetAction[] = [
    {
      label: 'Replace exercise',
      hint: 'Swaps it for today only — your weekly routine is unchanged',
      onPress: () => setReplacing(true),
    },
    { label: 'Add exercise', hint: 'Appends it to this session', onPress: () => setAddingExercise(true) },
    {
      label: current?.skipped ? 'Unskip exercise' : 'Skip exercise',
      onPress: () => current && setExerciseSkipped(current.id, !current.skipped),
    },
    { label: 'End workout', hint: 'Finish here and save what you logged', onPress: finish },
    { label: 'Discard workout', destructive: true, onPress: discard },
  ];

  // ---------------------------------------------------- exercise completion

  if (justCompleted && current) {
    return (
      <ExerciseComplete
        name={current.name}
        sets={sets}
        unit={unit}
        isLast={isLastExercise}
        onNext={advance}
        onBack={() => setJustCompleted(false)}
        onAddExercise={() => {
          setJustCompleted(false);
          setAddingExercise(true);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase }} edges={['top', 'bottom']}>
      {/* ------------------------------------------------------- header */}
      <View
        style={{
          paddingHorizontal: gutter,
          paddingBottom: space.s,
          borderBottomWidth: 1,
          borderColor: c.hairline,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Minimise workout" onPress={() => router.back()} style={{ marginLeft: -12 }}>
            <Feather name="chevron-down" size={22} color={c.textSecondary} />
          </IconButton>
          <Text variant="titleM" style={{ flex: 1 }} numberOfLines={1}>
            {session.name}
          </Text>
          <WorkoutClock startedAt={session.started_at} />
          <IconButton label="Workout options" onPress={() => setMenuOpen(true)} style={{ marginRight: -12 }}>
            <Feather name="more-horizontal" size={22} color={c.textSecondary} />
          </IconButton>
        </View>

        {/*
          A labelled bar rather than a row of dots. Dots make you count them to
          learn anything; a filled proportion is read at a glance, which is the
          whole point of a progress indicator mid-set.
        */}
        <View style={{ marginTop: space.s }}>
          <Text variant="caption" color="textTertiary">
            {doneCount} of {exercises.length} exercises
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: exercises.length, now: doneCount }}
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: c.lineStrong,
              marginTop: space.s,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${exercises.length ? (doneCount / exercises.length) * 100 : 0}%`,
                height: '100%',
                borderRadius: 2,
                backgroundColor: c.focus,
              }}
            />
          </View>
        </View>
      </View>

      {/* --------------------------------------------------------- body */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {!current ? (
          <View style={{ paddingVertical: space.xxl }}>
            <Text variant="titleM">No exercises in this workout</Text>
            <Text variant="body" color="textSecondary" style={{ marginTop: space.s }}>
              Add one to start logging.
            </Text>
            <View style={{ marginTop: space.xl }}>
              <Button
                label="+ Add Exercise"
                variant="secondary"
                onPress={() => setAddingExercise(true)}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={{ paddingTop: space.l }}>
              <Text variant="titleL">{current.name}</Text>
              <Text variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
                {current.equipment}
                {current.skipped ? ' · skipped' : ''}
              </Text>
            </View>

            <View style={{ marginTop: space.l }}>
              {previous ? (
                <PreviousLine
                  sets={previous.sets}
                  unit={unit}
                  when={formatShortDate(previous.startedAt)}
                />
              ) : (
                <Text variant="caption" color="textTertiary" style={{ marginBottom: space.l }}>
                  First time logging this exercise.
                </Text>
              )}
            </View>

            <Divider />

            <View style={{ marginTop: space.m }}>
              <SetTable
                sets={sets}
                unit={unit}
                flashId={flashId}
                onEdit={beginEdit}
                onRemove={removeSet}
              />
            </View>

            <UndoStrip pending={undo.pending} onDismiss={undo.dismiss} />

            {/* -------------------------------------------- active row */}
            <View style={{ marginTop: space.l }}>
              <Text variant="label" color="textSecondary">
                {editingSet ? `Editing set ${editingSet.set_number}` : `Set ${sets.length + 1}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.m, marginTop: space.s }}>
                <NumberWell
                  value={weight}
                  step={current.weight_step}
                  decimals={2}
                  unit={unit}
                  onChange={setWeight}
                  onPressValue={() => setKeypad({ field: 'weight' })}
                  accessibilityLabel="Weight"
                />
                <NumberWell
                  value={reps}
                  step={1}
                  min={1}
                  max={200}
                  decimals={0}
                  unit="reps"
                  onChange={(n) => setReps(Math.round(n))}
                  onPressValue={() => setKeypad({ field: 'reps' })}
                  accessibilityLabel="Reps"
                />
              </View>

              {/*
                Real bordered controls, not tinted captions. On the last
                exercise the forward control says what it actually does —
                labelling it "Next exercise" when it ends the session was a
                trap. "+ Add exercise" is surfaced here rather than buried in
                the ⋯ menu, because deciding to add calf raises happens at
                exactly this moment.
              */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginTop: space.l,
                  gap: space.s,
                }}
              >
                {editingSet ? (
                  <ControlChip label="Cancel edit" onPress={() => setEditingSet(null)} />
                ) : (
                  <>
                    {index > 0 ? (
                      <ControlChip label="Previous" icon="chevron-left" onPress={goBack} />
                    ) : null}
                    <ControlChip label="Skip set" onPress={skipThisSet} />
                    <ControlChip
                      label="Add exercise"
                      icon="plus"
                      onPress={() => setAddingExercise(true)}
                    />
                    {sets.length > 0 ? (
                      <ControlChip
                        label={isLastExercise ? 'Finish workout' : 'Next exercise'}
                        icon={isLastExercise ? 'flag' : 'chevron-right'}
                        iconSide="right"
                        tone="accent"
                        onPress={nextExercise}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </View>

            {/* ------------------------------------------- rest panel */}
            {resting && rest ? (
              <View style={{ marginTop: space.xl }}>
                <RestPanel
                  state={rest}
                  onPause={() => pauseRest(session.id)}
                  onResume={() => resumeRest(session.id)}
                  onReset={() => resetRest(session.id)}
                  onSkip={endRest}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* ------------------------------------------- primary action bar */}
      {current ? (
        <View style={{ paddingHorizontal: gutter, paddingTop: space.s }}>
          {resting && !editingSet ? (
            <Button
              label={`Start Set ${sets.length + 1}`}
              onPress={endRest}
              height={WORKOUT_ACTION_HEIGHT}
              shout
            />
          ) : (
            <Button
              label={editingSet ? 'Save Set' : 'Complete Set'}
              onPress={completeSet}
              height={WORKOUT_ACTION_HEIGHT}
              shout
            />
          )}
        </View>
      ) : null}

      <NumericKeypad
        visible={keypad !== null}
        title={keypad?.field === 'reps' ? 'Reps' : 'Weight'}
        unit={keypad?.field === 'reps' ? 'reps' : unit}
        initial={keypad?.field === 'reps' ? reps : weight}
        allowDecimal={keypad?.field !== 'reps'}
        onCancel={() => setKeypad(null)}
        onDone={(value) => {
          if (keypad?.field === 'reps') setReps(Math.max(1, Math.round(value)));
          else setWeight(Math.max(0, value));
          setKeypad(null);
        }}
      />

      <ExercisePicker
        visible={addingExercise}
        title="Add to this workout"
        onClose={() => setAddingExercise(false)}
        onAdd={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
      />

      <ActionSheet
        visible={menuOpen}
        title={current?.name ?? 'Workout'}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

      <ExercisePicker
        visible={replacing}
        title={`Replace ${current?.name ?? 'exercise'}`}
        onClose={() => setReplacing(false)}
        onAdd={(exerciseId) => {
          replaceToday(exerciseId);
          setReplacing(false);
        }}
      />
    </SafeAreaView>
  );

  function beginEdit(set: SetRow) {
    setEditingSet(set);
    setWeight(Number(toDisplayWeight(set.weight_kg, unit).toFixed(2)));
    setReps(set.reps);
  }
}

/**
 * Exercise completion — DESIGN.md 5.4.4.
 * A confirmation glance, not a checkpoint: it auto-advances after four
 * seconds, and offers a way back because a user often wants one more set.
 */
function ExerciseComplete({
  name,
  sets,
  unit,
  isLast,
  onNext,
  onBack,
  onAddExercise,
}: {
  name: string;
  sets: SetRow[];
  unit: ReturnType<typeof useSettings.getState>['unit'];
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onAddExercise: () => void;
}) {
  const { c } = useTheme();
  const gutter = useGutter();

  // Auto-advance after four seconds: the summary is a confirmation glance, not
  // a checkpoint. Held in a ref so a parent re-render does not restart the
  // countdown and strand the user on this screen.
  const nextRef = useRef(onNext);
  nextRef.current = onNext;
  useEffect(() => {
    // Never auto-advance off the last exercise: there, "next" ends the
    // workout, and ending a session on a four-second timer is not a
    // confirmation glance — it is a decision made for the user.
    if (isLast) return;
    const id = setTimeout(() => nextRef.current(), 4000);
    return () => clearTimeout(id);
  }, [isLast]);

  const rests = sets.map((s) => s.rest_before_s).filter((r): r is number => r != null);
  const avgRest = rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null;
  const top = sets.reduce<SetRow | null>(
    (best, s) => (!best || s.weight_kg > best.weight_kg ? s : best),
    null,
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bgBase, paddingHorizontal: gutter }}
      edges={['top', 'bottom']}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="check" size={22} color="positive" />
          <Text variant="titleL" color="positive" style={{ marginLeft: space.s }}>
            {name} completed
          </Text>
        </View>
        <View style={{ marginTop: space.l }}>
          <Text variant="num" color="textSecondary">
            {sets.length} {sets.length === 1 ? 'set' : 'sets'} ·{' '}
            {sets.map((s) => s.reps).join(', ')} reps
          </Text>
          {top ? (
            <Text variant="num" color="textSecondary" style={{ marginTop: space.xs }}>
              Top set {formatWeight(top.weight_kg, unit)} × {top.reps}
            </Text>
          ) : null}
          {avgRest != null ? (
            <Text variant="num" color="textSecondary" style={{ marginTop: space.xs }}>
              Average rest {formatDuration(avgRest)}
            </Text>
          ) : null}
        </View>
      </View>

      {/*
        On the last exercise this screen is the final fork, so both ways out
        are offered: add something else, or finish. Anywhere else it is just a
        confirmation glance that auto-advances.
      */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: space.s,
          marginBottom: space.m,
        }}
      >
        <ControlChip label={`Back to ${name}`} icon="chevron-left" onPress={onBack} />
        <ControlChip label="Add exercise" icon="plus" onPress={onAddExercise} tone="accent" />
      </View>

      <Button
        label={isLast ? 'Finish Workout' : 'Next Exercise'}
        onPress={onNext}
        height={WORKOUT_ACTION_HEIGHT}
        shout
      />
      <View style={{ height: space.l }} />
    </SafeAreaView>
  );
}
