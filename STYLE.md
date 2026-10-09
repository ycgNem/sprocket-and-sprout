# Sprocket & Sprout — Style bible

The rules every sprite follows from 1.1 on. The `art-director` agent owns this file; change it
on purpose, not by drift. `ROADMAP.md` has the plan, `references/notes.md` the owner's taste.

## Owner decisions (2026-10-08)

1. **Palette: Resurrect 64** by Kerrie Lake (`references/palettes/resurrect-64.hex`). The game
   palette is `src/data/palette.ts`; it never drops below 48 colors. Additions only when a test
   sprite proves a gap, written down here with the reason.
2. **Scope: full replacement.** Every sprite the game draws becomes imported pixel art (terrain,
   crops, characters, objects, structures, UI icons). The procedural generators in
   `src/render/art/` stay only as fallbacks until their replacement lands, then get deleted.

## The look in one paragraph

Cozy clockwork farm. Warm light from the upper left, soft plum shadows, chunky readable
silhouettes with a dark plum outline, and color doing the talking: brass, copper, rust-red wood,
green growth, blue water. Never cold industrial gray, never pure black, nothing that reads as an
alarm. Stardew Valley for warmth, Forager for reward density, Sun Haven for crop and character
readability.

## Grid and sizes

| Thing | Size (px) | Notes |
|---|---|---|
| Tile | 16 × 16 | `TILE` in `src/render/art/terrain.ts`. Terrain art is exactly one tile, or a Wang/autotile set of 16 px tiles. |
| Adult character | **28–31 tall**, 14–17 wide | Sole of the boot to top of the hair, measured by `art-import` (`height`). Head ≈ 0.4 of the height (11–13 px): chibi-leaning, so faces read at 1×. |
| Child / short | 22–25 tall | Same head size, shorter body. |
| Tall adult | 31–33 tall | |
| Character frame | 40 × 40 (player 44 × 40) | Anchor (20, 38), player (22, 38): bottom-center of the feet. Room for hats, arms and tool swings (the fishing cast needs the extra width). |
| Item icon | 16 × 16 | Art inside 14 × 14 (1 px margin) where the silhouette allows; tall or wide items (bottles, saplings, long fish) may use 15–16 px on one axis, never both. Belt version 10 × 10 (`ib:`), derived automatically. Generate at PixelLab `size: 16`. |
| Crop stage | frame 20 × 26, origin (2, 10) | Plant base on tile row 13; mature plants 16–20 px wide (neighbors may touch, which reads lush). Giant crops 48 × 48. |
| Tree | 32–48 wide, 48–64 tall | Trunk base on the tile's bottom-center. |
| Portrait | 32 × 32 (48 × 48 later) | Dialogue window. |
| Buildings, machines | whole tiles wide | Footprint matches the structure's tile size; height free. |

Everything sits on the integer pixel grid: no fractional scale, no fractional position, no
rotation of pixel art (the rotated tool swing gets drawn frames in Phase 2). Scaling is only by
whole factors (`drawFit`, `drawItemIcon` in `src/render/atlas.ts`).

## Palette

Resurrect 64, indices as in `src/data/palette.ts`:

```
 0-4  #2e222f #3e3546 #625565 #966c6c #ab947a   warm neutrals (plum-black .. taupe)
 5-9  #694f62 #7f708a #9babb2 #c7dcd0 #ffffff   cool neutrals
10-15 #6e2727 #b33831 #ea4f36 #f57d4a #ae2334 #e83b3b   reds
16-18 #fb6b1d #f79617 #f9c22b                   orange .. gold
19-23 #7a3045 #9e4539 #cd683d #e6904e #fbb954   rust .. amber
24-28 #4c3e24 #676633 #a2a947 #d5e04b #fbff86   olive .. pale yellow
29-33 #165a4c #239063 #1ebc73 #91db69 #cddf6c   greens
34-38 #313638 #374e4a #547e64 #92a984 #b2ba90   sage
39-43 #0b5e65 #0b8a8f #0eaf9b #30e1b9 #8ff8e2   teals
44-48 #323353 #484a77 #4d65b4 #4d9be6 #8fd3ff   blues
49-53 #45293f #6b3e75 #905ea9 #a884f3 #eaaded   purples
54-57 #753c54 #a24b6f #cf657f #ed8099           roses
58-63 #831c5d #c32454 #f04f78 #f68181 #fca790 #fdcbb0   magenta .. peach
```

