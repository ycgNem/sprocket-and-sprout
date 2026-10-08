# Handoff: Sprocket & Sprout

A cozy farming + factory-automation browser game (Stardew-style life sim and Factorio-style
logistics), written in TypeScript + Vite + Canvas 2D with no engine and no asset files. All art
and audio are procedural. **Status: playable and feature-complete for the original brief, with a
large post-brief depth pass. All tests and e2e suites are green. The working tree is clean and
everything is committed.**

- Location: `C:\Users\jacks\Documents\sprocket-and-sprout` (git repo, branch `main`)
- Docs: `README.md` (features, controls), `PLAN.md` (architecture), `DECISIONS.md` (34 design
  decisions with reasons), `PROGRESS.md` (phase-by-phase status and known issues)

## How to play

**Easiest:** double-click `Play.bat` in the project folder. On the first run it installs
dependencies, then starts the game server and opens your browser at http://localhost:5173. Keep
the black window open while playing and close it to stop.

**Why `npm install && npm run dev` didn't work:** Node.js on this PC is a *portable* copy at
`C:\Users\jacks\tools\node-v22.20.0-win-x64`. It isn't on the Windows PATH, so PowerShell and cmd
don't know `node`/`npm` (the dev sessions only reached it through Git Bash shims in `~/bin`).
`Play.bat` adds that folder itself. To use `npm` directly in PowerShell, do one of these:

- Temporarily, in the current window:
  `$env:Path = "$env:USERPROFILE\tools\node-v22.20.0-win-x64;$env:Path"`
- Permanently: install Node.js LTS from https://nodejs.org (the simplest option), or add that
  folder to your user PATH in Windows "Edit environment variables for your account", then open
  a new terminal.

Then `npm install`, `npm run dev`, and open the URL it prints.

## Environment notes (for whoever works on this next)

- The project must stay in a normal folder like Documents. The app's scratch workspace path
  broke Vite ("Failed to load url"), which is why the project was moved here.
- Playwright uses the installed Chrome (`channel: 'chrome'`). Its bundled Chromium failed to
  spawn on this machine.
- In the Claude Code sandbox, running vite or Playwright needed the sandbox disabled. That
  doesn't affect normal use.
- The e2e scripts expect a dev server. They default to `http://127.0.0.1:5173/` and accept
  `BASE=...`. Plain `npm run dev` listens on `localhost`, so use `BASE=http://localhost:5173/`
  or start vite with `--host 127.0.0.1`.

## Verify everything

```
npm run typecheck                         # TypeScript
npm test                                  # 60 Vitest tests (sim, data, systems, pacing bot)
LONG=1 npx vitest run tests/longrun.test.ts   # bot plays a full in-game year, save round-trip
npm run build                             # production build (about 735 KB JS)
node e2e/smoke.mjs                        # real UI smoke, 0 console errors expected
node e2e/flow.mjs                         # real input: new game, farm, house, bed, reload
node e2e/windows.mjs | shots.mjs | bot.mjs | perf.mjs | qa.mjs
node e2e/house.mjs | pet.mjs | decor.mjs | guild.mjs | cart.mjs | pond.mjs | logi.mjs
```

Last results: every suite passes with 0 console errors. The perf bench (1,320 belts, 260
machines, 5k items on belts) averages about 7.3 ms per frame and 0.2 ms per sim tick.
Screenshots go to `e2e/out/` (gitignored).

## Code map

```
src/engine/   loop (fixed 60 Hz sim, separate render), input (rebindable actions), rng, audio
src/data/     all content as typed data: items, crops, trees, fish, creatures, structures,
              recipes, research, npcs, shops, goals (quests/projects/festivals), buffs,
              contracts, cookbook, furniture, perks, palette (32 colours)
src/sim/      pure simulation, no DOM. Game.ts (state, tick, endDay), ents.ts (entities with
              belt/arm/mach/inv/gen components), ports.ts (generic item in/out + PORT_HANDLERS),
              build.ts, blueprint.ts, save.ts (versioned, SAVE_VERSION 2 + MIGRATIONS),
              world/ (tilemap, worldgen, A* path)
src/sim/systems/  one file per system, registered with registerSystem({tick, dayStart,
              dayEnd, save, load, afterLoad}). Import order lives in src/sim/index.ts.
src/render/   renderer (chunk-baked terrain, y-sorted drawables), lighting, weather,
              particles, ambient, atlas (lazy sprite families by name prefix), art/*
src/ui/       immediate-mode canvas UI kit, HUD, tooltips, windows/* (registered by id)
src/app/      App/title/new game, PlayScreen (input, build mode, events → UI), tips, perf
tests/        Vitest suites + tests/bot.ts (scripted player)
e2e/          Playwright scripts
```

**Patterns to follow**
- Sim code never touches the DOM. It emits events (`g.emit({t:'sfx'|'toast'|'ui'|'fx'...})`)
  and `PlayScreen.processEvents` turns them into sound and UI.
- Cross-system calls go through `g.sys.<name>` hooks to avoid import cycles. Systems that don't
  form cycles import each other directly.
- `player.where` is `'world' | 'mine' | 'house'`. `curMap(g)` returns the active map. Anything
  that touches world entities or soil must check `where === 'world'`, because house and mine
  coordinates overlap world coordinates.
- Item keys are `index*4 + quality`. Saves store `[id, quality]`, so adding items is safe.
- The `O` (object) enum in `tilemap.ts` is saved by value: **only append** new members.
- New persistent state goes in a system's `save`/`load`. Flags (`g.flags`) are saved
  automatically and are fine for one-off unlocks.
- Content goes in `src/data` first. `tests/data.test.ts` checks that every item, recipe, shop
  entry and structure is valid and obtainable.

## What was added after the original brief

The farmhouse interior (bed, hearth, almanac, kitchen cooking, root cellar, renovations),
furniture (24 pieces, wall and floor, rugs stacking), farm pet (stray cat or dog), partners
(Brass Locket), food buffs, a cookbook learned through friendship, villagers visiting the farm,
Trading Guild weekly contracts with a Freight Depot, Mags' traveling cart, professions (24
perks), fish ponds, mine treasure and infested floors, night events, Founder's Day yearly
review, legendary fish trophies, splitter filter and priority, arm stock limits, quick stack (K),
seasonal house decorations, onboarding tips, and debug-panel shortcuts for all of it. Details
are in PROGRESS.md.

## Known issues / loose ends

- Bumblebots in flight during a manual mid-day save return to their hive on load.
- NPC paths cached before a big structure is placed can clip through it until the cache clears.
- The pacing bot's income stalls in week 2 (it plants slow crops and hoards for bundles). That's
  the bot's strategy, not a game bug. Real play earns more.
- The pet and the partner don't use A* (they steer and slide). That's fine for a yard and a
  room, but the pet can snag on fences.
- Placed furniture can overlap the spot where the partner sits in the evening (cosmetic).

## Ideas for next steps

Placeable decor outdoors, farmhouse expansion tiers, a fish-trophy room or aquarium, more
festivals (a night market), smarter mid-game bot strategies to validate late-game balance, and a
title-screen "continue" thumbnail.
