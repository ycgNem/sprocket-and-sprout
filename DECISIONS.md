# Decisions log

Running log of design and technical decisions made while building autonomously.

1. **Name & setting** — Game is *Sprocket & Sprout*, set in the valley town of
   *Thistlewick*. All names, characters and text are original.
2. **Project location** — No project folder was chosen, so work happens in the
   session's scratch workspace; it gets copied to `Documents/sprocket-and-sprout` at the end.
3. **Node** — Node.js wasn't installed. A portable Node 22 LTS was unpacked to
   `C:\Users\jacks\tools\node-v22.20.0-win-x64` (no admin rights needed).
4. **UI is drawn on canvas** with an immediate-mode UI kit and a hand-defined
   bitmap font instead of DOM/CSS. That keeps the whole game pixel-perfect and
   cohesive with the procedural art. It costs more code, but every window
   (inventory, research tree, stats graphs) shares one kit.
5. **Pure simulation layer** — `src/sim` never touches the DOM. The
   presentation layer (sound, particles, toasts) reacts to events the sim
   emits. This makes belts/inserters/power/time/save unit-testable in Node.
6. **Time scale** — 1 in-game minute = 0.7 real seconds (the clock ticks in
   10-minute steps). A day runs 6:00 → 2:00 (20 h, about 14 real minutes).
7. **Basic "Clockwork Arm" inserter is spring-wound and needs no power**, so
   the first automation (week 1–2) comes before power. Fast, long and filter
   arms need power. This keeps the early ramp gentle and cozy.
8. **Hand-era machines are unpowered** (keg, preserves jar, furnace, oven run
   on time/fuel). Powered machines (mill, loom, bottler, sawmill, assembler,
   harvesters) arrive through research.
9. **Greenhouse is an outdoor glass-roofed zone** on the farm rather than a
   separate interior map. Its roof fades out while the player is inside.
10. **Animals live in coop/barn buildings and wander a pen area** during fair
    days. Buildings hold hay and products in an inventory that arms can access.
11. **Ore automation** — the quarry has ore veins where automated drills can be
    placed (Factorio-style), linking mining to the factory. The mines supply
    gems, rare ores and combat.
12. **Saves store deltas** — terrain regenerates from the world seed. Saves
    hold objects, soil, structures and actor state, which keeps localStorage small.
13. **Project moved to `Documents/sprocket-and-sprout`** — the scratch folder is virtualized by the app
    container, and Vite couldn't transform modules from there. The real folder is also persistent.
14. **Playwright uses the system Chrome** (`channel: 'chrome'`): the downloaded Chromium build couldn't
    be spawned on this machine (`spawn UNKNOWN`, likely Smart App Control).
15. **Shops have no interiors**: villagers "go inside" (vanish at the door) and a shop opens when its
    keeper is inside during opening hours. Talking happens outdoors. This keeps the town as one map.
16. **Machines in auto mode only pick single-ingredient recipes.** Multi-ingredient recipes (cooking,
    brass, bundles in an assembler) must be locked in from the machine window. This stops machines from
    clogging with half a recipe.
17. **Arms never grab more than the destination can take**, and filter arms match items regardless of quality.
18. **Ore veins never run out.** Quarry rocks respawn daily for hand mining; drills give the factory a steady supply.
19. **Products from animals land in the building's storage**, which arms can empty (automation-friendly).
    No milk pails or shears.
20. **Fishing minigame is a tension gauge** (hold to reel, release to ease, keep the needle in a moving zone),
    distinct from other farming games' vertical bar.
21. **Mine floors regenerate each day**, and you always wake up at home.
22. **Megaprojects are placed structures fed by arms/bots/hand**, so they're a true throughput goal.
23. **"Have" and "produce" quest objectives are polled**; event objectives (till, plant, ship...) use notify hooks.
24. **Ghost structures are built automatically** from your own inventory when you're within ~9 tiles
    (a "tinker's satchel"), and by bumblebots from crates later.
25. **Early balance (from the pacing bot)** — with a deliberately simple strategy the bot earns ~1.7k by
    day 7 and researches Conveyance on day ~7 and Clockwork Arms on day ~11. Sprout Bundles cost
    1 fiber + 1 crop. Copper gears need no research, so belts and arms are craftable as soon as they're
    researched. Energy is 220 at a cost of about 2 per tool use: a full day of tilling, watering and
    chopping lands near the bottom of the bar without forcing exhaustion. The first automation
    therefore lands in week 2, comfortably inside the week 2-3 target.
26. **Market saturation** halves a product's price after ~5000/price units are sold (min 25), decays
    18%/day, and never drops below 30% of base. Big single-product factories are strongly pushed
    to diversify, while small farms barely notice it.
