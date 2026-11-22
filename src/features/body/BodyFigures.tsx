import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, Path } from 'react-native-svg';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { space } from '@/ui/tokens';
import type { BodyView, Muscle } from '@/features/analysis';
import { BODY_CROP, type BodyOutlines } from '@/data/body/types';

/**
 * Front and back of the body, side by side, each trained muscle tinted in the
 * logo blue by how much it was trained (levels 0–5, see shadeLevels).
 * Untrained muscles are drawn as faint outlines, so the figure still reads as
 * a map of what was left out; the selected muscle gets an ink outline.
 *
 * Built for negligible battery use: tools/bake-body.mjs has already made a
 * grey photo of the body and a blue-blended copy for each theme, so drawing
 * is plain transparency. The blue copy is drawn once per level, clipped to
 * that level's muscles: at most six image draws a figure, and only when the
 * levels change (memo). No animation, no filters, no WebView.
 *
 * Body photos and outlines: MuscleMap (MIT), vendor/musclemap.
 */

type Sex = 'male' | 'female';

const IMAGES = {
  male: {
    front: {
      base: require('../../../assets/body/male-front-base.webp'),
      dark: require('../../../assets/body/male-front-glow-dark.webp'),
      light: require('../../../assets/body/male-front-glow-light.webp'),
    },
    back: {
      base: require('../../../assets/body/male-back-base.webp'),
      dark: require('../../../assets/body/male-back-glow-dark.webp'),
      light: require('../../../assets/body/male-back-glow-light.webp'),
    },
  },
  female: {
    front: {
      base: require('../../../assets/body/female-front-base.webp'),
      dark: require('../../../assets/body/female-front-glow-dark.webp'),
      light: require('../../../assets/body/female-front-glow-light.webp'),
    },
    back: {
      base: require('../../../assets/body/female-back-base.webp'),
      dark: require('../../../assets/body/female-back-glow-dark.webp'),
      light: require('../../../assets/body/female-back-glow-light.webp'),
    },
  },
} as const;

/** Only the body in use is loaded: Metro evaluates a require when it runs. */
function outlinesFor(sex: Sex): BodyOutlines {
  return sex === 'female' ? require('@/data/body/female').FEMALE : require('@/data/body/male').MALE;
}

/** Opacity of the blue per level; the same steps as the companion. */
const OPACITY = [0, 0.16, 0.32, 0.5, 0.7, 0.92];

type Props = {
  levels: Partial<Record<Muscle, number>>;
  sex: Sex | null;
  /** Outlined, when set. */
  selected?: Muscle | null;
  /** Makes muscles tappable. */
  onSelect?: (muscle: Muscle) => void;
  /** Spoken summary for screen readers. */
  accessibilityLabel: string;
  /** Largest width of each figure, in dp. Summary uses a small one. */
  maxWidth?: number;
};

export const BodyFigures = memo(function BodyFigures({ levels, sex, selected, onSelect, accessibilityLabel, maxWidth = 220 }: Props) {
  const body: Sex = sex === 'female' ? 'female' : 'male';
  return (
    <View
      style={{ flexDirection: 'row', gap: space.s }}
      accessible={!onSelect}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {(['front', 'back'] as const).map((view) => (
        <View key={view} style={{ flex: 1, alignItems: 'center' }}>
          <Figure view={view} sex={body} levels={levels} selected={selected ?? null} onSelect={onSelect} maxWidth={maxWidth} />
          <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
            {view === 'front' ? 'Front' : 'Back'}
          </Text>
        </View>
      ))}
    </View>
  );
});

function Figure({
  view,
  sex,
  levels,
  selected,
  onSelect,
  maxWidth,
}: {
  view: BodyView;
  sex: Sex;
  levels: Partial<Record<Muscle, number>>;
  selected: Muscle | null;
  onSelect?: (muscle: Muscle) => void;
  maxWidth: number;
}) {
  const { name: theme, c } = useTheme();
  const muscles = outlinesFor(sex)[view];
  const images = IMAGES[sex][view];
  const { x, y, w, h } = BODY_CROP;

  // Muscles grouped by level, so each level is one clipped draw.
  const byLevel = useMemo(() => {
    // groups[0] holds the untrained muscles, drawn as outlines below.
    const groups: string[][] = [[], [], [], [], [], []];
    for (const m of muscles) {
      const level = Math.max(0, Math.min(5, Math.round(levels[m.muscle] ?? 0)));
      groups[level]!.push(m.d);
    }
    return groups;
  }, [muscles, levels]);

  const outline = selected ? muscles.find((m) => m.muscle === selected) : undefined;

  return (
    <Svg viewBox={`${x} ${y} ${w} ${h}`} width="100%" style={{ aspectRatio: w / h, maxWidth }}>
      <Defs>
        {byLevel.map((paths, level) =>
          level > 0 && paths.length ? (
            <ClipPath key={level} id={`level${level}`}>
              {paths.map((d, i) => (
                <Path key={i} d={d} />
              ))}
            </ClipPath>
          ) : null,
        )}
      </Defs>
      <Image href={images.base} x={x} y={y} width={w} height={h} preserveAspectRatio="none" />
      {byLevel[0]!.map((d, i) => (
        <Path key={`o${i}`} d={d} fill="none" stroke={c.lineStrong} strokeWidth={2} strokeOpacity={0.7} />
      ))}
      {byLevel.map((paths, level) =>
        level > 0 && paths.length ? (
          <Image
            key={level}
            href={images[theme]}
            x={x}
            y={y}
            width={w}
            height={h}
            preserveAspectRatio="none"
            opacity={OPACITY[level]}
            clipPath={`url(#level${level})`}
          />
        ) : null,
      )}
      {onSelect ? (
        <G>
          {muscles.map((m) => (
            <Path key={m.muscle} d={m.d} fill={c.textPrimary} fillOpacity={0.001} onPress={() => onSelect(m.muscle)} />
          ))}
        </G>
      ) : null}
      {outline ? <Path d={outline.d} fill="none" stroke={c.textPrimary} strokeWidth={5} /> : null}
    </Svg>
  );
}
