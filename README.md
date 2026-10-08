# Sprocket & Sprout

A cozy top-down pixel-art farming game that slowly becomes a humming, steam-puffing
farm-factory. You arrive in the valley town of **Thistlewick** to take over an overgrown
plot. You farm by hand at first. With help from Professor Cogwhistle's research you build
clockwork arms, belts, mills, water wheels and little brass bumblebots, until the farm
runs itself like a music box.

All art, music and sound are generated procedurally in code: there are no image or audio
files. Everything is original.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | type-check + production build into `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest unit tests (simulation, data validation, pacing bot) |
| `node e2e/smoke.mjs` | Playwright smoke test through the real UI (needs the dev server and Chrome) |
| `node e2e/bot.mjs 14` | Playwright bot plays 14 in-game days, screenshots every morning |
| `node e2e/perf.mjs` | builds a 1300-belt / 260-machine factory and measures frame + tick times |
| `node e2e/shots.mjs farm,town,npcs,minefloor,factory` | screenshots of scenes and windows |

## Controls (all rebindable in Settings)

| Action | Default |
|---|---|
| Move | WASD / arrows (hold Shift to walk slowly) |
| Use tool / place / attack | Left mouse (hold to repeat; hold the hoe or can to charge an area) |
| Talk / harvest / open / collect | Right mouse or F |
| Hotbar | 1-0, mouse wheel |
| Backpack / Crafting | E (or Tab) / C |
| Research tree | T |
| Production stats + power grids | P |
| Journal (quests, friends, collections, mail) | J |
| World map | M |
| Rotate (placing or under the mouse) | R |
| Pick the structure under the mouse | Q |
| Deconstruct an area | X, then drag |
| Copy blueprint / paste | V, then drag / B |
| Eat held item | H |
| Quick stack bag items into nearby chests | K |
| Drop one item | Z |
| Zoom | + / - or Ctrl + wheel |
| Pause / close | Esc |
| Debug & cheat panel | ` (backtick) |

## Features

**Farming life**
- 36 crops across four seasons. Many regrow, some climb trellises, grains need a scythe, and
  cabbages, melons, pumpkins and glowmelons can form 3x3 giant crops.
- Watering, rain, sprinklers (3 tiers) and powered mist towers. Six fertilizers (quality,
  speed, water-keeping). Silver, gold and star quality tiers.
- Fruit trees and wild trees with seasonal looks, tapping for syrup, resin, tar and sap.
- A ruined greenhouse you can restore to grow all year.
- A walk-in farmhouse: sleep in your bed (you wake up inside), warm up by the hearth, and read
  the almanac for tomorrow's weather, this week's market demand and upcoming birthdays and
  festivals. The carpenter sells renovations: a kitchen for instant home cooking (22 recipes),
  a root cellar pantry, a featherbed and a grand hearth.
- Furnish the farmhouse: armchairs, lamps, rugs, a fish tank, plants, a pet bed, and paintings
  that Hazel gives you as your friendship grows.
- A farm pet: a stray cat or dog adopts you on day 3. Name it, pet it, fill its water bowl, and
  it will follow you around, nap by the hearth and leave gifts at the door.
- Professions: choose one of two perks at skill levels 5 and 10 (24 perks across 6 skills).
- Cooked food grants timed buffs (speed, stamina, fishing, mining, luck, defense, farming).
- Splitter filters and output priority, and arm stock limits, for tidy factories.
- Trading Guild contracts: weekly bulk orders delivered to a Freight Depot (arms can feed it),
  with reputation ranks that raise shipping prices.
- Coops and barns (3 tiers each) with chickens, ducks, rabbits, cows, goats, sheep, pigs and
  alpacas. They need hay (scythe tall grass into silos), love being petted, and lay better goods
  when happy.
- Fishing with an original tension-reel minigame: 27 fish by location, season, hour and weather,
  three legendaries, plus wicker traps for shellfish.
- The Old Mine: 60 procedural floors in three themes (earth, frost, ember), ores, gems, geodes,
  hidden ladders and shafts, lifts every 5 floors, 8 monsters, sword combat and health.
- 13 villagers with schedules, A*-pathing, 37+ lines of dialogue each (by season, weather, time,
  weekday and friendship), gift tastes, birthdays, and four heart events with choices.
- 4 festivals with minigames (Kite Day, Lantern Night, Pumpkin Roll, Frostlight Skate) and a
  token stall.
- Day/night with warm lighting, weather (sun, rain, storm with lightning, snow, wind),
  energy and passing out at 2am.

**The factory layer**
- Two-lane conveyor belts in 3 speed tiers, with curves, side-loading/merging, underground
  belts and splitters. Belts are simulated as item lanes, downstream-first.
- Arms: clockwork (spring-wound, no power), brass (fast), reaching, sorting (filter) and bulk.
- More than 25 machines with real recipes: kegs, preserves jars, furnaces, ovens, cheese presses,
  looms, seed sifters, compost bins, kilns, bee skeps, grist mills, sawmills, bottlers, bean
  roasters, rock crushers, steam kitchens, blast furnaces, tinker's benches and assemblers.
- Power: water wheels (on the river), windmills (follow the wind), steam engines (burn fuel),
  sun lenses (daylight), spring batteries, three pole types. Grids are networks, and machines
  slow down when supply is short.
- Harvest cranes, seed sowers, ore drills on quarry veins, fish traps and sap spigots.
- Bee crates (outbox, request, storage) and bumblebot drones for logistics and construction.
- Blueprints: copy, rotate and paste with ghost previews; ghosts build themselves when the parts
  are near. Bulk deconstruct and pipette.
- Production statistics: items made/used per minute at 3 time scales, with graphs, plus power
  grid graphs.
- A 60-node research tree fed by 5 tiers of research bundles made from farm and factory goods.

**Goals**
- Guided first week (tutorial quests plus contextual tips), story quests, and daily town
  requests on the notice board.
- The Clocktower Restoration Board: 16 projects in 5 areas. Rewards include the greenhouse,
  restarting the town clock, and more.
- Three late-game megaprojects (the Great Orrery, Skyship Dock, Starlight Beacon), built by
  feeding a construction site with belts and arms.
- A dynamic market: flooding one product lowers its price, weekly in-demand goods, and
  daily drift. This nudges you to diversify the factory.
- Museum donations, a collection log, mail, skills (6) and tool upgrades.

**Tech**
- TypeScript + Vite + Canvas 2D, with no engine and no assets. A fixed 60 Hz simulation is
  decoupled from rendering.
- A pure simulation layer (`src/sim`) made of component stores and systems, unit-tested in Node.
- Data-driven content in `src/data` (items, crops, trees, recipes, structures, research, NPCs,
  fish, animals, monsters, shops, quests, projects, festivals).
- Chunk-baked terrain with world-continuous procedural shading, culling and y-sorting.
- Procedural Web Audio: about 50 synthesized SFX, ambient beds, and a generative music loop
  whose scale, tempo and instruments follow the season and the hour.
- Autosave every morning, 6 manual slots, versioned save migrations, and JSON export/import.

See `PLAN.md` for the architecture, `DECISIONS.md` for design decisions and
`PROGRESS.md` for status.
