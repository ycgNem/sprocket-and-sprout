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

## 1.2 "The Works", Phases 0 and 1 (October 9, 2026)
- Phase 0 (hotfix 1.1.1, on `main`): the owner's playtest bugs (shift-click, one-shot chests,
  walkable weeds, dampened shake, one name for the Professor, less mail, research tree scrolling
  and Fit, the key bubble avoiding the HUD, crate pop, jar price, 960x600 embed, palette names),
  the overhead pickaxe (C32 look), flagstone paths, plank decks with rails, the seam audit
  (`e2e/seams.mjs`, 165 offenders listed in `e2e/out/seams.md`), painted ground transitions (the
  farming glitch), placed paths that finally change the ground. DECISIONS #49-63.
- The spec: ROADMAP.md 3.1 (the gameplay loop) and 4 (the automation redesign + the Field Works),
  rewritten at the owner's request and approved by the indie-critic after two review rounds.
- Phase 1 (on `works`): the machine contract (`src/data/contract.ts`), six states with one reason
  (`src/sim/mstate.ts`), queued / waiting for harvest, time in state with today and yesterday,
  per-day rates, root-cause glyphs (`src/render/glyphs.ts`), four pulse lamps, the hold-I line
  inspector and the fix ping (`src/app/worksview.ts`), the Production window's Lines tab
  (`src/ui/windows/linetab.ts`) with the diagnosis (`src/sim/lines.ts`, `src/data/advice.ts`),
  power feedback and the three-position grid switch, the winding verb, the night shift and the
  night tally's lines, the Field Works (gleaner, field gantry + rails, the noon rule, quality
  through artisan goods, the streak's quality step, the Dawn Shift and Long Rails research),
  cogbean oil's data. DECISIONS #64-67.
