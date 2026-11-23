import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { useTheme } from './theme';
import { space, TAB_BAR } from './tokens';
import { ResumeBar } from '@/features/workout/ResumeBar';
import { UpdateBar } from '@/features/updates/UpdateBar';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  index: 'home',
  plan: 'calendar',
  log: 'book-open',
  you: 'user',
};

const LABELS: Record<string, string> = {
  index: 'Today',
  plan: 'Plan',
  log: 'Log',
  you: 'You',
};

/**
 * Tab bar — DESIGN.md 4. Four labelled tabs, fixed to the bottom edge and
 * outside the scroll area, so it never covers a screen's last row (the old
 * floating pill did, and every screen had to pad around it).
 *
 * Labels are always shown: an icon alone made people guess between a clock
 * and a trend line. The selected tab is ink with a 2 dp ink line on top; the
 * others are tertiary. The resume and update strips dock directly above.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: c.bgBase }}>
      <UpdateBar />
      <ResumeBar />
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          minHeight: TAB_BAR.height,
          paddingBottom: Math.max(insets.bottom, space.s),
          paddingHorizontal: space.s,
          borderTopWidth: 1,
          borderColor: c.hairline,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = LABELS[route.name] ?? route.name;
          const tint = focused ? c.textPrimary : c.textTertiary;
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
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: space.s,
                opacity: pressed && !focused ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -1,
                  width: 24,
                  height: 2,
                  backgroundColor: focused ? c.textPrimary : 'transparent',
                }}
              />
              <Feather name={ICONS[route.name] ?? 'circle'} size={21} color={tint} />
              <Text
                variant="label"
                color={focused ? 'textPrimary' : 'textTertiary'}
                style={{ marginTop: 3 }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
