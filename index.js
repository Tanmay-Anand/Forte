// Custom entry point (https://docs.expo.dev/router/installation/#custom-entry-point).
//
// The lock-screen workout notification's buttons must work when the app is in
// the background or Android has killed it. Notifee delivers those presses to a
// headless task, and that handler has to be registered before the app itself.
import { registerBackgroundHandler } from './src/features/workout/workout-notification';

registerBackgroundHandler();

require('expo-router/entry');
