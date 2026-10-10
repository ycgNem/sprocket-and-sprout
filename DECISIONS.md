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
72. **One path, no "pick a direction" card (the owner, 2026-10-09).** The roadmap's "Plan the works"
    card (B8 and the end of each era: three directions, each starting a story thread) is cut. The
    owner: those directions were ideas for where to take the game, not a choice to hand the player;
    the path must be the same for everyone and part of the game. Progression is one authored order
    (the Keeper's Line, then the Mill, the Waterworks, Lamplighting, the Tram, the Clock); lines,
    the Deepworks and orders are all steps on it. Side content stays optional, but the main path
    never branches.
73. **The Keeper's Line opens on rusted works (Phase 2, ROADMAP.md 6.0).** A new game starts beside
    the keeper's jar, still running on its last beans (so the factory pulse reads "1 working" from
    the first second), with the rest of the old works rusted: the arm between the jar and the
    crate, a belt run, a gleaner on a half-planted bed, the study desk. One new verb, **Restore**:
    F at a rusted piece brings it back (rust lifts, a chime); arms need a mainspring, which the
    Professor brings in B2. Rusted pieces do nothing, can't be picked up or broken, and draw in a
    rust ramp of their own sprite with a small broken-cog badge. Only new games have rust; saves
    from 1.x keep their quests and get the desk flag. Both old tutorial chains are gone (19 quests).
74. **One step at a time, with its reason (Phase 2).** The Now strip replaces the 3-quest tracker:
    one line ("Now: feed the jar") with the step's why under it and a ? to the Keeper's Notebook
    (a new Journal tab: lessons, machines, lines, controls). Lesson cards (src/data/lessons.ts,
    21 of them) show the first time a situation happens, never modal, kept in the Notebook.
    Ctrl+Z takes back the last placement (one drag) within 10 s with a full refund. F at a
    machine collects its goods and loads it from the bag in one press.
75. **The critic's quick read of the opening (approve with changes)** shaped the numbers: B1 is
    short (pick 4, feed, carry 2) so the Professor arrives at about 1:30; the keeper's jar runs at
    4x until the line is whole (B3) and the cellar starts with 24 beans; B3 checks that the arm fed
    the jar; B6's second jar starves on its own empty chest (the cellar's daily dozen keeps the
    first jar running through day 4) and its arms snap but don't turn themselves (facing is
    practised); a lost mainspring or seed comes again. B8 (copper, the furnace, Water Power) is
    to be reworked when it's built: Bram's bars from an order, the Deepworks after B8, the keeper's
    grain for the mill, a 40-spark wheel so the brownout is real. The keystone after it is the Town
    Mill.
76. **The Preserves Jar is the Preserving Crock (the owner, 2026-10-10).** The critic flagged
    Stardew's own machine name at the centre of the new opening; the owner picked "Preserving
    Crock" ("crock" in text: "Feed the crock", "crock 17/day"). Display names only: the id stays
    `jar`, so saves, recipes (`jar:*`) and sprites are untouched.
77. **Orders and consignment, the minimal board (Phase 2, ROADMAP.md 6.0 B7 and 7.4).** The town's
    noticeboard is the Orders board (also J -> Orders): standing orders from businesses plus
    today's asks (the old daily requests, unchanged). A standing order is filled by hand at the
    villager or by consignment: the shipping crate's "Ship to" tag sends what fits that customer's
    open order at each post (noon, 6pm, overnight) before the market gets the rest. Orders pay
    above market, never saturate it, and add reputation per customer (Phase 3 turns it into ranks).
    Rowan's is weekly (6 pickled cogbeans, +2 per reputation point, silver pays double; the first
    one never lapses); Bram's is a one-off (6 cogbean oil for 5 copper bars and 2 Brass Arms).
    Cogbean oil sells for 200: per bean it pays less than pickles, per crock-second more, so which
    recipe to lock is a real choice. The crate's price tag names the most flooded item.
