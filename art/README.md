# Art sources (Phase 2: full replacement)

Everything the game draws comes from PixelLab-generated PNGs that are snapped to the palette and
packed into sheets in `src/art/`. This folder keeps the raw generations and the recipes, so every
import can be rerun. Rules: `STYLE.md`. Plan: `ROADMAP.md`.

| Folder | What | Importer | Output |
|---|---|---|---|
| `player/` | player character sheet (look-swappable) | `scripts/art-import.mjs` | `src/art/player.*` |
| `npcs/` | NPC character sheets; the six re-roled villagers' work clothes (2.0) come from PixelLab edits in `npcs/<id>/edit-a/`, laid out by `npcs/<id>/prep.mjs` | `scripts/art-import.mjs` | `src/art/npc-*.*` |
| `portraits/` | villager portraits (`portrait:<id>:<mood>:<frame>`): moods by `moods.mjs`, the re-roled villagers' work clothes painted over by `outfits.mjs` (`outfits/`) | `scripts/sprites-import.mjs` | `src/art/portraits.*` |
| `airship/` | Roxy's airship (`bld:airship:<season>:<night>:<frame>`), graded by `build.mjs` | `scripts/sprites-import.mjs` | `src/art/airship.*` |
| `terrain/` | Wang tilesets, base variants, per-tile classes, decals | `scripts/terrain-import.mjs` | `src/art/terrain.*` |
| `fences/` | fences, walls, gates and the paddock by neighbour mask (`fence:<kind>:<mask>`), hand-pixeled by `build.mjs` | `scripts/sprites-import.mjs` | `src/art/fences.*` |
| `deep/` | the Deepworks chamber machines (`deep:<kind>:<restored>:<frame>`) and gallery doorways (`o:52:*`): one PixelLab machine each, every frame derived by `build.mjs`; doorways by `gallery.mjs` | `scripts/sprites-import.mjs` | `src/art/deep.*` |
| `town/` | the town works (`town:*`, `st:tram_bin:*`): PixelLab pieces plus scripted frames (`tools/*.mjs`); the mill and rails baked from the old generator into `baked/` (`tools/bake.mjs`, needs the dev server) | `scripts/sprites-import.mjs` | `src/art/town.*` |
| `ruins/` | the Tinker's Yard wrecks (`o:56:<v>:<season>`): one PixelLab wreck each (`raw/batches.json`), graded and given its four seasons by `build.mjs` | `scripts/sprites-import.mjs` | `src/art/ruins.*` |
| `fairs/` | the Harvest Haul stalls and podium (`haul:stall:<k>:<f>`, `haul:podium:<f>`), the Fair's test plate and banner (`fair:plate`, `fair:banner:<f>`), hand-pixeled by `build.mjs` | `scripts/sprites-import.mjs` | `src/art/fairs.*` |
| `harbor/` | the Harbor (`harbor:warehouse:<restored>[:winter]`, `harbor:ship:<f>`, `harbor:ship:sail[:west]:<f>`, `harbor:cargo:<n>`): the warehouse from one PixelLab pick widened and given its derelict state by rule, the Copper Gull graded, furled, bobbed and smoked by rule, the cargo hand-pixeled; `build.mjs`, review `tools/contact.mjs`, in-game `tools/proof.mjs` | `scripts/sprites-import.mjs` | `src/art/harbor.*` |
| `buildings/` | town buildings and farm structures (`bld:*`, `st:*`) composed from PixelLab picks by `tools/compose.mjs` (config `buildings.json` from `tools/mkconfig.mjs`); the farmhouse's clockwork (gable cog, copper downpipe into a gauge tank, roof vent) pixeled over it by `keeper.mjs`, which compose runs as its `post` step (0 generations) | `scripts/sprites-import.mjs` | `src/art/buildings.*` |
| `promo/` | the "then and now" screenshots in What's new, PATCHNOTES.md and the README: the first build (v0.9, commit `9a72b2a`) and 2.0 at a new game's first morning, by `promo/capture.mjs` (its header says how to build the old version) | (imported by `src/data/patchnotes.ts`) | the WebPs themselves |
| everything else | sprites by name (crops, objects, trees, buildings, machines, icons…) | `scripts/sprites-import.mjs` | `src/art/<group>.*` |