27. **The game loop catches and reports exceptions** (console + toast) instead of freezing.
28. **The farmhouse is a separate small map** (`player.where = 'house'`) rather than a see-through
    roof. It reuses the tile/chunk renderer, but furniture is drawn live and y-sorted so tall pieces
    overlap the wall. The front door enters, the bed sleeps, and you wake inside. Saving indoors keeps
    you indoors. Tools, building and world hover are disabled indoors so they can't touch the farm
    through matching coordinates.
29. **Home cooking is instant but costs a renovation** (Kitchen, 2500 coins + materials). Oven machines
    are still the way to cook in bulk. The home kitchen is a convenience for players who don't
    automate food.
30. **Food buffs: one at a time, in game minutes, cleared by sleep.** Seven kinds (speed, stamina,
    fishing, mining, luck, defense, farming) at levels I-III, tied to 23 dishes and drinks. Effects
    are small per level (8-12%) so buffs flavor a day's plan without replacing tool upgrades or
    skills. Foods with a buff can be eaten at full energy. This replaces the old coffee speed flag,
    which never expired.
31. **The pet is a stray that arrives on day 3** instead of a new-game choice. That keeps the new-game
    form short and makes the pet a small story beat (a letter, then a right-click). Its species and
    coat come from the world seed; you choose the name. Pets steer straight toward their target
    and slide along walls rather than using A*, which is good enough for a yard and a room.
32. **Guild contracts are the factory's mid-game goal.** The market saturates on purpose, so a
    single-product factory needs another outlet. Contracts take bulk goods at 1.5x base value with no
    saturation, unlock with arms research, refresh weekly, and never punish you for missing one.
    Reputation ranks add a small permanent shipping bonus, so steady suppliers get ahead over time.
33. **Recipes are learned through friendship.** This gives hearts a practical reward and gives each
    villager a signature dish. The Sunday almanac guarantees steady progress for players who don't
    socialize. Saves made before the cookbook existed get every recipe, so no machine loses a
    recipe it was already running.
34. **Founder's Day is a yearly review, not a one-off verdict.** Inspired by the classic year-end
    evaluation but kinder: it repeats every year, rewards stay claimed, and the criteria span every
    pillar (cozy and factory alike), so different play styles can all reach four candles.


## October 2026 identity pass (after the indie-critic review)

35. **The opening leads with clockwork.** The old keeper left ripe cogbeans and a working
    preserves jar by the shipping crate. You start with arms, belts, a chest and a Study Desk,
    and belts, arms and preserving are known from minute one. The first automated sale lands
    about four minutes in instead of on day 9. Old saves keep their quest chain: a quest that
    depends on a flag-gated opening quest counts that quest as met when the flag is missing.
36. **The post collects at noon and 6pm**, plus overnight. Automation should pay off while you
    watch, not only in the morning summary. The day summary still lists everything sold that day.
37. **Passing out costs your morning, not your coins.** You sleep in until 10am with 60% energy.
    The old 10% coin fine copied a genre convention and punished long building sessions.
38. **The world runs at 1/4 speed while you build** (holding a structure, in remove/copy/paste mode,
    or with a machine window open), and at 1/2 in Cozy mode. The whole sim slows (clock, machines,
    crops, villagers); only the player, pickups, fishing, festivals and the mine stay real-time
    (`System.realtime`). The first version slowed only the clock, which the second review caught
    as a 4x output-per-day exploit. A test now checks that output per game day is the same at any speed.
39. **Modes and maps are rule sets and farm layouts, not new worlds.** The town, river, mine and
    beach are shared, so villager schedules and story locations keep working. Only the farm area
    changes (`src/sim/world/farms.ts`), and the save stores `mode` + `farmKind` so terrain regenerates
    identically. Modes: Story, Cozy (half-speed clock, no pass-out cost, crops survive season
    changes), Clockwork Rush (28-day scored run with medals), Sandbox (everything researched,
    free crafting, no energy, clock stops unless you sleep).
40. **Harvest cranes don't replace hand farming.** Machine-picked crops cap at silver quality and
    give no farming XP. Star quality is hand-only. Cranes leave chaff (fiber) so research doesn't
    stall on scything weeds; flax also turns into fiber.
41. **Numbers are our own.** Artisan multipliers, animal prices, the XP curve and tool upgrade costs
    were moved off the genre-standard tables (see the review), and the market floor rose to 40%.
42. **Achievements are a curiosity loop.** About 120 achievements, about a third of them secret
    easter eggs that show only a hint. Secrets pay 250 coins. A cross-save profile in localStorage
    remembers every unlock across farms.