78. **B8 is the keeper's river works (Phase 2, the critic's rework).** On the river by the farm
    gate, south of the bridge (the river and the gate road are the same on every map): the
    keeper's water wheel (rusted; 5 copper bars restore it; worn to 40 sparks), two rusted poles,
    a rusted grist mill and a rusted grain bin with last autumn's 40 barley. Bram's order pays the
    bars and two Brass Arms; the mill (50 sparks) and the arms overload the old wheel, so the first
    grid the player builds browns out for real (the card, the amber power lamp, slow animation,
    dim lamps). B8 ends when the mill has ground 5 meal in it. The next main step is k9 "More
    Power" (Water Power at the desk, a second wheel, the mill's grid able to run everything at
    once), the bridge to the Town Mill keystone of Phase 3. Safety nets resend bars, barley and an
    arm (once a day) so the beat can't be lost.
79. **Shift+F opens a machine's window; a recipe click always takes.** F at a machine collects and
    loads (decision 74), so a player carrying beans could never reach the crock's recipes; Shift+F
    opens any structure's window, and the key bubble says so where a machine has two recipes for
    one input. A recipe picked mid-batch waits for the batch ("Next batch: Cogbean Oil") instead of
    being silently ignored, and the recipes for what the machine holds or the bag carries come
    first in its list.
80. **The pace bot builds its own line before it grows its plot (3.2 rule 5).** On day 5 the bot's
    farm had 39 structure tiles to 51 tilled; the bot now buys its first line's crock and arms once
    B6 is done and keeps its plot at 12 + 3/day until day 5 (then 12 + 6/day as before), giving
    43 to 39. `tests/keeper.test.ts` checks it, and the sweep has a `day5-farm` shot.
81. **Before the 2.0 beta goes live: saves are v4, and new items go last (a pre-merge review).** A
    review built ten real 1.1.1 saves with the 1.1.1 code (every mode and map, mid-tutorial, a
    factory saved mid-batch) and loaded them into 2.0: nothing lost or broken. What changed from
    it: `SAVE_VERSION` is 4 (a no-op migration), so if `main` ever rolls back, 1.1.x refuses a 2.0
    save cleanly instead of throwing every tick on a research topic it doesn't know; items added
    after 1.1 sit at the end of the item list (`ITEMS_AFTER_1_1` in `src/data/items.ts`, checked by
    `tests/data.test.ts`), because a blueprint ghost's filters are saved as raw item keys. Also
    fixed: restoring a piece counts as looking at it (B5 could softlock if the belts were mended
    early), goods put in through the crate's window count for B1, a recipe picked mid-batch is
    saved, the spare mainspring comes once a day (it streamed every half second), consignment
    fills an order silver first as a hand delivery does, quests start on load (an old save's
    retired tutorial left the Now strip empty until morning), and Shift+F doesn't open a window
    while walking slowly. Phase 3's orders migration is v5.
82. **The critic's end-of-Phase-2 review failed the works on day 5; the hour stays, the week gets a
    supply (2026-10-10).** The first hour passed the Stardew test (a rusted works running its own
    line by minute 8), but by day 5 every machine starved: the cellar's beans stopped on day 4, no
    shop sold cogbean seeds, and the mill's 40 barley was a one-off, so day 6 earned nothing and
    the next goal asked for power for a mill with nothing to grind. This revises decisions 75 and
    78: the cellar sends its dozen beans through day 7; cogbean is no longer a rare seed (the
    Mercantile sells it); barley grows in spring and fall; the keeper's granary tops the grain bin
    up to 20 barley each morning through day 7; Rowan posts a weekly Barley Meal order (10 at 80)
    once B8 is done; the worn wheel makes 35 sparks in any weather (rain lifted it to 98%). The
    chain after B8 is k9 "A Second Bed" (Gleaning, a second gleaner, 8 cogbeans in its reach) and
    then More Power (with a Metalwork step and the Workshop named for copper gears); side quests
    start after the second bed and the money goal after More Power. Also: arms snap only to the
    slot the current step marks (B6's out-arm slot took the fix's third arm), rusted belts don't
    carry the player, and a crate tagged for a customer with nothing open follows a new order.
    What's left of the must-fix list, and the acceptance check, are in ROADMAP.md Phase 2.
