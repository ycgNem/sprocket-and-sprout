# Handoff: Sprocket & Sprout

A cozy farm-factory browser game: a clockwork-automation life sim in TypeScript + Vite + Canvas 2D,
with no engine. The pixel art is PixelLab-generated and packed into small PNG sheets (`src/art/`);
music and most sound are procedural, some SFX come from a jsfxr bank.

**Status (October 9, 2026, evening):** 1.0 shipped; the 1.1 visual overhaul (`ROADMAP.md`) has Phases
0-2 done and live on the website. **Phase 3 session 1 is done and committed locally (not pushed yet:
pushing deploys)**: the juice layer, key bubbles, a resequenced first session from the indie-critic's
playthrough, the post courier, the title wordmark with the sprocket O. See ROADMAP.md, Phase 3,
"Session 1 … done" for the list and what's still open. Phase 4 (review, release 1.1) remains.
- **Live:** https://ycgnem.github.io/sprocket-and-sprout/ (redeploys on every push to `main`);
  Windows installers on https://github.com/ycgNem/sprocket-and-sprout/releases/tag/v1.0.0.
- **Phase 0 of the overhaul is done** (Oct 9): the player-look bug, belt items on the pixel grid,
  the title overlap, an integer-grid rule for every scaled sprite, and `npm run screens` (a
  43-screen sweep with an automatic UI overlap audit, now at 0 issues).
- **Phase 1 is done** (Oct 9): `STYLE.md`, Resurrect 64, PNG sheets in the atlas (`src/art/`,
  `src/render/art/sheets.ts`), `scripts/art-import.mjs`, a PixelLab player with walk + hoe swing.
- **Phase 2 is done** (Oct 9, one session): every sprite the game draws is imported art (6,415 names,
  `node e2e/coverage.mjs` = 100%). 11 parallel `art-director` agents, ~1,100 PixelLab generations
  plus ~230 for the hair-style tool swings (about 660 left this month, reset Nov 9; the owner added
  $2 of credits, unused). See ROADMAP.md
  Phase 2 for what was made and the indie-critic's open items. The C32 player look is the one built
  out (tool swings, 10 hair styles); the `candidate-*` sheets only feed the debug Compare lineup.
  Next: the open critic items, then Phase 3 (juice).

1.0 itself was feature-complete for the original brief. On top of that:
- a large depth pass;
- an "identity pass" driven by two indie-critic reviews:
  - a clockwork-first opening, 4 game modes and 5 farm maps;
  - about 120 achievements (about 35 secret);
  - a new HUD, pixel cursor and economy fixes;
- web sharing tools.

All tests and e2e suites are green.

