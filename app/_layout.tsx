import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from '@expo-google-fonts/urbanist';
import { checkpoint, initDatabase } from '@/db/client';
import { seedAll } from '@/db/seed';
import { useSettings } from '@/store/settings';
import { ThemeProvider, useTheme } from '@/ui/theme';
import { palette } from '@/ui/tokens';

// Hold the native splash — the Forte wordmark on the dark ground — until the
// database has migrated and Urbanist has loaded, so the first painted frame is
// the finished UI rather than a flash of unstyled text.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const loadSettings = useSettings((s) => s.load);

  const [fontsReady] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
  });

  useEffect(() => {
    // Synchronous and sub-millisecond, so there is no loading screen to design.
    initDatabase();
    seedAll();
    loadSettings();
    setReady(true);
  }, [loadSettings]);

  // WAL housekeeping so the sidecar file does not creep over months of use
  // (IMPLEMENTATION_PLAN.md section 6).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') checkpoint();
    });
    return () => sub.remove();
  }, []);

  const booted = ready && fontsReady;

  useEffect(() => {
    if (booted) void SplashScreen.hideAsync();
  }, [booted]);

  // The native splash is still on screen at this point, so this view is only
  // ever a colour-matched backstop during the handover.
  if (!booted) return <View style={{ flex: 1, backgroundColor: palette.dark.bgBase }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.dark.bgBase }}>
      <SafeAreaProvider>
        <ThemeProvider fontsReady={fontsReady}>
          <Chrome />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Chrome() {
  const { c, name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bgBase },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/*
          Active Workout sits ABOVE the tab stack as a full-screen modal route.
          This is the single most important navigational decision in the app:
          there is no tab bar to wander into mid-set (DESIGN.md 4).
        */}
        <Stack.Screen
          name="workout/active"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="workout/summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="day/[day]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="session/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
