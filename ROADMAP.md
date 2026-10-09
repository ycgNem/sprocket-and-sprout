# Sprocket & Sprout — Roadmap (visual overhaul, 1.0 → 1.1)

Written 2026-10-08, after the 1.0 release went live at
https://ycgnem.github.io/sprocket-and-sprout/ (Windows builds on GitHub Releases).
`PLAN.md` is the original 20-phase design plan and `PROGRESS.md` is what's built.
This file is the plan for what comes next: fix the base, replace the art, add juice.

Work one phase per session. Start every session with "Read ROADMAP.md", end it with
the `indie-critic` agent, a commit, and a push (the live site redeploys itself).

**Owner's priority (2026-10-09): features and visible improvements over polish.** Phase 0
is done; don't sink sessions into minor bug fixing. Fix only what is game-breaking or
clearly visible, and spend the time on Phases 1–3. `npm run screens` catches layout
regressions cheaply, so run it instead of hunting by hand.

## Where we are

The game is complete and playable, but it looks bland. Root cause: every sprite is
drawn procedurally from a 32-color palette (`src/render/art/`, ~5,000 lines). That gives
uniform tiles, flat lighting, no hand-placed highlights and crops that read as sad.
The sim, the content and the test rig are solid; the art and the feedback are the gap.

### Bugs reported 2026-10-08 (all fixed in Phase 0)

| Bug | Cause | Fix |
|---|---|---|
| Character look reverts to the default | Sprites are cached by name; `setPlayerLook` updated the look but not the cached `ch:player:*` frames drawn on the title screen | `setPlayerLook` flushes them (`invalidateSpritePrefix`) |
| Belt items out of line | 16×16 icons squeezed to 10×10 at lane offsets that missed the belt surface | `ib:` 10×10 belt icons drawn 1:1, lanes at the surface's real centers |
| "Sprocket" overlapped on the title | The spinning gear ornament sat on the letters; the demo farm drifts under the logo | Gear placed from the measured word width; soft plate behind the logo |
| Overlapping text in windows | Toasts and the achievement banner under/over windows, HUD peeking around windows, raw key codes in the controls help, long lines | See Phase 0; `npm run screens` now reports 0 issues on 43 screens |

## Design principle for the overhaul

**Dopaminergic but cozy = small, frequent rewards with soft presentation.**
Every action gets feedback within ~100 ms (sound + particle + motion). Rewards escalate
(harvest streaks, night tally that counts up). The palette stays warm, motion eases
instead of snapping, nothing reads as an alarm. References: Stardew Valley for warmth,
Forager for reward density, Sun Haven for crop readability.

Hard rules from here on:
- Everything on an integer pixel grid. No non-integer sprite scaling, ever.
- One tile is 16 px (`TILE` in `src/render/art/terrain.ts`). Characters are drawn at a
  consistent height. Record the exact numbers in `STYLE.md` (Phase 1).
- Shadows under every object that stands on the ground.
- New art goes through the atlas (`src/render/atlas.ts`) like the procedural art, so the
  renderer doesn't care where a sprite came from.

## Decisions (owner, 2026-10-08)

