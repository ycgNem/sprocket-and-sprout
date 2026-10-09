# Art sources (Phase 2: full replacement)

Everything the game draws comes from PixelLab-generated PNGs that are snapped to the palette and
packed into sheets in `src/art/`. This folder keeps the raw generations and the recipes, so every
import can be rerun. Rules: `STYLE.md`. Plan: `ROADMAP.md`.

| Folder | What | Importer | Output |
|---|---|---|---|
| `player/` | player character sheet (look-swappable) | `scripts/art-import.mjs` | `src/art/player.*` |
| `npcs/` | NPC character sheets | `scripts/art-import.mjs` | `src/art/npc-*.*` |
| `terrain/` | Wang tilesets, base variants, per-tile classes, decals | `scripts/terrain-import.mjs` | `src/art/terrain.*` |
| everything else | sprites by name (crops, objects, trees, buildings, machines, icons…) | `scripts/sprites-import.mjs` | `src/art/<group>.*` |

## How a sheet replaces procedural art

The renderer asks the atlas for sprites by name (`crop:radish:2:0:1:0`, `tree:oak:4:1:0:2`,
`st:keg:0:1:2`, `i:radish` …). A sheet registers frames under those names; the procedural
generators in `src/render/art/` are only the fallback, still reachable as `name:old` and with
`?art=old`. **To learn the names, sizes and anchors, read the generator** (`registerXxxSprites` in
`src/render/art/*.ts`): the frame size and `ox`/`oy` you import must match what it returns, so the
renderer needs no change. Every parameter in a name is a variant the game draws (season, stage,
frame, tier…); cover them all, using `*`/`**` patterns and `recolor` instead of separate art
where the art would be the same.

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
- `node e2e/sprites.mjs <name> … --out e2e/out/<x>.png`: the running game draws each sprite
  name, imported (left) next to the procedural 1.0 one (right). Needs the dev server
  (http://localhost:5173/, usually already running). `e2e/out/peek.mjs` takes a full in-game
  screenshot after running a JS snippet.
- Node is portable: `export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"` in Bash.

## The cheap way to generate many sprites

`create_1_direction_object` with `size` ≤ 42 returns **64 sprites for 10 generations**, and
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

## Boundaries (several agents work at once)

- Write only in your own `art/<group>/` folder and your own `src/art/<group>.*` outputs.
- Don't edit `src/render/`, `src/ui/`, `src/sim/` or another group's files. If the renderer
  needs a change (a new size, an extra frame), say so in your report.
- Don't commit. Report: sheets written, sprite names covered (and any not covered), generations
  spent (`get_balance` before and after), screenshot paths, rejects and why.
