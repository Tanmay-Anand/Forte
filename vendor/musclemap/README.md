# MuscleMap body diagrams

From [`@musclemap/assets`](https://www.npmjs.com/package/@musclemap/assets) 1.1.0
(https://github.com/Jsplice/MuscleMap), MIT licence (see `LICENSE`). Unchanged except that the
source-map comment lines were removed.

- `*.js`: the muscle and body outlines for each view, as SVG path data.
- `*.webp`: the matching AI-generated reference body photos, turned grey and cut to the body
  outline by the bake script.

Used by `tools/bake-body.mjs`, which builds the phone's figures (`assets/body/`, `src/data/body/`) and
the companion's (`companion/web/body-data.js`). Neither app loads these files directly.
