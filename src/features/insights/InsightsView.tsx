import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Card, ControlChip, EmptyState, SectionLabel, Spacer, StatGrid } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { loadHistory } from '@/db/queries/analysis';
import { getProfile } from '@/db/queries/profile';
import {
  insights,
  muscleBalance,
  muscleWeeks,
  periodBrief,
  shadeLevels,
  weeklyVolume,
  type Finding,
  type History,
  type Muscle,
} from '@/features/analysis';
import { BodyFigures } from '@/features/body/BodyFigures';
import { currentBriefOptions, shareTrainingBrief } from '@/features/claude/share';
import { formatVolume, trimNumber } from '@/lib/format';
import { relativeDays } from '@/lib/time';
import { useSettings } from '@/store/settings';

/**
 * Progress → Insights. Specific observations from the log — no motivation,
 * no scores. Every card names its numbers and its period, comes from a fixed
 * rule in src/features/analysis/findings.ts, and disappears when it stops
 * being true. At most five, so it never becomes a dashboard.
 */
export function InsightsView({ onOpenExercise }: { onOpenExercise: (exerciseId: string) => void }) {
  const router = useRouter();
  const unit = useSettings((s) => s.unit);
  const history = useQuery(() => loadHistory(), []);
  const now = Date.now();
  const cards = insights(history, now, unit);
  const weekly = weeklyVolume(history, now);

  const ask = () => void shareTrainingBrief(periodBrief(loadHistory(), Date.now(), currentBriefOptions()));

  return (
    <View>
      <StatGrid
        items={[
          {
            label: 'Last 7 days',
            value: formatVolume(weekly.thisWeek.volume, unit),
          },
          {
            label: '4-week average',
            value: weekly.average != null ? formatVolume(weekly.average, unit) : '—',
          },
        ]}
      />
      <Text variant="caption" color="textTertiary" style={{ marginTop: -space.s }}>
        {weekly.thisWeek.sessions} {weekly.thisWeek.sessions === 1 ? 'session' : 'sessions'} in the last
        seven days
        {weekly.change != null
          ? ` · ${Math.abs(Math.round(weekly.change * 100))}% ${weekly.change >= 0 ? 'above' : 'below'} average`
          : weekly.average == null
            ? ' · an average needs three weeks of training'
            : ''}
      </Text>

      <Spacer h={space.xl} />
      <MuscleMap history={history} />

      <BalanceBars history={history} now={now} />

      <Spacer h={space.xl} />
      <SectionLabel right="From your log">Noticed</SectionLabel>
      {cards.length === 0 ? (
        <EmptyState
          title=""
          body="Nothing stands out yet. Observations appear once an exercise has been logged at least three times."
        />
      ) : (
        cards.map((f) => <InsightCard key={f.id} finding={f} onOpenExercise={onOpenExercise} />)
      )}

      <Spacer h={space.l} />
      <SectionLabel>Ask AI</SectionLabel>
      <Text variant="caption" color="textTertiary" style={{ marginBottom: space.m, maxWidth: 460 }}>
        Shares a summary of the last eight weeks to an AI app on this phone (Claude, ChatGPT, Gemini), or review it on your
        PC with Forte Companion.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <ControlChip label="Ask about the last 8 weeks" icon="share" onPress={ask} />
        <ControlChip
          label="What's shared"
          icon="eye"
          onPress={() => router.push('/claude/brief?kind=period')}
        />
      </View>
    </View>
  );
}

const MAP_WEEKS = 4;

/**
 * Which muscles got the work over four weeks, on the body. Tap a muscle for
 * its sets and exercises. Muscles come from exercise names (muscles.ts).
 */
