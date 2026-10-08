# Sprocket & Sprout — Plan

An original top-down pixel-art farming + automation game for the browser.
You arrive in the valley town of **Thistlewick** to take over an overgrown
plot at the edge of town. You farm by hand at first, then with the help of the
town tinkerer you research clockwork arms, belts, mills and little brass
"bumblebots", until the farm hums like a cozy, steam-puffing music box.

Tone: warm, rustic, steampunk-cozy. Wood, brass, copper, painted tin, puffs of
steam, little gears. Never cold industrial gray.

## Tech

| Concern | Choice |
|---|---|
| Language / build | TypeScript (strict) + Vite |
| Rendering | HTML5 Canvas 2D, single canvas, `imageSmoothingEnabled = false` |
| Art | 100% procedural / code-drawn pixel art from a fixed 32-color palette |
| Text | Hand-defined bitmap pixel font, pre-rendered to tinted glyph atlases |
| UI | Immediate-mode UI drawn on canvas (panels, slots, buttons, tooltips) |
| Audio | Web Audio API: procedural SFX + generative ambient music |
| Simulation | Fixed timestep (60 ticks/s) decoupled from rendering (rAF) |
| Architecture | Component stores + systems ("entity/system"), pure sim with no DOM |
| Content | Typed data files in `src/data/` (items, crops, recipes, machines, NPCs, research, fish, ...) |
| Persistence | localStorage autosave + manual slots, versioned migrations, JSON export/import |
| Tests | Vitest (sim), Playwright + headless Chromium (screenshots, console checks, bot playthrough) |

## Architecture overview

```
           ┌────────────── main.ts (bootstrap) ──────────────┐
           │                                                  │
   engine/loop.ts  ── fixed 60Hz tick ──► sim/Game.tick()     │
           │                               │ systems in order │
           │                               ▼                  │
           │   time → weather → player → farming → animals →  │
           │   belts → inserters → machines → power → drones  │
           │   → npcs → economy → stats → quests              │
           │                                                  │
           └── rAF ──► render/Renderer.draw(game, alpha) ─────┘
                         chunks → soil/crops → belts/items →
                         y-sorted sprites → particles → weather →
                         lighting → UI (ui/*) → cursor
```

* **`sim/` is pure**: no DOM, no canvas, no audio. It can be unit-tested and
  run headless. Side effects meant for presentation (sounds, particles, toasts,
  screen shake) are emitted as events on `game.events` (a queue drained by the
  presentation layer each frame).
* **Component stores**: placed structures are entities (`EntityId` numbers).
  Components live in typed `Map`s on `World` (`structure`, `belt`, `inserter`,
  `machine`, `inventory`, `power`, `harvester`, `drone`, ...). A spatial index
  (`Int32Array` per tile) maps tiles → entity for O(1) lookup. Systems iterate
  only the stores they care about.
* **Belts as lanes**: each belt tile has two lanes; each lane is a short array
  of items with positions in [0, length). Items advance with a min spacing and
  hand off to the next segment. Update order is downstream-first (computed on
  topology change), so compressed belts stay compressed. Underground belts are
  long segments; splitters alternate outputs per lane; side-loading inserts
  into the near lane mid-tile.
* **Power**: generators (water wheel, windmill, steam engine, later solar
  "sun-lens") and consumers join networks formed by power poles (union-find,
  rebuilt on topology change). Each tick: satisfaction = min(1, supply/demand),
  and powered machines run at `speed × satisfaction`.
* **Machines**: recipes are data; a machine owns input/output buffers, a
  current recipe (auto-chosen from inputs or locked by the player), progress,
  and optional fuel. Inserters ask the machine whether it accepts an item.
* **Data-driven content**: every content type is a typed record in
  `src/data/`. A validation test asserts all cross-references are valid.
* **Rendering**: static ground + flat decoration baked into 32×32-tile chunk
  canvases (rebuilt when dirty). Dynamic things are culled to the viewport and
  y-sorted. Lighting is a low-res darkness buffer with light holes.
* **Saves**: the overworld terrain is regenerated from its seed; saves store
  only deltas (objects, soil, structures, inventories, NPC state ...).
  `SAVE_VERSION` + an ordered list of migrations.

