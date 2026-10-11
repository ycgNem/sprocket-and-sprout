#!/bin/sh
# Rebuild the terrain sheet from the raw PixelLab downloads in art/terrain/raw/ (run from the repo root).
# grade (sets, per-tile classes, decals) → pure set tiles → compose per-tile classes and base variants →
# flagstone path (bases + the path sets, tools/flagstone.mjs) → diagonal masks rebuilt from their corners where
# that meets the neighbours better (tools/diagonals.mjs, measured with e2e/seams.mjs) → the crossings of the Wang
# sets' two-class edges lined up where the audit finds an offending pair (tools/seams.mjs) → plank decks
# (tools/planks.mjs) → recipe → import (terrain sheet, and the Flagstone Path item sprites: items.json →
# src/art/terrain-items.*) → the seam audit's count, printed.
# Everything under sets/ tiles/ bases/ decals/ try/ items/ is generated.
set -e
T=art/terrain
rm -rf $T/sets $T/tiles $T/bases $T/decals $T/try $T/items
node $T/tools/grade.mjs $T/grade.json > /dev/null
node $T/tools/grade.mjs $T/grade-tiles.json > /dev/null
node $T/tools/grade.mjs $T/grade-decals.json > /dev/null
node $T/tools/extract-bases.mjs > /dev/null
node $T/tools/compose.mjs $T/compose.json
node $T/tools/compose.mjs $T/compose-bases.json
node $T/tools/flagstone.mjs
node $T/tools/diagonals.mjs path-dirt path-grass path-sand soil-grass wet-dirt
node $T/tools/seams.mjs
node $T/tools/planks.mjs
node $T/make-recipe.mjs
node scripts/sprites-import.mjs $T/items.json
node scripts/terrain-import.mjs $T/terrain.json "$@"
node e2e/seams.mjs | sed -n 1p
