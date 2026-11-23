import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Android's navigation bar stays hidden while Forte is open; a swipe up from
 * the bottom edge shows it briefly over the app.
 *
 * Sheets used to be React Native <Modal>s, separate dialog windows that drew
 * nothing (or a collapsed sliver) when opened over a hidden bar, so the bar
 * was revealed around every sheet. Sheets are now ordinary views inside the
 * app's window (SystemModal / ModalHost), so the bar never needs to change
 * for them.
 */

const isAndroid = Platform.OS === 'android';

/** Hide the bar; a swipe up from the bottom edge shows it briefly over the app. */
export function hideNavigationBar(): void {
  if (!isAndroid) return;
  void NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
  void NavigationBar.setVisibilityAsync('hidden').catch(() => {});
}