- **Location:** `C:\Users\jacks\Documents\sprocket-and-sprout` (git repo, branch `main`, remote
  `origin` = https://github.com/ycgNem/sprocket-and-sprout, public).
- **Docs:**
  - `README.md`: features and controls.
  - `PLAN.md`: architecture.
  - `DECISIONS.md`: 46 design decisions with reasons; #35-46 cover the identity pass.
  - `PROGRESS.md`: phase-by-phase status.
  - `SHARING.md`: putting the game online or packaging it.
  - `ROADMAP.md`: **the current plan** (visual overhaul toward 1.1): owner decisions, phases,
    hard art rules and the prompt that starts each phase.
  - `references/`: the owner's taste: `notes.md`, palettes (Resurrect 64 is the chosen one), and
    screenshots of admired games (`games/`, gitignored because they are other studios' work).
- **Project agents** (`.claude/agents/`):
  - `indie-critic`: design review. Reads the code, plays the build with Playwright, returns a
    ranked, evidence-tagged critique. Read-only. Both review rounds are in DECISIONS #35-46.
  - `art-director`: owns `STYLE.md`, generates art with PixelLab, grades it onto the palette and
    imports it as sheets (`art/README.md`). Several can run in parallel, one per art group. Never commits.
  - `qa-screens`: runs `npm run screens` and reports overlaps, off-grid sprites and regressions.
    Read-only.
- **Tools connected on this PC:** PixelLab MCP (pixel-art generation; added with `claude mcp add`,
  local scope for this project), ComfyUI skill (concept art), jsfxr (in the repo).

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
- **GitHub Pages.** `.github/workflows/deploy.yml` runs the tests, builds and publishes on every push to
  `main`. It is on and live at https://ycgnem.github.io/sprocket-and-sprout/. **Pushing = deploying.**
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
npm test                                   # 99 Vitest tests (sim, data, modes, maps, achievements, UI audit, art lookup, juice/prompts, pacing bot)
LONG=1 npx vitest run tests/longrun.test.ts    # bot plays a full in-game year, save round-trip
npm run build                              # production build, about 1.1 MB JS (380 KB gzipped) + ~500 KB of PNG sheets
node e2e/smoke.mjs http://localhost:5173/  # real UI smoke, 0 console errors expected
npm run screens                            # 48-screen sweep + overlap audit -> e2e/out/screens/report.md (0 issues expected)
node e2e/coverage.mjs                      # every sprite name vs imported art (6415/6415 = 100% expected)
node e2e/sprites.mjs <name> ...            # imported vs procedural sprites side by side
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
src/engine/   loop (fixed 60 Hz sim, separate render), input (rebindable actions, keyLabel), rng,
              audio/audio.ts (procedural SFX + music), audio/sfxr.ts (jsfxr bank: base58 sounds
              from sfxr.me; ids in SFXR_BANK override the synthesized version)
src/data/     typed content: items, crops, trees, fish, creatures, structures, recipes, research,
              npcs, shops, goals (quests/projects/festivals), buffs, contracts, cookbook, furniture,
              perks, palette (32 colours), modes (game modes, farm maps, Rush medals)
src/sim/      pure simulation, no DOM. prompts.ts (what F / a left click would do on a tile, for the key
              bubbles; questTarget for the guide arrow and compass). Game.ts (state, tick, endDay, simRate/clockRate),
              ents.ts, ports.ts, build.ts, blueprint.ts, save.ts (SAVE_VERSION 2 + MIGRATIONS;
              saves also store mode + farmKind), world/ (tilemap, worldgen, farms.ts = map variants, A*)
src/sim/systems/  one file per system, registered with registerSystem({tick, dayStart, dayEnd,
              init, save, load, afterLoad, realtime}). Import order lives in src/sim/index.ts.
              New: modes.ts (start kits, the clockwork opening, Rush scoring), achievements.ts
src/render/   juice.ts (Phase 3 reward layer: sprite effects, confetti, rings, hops, item/coin flights
              into the HUD, streak counter, ribbons, big pop numbers, the post courier; drawFx with
              code fallbacks), renderer (dual-grid terrain bake, y-sorted sprites), lighting, weather, particles, ambient,
              atlas.ts (sprite cache, imported sheet frames, hasImage, drawFit, drawItemIcon),
              art/sheets.ts (loads src/art/*.json: character, sprites, terrain kinds), art/match.ts
              (pattern + Wang vertex rules), art/* (procedural generators = the ?art=old fallback)
src/art/      imported sprite sheets (PNG + JSON manifest), written by scripts/*-import.mjs
art/          per-group art sources: raw PixelLab downloads, build scripts, import recipes
src/ui/       immediate-mode canvas UI kit (ui.ts; records draws for the audit when ui.audit is on),
              audit.ts (overlap checks: clash/overflow/covered), font.ts (textWidth, wrapText, ellipsize),
              hud.ts (layout), hudparts.ts (chronometer, odometer,
              gear hotbar, gauges, build bar, Rush tracker), pulse.ts (factory lamps),
              cursor.ts (CSS pixel cursor), tooltips, windows/* (achievements, modes = Rush result,
              palette = Sandbox build palette, plus the older ones)
src/app/      App/title/new game (two steps: character, then mode + map with a live preview),
              PlayScreen (input, build mode, guide markers, events -> UI), tips, profile.ts
              (cross-save achievement/Rush profile in localStorage), perf
tests/        Vitest suites + tests/bot.ts (scripted player; it now plays the opening too)
e2e/          Playwright scripts (e2e/out is gitignored scratch); screens.mjs = the sweep (add new
              screens to its SC table)
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
- **Pixel grid (Phase 0 rule):** never draw a sprite at a fractional scale. Use `drawFit` (whole-number
  scale into a box) or `drawItemIcon` (10 px `ib:` icon below 13 px, 16 px 1:1 up to 31, multiples
  above); `ui.itemIcon` and `ui.spriteIcon` already do. The rotated tool swing is the one known exception.
- **Overlays and windows:** while a modal window is open, the HUD isn't drawn, and toasts and the
  achievement banner wait (they don't age). Non-modal windows (`modal: false`, e.g. the fade) don't count.
  `PlayScreen.modalOpen` is the check.
- **Sprite cache:** sprites are generated once per name and cached. If what a name draws changes at
  runtime (like the player look), flush it with `invalidateSpritePrefix`.
- **Other conventions (unchanged):**
  - Item keys are `index*4 + quality`. Saves store `[id, quality]`.
  - The `O` enum is saved by value, so only append to it.
  - Flags are saved automatically.

## The art pipeline (Phase 2)

- Every sprite is looked up by name in the atlas; imported sheets (`src/art/*.json` + `.png`) win
  over the procedural generators in `src/render/art/`, which remain as the `?art=old` fallback.
- Sheet kinds (loaded by `src/render/art/sheets.ts`): `character` (art-import.mjs), `sprites` (any
  name or `*`/`**` pattern; sprites-import.mjs), `terrain` (dual-grid Wang ground; terrain-import.mjs).
- Each art group lives in `art/<group>/` with its raw PixelLab downloads, its build scripts and its
  recipe; `art/README.md` says how to regenerate and import. `node e2e/coverage.mjs` lists anything
  still procedural; `node e2e/sprites.mjs <names>` draws imported vs procedural side by side.
- Renderer hooks that only exist for imported art: `emote:*`, `amb:*`, `bot:*`, `fx:*` (letter,
  pennants, fireball, twinkle, nopower, pip), `gh:glass:*`, `armh:*`, `hf:fire|pendulum|gpend|steam|fish`,
  `ui:*` (nine-slice skin, `src/ui/skin.ts`), factory `meta.smoke` chimney points.
- Gotchas: Vite serves hot-updated modules as `?t=` URLs, so page scripts import the app's own
  instance (see `mod()` in `e2e/sprites.mjs`). Agents' imports trigger full reloads in open pages.

## What's next

`ROADMAP.md` is the plan for the 1.0 → 1.1 visual overhaul. Phases 0-2 are done; Phase 3 session 1
is done (local commits, not pushed). Next session:

> Read ROADMAP.md and HANDOFF.md. Push the Phase 3 commits if the owner agreed. Then Phase 3
> session 2: the open items in ROADMAP.md Phase 3 (the critic's replay findings, shoreline foam
> via terrain art, a compact HUD for 540–679 px tall windows). Use the art-director agent for art.
> Run npm run screens through qa-screens, then the indie-critic agent. Commit; push with the OK.

Phase 3 patterns:
- Sim code emits reward events (`harvest`, `made`, `quest`, `post`, `crated`, `hop`); `PlayScreen.processEvents`
  turns them into juice. Money earned while playing becomes a coin shower automatically (money diff per frame);
  set `coinSrc`/`coinWait` in an event handler to aim or delay it.
- Effects are looked up by name (`drawFx(ctx, 'fx:star', frame, x, y)`); frame counts live in `FRAMES` in
  juice.ts. Sheets: `src/art/juice.*`, `src/art/logo.*`, `src/art/guide.*` (sources in `art/<group>/build.mjs`).
- Quests: `load` objective (F at a machine), `craft … fresh: true`, `firstDayFrom` (hour gate on day one).
- jsfxr sounds designed as parameter sets in `scripts/sfx-design.mjs` (`--wav` writes files to listen to);
  loudness per sound in `BANK_GAIN` (base58 strings carry no volume); `Audio.sfx(id, v, pitch)`.

Owner decisions so far: full art replacement through PixelLab (generation budget is fine to spend;
compromise with code-drawn art only where it looks as good); anything that moves gets real
animation frames; map and farm first; Resurrect 64 palette (never under 48 colors); features and
visible change over polish.

## Environment notes (for whoever works on this next)

- **Keep the project in a normal folder like Documents.** The app's scratch-workspace path broke Vite.
- **Playwright uses the installed Chrome** (`channel: 'chrome'`).
- **The dev server:** the owner usually has `Play.bat` running at http://localhost:5173. E2E scripts
  accept `BASE=http://localhost:5173/`. `e2e/out/peek.mjs` (gitignored) is a handy one-shot screenshot
  helper. The in-app browser pane often runs hidden, which pauses `requestAnimationFrame`; use headless
  Playwright screenshots to check visuals.
- **Shell gotcha:** in this environment, bash heredocs fed to `python -`/`cat` lose backslashes
  (`\'` becomes `'`), and long heredocs with quotes can fail to parse. Use the Edit tool, or
  write the script to a file first.
- **Line endings:** git checks files out with CRLF here (autocrlf) and commits LF (`.gitattributes`).
  Scripted edits must match CRLF or normalize first; the Edit tool handles it. "CRLF will be
  replaced by LF" warnings on commit are harmless.
- **The owner's dev server answers on `localhost`, not `127.0.0.1`.** Pass `http://localhost:5173/`.
  After hot updates, Vite serves edited modules as `?t=` URLs, so `import('/src/...')` from page
  scripts can get a second module instance; find the URL the app loaded via
  `performance.getEntriesByType('resource')`, or reload first.
- **Handy scratch helpers** (in gitignored `e2e/out/`): `titleshot.mjs` (title screen with a frozen
  camera), `compare.mjs` (before/after side by side, pixel-perfect), `crop.mjs` (crop + enlarge).

## Known issues / loose ends

- Bumblebots in flight during a manual mid-day save return to their hive on load.
- NPC paths cached before a big structure is placed can clip through it until the cache clears.
- The noon/6pm post tally (`g.sys.postDay`) isn't saved. After a mid-day reload, the night summary
  lists only sales made since the reload. Money is never lost.
- The pacing bot is simple: it ships crops and builds one arm line, with no real factory. It is a
  floor for balance, not a target.
- Tinker's Yard's ruins are still plain cobble halls. They need wrecked-machine dressing.
- The title footer shows package.json's version (1.0.0); bump to 1.1.0 at release (Phase 4).
- Open art items from the Phase 2 critic review are in ROADMAP.md (NPC walk faces, strike-frame
  tool heads, riverbanks, winter dirt, the world-map window, logo, chronometer sky, player portrait).
- The jsfxr sounds (coin/sell/ship, levelup, hurt) are generated placeholders; nobody has listened yet.
- `npm run screens` doesn't cover every festival, dialogue, cooking/adopt/elevator or the result screens.

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