43. **The HUD is a machine, not a wood sign.** A sky-window chronometer, a rolling brass odometer,
    a factory pulse (working / starved / blocked lamps that highlight machines when clicked) and
    a gear hotbar with steam-tube gauges. The cursor is a CSS pixel cursor (zero lag; it falls
    back to the system cursor).
44. **Clockwork Rush is its own ruleset**: no festivals or side stories (only the opening tutorial),
    half-price research, Guild contracts from day 1 refreshed every 3 days. Medals (20k / 40k / 65k)
    are calibrated at about 1.5x / 3x / 5x the pacing bot's 28-day Rush score (about 12.7k across 3 seeds).
    **Sandbox** has no quests, a free build palette (G) and only counts its own challenge and
    secret achievements, so it can't flood the profile with free unlocks.
45. **Machines load from the bag.** Right-clicking a machine with nothing loadable in hand loads the
    first ingredient it accepts from the whole backpack (fuel excluded). The opening relied on
    "hold the beans", which a full hotbar made impossible. The starting hotbar keeps two slots free.
46. **Quest objectives check state, not only events.** "Build X" and "craft X" count things you
    already own, so doing a step before its quest starts never soft-locks the chain.
47. **Roxy Vane breaks the villager template on purpose (1.1, owner request).** The owner asked
    for a glamorous female villager and said she could be more detailed than the rest. She is a
    taller sprite (48 px frames, 38 px tall against the 28-31 px cap in STYLE.md, goggles included) with idle
    and greeting frames, and 64 px portraits drawn 1:1 where the others are 32 px drawn 2x. She
    ties in lightly: a shop on her airship (off-season seeds for the greenhouse, clockwork parts
    before the research unlocks them, at a premium), four daily requests, four heart events, and
    the locket in her stock after her 6-heart event. Skyhook Field sits outside the town zone at
    the end of Main Street; saves from 1.0 get the meadow cleared on load (`skyfield()`).
48. **The UI stays at 2x on laptop browser windows.** The automatic scale wanted 340 UI px of
    height, so a 1366x768 laptop (about 620-660 px of browser viewport) fell to 1x, which is too
    small to read. From 600 px tall and 1120 wide it now keeps 2x; the screen sweep at 1366x620
    (`VIEW=1366x620 npm run screens`) shows every window fits.

## 1.2 "The Works" (owner decisions D1-D12 from ROADMAP.md, 2026-10-09)

The owner playtested 1.1 and asked for an identity rebuild around automation. ROADMAP.md section 1
lists twelve questions with recommendations; the owner left them as defaults, so the
recommendations are the decisions.

49. **Version 2.0, codename "The Works" (D1).** It ships as 2.0 when the new opening lands; the
    playtest hotfix is 1.1.1. The opening, the research model and the save format all change.
50. **Old saves migrate (D2).** SAVE_VERSION 4 adds new state with defaults and keeps re-roled
    villager ids. Only new games get the new opening; old saves keep their quest chain through
    `needFlag`.
51. **Romance is kept and frozen (D3).** No new romance content; Roxy's events stay. It is no longer
    a pillar: no quest points at it.
52. **Combat leaves the critical path (D4).** The mine becomes the Deepworks (hazards, a few pests);
    the sword stays a tool and `s_deep` stops gating anything important.
53. **Two festivals stay, two are replaced (D5).** Lantern Night and Frostlight Skate stay. Kite Day
    becomes the Sprocket Fair (a throughput contest), Pumpkin Roll becomes the Harvest Haul (a trade
    fair with an auction).
54. **One flagstone set for every path (D6).** The placeable path and the town's roads are both
    `T.PATH`, so one set replaces the cobbles: flagstone with a gravel edge, worn variants for the
    wide town roads.
55. **One name for the Professor (D7).** Quests, guide arrows, the tracker, the key bubble and the
    map say "Prof. Cogwhistle" (`questName` in `src/data/cookbook.ts`); only friends' dialogue says
    "Ottoline". A name tag hangs over the villager the guide arrow points at.
56. **Art budget timing (D8).** Phase 0 spends up to 60 generations (pickaxe frames, flagstone and
    plank sets); the big art pass (Phase 6, about 450) waits for the November 9 reset.
57. **Less mail (D9).** Quests send no letters (the tracker and the toast already say it); season
    notes, festivals and birthdays live in the almanac (festivals also get a morning toast the day
    before); the tool-upgrade letter became the toast it already had; the mailbox delivers at most
    one letter a day and queues the rest (`send` in `src/sim/systems/goals.ts`).
58. **Structures indoors come with Workshop HQ (D10).** Chests, jars, kegs, the loom, the desk,
    lamps and decor go indoors in Phase 5; belts and arms indoors later (the Basement).
59. **No fluid network in 1.2 (D11).** The Waterworks keystone is a restored pump house (a project);
    pipes are a 2.1 candidate.