- Tests: `tests/lines.test.ts` (L1-L5, the night shift, the noon rule, the gantry), the contract
  and advice data tests; `e2e/shift.mjs`, `e2e/works.mjs`, `e2e/terrainshots.mjs`, new sweep
  scenarios (research scrolled/Fit, works-lines, works-field, works-pole); `e2e/perf.mjs` times the
  night shift. The pacing bot builds L1 and a gleaner (L3 needs Logistics, which it doesn't reach).
- The indie-critic's Phase 1 build review (PASS WITH FIXES) and its fixes: the wrong input named
  and diagnosed (`portUses`, `wrong:arm` / `wrong:belt`), arms refreshing their reason, the
  gantry parking off season, root-cause pulse lamps, one glyph per line, Lines tab polish, "your
  hands took 3 of the field's 4". DECISIONS #71.
- 1.1.1 round two, released with 1.1.1 (website + v1.1.1 on GitHub, 2026-10-09): the ranch opens,
  square bridges, mine lifts past shafts, the map with names, heads and hovers. DECISIONS #70.
- The owner's direction for everything after: factory first, un-Stardew at a glance (ROADMAP.md
  3.2, DECISIONS #68); no Builderment-style arm-free lines (#69).
## 1.2 "The Works", Phase 2 session 1: the Keeper's Line (October 9, 2026, on `works`)
- The opening re-spec'd against "factory first" (ROADMAP.md 6.0) and the critic's quick read
  (approve with changes) folded in. The owner cut the "Plan the works" direction card: one path
  for everyone (DECISIONS #72).
- A new game opens on the keeper's rusted works: the jar running from the first second, a rusted
  arm, belt run, gleaner and study desk, a clear yard. Rust and Restore: F brings a piece back
  (arms take a mainspring). DECISIONS #73-75.
- The chain B1-B8 replaces both old tutorial chains: B1 the broken line, B2 the Professor's visit
  with two mainsprings, B3 the whole line, B4 the gleaner's bed, B5 the desk and Conveyance's
  three stages, B6 the second jar starving on its own chest, B7 Rowan's pickles (by hand for now),
  B8 copper and Water Power (to be reworked).
- The Now strip (one step and its why), 21 lesson cards, the Keeper's Notebook tab, undo (Ctrl+Z),
  F collects and loads in one press, toasts that keep clear of the left column.
- Tests: 141 (new `tests/keeper.test.ts`: the chain by the bot, the 150-seed B6 starve, wreck the
  yard, rust rules, old saves); smoke 0 errors. Pacing: Story 35.5k, Rush 33.9k (28 days, 8 seeds).

## 1.2 "The Works", Phase 2 session 2: Orders, the river works, the critic's review (October 10, 2026)
- The Orders board (on the square and J -> Orders): standing orders and today's asks, consignment
  through the crate's "Ship to:" tag, reputation per business. B7 is Rowan's weekly pickles (by
  hand or by the post); Bram's oil order pays the bars and two Brass Arms for B8. DECISIONS #77.
- B8 The River Works: the keeper's wheel (worn to 40 sparks), two poles, the grist mill and the
  grain bin by the bridge; a real brownout, and lamps dim in one. k9 More Power follows, toward
  Phase 3's Town Mill. DECISIONS #78.
- Shift+F opens a machine's window; a recipe picked mid-batch takes the next batch; the Skills
  cards (bug 5); crafting labels; the Preserves Jar is the Preserving Crock. DECISIONS #76, #79.
- The pace bot builds its own line before it grows its plot (3.2 rule 5) and waters the beds that
  feed its line. DECISIONS #80.
- A pre-merge review loaded ten real 1.1.1 saves into 2.0 (nothing lost) and its fixes: saves are
  v4, items added after 1.1 go last, a B5 softlock, crate-window deposits counting for B1, the
  mainspring stream. DECISIONS #81.
- The indie-critic's end review: FAIL on day 5 (the works starved: no bean supply after day 4, a
  one-off barley bin). Fixed since: the cellar through day 7, cogbean seeds at the Mercantile,
  barley in spring, the granary, Rowan's barley meal order, k9 "A Second Bed" before More Power,
  a Metalwork step, arms snapping only to the current step's slot, rusted belts, the 35-spark
  wheel. DECISIONS #82. Left (ROADMAP.md Phase 2): the bot planting beans for its crocks, the
  acceptance check (`scripts/accept.ts`), the critic's re-check.
- Tests: 152; sweep 67 shots / 0 issues (before the supply fixes); smoke, flow, shift (185),
  works, windows, perf all pass. Pacing (28 days, 8 seeds, before the supply fixes): Story 42.2k,
  Rush 39.9k.
- Not merged: the owner deferred the 2.0 beta and asked for Phase 3 next.

## 1.2 "The Works", Phases 3 and 4: Orders, eras, the Town Mill, the Deepworks (October 10, 2026)
- Phase 2 finished: the must-fix list, the re-check's supply for days 8-12 (cogbeans every 2 days,
  two gleaner beds, the cellar's taper, More Power sows barley and grinds at full power); the
  acceptance check (days 5-12) passes on seeds 2024, 7, 99 (pickles 52-61% of capacity, no
  zero-income day). DECISIONS #83.
- Research in five era bands with keystone stages (observe, experiment, validate, apply) and era
  rewards in place of the 12 flat-buff nodes; the research window redone. DECISIONS #84.
- One Orders board (Today, Standing, Works), reputation ranks and rank stock, the Guild and the
  restoration projects folded in; save v5 with real-save fixtures. DECISIONS #85.
- Crop numbers from one formula (cotton too), rapeseed, the intermediates (canvas, lubricant, grain,
  straw, starch paste, pigment, spirit) and the thresher. DECISIONS #86.
- The Town Mill end to end (k10: look, grind, validate, Milling, the Works order of 80 meal); the
  town's mill turns, bread in the shops, Rowan's bread order. DECISIONS #87.
- The Deepworks: 30 levels in six strata with hazards, pests and works chambers; the lift restored
  on level 5. The town keystones in the world: the Town Mill, the Waterworks' pump house and
  fountain, the square's 12 lamps on your power, the tram. DECISIONS #88, #89.
- Rush medals 35k / 65k / 100k; the villagers' path cache per world; the critic's Phase 2 Minors
  (build slow-down, Esc, undo, lesson wrapping, units, the summary's order rows, a path into the
  river works, B2's empty crock); a 2.0 title demo. DECISIONS #90-92.
- Built with three parallel agents in worktrees (crops, town keystones, the Deepworks), merged.
- Checks: the bot reaches the Mill by day 20 on 8 of 8 seeds (days 18-20, `scripts/mill20.ts`);
  `data.test.ts` validates every order and keystone; `e2e/minex.mjs` walks all six strata (0
  console errors); the year-long bot restores the lift; the Tram runs on a reloaded game. Tests:
  204 (and the year-long run). Pacing (28 days, 8 seeds): Story 62.9k, Rush 65.5k.
- The critic's end review of Phases 3+4 failed narrowly (the one path ended at k10; the Now strip
  fell back to "Build a Coop"). Its fixes:
  - main quests k11-k17 hand over each era's town keystone (Steam, the Waterworks, Spark Coils,
    Lamplighting, the Tram, the Clock); Harvest Bundles from a crock, a loom and the smelter; Seed
    Sowers in the Water era. DECISIONS #93.
  - a keystone's stages count from its quest; validate shows its rate and clock and a ring over the
    machine; keystone orders go up with their quest and wait for its research; the Town Mill asks
    40 meal and finishes with a camera pan to its wheel, then its card, then the era's. DECISIONS #94.
  - the Works tab without Stardew's crop, fish, forage and gem baskets (old saves paid back); works
    open by era; standing orders wait for their know-how; fillable orders first. DECISIONS #95.
  - goods only a line makes (bread from meal, no shop oil, beams from a sawmill, capped planks and
    brass gears, machines for coins), paste and pigment worth their inputs, the tram carries bars;
    professions renamed. DECISIONS #96. Rush medals 40k / 75k / 110k. DECISIONS #97.
  - the Deepworks: firedamp vents on a clock, lamps set down in the dark, chamber study cards,
    Starfall's shard rings (an agent in a worktree, merged). DECISIONS #98.
  - After the fixes: the bot reaches the Mill on days 15-18 (8 of 8 seeds); a chain-walk test takes
    k11 to k17; tests 222; the sweep is clean at both sizes; `e2e/minex.mjs` and
    `e2e/townworks.mjs` pass. Pacing: Story 65.7k, Rush 66.0k.