The 1.0 color names (`C.ink`, `C.brass` …) are aliases to the nearest Resurrect color until the
procedural art is gone. New art never uses `C`; it uses the material ramps below.

### Material ramps (shadow → light)

| Material | Ramp | Use |
|---|---|---|
| Outline | `#2e222f` | Plum-black. The only "black". |
| Shadow tint | `#45293f` `#3e3546` | Deepest shade of warm materials; cast shadows. |
| Wood | `#45293f` `#7a3045` `#9e4539` `#cd683d` `#e6904e` | Planks, fences, handles, crates. |
| Brass | `#9e4539` `#cd683d` `#f79617` `#f9c22b` `#fbff86` | Gears, fittings, lamps, the clockwork. |
| Copper | `#6e2727` `#b33831` `#ea4f36` `#f57d4a` `#fca790` | Pipes, kettles, boilers. |
| Iron (sparingly) | `#3e3546` `#625565` `#7f708a` `#9babb2` | Blades, rails, bolts. Always next to brass or wood, never a whole gray machine. |
| Stone | `#3e3546` `#625565` `#966c6c` `#ab947a` `#c7dcd0` | Rocks, walls, paths: warm taupe, not gray. |
| Foliage | `#165a4c` `#239063` `#1ebc73` `#91db69` `#cddf6c` | Leaves, crops, bushes. |
| Dry/autumn foliage | `#4c3e24` `#676633` `#a2a947` `#d5e04b` | Fall, wheat, hay. |
| Grass (ground) | `#165a4c` `#239063` with `#676633` speckle, `#91db69` tufts | Warm the green with olive, don't go teal. |
| Soil | `#45293f` `#4c3e24` `#7a3045` `#9e4539` | Tilled earth darker and redder than paths. |
| Water | `#323353` `#484a77` `#4d65b4` `#4d9be6` `#8fd3ff` `#ffffff` | `#ffffff` only for glints and foam. |
| Light / glow | `#fbb954` `#f9c22b` `#fbff86` `#fdcbb0` | Lamps, windows at dusk, ripe-crop sparkle. |
| Skin (7 tones) | see `SKIN3` in `src/data/palette.ts` | `#fdcbb0` peach down to `#45293f`. |
| Cream / white fur | `#966c6c` `#ab947a` `#fdcbb0` `#ffffff` | Sheep, chickens, white coats, speech bubbles. The automatic snap turns PixelLab's cream into sage `#b2ba90`: map it onto this ramp explicitly. |
| Ground as shipped (terrain sheet) | dirt `#e6904e` (specks `#cd683d` `#9e4539`, lip `#7a3045` `#45293f`); dry soil `#9e4539` / `#cd683d`; wet soil `#45293f` / `#7a3045`; sand `#fbb954` (wet `#ab947a`); water `#4d9be6`; deep `#484a77` | The grass ramp colors (`#165a4c #239063 #1ebc73 #91db69 #676633 #a2a947 #cddf6c #f9c22b`) are reserved for grass in terrain: the season recolors map exactly those. |

Cool grays may also color animal coats (a silver cat), not only iron, glass and snow.

**"Warm brass, never gray" in hex:** a machine is brass (`#f79617`/`#f9c22b`) and wood
(`#9e4539`/`#cd683d`) with copper accents; its darkest shade is `#45293f` or `#7a3045`, never
`#313638`; its highlight is `#fbff86` or `#fdcbb0`, never `#ffffff`. Cool grays (`#7f708a`
`#9babb2` `#c7dcd0`) appear only on small iron parts, glass and snow.

**Hue shifting:** shadows move toward plum/purple, highlights toward yellow/peach. A ramp that
only changes lightness looks plastic.

## Outline

- Characters, creatures, items, icons, crops and small objects: a closed 1 px outline in
  `#2e222f` around the silhouette. Inside the silhouette, separate parts with the material's
  darkest ramp shade, not the outline color (eyes are the exception).
- Large objects (buildings, trees, big machines): selective outline. `#2e222f` on the bottom and
  shadow side, the material's darkest shade on the lit top-left edges.
- Terrain tiles: no outline. Edges come from the autotile transitions.
- Never `#000000`. Never a light outline.

## Light and shadow

- Light comes from the **upper left**. Highlights on top and left edges, shade on the bottom and
  right. Every sheet, every tile, every icon.
