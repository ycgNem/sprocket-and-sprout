# Handoff: Sprocket & Sprout

A cozy farm-factory browser game: a clockwork-automation life sim in TypeScript + Vite + Canvas 2D,
with no engine. The pixel art is PixelLab-generated and packed into small PNG sheets (`src/art/`);
music and most sound are procedural, some SFX come from a jsfxr bank.

**Status (October 9, 2026, night): 1.1.0 is released.** The visual overhaul (`ROADMAP.md`, Phases
0-4) is done: imported PixelLab art everywhere, the juice layer, a reworked first session, then a
code review and a full indie-critic review with their fixes (ROADMAP.md, Phase 4). New in 1.1 at
the owner's request: **Roxy Vane**, a sky-courier villager with her airship on Skyhook Field
(DECISIONS #47). Open items are at the end of ROADMAP.md Phase 4.
- **Live:** https://ycgnem.github.io/sprocket-and-sprout/ (redeploys on every push to `main`);
  Windows installers on https://github.com/ycgNem/sprocket-and-sprout/releases/tag/v1.1.0 (1.0.0 is
  still there too). Git tag `v1.1.0` = commit `933bd86`.
- **After the release** (same night, pushed to the website, not in the v1.1.0 installers): a fix
  for a rare tutorial blocker. On some seeds (90, 99, …) the daily weed roll put a weed on the
  opening's first arm tile, so "A Helping Hand" answered "Clear the ground first". The opening's
  marked tiles are now off-limits to weeds and storm debris (`src/sim/opening.ts`). Ship it in the
  next desktop build (1.1.1).
- **The overhaul, phase by phase** (all in ROADMAP.md):
  - Phase 0: pixel-grid rule, overlap-free UI, `npm run screens`.
  - Phase 1: `STYLE.md`, Resurrect 64, PNG sheets in the atlas, the import pipeline.
  - Phase 2: every sprite is imported PixelLab art (6,415 names, `node e2e/coverage.mjs` = 100%).
    The C32 player look is the one built out; the `candidate-*` sheets only feed the debug Compare lineup.
  - Phase 3: the juice layer, key bubbles, the reworked first session, the post courier, the wordmark.
  - Phase 4: code review + full critic review and their fixes, Roxy Vane, 1.1.0 released.