83. **The Phase 2 re-check: a supply for days 8-12, and More Power grinds (2026-10-10).** The
    critic's re-check passed the must-fix list but found a cliff when the crutches end and a second
    wheel powering a starved mill. Cogbeans regrow every 2 days (was 3); k9 "A Second Bed" asks for
    16 cogbeans in reach of two new gleaners (two beds and the keeper's patch feed one crock); the
    cellar tapers (a dozen beans a day through day 7, 8 on days 8-9, 4 on days 10-11, with "the last
    of the keeper's cellar" toasts) and the granary says when its last sack comes; More Power asks
    you to sow 10 barley and to grind 5 meal at full power instead of a capacity check. The
    acceptance check runs days 5-12 (`scripts/accept.ts`): no zero-income day on seeds 2024, 7 and
    99; pickles at 45-50% of the crocks' capacity.
84. **Research in five eras, with keystones and era rewards (ROADMAP.md 7.3, 8).** Topics sit in
    era bands (Spring, Water, Steam, Clockwork, Starlight) whose bundle colours add up (sprout, then
    copper, rose, brass, star). Eight keystones carry stages, four pips on the node: observe (hover
    it, hold I over it, walk up to it, or restore it), experiment (quest-kind objectives), validate
    (an item made at a rate over the last minute, held for some minutes), then apply (the bundles).
    A desk on a keystone whose stages aren't done waits and takes no bundles. The 12 flat-buff nodes
    are era rewards, granted in one card by the era's town keystone; their pieces keep the old ids
    (`research.rewards`), so a 1.x save that had studied one keeps the bonus (save v5 moves it out of
    `done`). Reaching and Sorting Arms are spring arms in Water; Brass Arms and Brass Sprinklers moved
    to Steam; new: Threshing (Steam) and Dyes & Pastes (Water). The window: tinted era bands named
    for their keystone, both axes scroll, Fit, and a locked topic names what it needs.
85. **One Orders board: Today, Standing, Works (7.4).** The daily requests, the Guild's contracts
    and the restoration projects moved into `src/sim/systems/orders.ts`. An order has lines, a
    customer (a business id, which is its keeper's villager id, or the Guild or the Town Council), a
    kind, a due day, its pay and reputation. Today: three asks a day from k9 on, by hand or by a
    tagged crate, gone at midnight. Standing: each business's weekly orders, opened by rank (six
    ranks at 0, 2, 5, 9, 14 and 20 points; +1 an order, +2 a big one), and rank-gated stock in its
    shop (`unlock: 'rep:<business>:<rank>'`). Works: the 16 restoration projects and the town
    keystones, delivered at the board or by a crate tagged for the Town Council; the clocktower's
    door opens the Works tab. Save v5 moves the old state across (`tests/migrate.test.ts` loads three
    1.1.1 saves and two 2.0 beta saves).
86. **Crop numbers from one formula, and the intermediates (7.1, 4.10).** Price = (seed + days x 6)
    x kind / average yield, a regrower's season counted as one plant; seeds still on Stardew's moved
    first (about 10% under). Cotton was re-derived too (40 to 18): at 40 the year-long bot planted it,
    it can't go in a crock, and the crocks starved all year. Cogbean, barley and radish keep their
    roles and numbers. Rapeseed (summer) presses to oil. The intermediates: canvas (belts), lubricant
    (fitted to a machine with F: 10% faster for good), grain and straw (the thresher, Steam), starch
    paste and pigment (the crock, Dyes & Pastes), spirit (the keg; burns for twice a coal). Left open:
    sweet pea, frostmint and tea sell at about twice the formula, and the seed sifter's seeds outsell
    most regrowers' crops.
87. **The Town Mill, end to end; it asks 80 meal, not 120 (2026-10-10).** k10 follows More Power:
    look at the town's silent mill (walking up to it counts), grind 20 meal (a lifetime count: the
    Keeper's Line has usually done it), keep a mill at 3 a minute for 2 minutes (two dozen barley
    tipped into its bin at once does it; the hint said a thresher, but threshing is a Steam topic),
    study Milling (20 sprout and 20 copper bundles), then fill the Works order: 80 flour or barley
    meal, 40 planks and 8 copper gears. The spec's 120 meant 120 barley plants on top of Rowan's
    weekly 10 (barley yields one a plant), and the bot got there on days 21-23; at 80 it reaches the
    Mill by day 20 on 8 of 8 seeds, on days 18-20 (`scripts/mill20.ts`). The flag turns the mill's
    wheel; the Kettle and the Mercantile sell bread and flour; Rowan posts a weekly bread order; the
    Bakery Window project opens; the Water era's reward card shows.
88. **The Deepworks: 30 levels in six strata (7.2, Phase 4).** Earth, Clayworks, Frost, Ember,
    Crystal and Starfall, each with its own ores, a hazard, a pest and a works chamber on its fifth
    level (the lift, the boiler, the pump, the lamp works, the lockers and the rail cart, the fallen
    star). Hazards cost health; pests never do (they eat ore left on the floor, sit in a gallery, or
    hide the ladder). The lift does nothing until it's restored on level 5 (4 planks, 2 copper gears,
    a rope); below level 10 is flooded until the Waterworks. Old saves: `deepest` halves, lift flags
    map to every fifth level and count as a restored lift, and the grand chests of floors 20/40/60 are
    those of levels 10/20/30. Iron and frost shards now come from the Frost, behind the Waterworks,
    so "Deeper Down" asks for Clayworks tin at level 10; the mine bundle and glow sorbet wait for the
    Waterworks (the smithy and the quarry still sell or yield iron, tin and gold). Brute fells a crab
    in two hits and Warrior takes 25% less from hazards; drops near you go in your bag when you leave
    a level.