## How a sheet names its sprites

The renderer asks the atlas for sprites by name (`crop:radish:2:0:1:0`, `tree:oak:4:1:0:2`,
`st:keg:0:1:2`, `i:radish` …), and every name comes from an imported sheet: 2.0 deleted the 1.x
procedural generators (DECISIONS #145). Only names made at runtime are still drawn in code:
`shadow:<width>`, the `ib:` belt icons (from the imported `i:` icons) and the `rust:` variants.
**To learn a name's size and anchor, read the sheet that has it** (`src/art/<group>.json`: its `r`
rect and `o` origin): a replacement keeps the frame size and origin, so the renderer needs no
change. A new family needs a line in `e2e/coverage.mjs`. Every parameter in a name is a variant the
game draws (season, stage, frame, tier…); cover them all, using `*`/`**` patterns and `recolor`
instead of separate art where the art would be the same.

## Tools

- PixelLab MCP (`mcp__pixellab__*`, load with ToolSearch). The account allows **8 jobs at once**,
  and several agents share it: if a create call is refused for concurrency, `wait_for_jobs` and
  retry. Never cancel another agent's jobs.
- `node scripts/pl-fetch.mjs frames <frame_0 url> <count> <dir>`: download a review batch.
  `node scripts/pl-fetch.mjs tileset <id> <dir>`: a Wang tileset (`tileset.png` + `tileset.json`).
  `node scripts/pl-fetch.mjs url <url> <file>`: anything else.
- `node scripts/contact.mjs <dir> --out e2e/out/<x>.png --snap --cols 16`: one labeled image of a
  whole batch, snapped to the palette (what the import will make). Read it to choose.
- `node scripts/sprites-import.mjs art/<group>/sprites.json`: build a sprites sheet (format in
  the script header). Preview: `e2e/out/art/<name>.preview.png`.