function MuscleMap({ history }: { history: History }) {
  const sex = useQuery(() => getProfile().sex, []);
  const [selected, setSelected] = useState<Muscle | null>(null);
  // Recomputed only when the log changes; the figure redraws only then too.
  const map = useMemo(() => {
    const rows = muscleWeeks(history, Date.now(), MAP_WEEKS).muscles.map((m) => ({
      ...m,
      total: m.weekly.reduce((a, b) => a + b, 0),
    }));
    const levels = shadeLevels(Object.fromEntries(rows.map((r) => [r.id, r.total])) as Record<Muscle, number>);
    const ranked = [...rows].sort((a, b) => b.total - a.total);
    return { rows, levels, ranked };
  }, [history]);

  if (!map.ranked[0] || map.ranked[0].total <= 0) return null;
  const sel = selected ? map.rows.find((r) => r.id === selected) : undefined;
  const names = (list: typeof map.rows) => list.map((r) => r.label).join(', ');
  const most = map.ranked.filter((r) => r.total > 0).slice(0, 3);
  // Fewest sets first; among equals, never trained, then longest ago.
  const least = [...map.rows]
    .sort((a, b) => a.total - b.total || (a.lastAt ?? -1) - (b.lastAt ?? -1))
    .slice(0, 3);

  return (
    <View style={{ marginBottom: space.xl }}>
      <SectionLabel right={`Sets · last ${MAP_WEEKS} weeks`}>Muscles</SectionLabel>
      <BodyFigures
        levels={map.levels}
        sex={sex}
        selected={selected}
        onSelect={(m) => setSelected((s) => (s === m ? null : m))}
        accessibilityLabel={`Most trained: ${names(most)}. Least: ${names(least)}.`}
      />
      <View style={{ marginTop: space.m, minHeight: 44 }}>
        {sel ? (
          <>
            <Text variant="bodyStrong">{sel.label}</Text>
            <Text variant="caption" color="textSecondary">
              {sel.total > 0
                ? `${trimNumber(sel.total / MAP_WEEKS, 1)} sets a week`
                : `No sets in ${MAP_WEEKS} weeks`}
              {sel.lastAt ? ` · last trained ${relativeDays(sel.lastAt)}` : ''}
              {sel.exercises.length ? ` · ${sel.exercises.slice(0, 3).map((e) => e.name).join(', ')}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text variant="caption" color="textSecondary">Most: {names(most)}</Text>
            <Text variant="caption" color="textSecondary">Least: {names(least)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Sets per muscle group over four weeks, as plain bars. Sets rather than
 * kilograms, so a leg press doesn't dwarf a curl. Hidden until there is
 * enough to read.
 */
function BalanceBars({ history, now }: { history: History; now: number }) {
  const { c } = useTheme();
  const b = muscleBalance(history, now);
  if (b.total < 12) return null;
  const max = Math.max(...b.groups.map((g) => g.sets));
  return (
    <View>
      <SectionLabel right="Sets · last 4 weeks">Muscle groups</SectionLabel>
      {b.groups.map((g) => (
        <View
          key={g.group}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 32 }}
          accessible
          accessibilityLabel={`${g.label}, ${g.sets} sets`}
        >
          <Text variant="caption" color="textSecondary" style={{ width: 84 }} numberOfLines={1}>
            {g.label}
          </Text>
          <View style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: c.bgSunken }}>
            <View
              style={{
                width: `${Math.max(3, (g.sets / max) * 100)}%`,
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: c.textSecondary,
              }}
            />
          </View>
          <Text variant="num" color="textSecondary" align="right" style={{ width: 40 }}>
            {g.sets}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InsightCard({
  finding,
  onOpenExercise,
}: {
  finding: Finding;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const open = finding.exerciseId ? () => onOpenExercise(finding.exerciseId!) : undefined;
  return (
    <View style={{ marginBottom: space.s }}>
      <Card onPress={open}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', columnGap: space.m, flexWrap: 'wrap' }}>
          <Text variant="label" color="textSecondary">
            {finding.title}
          </Text>
          <Text variant="caption" color="textTertiary">
            {finding.span}
          </Text>
        </View>
        {finding.exerciseName ? (
          <Text variant="bodyStrong" style={{ marginTop: space.xs }}>
            {finding.exerciseName}
          </Text>
        ) : null}
        <Text variant="body" color="textSecondary" style={{ marginTop: space.xs }}>
          {finding.text}
        </Text>
      </Card>
    </View>
  );
}