89. **The town keystones in the world (7.5).** Everything follows from four flags. `town_mill`: the
    mill on the river at the west end of Main Street (a landmark you look at, not enter) turns, with
    flour dust and sacks. `waterworks`: the pump house's chimney smokes and the new fountain south of
    the clocktower runs. `lamps_hung`: the square's twelve lamps replace its four oil lampposts; they
    light after 6pm while one of your poles reaches the farm gate on a powered grid, drawing 12
    sparks (the keeper's river works' pole already reaches it, so restored works light them).
    `tram`: a fixed cart bin appears at the quarry, and each morning the cart sells up to 20 ore from
    it at 1.3x without saturating the market (a cart runs the road at 6:00 and back at noon).
90. **Rush medals re-tuned to the 2.0 bot: 35k / 65k / 100k (revises decision 44).** Decision 44 set
    them at 1.5x / 3x / 5x a bot that scored 12.7k. The 2.0 bot plays the Keeper's Line and reaches
    the Town Mill and earns 65.5k in a 28-day Rush (Story 62.9k) on 8 seeds; at 1.5x-5x of that no
    one would medal. They sit at about 0.5x / 1x / 1.5x the bot now: bronze for a decent run, silver
    for matching a practiced script, gold for beating it by half.
91. **A world's caches are its own.** The villagers' path cache lived at module level: a path planned
    on one seed's map was walked on the next game's (a new game after another, a loaded save, the bot
    running seeds in one process), so the same seed played out differently by what ran before it. It
    is per world now (keyed on the map) and starts again whenever a structure is placed or removed.
