# Sprocket & Sprout

A cozy top-down pixel-art farm-factory. You arrive in the valley town of **Thistlewick** to
take over the old keeper's clockwork farm. Their beans are ripe and their preserves jar still
works, and within minutes your first Clockwork Arm is carrying jars to the shipping crate.
With Professor Cogwhistle's research you add belts, mills, water wheels and little brass
bumblebots, until the farm runs itself like a music box.

All art, music and sound are generated procedurally in code: there are no image or audio
files. Everything is original.

## Run it

**On Windows, just double-click `Play.bat`.** It installs dependencies on the first run, starts
the game and opens your browser. Keep its window open while you play.

With Node.js on your PATH you can also run:

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

**Sharing it:** see [SHARING.md](SHARING.md).
- **Your own website:** `Package for web.bat` makes a static site. Host it on GitHub Pages (a
  workflow is included), Netlify or Cloudflare Pages. Visitors can press **Install as an app** to keep
  it as an offline app.
- **A Windows download:** `Build desktop app.bat` makes an installer and a portable `.exe` in
  `release/` (Electron). `npm run desktop` runs the desktop version from source. If PowerShell says `npm` is not
recognized, Node isn't on your PATH: use `Play.bat`, or install Node.js LTS from nodejs.org.
See `HANDOFF.md` for details.

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | type-check + production build into `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest unit tests (simulation, data validation, pacing bot) |
| `node e2e/smoke.mjs` | Playwright smoke test through the real UI (needs the dev server and Chrome) |
| `npm run screens` | screenshots 43 screens and windows and checks the UI for overlapping or cut-off text; report in `e2e/out/screens/report.md` |
| `node e2e/bot.mjs 14` | Playwright bot plays 14 in-game days, screenshots every morning |
| `node e2e/perf.mjs` | builds a 1300-belt / 260-machine factory and measures frame + tick times |
| `node e2e/shots.mjs farm,town,npcs,minefloor,factory` | screenshots of scenes and windows |
| `node e2e/flow.mjs` | real-input flow: new game, farm, go inside, sleep in the bed, continue |
| `node e2e/house.mjs`, `pet.mjs`, `decor.mjs`, `guild.mjs`, `cart.mjs`, `pond.mjs`, `logi.mjs` | screenshots of the newer systems (into `e2e/out/`) |
| `LONG=1 npx vitest run tests/longrun.test.ts` | the bot plays a whole in-game year, then saves and reloads |

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
| Achievements | U |
| Quick stack bag items into nearby chests | K |
| Drop one item | Z |
| Zoom | + / - or Ctrl + wheel |
| Pause / close | Esc |
| Debug & cheat panel | ` (backtick) |

The debug panel (backtick) can add money, skip time, unlock all research, give a factory kit
or resources, warp around the map, and jump straight to the newer systems: a stray pet, the
Trading Guild with its depot, a fully renovated farmhouse, every furniture piece, Founder's Day,
or a Brass Locket.

## Features

**Ways to play**
- Four game modes: **Story**, **Cozy** (half-speed clock, nothing punishes you), **Clockwork
  Rush** (28 days, score as many coins as you can, bronze/silver/gold medals and local best runs)
  and **Sandbox** (everything researched, free building, the clock waits for you).
- Five farm maps: Overgrown Homestead, Riverside Mill (a stream through the farm), Tinker's Yard
  (ruined workshop halls and a copper seam for drills), Terraced Highlands (cliff terraces, windy)
  and Wildwood (a forest farm). Each one has its own starting kit and achievement.
- About 120 achievements in 8 categories, including about 35 secret easter eggs that only show a
  hint. Press U. Secrets pay a few coins, and a profile remembers every unlock across farms.

**Farming life**
- 36 crops across four seasons. Many regrow, some climb trellises, grains need a scythe, and
  cabbages, melons, pumpkins and glowmelons can form 3x3 giant crops.
- Watering, rain, sprinklers (3 tiers) and powered mist towers. Six fertilizers (quality,
  speed, water-keeping). Silver, gold and star quality tiers.
- Fruit trees and wild trees with seasonal looks, tapping for syrup, resin, tar and sap.
- A ruined greenhouse you can restore to grow all year.
- Coops and barns (3 tiers each) with chickens, ducks, rabbits, cows, goats, sheep, pigs and
  alpacas. They need hay (scythe tall grass into silos), love being petted, and lay better goods
  when happy.
