# Progress

## Done
- Phase 1: scaffold (Vite + TS + Vitest + Playwright), PLAN/DECISIONS/PROGRESS.
- Phase 2: engine core: fixed-timestep loop, input with rebindable keys, 32-color palette, bitmap font,
  sprite atlas, camera, immediate-mode UI kit, title / new game / load / settings screens.
- Phase 3: world gen (farm, town, river, lake, ocean, forest, pond, mountains, mine entrance, quarry with
  ore veins), world-continuous procedural ground painting, chunk baking, culling, y-sorting, minimap.
- Phase 4: items (~400), inventory + 12-slot hotbar, tools x5 tiers, weapons, drops with magnet pickup,
  particles, energy, health.
- Phase 5: time (10-min steps, 4x28-day seasons, years), day/night lighting, sleep / pass out,
  weather (sun, rain, storm, snow, wind) with effects, versioned save/load + autosave + export/import.
- Phase 6: farming: 36 crops, watering, fertilizers, quality, regrowth, giant crops, fruit/wild trees,
  sprinklers, mist towers, greenhouse (restoration reward), crows + scarecrows.
- Phase 7: economy: shipping crates, dynamic market (saturation, weekly demand, daily drift), 9 shops,
  tool upgrades, geodes, building kits; hand crafting menu with categories.
- Phase 8: 20+ machine types with real recipes, fuel, power, recipe locking.
- Phase 9: 2-lane belts x3 tiers, curves, side-loading, underground belts, splitters; 5 arm types;
  build mode with ghost preview, drag placing, rotation, pipette, deconstruct area.
- Phase 10: power grids (water wheel, windmill, steam engine, sun lens, batteries, 3 pole types),
  satisfaction slowdown, grid graphs; harvest cranes, seed sowers, ore drills, spigots, fish traps.
- Phase 11: research tree (60 nodes, 5 bundle tiers), study desks, unlock gating, effects.
- Phase 12: production stats with 3 resolutions + graphs, blueprints copy/paste/rotate with ghosts,
  bee crates (outbox / request / storage) + bumblebot drones (logistics + construction).
- Phase 13: 13 NPCs (subagent-written content) with schedules + A* pathing, dialogue, gifts, hearts,
  4 heart events each with choices; door-based shops with hours.
- Phase 14: coops/barns (3 tiers), 8 animals, hay/silo, happiness, products.
- Phase 15: fishing (tension-reel minigame), 33 fish incl. legendaries + trap catches.
- Phase 16: 60 mine floors (3 themes), ores, gems, ladders/shafts, elevators, 8 monsters, combat.
- Phase 17: 4 festivals with minigames + token stall, tutorial/story quests, daily requests,
  restoration board (16 projects), 3 megaprojects, museum, collections, mail.
- Phase 18: procedural SFX (~50), ambience (rain, wind, birds, crickets, machine hum), generative music.
- Phase 19 (polish + balance): scripted pacing bot (Vitest, 3 weeks) and in-browser bot (14 days),
  perf bench (1320 belts / 260 machines / 5k items: 0.2ms tick, 6.4ms frame), README, debug panel,
  achievements (33 feats), NPC portraits with moods, ambient life (butterflies, birds, fish, falling
  trees), festival bunting, mailbox flag, live town clock, cave wall shading, onboarding tips.
- Phase 20 (home): walk-in farmhouse interior (bed, hearth, almanac, kitchen stove, shelves, rug,
  windows that follow day/night and season, ticking clock). You sleep in the bed and wake up inside.
  The almanac gives tomorrow's forecast, this week's market demand, birthdays and festivals.
  The carpenter sells 4 renovations: Kitchen (instant cooking from your bag), Root Cellar (36-slot
  pantry the kitchen cooks from), Featherbed (late nights cost less), Grand Hearth (+40 energy).
  Indoor lighting, muffled rain and fireplace crackle, and quieter "home" music.
- Food buffs: 7 kinds x 3 levels from 23 foods (speed, stamina, fishing, mining, luck, defense,
  farming), shown as a HUD badge with time left and on item tooltips.
- Farm pet: on day 3 a stray cat or dog (4 coats each) turns up and Marigold writes about it.
  Right-click to adopt and name it. It wanders the yard, follows you once it trusts you, heads
  inside at night or in bad weather and sleeps on the rug. It has a water bowl for the watering
  can, petting, 5 hearts, and morning gifts at 3+ hearts. Synthesized meow and bark.
- Trading Guild contracts: unlocked by researching arms (a letter brings a Freight Depot). Three
  bulk orders every Monday from a 27-contract pool in 3 tiers. Deliver by hand or by arm. They pay
  1.5x value without saturating the market, and build reputation through 6 ranks (+3% shipping
  each). Shown in the depot panel and the journal. 4 new feats.
- Tests: 46 Vitest tests (belts, arms, machines, power, time, crops, economy, crafting, NPCs, mine,
  save, house, pacing). E2E: smoke, flow (real input incl. the bed), windows (32 scenes), shots, bot,
  perf, qa, portraits, house. All report 0 console errors.

## Next
- More interior variety (decor items placeable indoors), farmhouse expansion tiers.
- More depth for mid-game automation goals and late-game megaprojects.

## Known issues
- Bumblebots in flight during a manual mid-day save return to their hive on load.
- Trees and big structures don't block NPC paths that were cached before placement (cache clears periodically).
- The simple pacing bot stalls its income in week 2 (it hoards crops for bundles); real play earns more.