60. **Branches (D12).** Work happens on `works`; `main` (= the website) gets merges at the end of
    Phase 0 (1.1.1), Phase 2 (2.0 beta, website only) and Phase 7 (2.0).
61. **Cut freely, but farming stays hands-on (owner, 2026-10-09).** The owner accepts that 2.0 is
    nearly a new game: old systems and content can be deleted outright when that makes the game
    more its own, rather than kept behind flags. The floor: the player can always till, plant,
    water and harvest by hand. Automation is the identity; hand farming is never automated away
    or removed.
62. **Tools don't one-shot structures (playtest).** An axe or pickaxe takes three hits within four
    seconds to lift a structure, with a small wobble; a chest or crate with anything in it never
    breaks by tool (remove mode or the window's new Pick up button take it with its contents).
    Weeds and twigs are walkable; shaking is capped (trees and struck structures 2 px, the camera
    3 px, both off with the Screen shake setting).
63. **Ground transitions are painted where the art has none (bug 3, the farming glitch).** Where two
    terrains met without a Wang set (flagstone and water, tilled soil and a path, three terrains at
    one corner) the dual grid dropped one class and left a square notch. `src/render/blend.ts`
    paints those vertices: each class over the ones below it through a smooth, wobbly mask with a
    dark rim (foam on water). The tilled-soil sets, whose tiles don't meet (the seam audit's worst),
    are painted the same way. Art sets still win everywhere else.
64. **The machine contract: six states, one reason, shown once (1.2 Phase 1).** Every structure is
    Idle, Working, Starved, Blocked, Unpowered or Needs fuel, with one line of why
    (`src/sim/mstate.ts`). Two refinements from the critic's spec review: a full queue in front of a
    busy machine is Working ("Queued"), and a stage whose supply traces back to a field with nothing
    ripe is Idle "waiting for harvest". Glyphs go on the root cause only (downstream symptoms get a
    faint dot), so a healthy or field-limited line shows nothing. Rates are per day (per minute
    above one a minute); the diagnosis states the gap in numbers and keeps the fixes behind "?".
65. **The night shift.** At 2am, before the tally, the works runs the 4 hours to 6am (works-only, in
    4-tick steps, ~1.3 s on the 1,300-belt perf scene). The "skip" overnight setting runs the
    bedtime-to-2am stretch the same way, so both settings make the same goods. The evening becomes
    an engineering choice (buffers, fuel, the pole's "Night shift only" position), not a chore.
66. **The Field Works (harvest automation) keep the hands first-class.** Gleaner (Spring, spring-wound,
    3x3, base quality), crane (moved to Water), sower, field gantry (Steam, rides two rails over a
    5-wide strip, waters/picks/resows). Machines pick a crop that ripened today only from noon (the
    morning harvest is the hands'; the Dawn Shift research adds a switch), artisan goods keep their
    input's lowest quality, and every fifth pick of a hand streak rolls one quality step higher.
67. **Cogbeans ripen in 4 days** (was 8) so "plant more" pays off in the first week; regrow stays 3.
68. **Factory first, at a glance (the owner, 2026-10-09).** "Hand farming stays sure but also there
    need to be apparent factory/automation, different than Stardew style." Hand farming is a floor,
    never the face: the first screen shows machines moving, the first hour has no debris-clearing
    chores, every beat ends with a machine doing something, the works' HUD shows from minute 0,
    and by day 5 the farm looks like a works. Every critic review from Phase 2 on runs the Stardew
    test (name three things Stardew doesn't have in the first 15 minutes). ROADMAP.md 3.2.
69. **No Builderment-style rework.** The owner asked for "a Builderment vibe"; the suggestion to let
    machines push output onto a belt in front (arms optional) was declined: "dont add the
    builderment direction". Lines stay arm-and-belt; belts already deliver into what they run into.
70. **1.1.1, round two of the playtest.** A villager who is already on (or put on) a doorstep
    steps straight in (Clem never entered the ranch, so it never opened); bridge decks are squared
    (`squareBridges` in worldgen, also run on load, never over soil or a structure), and a road
    sliver along a bank is road again; a shaft that drops you past floor 5, 10, ... unlocks those
    lifts, and the lift list includes every floor down to the deepest reached; the map labels
    buildings without overlap (hover for the full name, the door's answer and who is inside) and
    shows a head for you and every villager.
71. **The wrong input is named (Phase 1 build review).** Ports say whether a structure uses an item
    at all (`portUses`); an arm or belt stopped by one is Blocked "The jar can't use stone"
    (`e.refused`), the diagnosis has `wrong:arm` / `wrong:belt`, and the factory pulse counts
    root causes (what carries a glyph) rather than machines, so the lamps and the map agree.
