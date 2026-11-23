import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Screen, Segmented, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import { SessionsView } from '@/features/log/SessionsView';
import { LiftsView } from '@/features/log/LiftsView';
import { InsightsView } from '@/features/insights/InsightsView';

type View = 'sessions' | 'lifts' | 'muscles';

const VIEWS: { value: View; label: string }[] = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'lifts', label: 'Lifts' },
  { value: 'muscles', label: 'Muscles' },
];

/**
 * Log — everything you have done, in one place. Progress and History used to
 * be separate tabs with an icon each, and people had to guess which held what;
 * here they are three views of one record: Sessions (by date), Lifts (by
 * exercise) and Muscles (by body part, with the weekly comparison and what
 * Forte noticed). `?view=` opens a particular one, for links from elsewhere.
 */
export default function LogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const requested = VIEWS.some((v) => v.value === params.view) ? (params.view as View) : null;
  const [view, setView] = useState<View>(requested ?? 'sessions');

  useEffect(() => {
    if (requested) setView(requested);
  }, [requested]);

  return (
    <Screen>
      <Spacer h={space.l} />
      <Text variant="displayM">Log</Text>
      <Spacer h={space.m} />
      <Segmented options={VIEWS} value={view} onChange={setView} />
      <Spacer h={space.l} />
      {view === 'sessions' ? <SessionsView /> : null}
      {view === 'lifts' ? <LiftsView /> : null}
      {view === 'muscles' ? <InsightsView onOpenExercise={(id) => router.push(`/lift/${id}`)} /> : null}
    </Screen>
  );
}