- **PixelLab budget:** 520 generations left this cycle (Tier 1, 2,000 a month, resets Nov 9);
  the owner's $2 of credits are unused.

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
  - `DECISIONS.md`: 48 design decisions with reasons; #35-46 cover the identity pass, #47 Roxy
    (why she breaks the villager template), #48 the 2x UI on laptop windows.
  - `PROGRESS.md`: phase-by-phase status.
  - `SHARING.md`: putting the game online or packaging it.
  - `ROADMAP.md`: the 1.0 → 1.1 overhaul (done): owner decisions, phases, hard art rules, and
    **the open items at the end of Phase 4**, which are the starting list for the next version.
  - `STYLE.md`: the art rules (now with Roxy's exception and baked building shadows).
  - `references/`: the owner's taste: `notes.md`, palettes (Resurrect 64 is the chosen one), and
    screenshots of admired games (`games/`, gitignored because they are other studios' work).
- **Project agents** (`.claude/agents/`):
  - `indie-critic`: design review. Reads the code, plays the build with Playwright, returns a
    ranked, evidence-tagged critique. Read-only. Both review rounds are in DECISIONS #35-46. A full
    review takes about 50 minutes; give it a stable build outside the repo when you're editing code
    meanwhile (`npx vite build --outDir ../sns-review --emptyOutDir` +
    `npx vite preview --outDir ../sns-review --port 4173`; see the Vite note under Environment).
    Its report arrives as the agent's final message (it writes screenshots, not a report file).
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
npm test                                   # 108 Vitest tests (sim, data, modes, maps, achievements, UI audit, art lookup, juice/prompts, Roxy, pacing bot)
LONG=1 npx vitest run tests/longrun.test.ts    # bot plays a full in-game year, save round-trip
npx vite-node scripts/pace.ts story rush   # economy: the bot's 28-day earnings on 8 seeds (a few minutes)
npm run build                              # production build, about 1.2 MB JS (386 KB gzipped) + ~520 KB of PNG sheets
node e2e/smoke.mjs http://localhost:5173/  # real UI smoke, 0 console errors expected
npm run screens                            # 51-screen sweep + overlap audit -> e2e/out/screens/report.md (0 issues expected); VIEW=1366x620 for another size
node e2e/coverage.mjs                      # every sprite name vs imported art (6415/6415 = 100% expected)
node e2e/sprites.mjs <name> ...            # imported vs procedural sprites side by side
BASE=http://localhost:5173/ node e2e/flow.mjs  # real input: two-step new game, farm, house, bed, reload
BASE=http://localhost:5173/ node e2e/roxy.mjs  # real input: Roxy's door intro -> shop, chat, gift, 2-heart event
BASE=... node e2e/windows.mjs | qa.mjs | bot.mjs 7 | house.mjs | pet.mjs | guild.mjs | ...
```

Last results (October 9, night): everything above passes with 0 console errors; the sweep is 51
shots / 0 issues at 1280x720 and clean at 1366x620.

Pacing bot, `scripts/pace.ts`, 28 days, 8 seeds:
- Story: average 10.7k coins (9.5k to 11.9k). Before this session's changes: 10.9k.
- Clockwork Rush: average 13.0k (10.4k to 14.2k), so the medals (20k / 40k / 65k) still sit at
  about 1.5x / 3x / 5x the bot.
- Day 1 earns about 1.8k.
- Adding or removing a villager changes how many random rolls happen per tick, so per-seed results
  shift (weather, drops). Judge balance on the 8-seed average, never on one seed. A seed that
  collapses is a bug: that is how the opening-tile weed was found (seed 99 fell to 4.5k).

## Code map

```
src/engine/   loop (fixed 60 Hz sim, separate render), input (rebindable actions, keyLabel;
              DEBUG_KEYS / SHOWN_ACTIONS keep the debug panel to dev builds and ?debug), rng,
              audio/audio.ts (procedural SFX + music), audio/sfxr.ts (jsfxr bank: base58 sounds
              from sfxr.me; ids in SFXR_BANK override the synthesized version)
src/data/     typed content: items, crops, trees, fish, creatures, structures, recipes, research,
              npcs (14 villagers; Roxy is last), shops (10 + Mags' cart; airfreight = Roxy's),
              goals (quests/projects/festivals/REQUEST_POOL), buffs, contracts, cookbook, furniture,
              perks, palette (Resurrect 64; the old 32 `C` names are aliases), modes (game modes,
              farm maps, Rush medals)
src/sim/      pure simulation, no DOM. prompts.ts (what F / a left click would do on a tile, for the key
              bubbles; questTarget for the guide arrow and compass). Game.ts (state, tick, endDay,
              simRate/clockRate, beltSink = belt ends feed structures), opening.ts (the clockwork
              opening's tile layout + openingTile), ents.ts, ports.ts, build.ts, blueprint.ts,
              save.ts (SAVE_VERSION 3 + MIGRATIONS; saves store mode + farmKind, ground and
              objects, not buildings), world/ (tilemap, worldgen incl. AIRSHIP + skyfield(),
              farms.ts = map variants, A*)
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
tests/        Vitest suites + tests/bot.ts (scripted player; it now plays the opening too);
              roxy.test.ts (her data, paths, old-save load, day-4 card, bean top-ups)
e2e/          Playwright scripts (e2e/out is gitignored scratch); screens.mjs = the sweep (add new
              screens to its SC table; VIEW=WxH for other window sizes); roxy.mjs
scripts/      art importers and PixelLab helpers (art/README.md), make-icons, sfx-design, pace.ts
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
- Added in 1.1's last session (sources in `art/npcs/roxy`, `art/portraits-roxy`, `art/airship`,
  each with its rebuild command in the folder and in `art/README.md`):
  - `npc-roxy`: a 48x48 character sheet, anchor (24, 46), 38 px tall. Walk 0-3, stand 4-6,
    idle `i0`-`i7` (all rows), greeting `g0`-`g3` (down row; the other rows hold the stand).
  - `portraits-roxy`: `portrait:roxy:<mood>:*` at 64x64 (0 smirk, 1 laugh/blink, 2 sad, 3 flustered).
  - `airship`: `bld:airship:<season>:<night>:<frame>`, 148x148, o = (4, 68), 4 frames (envelope
    bob, propeller, pennant), winter snow, night portholes; the ground shadow is baked in a key
    colour and recoloured per season (buildings get no renderer shadow).
- Gotchas: Vite serves hot-updated modules as `?t=` URLs, so page scripts import the app's own
  instance (see `mod()` in `e2e/sprites.mjs`). Agents' imports trigger full reloads in open pages.

## What's next

1.1.0 is out. Next session (1.1.1, then 1.2):

> Read ROADMAP.md and HANDOFF.md. Work the open items at the end of ROADMAP.md Phase 4, arm
> redraw first (the art-director agent: arms read as "?" at rest). Then the deferred critic list
> below. Run npm test, npm run screens and scripts/pace.ts, then the indie-critic agent. Commit;
> push with the OK. For 1.1.1: bump package.json, Build desktop app.bat, gh release create v1.1.1.

Patterns from 1.1's last session:
- A belt that ends at a structure delivers into it through `portInsert` (`Game.beltSink`); full
  means it backs up. No arm needed at the end of a line.
- The debug panel and its key exist only in dev builds or with `?debug` (`DEBUG_KEYS` in input.ts).
- Extra character animations: a sheet can map `i0…` (idle, looped while standing) and `g0…`
  (greeting, once when a chat starts) in `meta.frames`; `charFrames(id, prefix)` counts them.
  Portraits may be 64 px (drawn 1:1; smaller boxes crop the face).
- Heart events set `heart_<npc>_<hearts>` flags, so shop stock can unlock from them.
- Saves store ground and objects but not buildings: anything new on the overworld needs an
  `afterLoad` clean-up for old saves (see `skyfield()` in worldgen.ts).
- Anything that scatters objects on the farm (daily weeds, windstorms) must skip `openingTile()`
  (`src/sim/opening.ts`), or a tutorial step can be blocked; `tests/modes.test.ts` checks 150 seeds.
- A new villager needs: an `NPCS` entry (schedules may only use locations that exist, a test
  checks), a character sheet + portraits (or the procedural look as a fallback), and, if they
  have a shop, a building whose `locId` matches the shop's `loc` and a schedule that puts them at
  `<loc>_in` during opening hours. The festival circle, journal, partner and mail pick them up.

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
  (`\'` becomes `'`, and a `'\b'` in a patch script landed as a raw backspace byte), and long
  heredocs with quotes can fail to parse. Use the Edit tool for anything with a backslash, or
  write the script to a file first. Check with `od -c` when in doubt.
- **Never put a copy of the project inside the repo** (git worktrees, unzipped builds with an
  `index.html` under `e2e/out/`…): Vite's dependency scanner picks it up and the dev server starts
  answering `504 (Outdated Optimize Dep)`, so the game never boots. Put worktrees outside the
  project. If it happens anyway, `touch vite.config.ts` restarts the owner's dev server in place.
- **TypeScript one-offs against the sim:** `npx vite-node some-script.ts` (vite-node ships with
  vitest), e.g. to dump a map region or run the bot (`scripts/pace.ts`).
- **Line endings:** git checks files out with CRLF here (autocrlf) and commits LF (`.gitattributes`).
  Scripted edits must match CRLF or normalize first; the Edit tool handles it. "CRLF will be
  replaced by LF" warnings on commit are harmless.
- **The owner's dev server answers on `localhost`, not `127.0.0.1`.** Pass `http://localhost:5173/`.
  After hot updates, Vite serves edited modules as `?t=` URLs, so `import('/src/...')` from page
  scripts can get a second module instance; find the URL the app loaded via
  `performance.getEntriesByType('resource')`, or reload first.
- **Handy scratch helpers** (in gitignored `e2e/out/`, so only on this PC): `titleshot.mjs` (title
  screen with a frozen camera), `compare.mjs` (before/after side by side, pixel-perfect), `crop.mjs`
  (crop + enlarge), `montage.mjs out.png <cols> <scale> a.png b.png …` (several shots in one image),
  `mapdump.ts x0 x1 y0 y1` (an ASCII map of a world region; run with vite-node).

## Known issues / loose ends

- Bumblebots in flight during a manual mid-day save return to their hive on load.
- NPC paths cached before a big structure is placed can clip through it until the cache clears.
- The noon/6pm post tally (`g.sys.postDay`) isn't saved. After a mid-day reload, the night summary
  lists only sales made since the reload. Money is never lost.
- The pacing bot is simple: it ships crops and builds one arm line, with no real factory. It is a
  floor for balance, not a target.
- Tinker's Yard's ruins are still plain cobble halls. They need wrecked-machine dressing.
- Open art items from the Phase 2 critic review are in ROADMAP.md (NPC walk faces, strike-frame
  tool heads, riverbanks, winter dirt, the world-map window, logo, chronometer sky, player portrait).
- The jsfxr sounds (coin/sell/ship, levelup, hurt) are generated placeholders; nobody has listened yet.
- `npm run screens` doesn't cover every festival, dialogue, cooking/adopt/elevator or the result screens.
- The v1.1.0 Windows installers predate the opening-tile fix (see the status at the top); the
  website has it. Next desktop build: bump to 1.1.1, `Build desktop app.bat`, a new GitHub release.
- From the 1.1 code review, not fixed: the "+N" popped over the crate when goods land uses the
  price before market saturation, so it can overstate what the post pays (`play.ts`, `crated`);
  `tileColor`, `SEASON_COL` and two banner colours use raw palette indices instead of `C` names.
- From the 1.1 critic review, not fixed: the list at the end of ROADMAP.md Phase 4 (arms read as
  "?" at rest, the day-2 toast behind the tracker, shift-click in the backpack, look-alike tool
  icons, the farmhouse doorway, research window colours, the 960x600 embed size, the jar costing
  402 at the Workshop vs 400 at the Mercantile).
- Roxy's 64 px portrait sits next to 32 px-at-2x portraits in the same dialogue frame. The critic
  flagged the mixed pixel density; the owner asked for her to be more detailed, so it stays.

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
