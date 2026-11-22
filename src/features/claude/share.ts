import { Alert, Share } from 'react-native';
import type { BriefOptions } from '@/features/analysis';
import { getBodyContext } from '@/db/queries/profile';
import { exportJson } from '@/lib/export';
import { useSettings } from '@/store/settings';

/**
 * "Ask Claude" — the no-API route (docs/AI_TRAINER_PLAN.md §2.6, §3.7).
 *
 * Forte never contacts Claude. It writes a brief and opens Android's share
 * sheet; the person picks the Claude app, and the subscription they already
 * have answers it. The other route is the PC companion, which gets backups
 * over Wi-Fi once paired (src/features/sync), or by hand from a folder such as
 * Google Drive (sendBackupForCompanion).
 *
 * Bump CONSENT_VERSION whenever what a brief can contain changes, so the
 * explanation is shown again.
 */
export const CONSENT_VERSION = 1;

/** The brief options for the person's current sharing settings. */
export function currentBriefOptions(): BriefOptions {
  const s = useSettings.getState();
  return {
    unit: s.unit,
    includeNotes: s.claudeIncludeNotes,
    body: s.claudeIncludeBody ? getBodyContext() : null,
  };
}

/** Plain-language list of what a training brief contains with the current settings. */
export function describeTrainingShare(): string {
  const s = useSettings.getState();
  const parts = ['workout names and dates', 'exercises, sets, weights, reps and rest times', 'durations and effort ratings'];
  if (s.claudeIncludeNotes) parts.push('your session notes');
  if (s.claudeIncludeBody) parts.push('your age, height and bodyweight trend');
  return parts.join(', ');
}

function confirm(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, onPress: () => resolve(true) },
    ]);
  });
}

async function share(text: string): Promise<void> {
  try {
    await Share.share({ message: text, title: 'Forte' });
  } catch (error) {
    Alert.alert('Could not open the share menu', error instanceof Error ? error.message : String(error));
  }
}

/** Training brief → share sheet. Explains what is shared the first time. */
export async function shareTrainingBrief(text: string): Promise<void> {
  if (!text) {
    Alert.alert('Nothing to share yet', 'Finish a workout first.');
    return;
  }
  const settings = useSettings.getState();
  if (settings.claudeConsent < CONSENT_VERSION) {
    const ok = await confirm(
      'Ask AI',
      `Forte will open the share menu with a text summary: ${describeTrainingShare()}.\n\nPick the AI app to send it to (Claude, ChatGPT, Gemini). Forte itself sends nothing. What the app keeps depends on its own privacy settings.\n\nChange what's included in Settings → AI analysis.`,
      'Continue',
    );
    if (!ok) return;
    settings.set('claudeConsent', CONSENT_VERSION);
  }
  await share(text);
}

/** Health brief → share sheet. Always confirmed: blood results are never shared without a fresh yes. */
export async function shareHealthBrief(text: string, markerCount: number): Promise<void> {
  if (!text) return;
  const ok = await confirm(
    'Share blood results with an AI app?',
    `This shares ${markerCount} ${markerCount === 1 ? 'marker' : 'markers'} with their dates, values and the lab's ranges, plus a short training summary. Report files and the lab's name are not included.\n\nThe reply is not medical advice.`,
    'Share',
  );
  if (ok) await share(text);
}

/** Backup → share sheet, to save into the Google Drive folder the PC companion reads. */
export async function sendBackupForCompanion(): Promise<void> {
  try {
    await exportJson();
  } catch (error) {
    Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
  }
}