- Fishing with an original tension-reel minigame: 27 fish by location, season, hour and weather,
  three legendaries (each gives a wall trophy), wicker traps for shellfish, and fish ponds that
  grow a school and lay roe.
- The Old Mine: 60 procedural floors in three themes (earth, frost, ember), ores, gems, geodes,
  hidden ladders and shafts, lifts every 5 floors, 8 monsters, sword combat and health. Grand
  treasure chests wait on every tenth floor, and infested floors must be cleared to go deeper.
- Professions: choose one of two perks at skill levels 5 and 10 (24 perks across 6 skills).
- Day/night with warm lighting, weather (sun, rain, storm with lightning, snow, wind), energy,
  passing out at 2am (you sleep in until 10), and the odd surprise overnight (meteorites, a crop fairy, windstorms).

**Home**
- A walk-in farmhouse: sleep in your bed (you wake up inside), warm up by the hearth, and read
  the almanac for tomorrow's weather, this week's market demand, birthdays, festivals and a
  Sunday recipe.
- Renovations from the carpenter: a kitchen for instant home cooking, a root cellar pantry, a
  featherbed and a grand hearth.
- Cooking: 22 dishes. Villagers teach you their recipes as friendships grow. Cooked food gives
  timed buffs (speed, stamina, fishing, mining, luck, defense, farming).
- Furniture: armchairs, lamps, rugs, a fish tank, plants, a pet bed, cart-only curios, and
  paintings from Hazel. Rugs stack under furniture and paintings hang on the wall.
- A farm pet: a stray cat or dog adopts you on day 3. Name it, pet it and fill its water bowl,
  and it will follow you around, nap in its bed and leave gifts by the door.

**Town**
- 13 villagers with schedules, A*-pathing, 37+ lines of dialogue each (by season, weather, time,
  weekday and friendship), gift tastes, birthdays, and four heart events with choices.
  Friends drop by your farm on weekend afternoons.
- Romance: give the Brass Locket to a villager you love. Your partner makes breakfast, helps
  with chores and spends evenings by your hearth.
- 9 shops plus Mags' Traveling Cart (Fridays and Sundays) with rare seeds, recipe cards and
  furniture.
- 4 festivals with minigames (Kite Day, Lantern Night, Pumpkin Roll, Frostlight Skate) and a
  token stall.

**The factory layer**
- Two-lane conveyor belts in 3 speed tiers, with curves, side-loading/merging, underground
  belts and splitters (alternate, prefer a side, or filter one item out). Belts are simulated
  as item lanes, downstream-first.
- Arms: clockwork (spring-wound, no power), brass (fast), reaching, sorting (filter) and bulk,
  with optional stock limits.
- More than 25 machines with real recipes: kegs, preserves jars, furnaces, ovens, cheese presses,
  looms, seed sifters, compost bins, kilns, bee skeps, grist mills, sawmills, bottlers, bean
  roasters, rock crushers, steam kitchens, blast furnaces, tinker's benches and assemblers.
- Power: water wheels (on the river), windmills (follow the wind), steam engines (burn fuel),
  sun lenses (daylight), spring batteries, three pole types. Grids are networks, and machines
  slow down when supply is short.
- Harvest cranes, seed sowers, ore drills on quarry veins, fish traps, fish ponds and sap spigots.
- Bee crates (outbox, request, storage) and bumblebot drones for logistics and construction.
- Blueprints: copy, rotate and paste with ghost previews (settings included); ghosts build
  themselves when the parts are near. Bulk deconstruct and pipette.
- Production statistics: items made/used per minute at 3 time scales, with graphs, plus power
  grid graphs.
- A 60-node research tree fed by 5 tiers of research bundles made from farm and factory goods.

**Goals**
- Guided first week (tutorial quests plus contextual tips), story quests, and daily town
  requests on the notice board.
- Trading Guild contracts: three bulk orders every week, delivered to a Freight Depot that arms
  can feed. Reputation ranks raise all shipping prices.
- The Clocktower Restoration Board: 16 projects in 5 areas. Rewards include the greenhouse,
  restarting the town clock, and more.
- Three late-game megaprojects (the Great Orrery, Skyship Dock, Starlight Beacon), built by
  feeding a construction site with belts and arms.
- Founder's Day: every new year the Mayor reviews the farm on 18 criteria and lights up to four
  candles, each tier unlocking a reward.
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
