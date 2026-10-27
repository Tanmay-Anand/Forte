import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Android's navigation bar: hidden while Forte is open, shown while a modal
 * sheet is open.
 *
 * Why the modal exception exists: a React Native <Modal> is a separate Android
 * dialog window. Opening one while the activity window has its navigation bar
 * hidden left the dialog's content undrawn — an invisible window that still
 * swallowed every tap until Back was pressed — so the keypad and every action
 * sheet were unusable. Observed on an Android 16 emulator with RN 0.76 (new
 * architecture). Showing the bar first, and letting it settle, fixes it; a
 * dialog shows the bar anyway, so nothing visible is lost. SystemModal does
 * this for every sheet; nothing else should open a <Modal> directly.
 */

const isAndroid = Platform.OS === 'android';

/** Time for the bar's inset change to land before a dialog window is created. */
export const BAR_SETTLE_MS = 150;

let openModals = 0;

/** Hide the bar; a swipe up from the bottom edge shows it briefly over the app. */
export function hideNavigationBar(): void {
  if (!isAndroid || openModals > 0) return;
  void NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
  void NavigationBar.setVisibilityAsync('hidden').catch(() => {});
}

/** A modal is about to open: show the bar. Resolves once it has been asked to show. */
export async function revealNavigationBarForModal(): Promise<void> {
  openModals += 1;
  if (!isAndroid) return;
  await NavigationBar.setVisibilityAsync('visible').catch(() => {});
}

/** A modal closed: hide the bar again once no modal is open. */
export function releaseNavigationBarForModal(): void {
  openModals = Math.max(0, openModals - 1);
  hideNavigationBar();
}
