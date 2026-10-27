import React, { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
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
import { useRevision } from '@/lib/db-hooks';
import {
  subscribeForegroundEvents,
  syncWorkoutNotification,
} from '@/features/workout/workout-notification';
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

/**
 * Hides Android's navigation bar (the gesture pill or the 3-button bar) while
 * Forte is open, for an edge-to-edge screen at the bench. A swipe up from the
 * bottom edge shows it temporarily over the app ('overlay-swipe'), so system
 * back/home stay one gesture away and the layout never jumps.
 *
 * app.json sets the same state at launch so there is no flash of the bar;
 * this re-applies it on every return to the foreground, because some OEM
 * skins (MIUI/HyperOS among them) restore the bar after a trip to another app.
 */
function useImmersiveNavigationBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hide = () => {
      void NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      void NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    };
    hide();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hide();
    });
    return () => sub.remove();
  }, []);
}

/**
 * Keeps the lock-screen workout notification in step with the database.
 * Mounted at the root rather than in Active Workout so it keeps working after
 * the workout is minimised. Every write bumps the revision, so one effect
 * covers logging, rest, skipping, finishing and discarding alike.
 */
function useWorkoutNotification() {
  const rev = useRevision((s) => s.rev);
  const enabled = useSettings((s) => s.lockScreenControls);
  const unit = useSettings((s) => s.unit);

  useEffect(() => {
    void syncWorkoutNotification();
  }, [rev, enabled, unit]);

  useEffect(() => subscribeForegroundEvents(), []);
}

function Chrome() {
  const { c, name } = useTheme();
  useImmersiveNavigationBar();
  useWorkoutNotification();
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