- `e2e/out/peek.mjs` takes a full in-game screenshot after running a JS snippet (needs the dev
  server, http://localhost:5173/, usually already running).
- Node is portable: `export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"` in Bash.

## The cheap way to generate many sprites

`create_1_direction_object` with a small `size` returns **64 sprites for 10 generations** (at `size`
42 the same batch cost 15 in Phase 6), and
`item_descriptions` gives each slot its own description, in order (slot 0 = first entry). The
batch shares one consistent style. So:

- Batch everything: 64 descriptions per call. Fill spare slots with second takes of the
  important sprites, not with random extras.
- Repeat the shared style words in `description` (warm cozy farm game, dark plum outline, light
  from the upper left, top-down 3/4 view, …) and keep each item description concrete (what it
  is, its colors, its size in the frame).
- `size` sets the canvas; the art fills most of it. Pick a size close to the sprite you need:
  art that comes out bigger than the frame gets rejected by the import, and shrinking pixel art
  ruins it. For 16 px icons and objects try `size: 16`–`20`; for 16×24 crops `size: 24`; trees
  and buildings need bigger canvases (`create_map_object`, `create_1_direction_object` with
  `size` 48–96 → 16 or 4 candidates per call).
- Review with `contact.mjs`, keep what passes `STYLE.md`'s readability checks, regenerate the
  rest in a second batch.
- A growth series or a set of states of one object stays consistent when it comes from one
  batch (same call), or from `create_object_state` on the chosen sprite.

Free fix-ups: `pixelart_workbench` (lint, repair, selout, shade). Cheap: `reduce_colors`,
`correct_pixelart` (0.1 generation).

## Drawn by script (0 generations)

Small, rule-bound pieces are cheaper and more exact pixeled by script than generated (2.0 beta: the
bridges, the fences and the hamster cage's icon cost 0 generations). Each script checks the palette
and writes PNGs the usual importers take:

- `node art/terrain/tools/planks.mjs`: the plank deck set (`planks_h/0-8`, `planks_v/0-8`, ends,
  sides, rails, posts) into `art/terrain/tiles/`, then the terrain import. `src/render/planks.ts`
  says which piece goes where.
- `node art/fences/build.mjs`, then `node scripts/sprites-import.mjs art/fences/sprites.json`: the
  101 fence, wall, gate and paddock frames. `src/render/fences.ts` picks them by mask; the
  east-west pieces are asserted to equal the old single sprites.
- `node art/icons/hand.mjs && node art/icons/tools/build.mjs && node scripts/sprites-import.mjs
  art/icons/sprites.json`: icons drawn from character grids in `hand.mjs` (`raw/hand/<id>.png`,
  picked in `art/icons/picks.json`; review image `e2e/out/icons-hand.png`). `art/icons/items.tsv`
  lists every item (regenerate it with `list-items.ts` together with picks for new items, or
  `build.mjs` fails); picks.json's `external` list names icons another sheet draws (fieldworks).
- `node art/terrain/tools/seams.mjs` (a `build.sh` step): lines up where the Wang sets cross each
  edge, so `node e2e/seams.mjs` reads 0; `seams-diff.mjs` shows what it changed.
- `node art/fairs/build.mjs`, then `node scripts/sprites-import.mjs art/fairs/sprites.json`: the
  Harvest Haul stalls and podium, the Fair plate and banner (review: `e2e/out/fairs-build.png`;
  `art/fairs/tools/contact.mjs` draws Phase 6 round 2's sprites at 1x and 3x).
- The thresher (`art/fieldworks/thresher.mjs`) and the gantry bridges' turning wheels
  (`art/fieldworks/wheels.mjs`; `build.mjs` asserts that the frames differ only in the wheels), both
  imported by `art/fieldworks/build.mjs`; the state glyphs `fx:state:*` (`art/fx/hand.mjs`), the
  Deepworks doorways (`art/deep/gallery.mjs`) and the town's waterwheel, pump beam, fountain water,
  sign, buffer and town-line post (`art/town/tools/`).
- Tock (`art/creatures/tock.mjs`) and the hamster (`art/creatures/hamster.mjs`; its cage and wheel
  `art/home/hamstercage.mjs`) are hand-pixeled as ASCII parts, every pose sharing one body; the
  PixelLab batches in their `raw/` folders were only the design reference.
- `node art/factory/gen/belts.mjs && node art/factory/gen/belt-recipe.mjs && node
  scripts/sprites-import.mjs art/factory/belts.json`: every belt and underground (`belt:*`, `ug:*`)
  framed as a conveyor for the screenshot test: rails on both edges with axle caps, a roller every
  8 px (ridge across the belt, end in the gap), the belt and chevron moving over them; the tier sets
  the materials (`TIER`), and the rails and rollers are lit in world space after rotation.
- The preserving crock (`art/factory/gen/crock.mjs`, built by `gen/structs.mjs`): raw/D/5's jam
  crock under a hand-pixeled brass canner lid, steam vent and gauge, 16x30 (14 px above its tile);
  only the vent stands high, so an arm behind it stays in view. `node art/factory/gen/crock.mjs`
  previews every frame (`e2e/out/crock.png`).

## Boundaries (several agents work at once)

- Write only in your own `art/<group>/` folder and your own `src/art/<group>.*` outputs.
- Don't edit `src/render/`, `src/ui/`, `src/sim/` or another group's files. If the renderer
  needs a change (a new size, an extra frame), say so in your report.
- Don't commit. Report: sheets written, sprite names covered (and any not covered), generations
  spent (`get_balance` before and after), screenshot paths, rejects and why.
