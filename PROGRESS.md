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
- Cookbook: 7 starter recipes. 15 more are taught by 10 villagers at heart milestones (sent as
  letters with a note) or copied from the Sunday almanac. Unknown recipes show who teaches them.
  Older saves keep every recipe.
- Farm visits: on fine weekend afternoons a villager with 3+ hearts may walk over to your farm.
  Chatting there gives a farm-aware line (your pet, belts, crops, animals, greenhouse, kitchen)
  and bonus friendship.
- Furniture: 15 pieces (armchairs, reading lamp, bookcases, rugs, fish tank, plants, pet bed,
  3 paintings Hazel mails you at 2/4/6 hearts, and a Guild banner at rank 3). Place them inside
  the farmhouse with a ghost preview; furniture can stand on rugs, paintings hang on the wall,
  right-click picks things up. Lamps and the tank give light, the goldfish swim, and your pet
  sleeps in its bed. The journal's Friends tab shows your pet.
- Professions: at skill levels 5 and 10 you pick one of two perks (24 in total). They cover
  price bonuses by category, crop growth, wood and forage, ore, geodes, damage, health, loot,
  catch zone, bite speed, traps, machine and arm speed, and power use. Chosen in a card window
  or later from the Skills tab.
- Quick stack (K): bag items go into nearby chests (or the root cellar indoors) that already
  hold the same item. The hotbar is never touched.
- Mine variety: a grand treasure chest on floors 10/20/30/40/50 (once each, with coins and
  themed loot), occasional small chests, and infested floors (about 10%) with twice the
  monsters, where the ladder only appears after you clear them all. Chests glow in the dark.
- Founder's Day: on Spring 1 of each new year Mayor Tobias reviews the farm on 18 criteria
  (earnings, skills, friendships, automation, restoration, museum, fish, pet, home). The score
  lights up to 4 candles, and each tier unlocks a one-time reward (coins, the Founder's Lantern,
  a +5% shipping medal, the Gilded Clock).
- Partners: give the Brass Locket (festival token stall) to an adult villager at 8+ hearts.
  Your partner makes you breakfast or waters crops most mornings, visits the farm on most fine
  days, and spends evenings by your hearth to chat. Shown in the journal.
- Mags' Traveling Cart: parks by the town square on Fridays and Sundays (8am-7pm) with a weekly
  rotating stock: rare seeds, a sapling, a gem or relic, a recipe card, a cart-only piece of
  furniture (globe, telescope, music box, tapestry), and sometimes a Brass Locket.
- Night events (about 1 night in 9 after the first week): a meteorite of starmetal rocks, a
  crop fairy that ripens a patch, a windstorm that scatters debris, or (in year 1) a coin
  pouch from a secret friend. Shown in a message after the morning summary.
- Fish ponds (Trapcraft research): stock a species by hand or by arm. The school grows to 10,
  lays roe nightly (5 roe make a Roe Jar in a preserves jar) and a crowded pond breeds fish.
- Legendary fish give a mounted wall trophy the first time you catch them.
- Logistics: arm stock limits (fill a chest only up to N of each item) and splitter modes
  (alternate / prefer left / prefer right, or filter one item left and the rest right). All of
  them are saved and copied with blueprints.
- Fixed: fainting in the mine among several monsters no longer crashes the monster loop (found by
  the full-year bot run).
- Fixed: a large XP gain now grants every level it crosses, not just one.
- Fixed titled villagers showing as "Mayor"/"Dr."/"Old" in toasts, quests and the almanac.
- Tests: 60 Vitest tests (+ a LONG=1 full-year run) (belts, arms, machines, power, time, crops, economy, crafting, NPCs, mine,
  save, house, pacing). E2E: smoke, flow (real input incl. the bed), windows (32 scenes), shots, bot,
  perf, qa, portraits, house. All report 0 console errors.

## Identity pass (October 2026, driven by the indie-critic review)
- Clockwork opening: ripe keeper's beans + a working jar by the crate, arms/belts/desk from minute
  one, amber guide markers, new quests (The Keeper's Beans, A Helping Hand, Room to Grow, The
  Study Desk). The post also collects the crate at noon and 6pm. First automated sale: about 4 minutes in.