- **Shadows under everything that stands on the ground**, drawn by the renderer as a separate
  sprite (`shadow:<w>`), never baked into a sheet: a flat ellipse of `#2e222f` at 28 % opacity,
  width ≈ ¾ of the footprint, height = width / 3, centered under the anchor.
- 3–4 shades per material. No gradients, no pillow shading, no anti-aliasing (no
  semi-transparent pixels), dithering only on large flat areas (sky, water, big walls).

## Animation

| Animation | Frames | Notes |
|---|---|---|
| Walk | 4 per direction | Columns `walk0..walk3`. The renderer cycles frames 0–3 while moving and shows frame 0 standing, so the sheet's frame 0 is the idle pose (PixelLab rotation image) and 1–3 are walk frames. |
| Tool use | 2 (raise, strike) | Frames 4 and 5 of the `ch:` sprite. |
| Idle | 1 for now | Breathing idle is a Phase 3 nice-to-have. |
| Directions | 4: down, right, up, left | A sheet's left row is optional; without one the renderer mirrors the right row. |

All frames of a sheet share one anchor (`art-import` aligns them), so nothing jitters between
frames.

## The look system on imported characters

The player picks skin, hair color, shirt and pants (`src/app/app.ts`, new game). Imported
character sheets are drawn in one look whose part colors are **key ramps** (3 shades each:
shadow, base, light). At runtime `lookSwap` (`src/render/art/sheets.ts`) recolors the keys to the
chosen look's ramps (`RAMP3` / `SKIN3` in `src/data/palette.ts`). Rules for a character sheet:

- Each swappable part (skin, hair, shirt, pants) uses exactly its 3 key colors, and no other part
  uses them. `art-import` rejects overlapping keys and writes a `.swaptest.png` with every key
  painted a loud color so leaks show.
- Hair *styles* can't be swapped by color. A sheet lists the styles it draws (`styles`); other
  looks keep the procedural sprite until their sheet exists (PixelLab `create_character_state`
  makes a hairstyle variant of the same character).

## Pipeline

1. **Generate with PixelLab** (MCP server `pixellab`, or `scripts/pixellab.mjs` with
   `PIXELLAB_API_TOKEN` when the MCP tools aren't loaded). Settings that work:

   | Asset | Tool and settings |
   |---|---|
   | Character | `create_character`, `mode: "v3"`, `size: 32` (≈30 px tall), `view: "low top-down"`, `outline: "single color outline"`. `standard` mode with `proportions: cartoon` is the cheap alternative (1 generation, 4 directions). `size` is the character's height, not the canvas. |
   | Walk | `animate_character`, `template_animation_id: "walking-4-frames"`, all 4 directions (1 generation each). |
   | Tool use, custom moves | `animate_character` without a template (v3): `action_description`, `frame_count: 4`, one direction per call. |
   | Variants (hair, outfit, season clothes) | `create_character_state` with `use_color_palette_from_reference: true`. |
   | NPCs in the same style | `create_character` with `mode: "pro"` and `style_character_id` = the player. |
   | Terrain | `create_topdown_tileset`, `tile_size: 16`, chained with `lower_base_tile_id` so grass, dirt, tilled soil, path and water share base tiles; then `create_map` + `edit_map` + `view_map` to preview a farm layout before importing. `create_tiles_pro` / `create_path_tiles` for variants and paths. |
   | Buildings | `create_building_kit`, or `create_map_object` per building. |
   | Objects, machines, crops | `create_map_object` / `create_1_direction_object` / `create_object_pro_flash`; `animate_object` for machine working frames. |
   | Icons, UI | `create_ui_asset`; `create_font` for the bitmap font pass. |
   | Portraits | `create_portrait_character` from the character. |
   | Fix-ups | `correct_pixelart` (strays, edges), `unzoom_image` (upscaled input), `inpaint_image` (repaint one part). |

   Ask for warm colors in the description; PixelLab has no palette parameter on most tools.
   Generations are budgeted (Tier 1: 2,000 a month, `get_balance`).

   **Batches:** `create_1_direction_object` with `size` ≤ 42 returns 64 sprites for 10
   generations, one `item_descriptions` entry per slot, in order, in one consistent style. It is
   the workhorse for crops, objects, icons, critters and UI frames (`art/README.md`).

   **What generation can't do well, and what we do instead:** sprites under ~10 px (critters,
   emote bubbles, pennants) come back at 14-16 px and can't be shrunk, so the batch is the design
   reference and the final is hand-pixeled as a character grid in a script (`art/fx/hand.mjs`).
   Nine-slice UI frames must tile and mirror exactly, so they are drawn by rule
   (`art/ui/tools/build.mjs`). Walk/idle frames that PixelLab animations made jittery are derived
   from one generated pose (`art/creatures/prep.mjs`). Generated sources are graded onto chosen
   ramps per material (`art/terrain/tools/grade.mjs`, `art/nature/build.mjs`) when a plain
   nearest-color snap muddies them.

