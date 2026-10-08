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

