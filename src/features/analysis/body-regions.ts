import type { Muscle } from './muscles.ts';

/**
 * Which Forte muscle each region of the MuscleMap body diagrams shades
 * (companion/web/vendor/musclemap). The only copy of this mapping:
 * tools/body/bake.mjs uses it to build the phone's body data
 * (src/data/body/) and the companion's (companion/web/body-data.js).
 */
export type BodyView = 'front' | 'back';

const GROUP: Record<string, Muscle> = {
  CHEST: 'chest',
  SHOULDERS_FRONT: 'front_delts',
  SHOULDERS_SIDE: 'side_delts',
  SHOULDERS_REAR: 'rear_delts',
  TRAPEZIUS: 'traps',
  LATS: 'lats',
  RHOMBOIDS: 'upper_back',
  BACK_LOWER: 'lower_back',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  CORE: 'abs',
  OBLIQUES: 'obliques',
  GLUTES: 'glutes',
  QUADS: 'quads',
  HAMSTRINGS: 'hamstrings',
  ADDUCTORS: 'adductors',
  CALVES: 'calves',
};

/**
 * Forte counts hip abduction as glutes. From behind, MuscleMap's abductor
 * region sits on the hip, so it shades with the glutes; from the front it is
 * the outer thigh, which reads as quads.
 */
const ABDUCTORS: Record<BodyView, Muscle> = { front: 'quads', back: 'glutes' };

/** The muscle a MuscleMap region shades, or null for one Forte doesn't track. */
export function bodyMuscle(group: string, view: BodyView): Muscle | null {
  if (group === 'ABDUCTORS') return ABDUCTORS[view];
  return GROUP[group] ?? null;
}

/**
 * Shade levels 0–5 from amounts per muscle, relative to the largest:
 * 0 is untrained, anything trained is at least 1. The same rule as the
 * companion's Body page.
 */
export function shadeLevels<K extends string>(amounts: Record<K, number>): Record<K, number> {
  const values = Object.values(amounts) as number[];
  const max = Math.max(0, ...values);
  const out = {} as Record<K, number>;
  for (const key of Object.keys(amounts) as K[]) {
    const v = amounts[key];
    out[key] = v <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((v / max) * 5));
  }
  return out;
}