- The critic's re-check of Phases 3+4: PASS WITH FIXES (no Criticals; three Majors; the Stardew
  test 1 pass, 2 half, 1 fail on professions). Fixed (DECISIONS #99):
  - the Waterworks' order goes up with k11 (its look is k11's first step), Lamplighting's with k14;
    the Now strip shows the quest's title and step, its ? opens the quest, and the why lines say why.
  - a loaded save no longer replays its first morning's toasts and lesson cards.
  - any oil fills the Waterworks (the crock's cogbean oil counts), so it needn't wait for summer.
  - professions: Tinkering first, 5 XP a machine batch (level 5 around day 12-13, before farming's
    17-18); farming's perks work the field machines and the crock (Field Hand, Long Reach,
    Seedwright, Crock Master), foraging's and mining's each one machine perk (Sawyer, Drill Rigger,
    Furnace Hand), no sell-price perks for them.
  - the Works tab names the places works serve (not Pantry/Workshop/Fields), no room-complete bonus.
  - smaller: Guild contracts wait for know-how; toasts queue; the journal lists the main path first;
    the Crystal is properly dark; the validate ring is a pixel gauge on the machine; a keystone
    finished overnight pans the camera when you step outside; "(now)" in research is the town's era
    and the era banner names the next era.
- The critic's confirmation pass of those fixes: PASS WITH FIXES (the Stardew test 3 pass, 1 half on
  the mine, 0 fail). Fixed (DECISIONS #99):
  - a crate tagged for the Council or the Guild keeps its tag when a business posts a new order (the
    Mill's finish re-tagged a Council crate to the Kettle and its Waterworks goods went to market).
  - each early profession pair is a real choice: Governor (powered machines keep full speed down to
    75% of their demand) against Engineer; Field Hand (every fourth field-machine pick a crop extra)
    against Long Reach.
  - the Earth stratum's placed fix: a cracked ceiling comes down when you walk under it, and 2 planks
    prop it up for good.
  - smaller: the research window opens on the Now step's topic; action feedback jumps the toast
    queue; toasts stack above the hotbar on narrow screens; the compass points at the desk for a
    research step; project descriptions wrap; perk cards have their own pictures.

## Next
- Phase 5 (people, events, HQ) of ROADMAP.md; see HANDOFF.md "What's next".
- Older ideas: more interior variety (decor items placeable indoors), farmhouse expansion tiers;
  more depth for mid-game automation goals and late-game megaprojects.

## Known issues
- Bumblebots in flight during a manual mid-day save return to their hive on load.
- A tree felled or a rock left on a path doesn't re-plan a villager's cached path (placing or removing a structure does).
- By day 7 the pace bot's farm is field-heavy (about 50 structure tiles to 75-80 tilled): it grows the Town Mill's barley by hand. Rule 5 (3.2) holds on day 5.
- The pace bot stops at the Town Mill: it doesn't play k11 on (Sawmilling, the gallery, Steam Power), so its research stays at 13 topics after day 16 and its cash piles up. The chain past the Mill is tested by `tests/eras.test.ts`, not by the bot.