- Game modes (Story, Cozy, Clockwork Rush with medals + local best runs, Sandbox) and five farm
  maps (Homestead, Riverside, Tinker's Yard, Highlands, Wildwood), picked on a second new-game
  step with a live map preview. Saves store mode + map.
- About 120 achievements (about 35 secret) with a U window, an unlock banner, 250-coin rewards for
  secrets and a cross-save profile. Hooks: walking, belt riding (belts now carry the player), the
  Konami code, poking the sun or moon in the sky window, spinning the hotbar gears, and more.
- HUD rework: sky-window chronometer (weather, stars, an underground view in the mine), rolling
  odometer with +/- deltas, factory pulse lamps, gear hotbar with tube gauges, build toolbar,
  3-quest tracker with pips, at most 3 toasts, one tip at a time, pixel CSS cursor (with a setting).
- Clock at 1/4 speed while building; passing out costs the morning, not coins.
- Readable research tree (named nodes, state colours, tier headers, costs).
- Economy: new artisan multipliers, animal prices, XP curve and tool costs. Sunflower, sweetcane,
  tea and gear fixes. Market floor 40%. Cranes cap at silver with no XP and leave chaff. Flax -> fiber;
  3-crop bundles.
- Saves on tab hide/close, persistent-storage request, confirm before overwriting a full slot list.
- Out-of-reach clicks show a red outline instead of acting on another tile.
- Belt chevrons, warm brick furnaces, a brass and copper farmhouse.
- Sharing: `Package for web.bat` builds + zips for itch.io, a GitHub Pages workflow, and SHARING.md.
- Tests: 77 Vitest tests (new: tests/modes.test.ts for maps, modes, time dilation, bag loading, the post and achievements) +
  LONG=1 year run. E2E smoke/flow updated for the two-step new-game screen; all report 0 console errors.

## 1.0 release and overhaul Phase 0 (October 8-9, 2026)
- Published: public repo https://github.com/ycgNem/sprocket-and-sprout, GitHub Pages live at
  https://ycgnem.github.io/sprocket-and-sprout/ (deploys on every push), v1.0.0 release with the
  Windows Setup and Portable .exe.
- Planning for the 1.1 visual overhaul: `ROADMAP.md` (owner decisions: full art replacement,
  Resurrect 64 palette, features over polish), `references/` (taste notes, palettes, admired-game
  screenshots kept local), `art-director` and `qa-screens` agents, PixelLab MCP connected.
- jsfxr sound bank (`src/engine/audio/sfxr.ts`): designed SFX override the synthesized ones by id;
  3 placeholder sounds seeded.
- Phase 0 fixes:
  - The player sprite no longer flips back to the default look (sprite cache flushed on change).
  - Belt items are crisp 10x10 icons on the pixel grid, centered on the real lanes.
  - Title: the gear ornament no longer sits on "Sprocket"; a plate keeps the logo readable.
  - No sprite is drawn at a fractional scale any more (`drawFit`, `drawItemIcon`), except the
    rotated tool swing.
  - `npm run screens`: 43-screen Playwright sweep with an automatic UI overlap audit
    (`src/ui/audit.ts`). It found 309 issues; all fixed: toasts and the achievement banner wait
    for modal windows to close, the HUD hides under modal windows, the controls help shows real
    key names, long texts are shortened to fit.
- Tests: 85 Vitest tests (new: `tests/audit.test.ts`). Smoke and the sweep report 0 console errors.

## Overhaul Phases 1-2: the art is replaced (October 9, 2026)
- Phase 1: `STYLE.md`, Resurrect 64, PNG sheets in the atlas, `scripts/art-import.mjs`, a PixelLab
  player with walk and hoe swing.
- Phase 2, in one session with 11 parallel `art-director` agents and ~1,100 PixelLab generations:
  every sprite the game draws now comes from imported art (6,415 names, `node e2e/coverage.mjs`).
  - Pipeline: `kind: "sprites"` and `kind: "terrain"` sheets (`scripts/sprites-import.mjs`,
    `scripts/terrain-import.mjs`), `src/render/art/match.ts` (tested), `art/README.md` handbook,
    helper scripts (`pl-fetch`, `contact`, `e2e/sprites.mjs`, `e2e/coverage.mjs`).
  - Terrain on a dual grid of Wang tiles with seasons, decals and animated water; tilled soil is
    part of the ground. Crops (37, all stages, ripe twinkle), trees, map objects, 20 buildings with
    night windows and snow, animated belts and machines with bumblebots, 14 villagers with
    portraits, the player with every tool swing in hand and 10 hair styles, animals, pets,
    monsters, furniture, 533 item icons, a nine-slice UI skin, small FX.
  - Renderer: shadows under trees, structures and solid ground objects; the camera snaps to world
    pixels (no more player shimmer); chimney smoke from each machine's real chimney; 16-step
    belt treads; map and minimap in the new colors; darker text where the new peach panels made it
    hard to read; deeper storm light.
  - The procedural art stays as the fallback (`?art=old`, `name:old`).
- Tests: 94 Vitest tests (new: `tests/art.test.ts`). `npm run screens`: 43 shots, 0 issues.

## Overhaul Phases 3-4 and the 1.1.0 release (October 9, 2026)
- Phase 3: the juice layer, key bubbles, the reworked first session, the post courier, the
  sprocket wordmark (ROADMAP.md, Phase 3).
- Phase 4: a code review and a full critic review, their fixes, version 1.1.0, Windows builds and
  a GitHub release (ROADMAP.md, Phase 4).
- New villager: Roxy Vane and her airship on Skyhook Field (the owner's request; DECISIONS #47).

## Next
- The open items at the end of ROADMAP.md Phase 4 (arm redraw first) and the deferred critic
  list in HANDOFF.md.
- Older ideas: more interior variety (decor items placeable indoors), farmhouse expansion tiers;
  more depth for mid-game automation goals and late-game megaprojects.

## Known issues
- Bumblebots in flight during a manual mid-day save return to their hive on load.
- Trees and big structures don't block NPC paths that were cached before placement (cache clears periodically).
- The simple pacing bot stalls its income in week 2 (it hoards crops for bundles); real play earns more.