2. **Import.** Three importers, one per sheet kind, all snapping to the palette:
   - `node scripts/sprites-import.mjs art/<group>/sprites.json`: any sprite by name (`kind:
     "sprites"`): entries `match` a name or a pattern (`*` = one segment, final `**` = the rest),
     with `frame`, `origin` (the procedural sprite's ox/oy), `at` (art bottom-center), `like` +
     `recolor` for cheap variants (seasons, tiers). Packed and deduplicated.
   - `node scripts/terrain-import.mjs art/terrain/terrain.json`: Wang sets, base variants,
     per-tile classes, decals and season recolors (`kind: "terrain"`), for the dual-grid ground.
   - `node scripts/art-import.mjs art/<name>/recipe.json` for characters (below).

   The character importer `art-import.mjs` undoes integer
   upscaling, checks the grid, thresholds alpha, snaps colors to the palette (CIEDE2000 with
   lightness at half weight so hues survive; near-blacks keep full weight), applies the recipe's
   `remap` (merge each part's colors onto its key ramp), aligns all frames on the anchor and
   writes `src/art/<name>.png` + `.json`, plus previews in `e2e/out/art/`. It rejects off-grid
   art, more than 2 % of pixels far from the palette, overlapping keys and art that doesn't fit
   the frame. `--check a.png …` analyzes candidates without writing (`--preview out.png` shows
   original vs snapped).

3. **Register**: nothing to do (`src/render/art/sheets.ts` loads every manifest in `src/art/` by
   its `kind`). A sheet takes over the procedural sprite of the same name; the old one stays
   reachable as `name:old`, with `?art=old` in the URL, or the debug panel's **Art** / **Compare**
   buttons (backtick key). Hooks that only exist for imported art (the renderer falls back to its
   own drawing without them): `emote:*`, `amb:*` critters, `bot:*` bumblebots, `fx:*`, `ui:*`
   nine-slice skin frames (`src/ui/skin.ts`), `tb:/tw:/tt:/td:` terrain tiles.

### Terrain: the dual grid

The ground is drawn from `src/art/terrain.json` on a dual grid: one 16 px tile per map-grid
vertex, centered on it, chosen from the classes of the four tiles that meet there (Wang corner
mask NW 8, NE 4, SW 2, SE 1 = upper class). Wang classes: `grass dirt path sand water deep soil
wet`; tilled soil is part of the ground (`soil`, watered `wet`) and chunks rebake when it changes.
A pair without a set gives way to a hard edge, so every pair that meets on the map needs a set.
Per-tile classes (`planks cliff cliff_top cliff_base rock ore0-7 minefloor0-2 minewall0-2 lava
woodfloor wall wall_upper wall_top`) are drawn over the grid. Decals (`grass`, `grass@3` …) are
scattered on tiles whose 8 neighbors share the class. Seasons are recolor maps that touch only the
grass colors. The pure rules are in `src/render/art/match.ts` (tested in `tests/art.test.ts`).

### Animation is not optional

Anything that moves in the game ships with real frames: belts (4, the surface travels),
machines while working (2-4), generators, bumblebots, walk cycles, tool swings (`<kind>0` raise,
`<kind>1` strike per tool in the player sheet), creatures, critters. Consecutive frames keep the
same ground line and silhouette center so nothing jitters. Renderer effects that stay code:
shadows, particles, smoke, water shimmer, progress pips, wires.

4. **Prove it**: screenshot old and new side by side, run `npm run screens`, then the critic.

## Readability checks (reject if any fails)

- The silhouette reads at 1× against grass, soil and a wooden floor.
- Crops: every growth stage distinct from the one before at a glance; ripe has a sparkle or glow.
- Items on belts read at 10 × 10.
- No pixel of the sheet off the palette, no semi-transparent pixel, no stray single pixels.
- Same outline weight, light direction and shading depth as the sheets already in the game.
  Consistency beats beauty: a gorgeous sprite in a different style is a reject.
