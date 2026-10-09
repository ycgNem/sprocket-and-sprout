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

- [ ] Write `STYLE.md`: tile size, character proportions (height in px, head ratio),
      the Resurrect 64 palette written into `src/data/palette.ts` (old `C` names
      aliased to their nearest color), outline rule (dark outline? selective?),
      shadow rule, light direction, what "warm brass, never gray" means in hex.
- [ ] Add PNG sprite loading to the atlas: `defImageSprite(name, url, frames…)` next to
      `defSprite`, with the same `Sprite` shape so the renderer is unchanged. Sheets live in
      `public/art/` (or `src/art/` imported by Vite) and are bundled into `dist/`.
- [ ] Add the import step: a script that takes a PixelLab PNG, quantizes it to the chosen
      palette, checks the pixel grid and writes it into the sheet (`scripts/art-import.mjs`).
- [ ] Prove it with ONE asset from PixelLab: the player, 4-direction walk, driven by the
      existing look system as far as that still makes sense (hair/shirt tints can be
      palette swaps on the sheet).
- [ ] Show old and new side by side in the game; screenshot both.
- [ ] Create the `art-director` agent (stub exists) and give it `STYLE.md`.

Done when: the owner looks at two screenshots and picks one, and `npm run build` still
produces a working `dist/`.

### Phase 2 — Full art replacement by screen time (5–8 sessions)

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
| `qa-screens` agent | Runs `npm run screens`, reports overlaps and visual regressions | stub, Phase 0 |
| `art-director` agent | Owns `STYLE.md`; generates with PixelLab; quantizes, imports, rejects off-style assets | stub, Phase 1 |
| `references/` folder | Owner's taste notes, palettes, mood boards, screenshots of admired games; agents consult it loosely | exists: Resurrect 64 (chosen), TanoPal 48, 4 game screenshots |
| PixelLab (MCP) | Characters with 4/8-direction animation, tilesets, item icons | connected |
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
