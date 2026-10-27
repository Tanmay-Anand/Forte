import React, { useEffect, useRef } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from './theme';
import { NAV, radius, space } from './tokens';
import { ResumeBar } from '@/features/workout/ResumeBar';
import { UpdateBar } from '@/features/updates/UpdateBar';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  week: 'calendar',
  progress: 'trending-up',
  history: 'clock',
};

const LABELS: Record<string, string> = {
  index: 'Today',
  week: 'Week',
  progress: 'Progress',
  history: 'History',
};

const GAP = 2;
/** Distance between adjacent button centres. */
const SLOT = NAV.button + GAP * 2;
const PAD = 6;

/**
 * Floating pill navigation — DESIGN.md 4.
 *
 * A detached capsule of circular buttons. The active tab is a filled light
 * disc that SLIDES between positions rather than cutting: the movement is the
 * only thing on screen that says "you went that way", so it carries the
 * spatial relationship between tabs.
 *
 * Icon-only costs a beat of recognition, so every button carries an
 * accessibility label and the set is fixed at four in a stable order — the
 * positions themselves become the affordance.
 */
export function PillNav({ state, navigation }: BottomTabBarProps) {
  const { c, reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();

  // Continuous position of the disc, in slot units. Interpolating from this
  // single value keeps the disc and the icon crossfades perfectly in step.
  const pos = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    if (reducedMotion) {
      pos.setValue(state.index);
      return;
    }
    Animated.spring(pos, {
      toValue: state.index,
      useNativeDriver: true,
      // Just shy of critically damped: it arrives quickly and settles without
      // a bounce, which would read as playful rather than precise.
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [state.index, pos, reducedMotion]);

  const slots = state.routes.map((_, i) => i);

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        paddingBottom: Math.max(insets.bottom, space.m),
      }}
      pointerEvents="box-none"
    >
      <View style={{ width: '100%', paddingHorizontal: space.l }} pointerEvents="box-none">
        <UpdateBar />
        <ResumeBar />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: NAV.height,
          paddingHorizontal: PAD,
          borderRadius: radius.pill,
          backgroundColor: c.bgElevated,
          borderWidth: 1,
          borderColor: c.hairline,
        }}
      >
        {/* The travelling disc, behind the icons. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PAD + GAP,
            top: (NAV.height - NAV.button) / 2 - 1,
            width: NAV.button,
            height: NAV.button,
            borderRadius: radius.pill,
            backgroundColor: c.accent,
            transform: [
              {
                translateX: pos.interpolate({
                  inputRange: slots,
                  outputRange: slots.map((i) => i * SLOT),
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        />

        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? 'circle';
          const label = LABELS[route.name] ?? route.name;

          // Two stacked icons crossfaded by proximity to the disc. Opacity is
          // native-driver friendly where an animated colour would not be, and
          // it means the dark icon is never dark-on-dark mid-flight.
          const inkOpacity = pos.interpolate({
            inputRange: [index - 1, index - 0.4, index, index + 0.4, index + 1],
            outputRange: [0, 0, 1, 0, 0],
            extrapolate: 'clamp',
          });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => ({
                width: NAV.button,
                height: NAV.button,
                marginHorizontal: GAP,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed && !focused ? 0.55 : 1,
              })}
            >
              <Animated.View style={{ position: 'absolute', opacity: Animated.subtract(1, inkOpacity) }}>
                <Feather name={icon} size={21} color={c.textSecondary} />
              </Animated.View>
              <Animated.View style={{ opacity: inkOpacity }}>
                <Feather name={icon} size={21} color={c.accentInk} />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
