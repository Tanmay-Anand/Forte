import React from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { SectionLabel, Spacer } from '@/ui/primitives';
import { space } from '@/ui/tokens';
import {
  formatTarget,
  signed,
  type ExerciseComparison,
  type NextTarget,
  type SessionBaseline,
  type SessionComparison,
  type SessionRecord,
} from '@/features/analysis';
import { formatVolume, formatWeight, toDisplayWeight, type Unit } from '@/lib/format';
import { formatDuration, formatShortDate } from '@/lib/time';

/**
 * Records and the per-exercise comparison, shared by the Finish summary and
 * session detail. All numbers come from src/features/analysis; nothing here
 * calculates.
 */

export function RecordsList({ records }: { records: SessionRecord[] }) {
  if (!records.length) return null;
  return (
    <View>
      <SectionLabel>Records</SectionLabel>
      {records.map((r) => (
        <View key={r.exerciseId} style={{ paddingVertical: space.xs }}>
          <Text variant="body">
            {r.name} · {r.value}
          </Text>
          <Text variant="caption" color="textTertiary">
            {r.detail}
          </Text>
        </View>
      ))}
      <Spacer h={space.l} />
    </View>
  );
}

const ORDER: Record<ExerciseComparison['change'], number> = {
  weight_up: 0,
  reps_up: 1,
  weight_down: 2,
  reps_down: 3,
  same: 4,
  new: 5,
};

/**
 * One row per exercise: the headline change, then reps and rest as a caption.
 * Unchanged lifts get a neutral dash, never a red arrow — maintaining is not
 * failing (DESIGN.md 5.5).
 */
export function ComparisonRows({
  comparison,
  unit,
  limit = 6,
}: {
  comparison: SessionComparison;
  unit: Unit;
  limit?: number;
}) {
  const rows = comparison.exercises
    .filter((x) => x.previous)
    .sort((a, b) => ORDER[a.change] - ORDER[b.change])
    .slice(0, limit);
  if (!rows.length) return null;

  return (
    <View>
      {rows.map((x) => {
        const cur = x.current;
        const prev = x.previous!;
        const byWeight = x.change === 'weight_up' || x.change === 'weight_down';
        const value = byWeight
          ? `${formatWeight(prev.top, unit, false)} → ${formatWeight(cur.top, unit)}`
          : x.change === 'same'
            ? cur.top > 0
              ? `${formatWeight(cur.top, unit)} × ${cur.repsAtTop}`
              : `${cur.repsAtTop} reps`
            : `${prev.totalReps} → ${cur.totalReps} reps`;
        const diff = byWeight ? cur.top - prev.top : cur.totalReps - prev.totalReps;
        const up = diff > 0;

        const caption: string[] = [];
        if (byWeight) caption.push(`Reps at top weight ${prev.repsAtTop} → ${cur.repsAtTop}`);
        else if (x.change !== 'same' && cur.top > 0) caption.push(`${formatWeight(cur.top, unit)} unchanged`);
        else if (x.change === 'same') caption.push('Same as last time');
        if (prev.avgRest != null && cur.avgRest != null) {
          caption.push(`rest ${formatDuration(prev.avgRest)} → ${formatDuration(cur.avgRest)}`);
        }

        return (
          <View key={x.exerciseId} style={{ paddingVertical: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {x.name}
              </Text>
              <Text variant="num" color="textSecondary" style={{ marginLeft: space.m }}>
                {value}
              </Text>
              <View
                style={{
                  minWidth: 56,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <Icon
                  name={diff === 0 ? 'minus' : up ? 'arrow-up' : 'arrow-down'}
                  size={14}
                  color={diff === 0 ? 'textTertiary' : up ? 'positive' : 'negative'}
                />
                {diff !== 0 ? (
                  <Text
                    variant="num"
                    color={up ? 'positive' : 'negative'}
                    style={{ marginLeft: space.xs }}
                  >
                    {signed(byWeight ? toDisplayWeight(diff, unit) : diff)}
                  </Text>
                ) : null}
              </View>
            </View>
            {caption.length ? (
              <Text variant="caption" color="textTertiary">
                {caption.join(' · ')}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * "6% above your usual for Chest + Triceps", against the median of the last
 * 3–6 sessions of that workout. Says plainly when the change is within the
 * normal spread, so a small number is never mistaken for news.
 */
export function usualVolumeLine(b: SessionBaseline, name: string, unit: Unit): string {
  const pct = Math.round(b.volumeChange * 100);
  const usual = formatVolume(b.volume, unit);
  if (pct === 0) return `Volume right on your usual ${usual} for ${name}.`;
  return (
    `Volume ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} your usual ${usual} for ${name}` +
    (b.volumeUnusual ? ' — more than your normal session-to-session spread.' : ', within your normal spread.')
  );
}

/**
 * Next time — a target per exercise from today's sets (double progression,
 * src/features/analysis/targets.ts). A suggestion only: the number wells
 * still pre-fill from what you actually did.
 */
export function NextTimeList({
  targets,
  unit,
}: {
  targets: { name: string; target: NextTarget }[];
  unit: Unit;
}) {
  if (!targets.length) return null;
  return (
    <View style={{ marginTop: space.xl }}>
      <SectionLabel>Next time</SectionLabel>
      {targets.slice(0, 6).map(({ name, target }) => (
        <View key={name} style={{ paddingVertical: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <Text variant="num" color={target.progress === 'weight' ? 'textPrimary' : 'textSecondary'}>
              {formatTarget(target, unit)}
            </Text>
          </View>
          <Text variant="caption" color="textTertiary">
            {target.reason}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Compared with 4 Nov" */
export function comparisonTitle(comparison: SessionComparison): string {
  return comparison.previous ? `Compared with ${formatShortDate(comparison.previous.startedAt)}` : '';
}
