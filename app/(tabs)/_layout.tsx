import React from 'react';
import { Tabs } from 'expo-router';
import { PillNav } from '@/ui/PillNav';

/**
 * Four tabs in a fixed order, rendered as a floating pill (DESIGN.md 4).
 * The bar is detached from the screen edge, so every screen pads its content
 * by the measured overlay height (src/ui/nav-overlay.ts) to scroll clear of it.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillNav {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="week" options={{ title: 'Week' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
    </Tabs>
  );
}
