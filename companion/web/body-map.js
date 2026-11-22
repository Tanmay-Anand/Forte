/**
 * Front and back body figures for the Body page, from MuscleMap's photo
 * bodies (MIT, vendor/musclemap) as prepared by tools/bake-body.mjs: the grey
 * photo cut to the body, and the muscle outlines in body-data.js. Each
 * trained muscle is tinted over the photo with a hard-light blend, so the
 * photo's light, shadow and fibre lines show through the colour. The phone
 * draws the same figure (src/features/body/BodyFigures.tsx).
 * Muscle shapes carry data-muscle and a level class (pl0–pl5) for the shade.
 */
import { BODY, CROP } from './body-data.js';

/**
 * One figure. `levels` maps muscle → 0–5; `labels` maps muscle → hover text;
 * `sex` picks the body ('female', else male).
 */
export function figure(view, levels, labels, selected, sex) {
  const body = sex === 'female' ? 'female' : 'male';
  const muscles = BODY[body][view]
    .map(({ muscle, d }) => {
      const cls = `pm pl${levels[muscle] ?? 0}${muscle === selected ? ' sel' : ''}`;
      return `<path class="${cls}" data-muscle="${muscle}" d="${d}"><title>${labels[muscle] ?? muscle}</title></path>`;
    })
    .join('');
  const { x, y, w, h } = CROP;
  return `<svg class="figure" viewBox="${x} ${y} ${w} ${h + 50}" role="img"
      aria-label="${view === 'front' ? 'Front' : 'Back'} of the body, shaded by training">
    <g class="stage">
      <image href="body/${body}-${view}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>
      <g>${muscles}</g>
    </g>
    <text x="${x + w / 2}" y="${y + h + 38}" text-anchor="middle">${view === 'front' ? 'Front' : 'Back'}</text>
  </svg>`;
}
