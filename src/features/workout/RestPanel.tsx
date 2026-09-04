import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/Icon';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { formatDuration } from '@/lib/time';
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
  variant?: 'displayXl' | 'displayM' | 'num';
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

  return (
    <Text
      variant={variant}
      color="textPrimary"
      style={{ opacity: paused ? 0.6 : 1 }}
      accessibilityLiveRegion="none"
    >
      {formatDuration(elapsed)}
    </Text>
  );
}

/**
 * Rest state — DESIGN.md 5.4.2.
 *
 * A compact bar, not a panel. The timer's job is to inform, not to take over
 * the screen: at full display size it pushed the set table and the primary
 * action out of view, so the thing you were resting *from* disappeared while
 * you rested. The digits stay large enough to read at arm's length; the
 * controls shrink to icons.
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
}: {
  state: RestState;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSkip: () => void;
}) {
  const { c } = useTheme();
  const paused = state.pausedAt !== null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgRaised,
        borderRadius: radius.card,
        borderLeftWidth: 3,
        borderLeftColor: c.rest,
        paddingLeft: space.l,
        paddingRight: space.s,
        paddingVertical: space.m,
      }}
      accessibilityLabel={paused ? 'Rest timer, paused' : 'Rest timer, running'}
    >
      <View style={{ flex: 1 }}>
        <Text variant="label" color="rest">
          {paused ? 'Rest · Paused' : 'Rest'}
        </Text>
        <View style={{ marginTop: 2 }}>
          <RestClock state={state} />
        </View>
      </View>

      <TimerControl
        icon={paused ? 'play' : 'pause'}
        label={paused ? 'Resume rest timer' : 'Pause rest timer'}
        onPress={paused ? onResume : onPause}
      />
      <TimerControl icon="rotate-ccw" label="Reset rest timer" onPress={onReset} />
      <TimerControl icon="skip-forward" label="Skip rest" onPress={onSkip} />
    </View>
  );
}

function TimerControl({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        marginLeft: space.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.bgElevated : c.bgSunken,
      })}
    >
      <Icon name={icon} size={17} color="textSecondary" />
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
  return (
    <Text variant="num" color="textSecondary">
      {formatDuration((Date.now() - startedAt) / 1000)}
    </Text>
  );
}
