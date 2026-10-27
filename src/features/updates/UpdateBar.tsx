import React, { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import * as Updates from 'expo-updates';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { getActiveSession } from '@/db/queries/session';

/** How often a return to the foreground may trigger another update check. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let lastCheckAt = Date.now(); // the native ON_LOAD check has just run

/**
 * Over-the-air updates (`npm run update`) download in the background, but by
 * default only apply on the second cold start, and Android rarely cold-starts
 * an app that is used daily. This bar says a downloaded update is ready and
 * applies it with one tap.
 *
 * Also checks when the app returns to the foreground (at most every 30 min),
 * because the native check only runs on a cold start. All of it is
 * best-effort: offline, the check fails silently and nothing is shown.
 */
export function UpdateBar() {
  const { c } = useTheme();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  // Never offer a restart mid-workout. The session would survive it (it lives
  // in SQLite), but it is not a decision to put in front of someone between sets.
  const session = useQuery(() => getActiveSession(), []);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;
      lastCheckAt = Date.now();
      void checkAndDownload();
    });
    return () => sub.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending || dismissed || session) return null;

  return (
    <View
      style={{
        height: 46,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: space.l,
        marginBottom: space.s,
        borderRadius: radius.pill,
        backgroundColor: c.bgElevated,
        borderWidth: 1,
        borderColor: c.hairline,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: c.positive,
          marginRight: space.s,
        }}
      />
      <Text variant="caption" color="textPrimary" numberOfLines={1} style={{ flex: 1 }}>
        Update ready
      </Text>
      <Pressable
        onPress={() => void Updates.reloadAsync().catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="Restart Forte to apply the update"
        hitSlop={6}
        style={({ pressed }) => ({
          height: 32,
          paddingHorizontal: space.m,
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: pressed ? c.bgSunken : c.accent,
        })}
      >
        <Text variant="caption" style={{ color: c.accentInk }}>
          Restart
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss. The update applies next time Forte starts"
        hitSlop={6}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Feather name="x" size={16} color={c.textTertiary} />
      </Pressable>
    </View>
  );
}

async function checkAndDownload(): Promise<void> {
  try {
    const result = await Updates.checkForUpdateAsync();
    // Downloading flips useUpdates().isUpdatePending, which shows the bar.
    if (result.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // No signal in the gym, or the update server is down: try again later.
  }
}
