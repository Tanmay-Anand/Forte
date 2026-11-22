import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/ui/TabBar';

/**
 * Four labelled tabs in a fixed order (DESIGN.md 4): Today, Plan, Log, You.
 * The bar sits below the screens rather than floating over them, so no screen
 * needs to pad its content to clear it.
 */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="log" options={{ title: 'Log' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