1. **Palette: Resurrect 64** (48 colors minimum was the owner's rule; the owner asked for
   something warmer than TanoPal 48 and left the pick to Claude). Resurrect 64 by Kerrie
   Lake (https://lospec.com/palette-list/resurrect-64) has long warm ramps for wood,
   brass, skin and foliage, muted greens and a plum-black instead of pure black, which
   fits "warm brass, never gray". Files: `references/palettes/resurrect-64.hex` and
   `resurrect-64-1x.png`. Hex values, in Lospec order:
   `#2e222f #3e3546 #625565 #966c6c #ab947a #694f62 #7f708a #9babb2`
   `#c7dcd0 #ffffff #6e2727 #b33831 #ea4f36 #f57d4a #ae2334 #e83b3b`
   `#fb6b1d #f79617 #f9c22b #7a3045 #9e4539 #cd683d #e6904e #fbb954`
   `#4c3e24 #676633 #a2a947 #d5e04b #fbff86 #165a4c #239063 #1ebc73`
   `#91db69 #cddf6c #313638 #374e4a #547e64 #92a984 #b2ba90 #0b5e65`
   `#0b8a8f #0eaf9b #30e1b9 #8ff8e2 #323353 #484a77 #4d65b4 #4d9be6`
   `#8fd3ff #45293f #6b3e75 #905ea9 #a884f3 #eaaded #753c54 #a24b6f`
   `#cf657f #ed8099 #831c5d #c32454 #f04f78 #f68181 #fca790 #fdcbb0`
   Phase 1 writes it into `src/data/palette.ts` (the old 32 `C` enum names become aliases
   to their nearest Resurrect color until the procedural art is gone). Small additions
   are allowed if a test sprite proves a gap, but the palette never drops below 48.
   TanoPal 48 (`references/palettes/tanopal-48-1x.png`) stays as a reference only: too
   saturated for the base (neon yellow `#f0ff00`, electric greens), but a source for a
   rare accent such as a ripe-crop sparkle.
2. **Scope: full replacement.** Every sprite the game draws gets replaced with imported
   pixel art: terrain, crops, characters, objects, structures, UI icons. The procedural
   generators in `src/render/art/` stay only as fallbacks until their replacements land,
   then get deleted. Expect Phase 2 to take more sessions than a hybrid would.

## Phases

### Phase 0 — Clean base (1 session)

No new art. Make the current game pixel-correct and overlap-free first.

**Done 2026-10-09.**

- [x] Character look reverting: cache flush on look change; the save round-trip test now
      checks the whole look.
- [x] Belt items: `ib:` belt icons (fill halved 2:1, edge-shaded, re-outlined), 1:1 on
      whole pixels, centered on the lanes.
- [x] Title: gear moved off the letters, backing plate behind the logo.
- [x] Integer-grid rule: `drawFit` and `drawItemIcon` in `src/render/atlas.ts`; every
      fractionally scaled `drawImage` routed through them. One exception left: the
      rotated tool swing (`renderer.ts`, `drawToolSwing` area) needs drawn frames (Phase 2).
- [x] `npm run screens`: 43 scripted screens/windows, one PNG each in `e2e/out/screens/`,
      `report.md`, boxed `<name>.issues.png`; previous run in `screens-prev/`. The overlap
      audit lives in `src/ui/audit.ts` (unit-tested in `tests/audit.test.ts`); the UI
      records draws only while `ui.audit` is on.
- [x] Fixed everything it found: 309 flagged → 0. Toasts and the achievement banner wait
      while a modal window is open, the HUD is hidden under modal windows, controls help
      uses real key names, long texts are shortened (`ellipsize` in `src/ui/font.ts`).
- [x] `qa-screens` agent updated to run the sweep.
- [ ] Not done: the critic agent pass (skipped at the owner's request to move on).

Not covered by the sweep yet: festivals other than the kite/skate minigames, the
evaluation and rush result screens, the cooking/adopt/elevator windows, dialogue.

### Phase 1 — Style bible and art pipeline spike (1 session)

**Done 2026-10-09, waiting for the owner's pick** (see "Owner's call" below).

- [x] `STYLE.md`: 16 px tiles; adult characters 28–31 px tall in 40×40 frames, head ≈ 0.4 of
      the height; Resurrect 64 in `src/data/palette.ts` (the old `C` names are aliases picked by
      CIEDE2000 and adjusted by hand: no shared colors, every DARK/LIGHT step still darker/lighter;
      saves migrate to v3); `#2e222f` outline, selective on big objects; light from the upper
      left; renderer-drawn shadows; material ramps and "warm brass, never gray" in hex.
- [x] PNG sprites in the atlas: `defImageSprite` / `defImageFamily` in `src/render/atlas.ts`
      (same `Sprite` shape; mirrored frames and palette recolors at load). Sheets are
      `src/art/*.png` + `.json`, picked up by `src/render/art/sheets.ts` and hashed into `dist/`.
      The procedural art stays reachable: `name:old`, `?art=old`, debug panel **Art** button.
- [x] `scripts/art-import.mjs`: undoes upscaling, checks the grid, thresholds alpha, snaps to the
      palette (CIEDE2000, lightness at half weight so hues survive), maps each look part's source
      colors onto its key ramp (`parts`), aligns frames on the feet, writes sheet + manifest +
      previews (`--check … --preview` vets candidates). `scripts/pixellab.mjs` calls the PixelLab
      MCP tools from a script; `scripts/lib/png.mjs` is a dependency-free PNG codec.
- [x] The player from PixelLab (v3, size 32): 4 directions × 4-frame walk, a standing pose
      (new frame 6) and a hoe swing that replaces the rotated tool icon for hoe and pickaxe.
      Skin, hair, shirt and pants recolor through the look system; hair styles `short` and
      `spiky` use the sheet, the other 8 keep the procedural sprite until their variants exist.
- [x] Side by side in the game: debug panel **Compare** draws the 1.0 player and the candidate
      sheets next to the player, same frame. `node e2e/artcompare.mjs` writes
      `e2e/out/art-compare/lineup.png` (4 directions, walk, hoe swing), `new.png`, `old.png`.
- [x] `art-director` agent rewritten around `STYLE.md`, PixelLab and the import pipeline.
- [x] `npm run build` works (the sheet is a 7 KB PNG), 86 tests pass, `npm run screens`: 43
      shots, 0 issues.
- [ ] Not done: the critic agent pass.

**Owner's call:** pick the player look from `e2e/out/art-compare/lineup.png`: **C32** (v3, in the
game now), **P32** (pro mode, softer) or **B28** (standard, slimmer), or keep 1.0. Then delete the
two losing `art/player/candidate-*.json` recipes and their `src/art/candidate-*` sheets.

Learned (details in `STYLE.md` and the art-director agent): PixelLab's `size` is the character's
height; it ignores palettes, so the import does the color work; template walks re-render the
character in slightly different colors, so each part's source colors must be listed per
animation.

**Phase 2 head start, terrain:** three chained 16 px Wang tilesets (grass↔tilled soil,
grass↔path, grass↔water; `art/terrain/`, PixelLab ids in the `.meta.json` files) and a PixelLab
map "Sprocket farm preview" (`06217953-c0fe-4b08-a8bd-8861c352fdfc`) painted with them. The
transitions are good; the grass is a neon lime that snaps to a pale green, it is one repeated
tile, and the water is flat. Next session: prompt for muted Resurrect greens, generate variants
(`create_tiles_pro`), add a `tileset` sheet kind and teach the chunk painter Wang corners.

### Phase 2 — Full art replacement by screen time (5–8 sessions)

**Done 2026-10-09 in one session** (owner asked for it in one go), with 11 `art-director` agents
working in parallel by group and about 1,100 PixelLab generations. `node e2e/coverage.mjs`: every
sprite family the game asks for (6,415 names) has imported art; `npm run screens`: 43 shots,
0 issues, 0 console errors.

- [x] Pipeline: `kind: "sprites"` sheets (any sprite by name or `*`/`**` pattern, `recolor` for
      seasons/tiers) via `scripts/sprites-import.mjs`; `kind: "terrain"` via
      `scripts/terrain-import.mjs`; helpers `pl-fetch.mjs`, `contact.mjs`, `e2e/sprites.mjs`,
      `e2e/coverage.mjs`; handbook `art/README.md`. Pure lookup rules in `src/render/art/match.ts`
      (tested). Sheets load before anything bakes; hooks that exist only for imported art wait for
      their sheet.
- [x] Terrain: dual-grid Wang ground, 14 chained sets (grass, dirt, path, sand, water, deep, dry and
      watered tilled soil), 15 grass variants, 24 per-tile classes (cliffs, planks, mine floors and
      walls, ores, lava, house floor and walls), 69 decals, fall/winter recolors; tilled soil is part
      of the ground (chunks rebake when it changes); open water animates.
- [x] Crops: all 37, every stage, 2-3 ripe takes with a glow, withered, 4 giants, fertilizer.
- [x] Characters: player with every tool swing in hand (the rotated icon is gone for the default
      hair style), 10 hair styles, 13 villagers + Mags, 56 portraits.
- [x] Factory: animated belts/undergrounds/splitters, arm bases and claws, every machine with
      working frames, generators, bumblebots (`bot:*`), chimney smoke from each machine's chimney.
- [x] Trees (14 species × stages × seasons × fruit), all map objects, lamps, notice board.
- [x] Buildings (20 town/farm buildings with night windows, winter snow, seasonal touches),
      coops/barns/silo/well/depot, megaprojects, greenhouse glass, the merchant cart.
- [x] Creatures (8 animals + babies, 4-frame walks; cat and dog in 4 coats; 8 monsters with hidden
      states), farmhouse furniture with fire/pendulum/steam/fish frames, item icons (533 + stars),
      UI skin (nine-slice panels/buttons/slots, `src/ui/skin.ts`), small FX (emotes, butterflies,
      birds, jumping fish, mail, bunting, fireballs).
- [x] Renderer shadows under trees, structures and solid ground objects.
- [x] Every hair style (10) swings every tool (7) with the tool in hand: the rotated-icon swing is
      gone for all imported looks.
- [ ] Not done: a look-driven player portrait (`portrait:player:*` is still procedural), HUD parts
      (gear hotbar, chronometer) and the title logo are still drawn in code, item 7 below (delete the
      procedural generators: they remain the `?art=old` fallback for now).

**Indie-critic review of Phase 2 (2026-10-09):** no Criticals; "in stills, a Stardew-level
upgrade". Fixed in the same session: ore/bar/cloth identity at 16 and 10 px, belt icons outlined
in material shades, 16-step belt treads, a color accent per small machine, taller windmill, no-power
badge and progress bar sprites, ripe twinkle (no more 1 px twitch, baked sparkles removed, leafy
crops get a lit rim), camera snapped to world pixels (player shimmer), derelict greenhouse shows
only its frame, text contrast on the peach panels, 16 px icons in the night tally, darker dry soil,
decals that looked like clickable rocks/twigs removed, storm light, map/minimap colors, the sweep's
farm shots no longer covered by the profession prompt. Still open:
- [ ] NPC walk frames redraw the face each frame: rebuild NPC walks from the stand pose with the
      head rows locked (as `art/creatures/prep.mjs` does); Bram and Wren are 34 px (cap 33).
- [ ] Strike frames: the hoe/pick head turns into a yellow crescent; keep the head visible and add
      a one-frame `#fdcbb0` arc.
- [ ] Water reads flat with canal-like banks, sand on riverbanks makes square blocks: a shallow band
      and animated foam at grass↔water, or layered transitions by class priority in the dual grid.
- [ ] Winter: dirt, sand and dry soil stay summer orange (needs season-keyed bases and sets).
- [ ] Leftover 1.0 parts next to the new art: world map window, minimap void at the map edge,
      chronometer sky dither, title logo, belt build ghost; "flat" buttons read as text fields.
- [ ] A status lamp per machine (working / starved / blocked) fed by the factory pulse.
- [ ] The fishing rod's light-brown highlight shares skin key colors on the player sheets, so a few
      rod pixels take the player's skin tone (a position rule in `art/player/clean.mjs` would fix it).
- [ ] Mine floor swirl repeats; mine walls read as bricks.
- [ ] Bundle: +100 KB gzipped of eagerly bundled manifests; the candidate player sheets still ship.
- [ ] Phase 3 list from the critic: harvest pluck + arc to the player, travelling wind gusts on tall
      grass and canopies, machine completion squash + puff + output pop, belt bounce and hum,
      tool impact stars and real-color soil chunks, a counting night tally, coins flying to the
      odometer, shoreline foam, dust and rustle.

Some art was drawn by rule in scripts instead of generated, where generation can't hold the
constraint: belts (exact lanes, seamless loops), UI nine-slices (must tile), sprites under ~10 px,
poles/fences/paths. See STYLE.md, "What generation can't do well".

In this order, because this is how much of the screen each occupies:

1. Terrain: grass with tufts, flowers and 4–6 variants per tile; dirt-to-grass edge
   transitions (autotile); path and water edges. All generated tiles (full replacement).
2. Crops: every crop, 4–5 visibly distinct stages, a ripe state that sparkles or glows.
   This is the "sad plants" fix.
3. Player and NPCs: all looks, 4 directions, walk + tool-use frames. Portraits if the
   dialogue UI shows them.
4. Belts, items and machines: belt sprites with an animated surface, item icons at the
   belt size, machine idle/working frames, little puffs on completion.
5. Trees, rocks, buildings and furniture.
6. UI icons and the bitmap font pass (check legibility at 1× UI scale). Tool-swing
   frames to replace the rotated icon (the last off-grid draw).
7. Delete the procedural generators in `src/render/art/` that no longer draw anything.

Each session ends with `npm run screens`, the critic agent, a commit and a push.

### Phase 3 — Juice pass (1–2 sessions)

- Harvest: pop + bounce + magnet-to-player; streak counter for consecutive harvests.
- Pickup / sale: coin burst, numbers that float up; night tally counts up with ticks.
- Machines: completion puff and a soft chime; belts hum louder with more throughput.
- Lighting (`src/render/lighting.ts`): golden hour warmth, lantern glow at dusk.
- Ambient life: butterflies, wind on grass, chimney smoke, birds taking off.
- Sound: migrate the most frequent SFX (`pickup`, `click`, `harvest`, `place`, `coin`)
  to designed jsfxr sounds in `src/engine/audio/sfxr.ts`. The pipeline exists: design at
  https://sfxr.me, Serialize, paste the base58 string into `SFXR_BANK`.

### Phase 4 — Review and release 1.1

- `indie-critic` full review; fix the Criticals.
- `/code-review` on the whole 1.0 → 1.1 diff.
- Fix the version label on the title screen (it says v0.9; `package.json` says 1.0.0).
  Bump to 1.1.0 in both places.
- `Build desktop app.bat`, `gh release create v1.1.0 …` as in `SHARING.md`.

## Agents, skills and tools

| Thing | Use | Status |
|---|---|---|
| `indie-critic` agent | Fun, pacing, readability review at the end of each phase | exists |
| `qa-screens` agent | Runs `npm run screens`, reports overlaps and visual regressions | done, Phase 0 |
| `art-director` agent | Owns `STYLE.md`; generates with PixelLab; quantizes, imports, rejects off-style assets | done, Phase 1 |
| `references/` folder | Owner's taste notes, palettes, mood boards, screenshots of admired games; agents consult it loosely | exists: Resurrect 64 (chosen), TanoPal 48, 4 game screenshots |
| PixelLab (MCP) | Characters + animations, Wang tilesets, maps, map objects, building kits, UI assets, fonts, portraits; Tier 1 = 2,000 generations a month | registered at user scope (loads in every session); `scripts/pixellab.mjs` with `PIXELLAB_API_TOKEN` as a fallback |
| ComfyUI (skill) | Concept art and mood boards, not final sprites | available |
| jsfxr | Retro SFX; bank in `src/engine/audio/sfxr.ts` | installed, 3 sounds seeded |
| Aseprite (~$20) | Hand touch-ups when a generated sprite is 90% right | buy when first needed |
| Hooks | Typecheck + tests before every commit | to do, any session |
| `/code-review` | Before merging each phase | available |

## Prompts to start each phase

Phase 0:
> Read ROADMAP.md. Do Phase 0: fix the character look reverting to default, fix belt
> items drawing off the pixel grid, fix the title overlapping the demo windmill. Then
> build the `npm run screens` sweep and use it to list and fix every overlapping text
> or sprite. No new art. Show before/after screenshots and commit each fix separately.

Phase 1:
> Read ROADMAP.md and STYLE.md if it exists. Phase 1 spike: write STYLE.md
> (palette: Resurrect 64; scope: full replacement), add PNG sprite loading to the
> atlas, finish the `art-director` agent, then use PixelLab to make one replacement
> player character with a 4-direction walk. Put old and new side by side in the game
> and screenshot both.

Phase 2 (repeat per item):
> Read ROADMAP.md and STYLE.md. Phase 2, item N: [terrain / crops / …]. Use the
> art-director agent for generation and import. Run `npm run screens`, then the
> indie-critic agent on the result. Commit and push.
