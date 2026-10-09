# Handoff: Sprocket & Sprout

A cozy farm-factory browser game: a clockwork-automation life sim in TypeScript + Vite + Canvas 2D,
with no engine and no asset files. All art and audio are procedural.

**Status (October 8, 2026):** playable and feature-complete for the original brief. On top of that:
- a large depth pass;
- an "identity pass" driven by two indie-critic reviews:
  - a clockwork-first opening, 4 game modes and 5 farm maps;
  - about 120 achievements (about 35 secret);
  - a new HUD, pixel cursor and economy fixes;
- web sharing tools.

All tests and e2e suites are green.

- **Location:** `C:\Users\jacks\Documents\sprocket-and-sprout` (git repo, branch `main`, no remote yet).
- **Docs:**
  - `README.md`: features and controls.
  - `PLAN.md`: architecture.
  - `DECISIONS.md`: 46 design decisions with reasons; #35-46 cover the identity pass.
  - `PROGRESS.md`: phase-by-phase status.
  - `SHARING.md`: putting the game online or packaging it.
- **Design reviewer:** `.claude/agents/indie-critic.md` is a project subagent. Ask Claude to "have
  indie-critic review X". It reads the code, plays the build with Playwright and returns a ranked,
  evidence-tagged critique. It is read-only. Both review rounds are summarised in DECISIONS #35-46.

## How to play

**Easiest:** double-click `Play.bat`. On the first run it installs dependencies, then starts the
server and opens http://localhost:5173. Keep its window open while you play.

Node.js on this PC is a *portable* copy at `C:\Users\jacks\tools\node-v22.20.0-win-x64`. It is not
on the Windows PATH, and `Play.bat` adds it by itself. To use `npm` in a terminal, either:
- add that folder to PATH for the current window:
  `$env:Path = "$env:USERPROFILE\tools\node-v22.20.0-win-x64;$env:Path"`
- or install Node.js LTS from https://nodejs.org.

## Sharing / publishing

See `SHARING.md` for the full guide.

- **Website.** `Package for web.bat` builds `dist/` (plus `sprocket-and-sprout-web.zip`). It is a complete
  static site and also an installable, offline-capable web app:
  - `public/manifest.webmanifest`, `public/sw.js` and the icons;
  - the service worker registers only for production builds over http(s);
  - the title screen shows **Install as an app** when the browser offers it.
- **GitHub Pages.** `.github/workflows/deploy.yml` publishes on every push to `main`. Turn it on in repo
  Settings -> Pages -> Source: GitHub Actions. The repo has no remote yet.
- **Desktop.**
  - `Build desktop app.bat` (`npm run dist:win`) runs electron-builder and puts these in `release/`:
    `Sprocket-and-Sprout-Setup-<version>.exe` (NSIS installer) and `...-Portable-<version>.exe`.
  - `electron/main.cjs` serves `dist/` over a private `app://` scheme, so modules, saves and relative
    paths behave like the website.
  - `npm run desktop` runs it from source.
  - The builds are unsigned: SmartScreen shows "More info -> Run anyway".
  - Bump `version` in package.json for each release.
- **Icons.** `scripts/make-icons.mjs` regenerates the pixel-art icons into `public/` and `build/`.

## Verify everything

```
npm run typecheck
npm test                                   # 77 Vitest tests (sim, data, modes, maps, achievements, pacing bot)
LONG=1 npx vitest run tests/longrun.test.ts    # bot plays a full in-game year, save round-trip
npm run build                              # production build, about 790 KB JS (280 KB gzipped)
node e2e/smoke.mjs http://localhost:5173/  # real UI smoke, 0 console errors expected
BASE=http://localhost:5173/ node e2e/flow.mjs  # real input: two-step new game, farm, house, bed, reload
BASE=... node e2e/windows.mjs | qa.mjs | bot.mjs 7 | house.mjs | pet.mjs | guild.mjs | ...
```

Last results: everything passes with 0 console errors.

Pacing bot over 28 days, 3 seeds:
- Story: about 10-12k coins.
- Clockwork Rush: about 12.7k coins.
- The day-1 automated sale earns about 1,400.

## Code map

