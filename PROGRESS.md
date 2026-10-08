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
- Tests: 32 Vitest tests (belts, arms, machines, power, time, crops, economy, crafting, NPCs, mine, save).

## Next
- Scripted bot playthrough of the first 2 weeks (pacing), balance pass.
- Perf measurement with the 1000-belt / 200-machine debug scene.
- Visual polish: mine walls, festival decorations, mailbox flag, more animations.
- README.

## Known issues
- Bumblebots in flight during a manual mid-day save return to their hive on load.
- Trees and big structures don't block NPC paths that were cached before placement (cache clears periodically).
