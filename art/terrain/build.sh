#!/bin/sh
# Rebuild the terrain sheet from the raw PixelLab downloads in art/terrain/raw/ (run from the repo root).
# grade (sets, per-tile classes, decals) → pure set tiles → compose per-tile classes and base variants →
# recipe → import. Everything under sets/ tiles/ bases/ decals/ try/ is generated.
set -e
T=art/terrain
rm -rf $T/sets $T/tiles $T/bases $T/decals $T/try
node $T/tools/grade.mjs $T/grade.json > /dev/null
node $T/tools/grade.mjs $T/grade-tiles.json > /dev/null
node $T/tools/grade.mjs $T/grade-decals.json > /dev/null
node $T/tools/extract-bases.mjs > /dev/null
node $T/tools/compose.mjs $T/compose.json
node $T/tools/path-variants.mjs $T/try/bases/path-path-grass.png $T/try/pathvar
node $T/tools/compose.mjs $T/compose-bases.json
node $T/make-recipe.mjs
node scripts/terrain-import.mjs $T/terrain.json "$@"