```
src/engine/   loop (fixed 60 Hz sim, separate render), input (rebindable actions), rng, audio
src/data/     typed content: items, crops, trees, fish, creatures, structures, recipes, research,
              npcs, shops, goals (quests/projects/festivals), buffs, contracts, cookbook, furniture,
              perks, palette (32 colours), modes (game modes, farm maps, Rush medals)
src/sim/      pure simulation, no DOM. Game.ts (state, tick, endDay, simRate/clockRate),
              ents.ts, ports.ts, build.ts, blueprint.ts, save.ts (SAVE_VERSION 2 + MIGRATIONS;
              saves also store mode + farmKind), world/ (tilemap, worldgen, farms.ts = map variants, A*)
src/sim/systems/  one file per system, registered with registerSystem({tick, dayStart, dayEnd,
              init, save, load, afterLoad, realtime}). Import order lives in src/sim/index.ts.
              New: modes.ts (start kits, the clockwork opening, Rush scoring), achievements.ts
src/render/   renderer, lighting, weather, particles, ambient, atlas, art/*
src/ui/       immediate-mode canvas UI kit, hud.ts (layout), hudparts.ts (chronometer, odometer,
              gear hotbar, gauges, build bar, Rush tracker), pulse.ts (factory lamps),
              cursor.ts (CSS pixel cursor), tooltips, windows/* (achievements, modes = Rush result,
              palette = Sandbox build palette, plus the older ones)
src/app/      App/title/new game (two steps: character, then mode + map with a live preview),
              PlayScreen (input, build mode, guide markers, events -> UI), tips, profile.ts
              (cross-save achievement/Rush profile in localStorage), perf
tests/        Vitest suites + tests/bot.ts (scripted player; it now plays the opening too)
e2e/          Playwright scripts (e2e/out is gitignored scratch)
```

## Patterns to follow

- **Sim code never touches the DOM.** It emits events (`g.emit({t:'sfx'|'toast'|'ui'|'fx'|'ach'...})`)
  and `PlayScreen.processEvents` turns them into sound and UI.
- **Cross-system calls go through `g.sys.<name>` hooks**, which avoids import cycles. For example,
  `g.sys.achUnlock?.(g, id)` is how sim code unlocks an achievement.
- **Time:** the whole world advances by `DT * g.simRate`:
  - Cozy runs at x0.5 and building at x0.25 (`g.slowClock`, set by PlayScreen).
  - Systems that must feel real-time declare `realtime: true`: player, drops, fishing, festivals, mine.
  - The clock uses `clockRate`, which equals simRate except in Sandbox, where it only moves while you sleep.
  - Never slow only the clock. That was a 4x output exploit, and a test now guards it.
- **Modes and maps:**
  - Modes are rule tweaks keyed on `g.mode`. Maps only reshape the farm rectangle (`farms.ts`),
    so the town, NPC schedules and story locations work on every map.
  - New-game-only setup goes in a system's `init` (it is skipped when loading).
- **Quests:**
  - `needFlag` gates quests to the new opening.
  - A prerequisite gated by a missing flag counts as met, so old saves keep their chain.
  - `build`/`craft` objectives check what you already own.
  - At most 3 story quests are active. Sandbox has none; Rush keeps only the tutorial.
- **Achievements:**
  - Add them to `ACHIEVEMENTS` with either a `test(g)` (polled every 2 s) or an event-time `unlockAch`.
  - Secrets need a `hint`.
  - `tests/modes.test.ts` checks ids, icons and hints.
- **Other conventions (unchanged):**
  - Item keys are `index*4 + quality`. Saves store `[id, quality]`.
  - The `O` enum is saved by value, so only append to it.
  - Flags are saved automatically.

## Environment notes (for whoever works on this next)

- **Keep the project in a normal folder like Documents.** The app's scratch-workspace path broke Vite.
- **Playwright uses the installed Chrome** (`channel: 'chrome'`).
- **The dev server:** the owner usually has `Play.bat` running at http://localhost:5173. E2E scripts
  accept `BASE=http://localhost:5173/`. `e2e/out/peek.mjs` (gitignored) is a handy one-shot screenshot
  helper. The in-app browser pane often runs hidden, which pauses `requestAnimationFrame`; use headless
  Playwright screenshots to check visuals.
- **Shell gotcha:** in this environment, bash heredocs fed to `python -`/`cat` lose backslashes
  (`\'` becomes `'`). Use the Edit tool for any text with escaped quotes.

## Known issues / loose ends

- Bumblebots in flight during a manual mid-day save return to their hive on load.
- NPC paths cached before a big structure is placed can clip through it until the cache clears.
- The noon/6pm post tally (`g.sys.postDay`) isn't saved. After a mid-day reload, the night summary
  lists only sales made since the reload. Money is never lost.
- The pacing bot is simple: it ships crops and builds one arm line, with no real factory. It is a
  floor for balance, not a target.
- Tinker's Yard's ruins are still plain cobble halls. They need wrecked-machine dressing.

## Deferred from the indie-critic reviews (biggest first)

1. About 15 crops still use Stardew's exact price/seed/growth numbers. Re-derive them from this
   game's own clock (e.g. `price = (seed + growDays*6) * tagMult`).
2. The cast maps one-to-one onto Stardew archetypes. Re-role about 6 villagers into steampunk roles
   (lock-keeper, Guild factor, tram conductor...).
3. Founder's Day is the year-end candle evaluation. Turn it into a "Clockmakers' Exhibition" that
   scores a machine line's throughput.
4. Tock, an automaton companion (reuse the `pet.ts` steering), plus a "winding" verb for arms.
5. A Post Tube object to replace the crate and mailbox. Town decoration: stalls, tram, brass clock.
6. Crafting grid: category headers and labels. "Hide locked" is now on by default.
7. The critic's cut list: romance, mine 60 to 30 floors, fewer festivals and goal systems.
