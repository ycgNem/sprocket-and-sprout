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
