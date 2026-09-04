import React from 'react';
import { Tabs } from 'expo-router';
import { PillNav } from '@/ui/PillNav';

/**
 * Four tabs in a fixed order, rendered as a floating pill (DESIGN.md 4).
 * The bar is detached from the screen edge, so every screen leaves
 * NAV.clearance of space at the bottom for content to scroll under it.
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
