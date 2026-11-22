import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import { TabularDigits } from '@/ui/TabularDigits';
import { formatDuration, spokenDuration } from '@/lib/time';
import { restElapsedSeconds, type RestState } from './rest-timer';

/**
 * The ticking digits, isolated.
 *
 * This component is the ONLY thing that re-renders each second during rest.
 * Keeping it separate from the set table and header is what holds the app to
 * the section 6.5 budget of one re-rendering component per tick, and it is
 * why an hour-long workout costs well under 0.5% of battery in JS work.
 *
 * The interval is a rendering concern only: the value always comes from
 * restElapsedSeconds() against stored timestamps, so a missed tick, a sleeping
 * screen, or a backgrounded app changes nothing.
 */
export function RestClock({
  state,
  variant = 'displayM',
}: {
  state: RestState;
  variant?: 'displayM' | 'num';
}) {
  const [, force] = useState(0);
  const running = state.startedAt !== null && state.pausedAt === null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = restElapsedSeconds(state, Date.now());
  const paused = state.pausedAt !== null;

  // Geist Mono digits, so the clock does not shuffle sideways every second. The live region stays off — announcing every tick
  // would drown a screen reader.
  return (
    <TabularDigits
      text={formatDuration(elapsed)}
      accessibilityLabel={`Rest ${spokenDuration(elapsed)}${paused ? ', paused' : ''}`}
      variant={variant}
      color="textPrimary"
      style={{ opacity: paused ? 0.6 : 1 }}
      accessibilityLiveRegion="none"
    />
  );
}

/**
 * Rest state — DESIGN.md 5.4.2. A strip under the workout header.
 *
 * Full width, on the pale rest-blue ground, so it reads as a state the whole
 * screen is in rather than one more card. The clock is the thing being
 * watched, so it is the only large element; the controls are words. Rest
 * only ever appears like this, a strip with a running clock, never as a dot
 * (tokens.ts: the rest blue sits close to the logo blue).
 *
 * Counts upward: there is no target rest time, so a countdown would invent an
 * instruction the product does not want to give.
 */
export function RestPanel({
  state,
  onPause,
  onResume,
  onReset,
  onSkip,
  gutter = space.l,
}: {
  state: RestState;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
  /** Horizontal padding, so the strip runs edge to edge and its content lines up with the screen. */
  gutter?: number;
}) {
  const { c } = useTheme();
  const paused = state.pausedAt !== null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: space.l,
        backgroundColor: c.restSoft,
        paddingHorizontal: gutter,
        paddingVertical: space.s,
        borderBottomWidth: 1,
        borderColor: c.hairline,
      }}
      accessibilityLabel={paused ? 'Rest timer, paused' : 'Rest timer, running'}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', columnGap: space.m, flex: 1 }}>
        <Text variant='label' color='rest'>
          {paused ? 'Rest · paused' : 'Rest'}
        </Text>
        <RestClock state={state} />
      </View>
      <View style={{ flexDirection: 'row', columnGap: space.l }}>
        <TimerControl label={paused ? 'Resume' : 'Pause'} spoken={paused ? 'Resume rest timer' : 'Pause rest timer'} onPress={paused ? onResume : onPause} />
        <TimerControl label='Reset' spoken='Reset rest timer' onPress={onReset} />
        <TimerControl label='Skip' spoken='Skip rest' onPress={onSkip} />
      </View>
    </View>
  );
}

function TimerControl({ label, spoken, onPress }: { label: string; spoken: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={spoken}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Text variant='bodyStrong' color='rest'>
        {label}
      </Text>
    </Pressable>
  );
}

/** Elapsed workout clock in the header. Also isolated, also once per second. */
export function WorkoutClock({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = (Date.now() - startedAt) / 1000;
  return (
    <TabularDigits
      text={formatDuration(elapsed)}
      accessibilityLabel={`Workout time ${spokenDuration(elapsed)}`}
      variant="num"
      color="textSecondary"
      accessibilityLiveRegion="none"
    />
  );
}