## Folder structure

```
src/
  main.ts                 bootstrap, wires engine + game + renderer + UI
  engine/                 loop, input/keybinds, rng, math, events, audio
    audio/                sfx.ts (procedural), music.ts (generative)
  data/                   typed content: palette, items, crops, trees,
                          recipes, machines, research, npcs, dialogue, fish,
                          animals, monsters, festivals, quests, shops, ...
  sim/                    pure simulation
    Game.ts               GameState + ordered systems + events
    world/                tilemap, worldgen, mine floors, pathfinding
    systems/              time, weather, farming, belts, inserters,
                          machines, power, drones, npcs, animals, fishing,
                          mining, combat, economy, research, quests, stats
    inventory.ts, items.ts, blueprint.ts, save.ts
  render/                 canvas renderer, sprite generators, atlas, chunks,
                          lighting, particles, weather fx
    art/                  pixel-art generators (tiles, items, chars, machines)
  ui/                     immediate-mode UI kit, font, screens & windows
tests/                    vitest unit tests (sim)
e2e/                      playwright scripts (screenshots, bot playthrough)
```

## Milestones (phases)

Each phase ends with: `npm run build` + `tsc --noEmit` clean, Vitest green,
Playwright screenshots inspected + console clean, PROGRESS.md updated, commit.

1. **Scaffold** — Vite + TS + Vitest + Playwright, PLAN/DECISIONS/PROGRESS, git.
2. **Engine core** — fixed-timestep loop, input + rebindable keybinds, palette,
   bitmap font, sprite atlas, camera (smooth follow + zoom), IMGUI kit, main menu.
3. **World** — overworld generation (farm, town, river/lake/ocean, forest,
   mountain + mine entrance, quarry), procedural decoration, chunked
   rendering + culling, collision, player movement/animation, minimap.
4. **Items & tools** — item registry, inventory grid + hotbar, tools with
   tiers (hoe, can, axe, pickaxe, scythe, rod, sword), chopping/mining/tilling,
   drops with pickup animation, particles, energy.
5. **Time & weather** — clock, days, 4×28-day seasons, years, night lighting,
   sleep / pass out at 2am, sun/rain/storm/snow, save/load + autosave + migrations.
6. **Farming** — 30+ crops, watering, fertilizer, quality tiers, regrowth,
   giant crops, fruit trees, sprinklers, greenhouse, season death.
7. **Economy & crafting** — shipping bin, dynamic market, general store,
   hand-crafting menu, chests, money flow.
8. **Processing machines** — keg, preserves jar, mill, smelter, oven, loom,
   sawmill, bottler, press, seed maker... with real recipes/timings.
9. **Belts & arms** — 2-lane belts × 3 tiers, curves, side-loading/merging,
   underground belts, splitters; inserters (clockwork, fast, filter, long);
   build mode with ghost preview, rotation, drag-place, deconstruct.
10. **Power** — water wheel, windmill, steam engine, poles, networks, grid stats;
    brown-out slowdown. Auto harvesters, planters, sprinkler grids, ore drills.
11. **Research** — 40+ node tree, labs, research bundles, gating of tiers.
12. **Factory tools** — production stats with graphs, blueprints (copy, paste,
    rotate), bulk deconstruct, logistics chests, bumblebot drones.
13. **Town & NPCs** — 12 NPCs with schedules + A* pathing, dialogue by
    season/weather/hearts, gifts, heart events; blacksmith, carpenter, shops.
14. **Animals** — coop + barn tiers, 7 animals, feeding, happiness, products.
15. **Fishing** — tension-reel minigame, 24+ fish by location/season/time, fish traps.
16. **Mining** — 60 procedural floors, ores, gems, monsters, combat, health, elevator.
17. **Festivals, quests & goals** — 4 festivals with activities, town requests,
    quest log, restoration board, megaprojects, collection log.
18. **Audio** — procedural SFX, generative seasonal/day-night music.
19. **Tutorial & UX** — guided first week, pause/settings (volume, keybinds,
    UI scale), tooltips everywhere, juice pass.
20. **Polish & balance** — debug panel (`), bot playthrough of 2 weeks,
    pacing/economy tuning, perf test (1000+ belts, 200+ machines), README.