92. **The critic's Phase 2 Minors (2026-10-10).** The build slow-down ends with a placement and stays
    off until another placeable is picked up; Esc with a machine in hand puts it away (the nearest
    tool or empty slot) instead of pausing; undo keeps the last five placements with no time limit; a
    midnight "bed by 2am" toast; lesson cards wrap their two lines as one text, and tips wait while one
    is up; the welcome is spoken, without a letter's sign-off; the Lines tab uses one unit per table;
    the day summary keeps an order's deliveries apart from market sales; the crock is first at the
    Mercantile; the title screen's demo is the 2.0 works (gleaner beds, belts, crocks, a field gantry).
93. **The one path past the Mill: k11-k17 (the critic's Phase 3+4 review, C1; 2026-10-10).** The
    review failed the two phases narrowly: after k10 the Now strip fell back to side quests ("Build a
    Coop") and the Works tab hid the next keystone until its research was done, the 1.1 "players get
    lost" moved to day 20. Section 8 already said each era ends by handing over the next town
    keystone; now it does, as main quests in one order (DECISIONS #72): k11 "Down to the Boiler"
    (Sawmilling, 20 beams for level 6's gallery, the boiler on level 10), k12 "Steam Power" (a
    charcoal kiln, Weaving and a hand loom, Brass Working, the topic), k13 "The Waterworks" (the pump
    house, Dyes & Pastes, the order), k14 "Spark Coils" (Glassblowing, Assembly, the lamp works on
    level 20, coils, a glass a minute), k15 "Lamplighting" (the order, the square lit on your power),
    k16 "The Tram" (the lockers and the rail cart on level 25, an assembler, brass gears, Clockwork
    Assembly, the order) and k17 "The Clock" (the clocktower, after the Tram). Harvest Bundles (the
    Steam colour) gain a works recipe, a jar of preserves, a length of canvas and a copper coil, so
    the next era needs a crock, a loom and the smelter, not a coop; the old preserve + cloth + animal
    product recipe stays. Seed Sowers move to the Water era (25 sprout and copper bundles): a field
    that sows itself before the Town Mill, so its meal can come from a works and not only your hands
    (M2).
94. **A keystone's stages count from its main quest; its order goes up with it (M1, M2).** On a
    Keeper's Line save a keystone walked by a main quest (Milling: k10, Steam Power: k11, Spark Coils:
    k14, Clockwork Assembly: k16) opens when its quest starts: looking counts only then (the town's
    mill stands by the Mercantile you visit on day 2), and its experiment counts from then (made:mill
    was 60 by day 5). `stages_open:<id>` marks it and `research.base` keeps the counters' starting
    points; a save from before keeps its lifetime counts. Keystones with no quest (Conveyance, Water
    Power, Bumblebots, Grand Works) count as before. Validate shows its rate and clock in the Now strip
    ("2.4 a minute now, 0:40 of 2:00"), a ring fills over each machine making the item, and a run that
    breaks after 10 seconds says the clock starts again. A keystone's Works order is posted when its
    quest starts and takes goods at once; the works start when its research (and the Tram's rail
    cart) is done, with a toast if everything was in before. The Town Mill asks 40 meal (80 in
    DECISIONS #87): with the order visible from k10's first step, the bot reaches the Mill on days
    15-18. Its finish is a scene (ROADMAP.md 7.5): the camera goes to the wheel as it starts turning,
    then the keystone's card, then the era's card (a window queue, so one doesn't replace the other).
95. **The Works tab without the Community Center (M5).** The crop, fish, forage and gem baskets of the
    1.x restoration board (spring, summer and fall produce, river, harbour and lake fish, forage,
    gems) were Stardew's Community Center and are cut (DECISIONS #61 allowed it); a 1.x save's goods in
    a cut basket are paid back at market price by the v5 migration. What's left waits for its era:
    Clockwork Restock and the Winter Pantry after the Town Mill, Dairy Day after Dairy, the Bakery
    Window after the Mill and Hearth Cooking (its reward is now an assembler, not a second mill), the
    greenhouse and the Smelter's Pride after the Waterworks, Quarry Road after Rock Crushing, and the
    Clock after the Tram. Standing orders wait for the know-how that makes their goods (cheese for
    Dairy, soup and feasts for Hearth Cooking, cloth for Weaving, wine for Brewing, smoked fish for
    Bottling, beams for Sawmilling, coils for Metalwork); the board lists the orders your bag can fill
    first, and the rank is drawn in ink.
96. **Goods only a line makes, and money for machines (M1, M3, M4).** Bread bakes from any flour or
    meal (the farmhouse kitchen or an oven), so Rowan's weekly loaves can come from your works; shop
    bread costs 240, above the order's 170. The Mercantile no longer sells oil (the Waterworks' 50 come
    from a mill's press), the Joinery cuts 30 planks a day and sells beams only at Master Purveyor, the
    Workshop sells 4 brass gears a day and now sells machines for coins (gleaner, water wheel, mill,
    sawmill, assembler, steam engine). Beams come only from a sawmill (the level-6 gallery teaches it;
    there was a hand recipe). Starch paste and pigment are worth at least what goes in (a yam or a corn
    makes 2 or 1 pot, a beet 1, a mooncap 2, a starpetal 5), Juniper orders paste every week, and the
    Waterworks asks 20 for its joints. The tram carries bars and gems as well as ore, so a smelting
    line feeding its bin beats tipping ore in; it shuttles every two hours from 6am to 6pm. The
    Joinery sells sand once you know glass (the crusher is a Steam topic). Stardew's profession names
    are replaced (Market Gardener, Stockkeeper, Preserver, Seedwright, Woodcutter, Forager,
    Wildcrafter, Prospector, Gemcutter, Smelter, Delver, Fishmonger, Trap-setter, Fly-tier,
    Crab-cracker, Hard Hat); their ids, and so saves, are unchanged.
97. **Rush medals 40k / 75k / 110k (revises decision 90).** After the fixes the pace bot earns 66.0k
    in a 28-day Rush (Story 65.7k) on 8 seeds and reaches the Town Mill on days 15-18. At 65k it took
    silver on every seed, though its works stop growing after day 5 (the critic). Silver now asks
    about 1.15x the bot, gold about 1.65x, bronze about 0.6x.
98. **The Deepworks' problems are solved by things you place or time (the critic's M6).** The review
    called the Deepworks Stardew's mine without monsters: break rocks, find the ladder, ride the lift,
    and gas without Spark Coils threw you up two levels (the only route to Spark Coils' own look). Each
    stratum's problem now has a fix you place or time: the Clayworks' gallery wants 20 beams (beams
    come only from a sawmill now, DECISIONS #96), the Frost waits for the Waterworks, the Ember's
    firedamp vents on a clock (7-9 s a cycle, staggered; quiet, a 1 s hiss, 2.5 s of venting: 8 health,
    6 for a Warrior, and a push back out, once a vent; never another level; Spark Coils still burn a
    pocket off for good), and the Crystal's dark galleries are lit by lamps you set down (F or a click
    with a lamp in hand: a 7-tile light; F picks it up; they come back to the bag when you leave the
    level, sleep underground or save there). A works chamber is a study card (its name, what it is,
    the research keystone it teaches, the parts it takes), shown on the first walk-up and on every F;
    a keystone's chamber seen before its quest asks says to come back then (DECISIONS #94). Starfall's
    shard marks get a dark-and-butter ring that grows as the shard nears, so they read on its speckled
    floor. Pests still never hurt (DECISIONS #88), and the lift still stops at the works chambers.
99. **The critic's re-check of Phases 3+4: PASS WITH FIXES, and the fixes (2026-10-10).** The one
    path and the Town Mill passed; three Majors and the Stardew test's professions were fixed:
    - *The next town keystone shows from its era's first quest.* The Waterworks' order goes up with
      k11, whose first step is now the look at the shuttered pump house (k13 keeps Dyes & Pastes and
      the order), and Lamplighting's with k14. The Now strip shows the quest's title and step over
      the step ("Down to the Boiler (1/5)"), and its ? opens the quest in the journal. The why lines
      of k10-k17 lead with the reason, not "Try: stage 2." or a bundle count.
    - *A loaded save shows no first-morning news.* The constructor's dayStart ran on an empty game
      when loading (no flags, so the Keeper's Line read as a 1.x save) and its toasts and lesson cards
      stayed; deserialize drops them. Quest progress is sized to the quest's steps on load.
    - *Any oil fills the Waterworks* (`#oil`: cogbean oil from a crock counts, as sunflower and
      rapeseed oil do), so it no longer waits for summer's crops (it came only from a mill's press,
      DECISIONS #96).
    - *Professions (the Stardew test failed them: "only the names changed").* Tinkering is listed
      first and gets 5 XP for every batch a machine finishes (level 5 around day 12-13 with the
      Keeper's Line's crocks and the mill; farming reaches it around day 17-18), so its pair is the
      first choice: Engineer (machines 10% faster) or Governor (powered machines keep full speed
      while the grid meets 75% of their demand; it was Clockmaker's arms 15% faster, and arms are
      never a line's bottleneck: the critic's confirmation pass). Farming's perks work the field
      machines and the crock instead of raising prices: Field Hand (every fourth pick of a gleaner,
      crane or gantry brings a crop extra; 25% faster picking bought about 3 seconds a day) or Long
      Reach (a gleaner's 5x5, cranes and sowers a tile further; the placement ghost shows a
      gleaner's reach) at 5, Seedwright or Crock Master (crocks, kegs and presses 20% faster) at 10. Foraging and mining each trade a sell-price or luck perk for one that runs their
      machines: Sawyer (sawmills and charcoal kilns 25% faster, was Forager), Drill Rigger (quarry
      drills 25% faster, was Gemcutter), Furnace Hand (furnaces 25% faster, was Smelter's +40% bars).
      Ids are kept. Fishing's and combat's perks are unchanged (Phase 5 may reshape them).
    - *The Works tab lists works under the place they serve* (the Copper Kettle, the clocktower, the
      smithy, the Mercantile, your farm, the quarry), the Winter Pantry is the Kettle's Cellar, and
      finishing every work at one place is no longer a Community Center room with its own bonus.
    - *A crate tagged for the Council or the Guild keeps its tag* when a business posts a new order
      (the Mill's finish posted Rowan's bread a moment before the Waterworks and re-tagged a Council
      crate to the Kettle, so its brass went to market); the works are posted before standing orders.
    - *The Earth stratum's placed fix* (the confirmation pass: levels 1-5 were still Stardew's mine):
      a cracked ceiling comes down when you walk under it (it was anywhere within 2 tiles), and 2
      planks prop the whole crack up for good (F beside it; timber posts show over it).
    - Smaller: Guild contracts wait for their know-how as standing orders do; toasts queue (three on
      screen) instead of dropping one; the journal lists the main path first; the Crystal's dark is
      0.93 and colourless; the validate ring is a pixel gauge on the machine; a keystone finished
      indoors or asleep shows its card then and the camera goes to look once you're outdoors; the
      research window's "(now)" is the town's era (`townEra`) and it opens on the Now step's topic
      when that's one to study; the era banner names what comes next ("The Steam era begins"); a toast
      within 0.3 s of a key or click (the answer to an action) goes to the front of the queue; on a
      narrow screen toasts stack above the hotbar, clear of the Now strip; a main step at the desk
      points the compass at the desk (one with no place points nowhere, not at a side quest); the
      Works tab wraps a project's description; each perk card has its own picture.
