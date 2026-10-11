# Handoff: Sprocket & Sprout

A cozy farm-factory browser game: a clockwork-automation life sim in TypeScript + Vite + Canvas 2D,
with no engine. The pixel art is PixelLab-generated and packed into small PNG sheets (`src/art/`);
music and most sound are procedural, some SFX come from a jsfxr bank.

**Status (October 10, 2026, night): 2.0 beta is released.** Phases 1-5 of 2.0 "The Works" are
built, `main` is fast-forwarded to `works` and pushed (the website runs 2.0 beta), and a GitHub
pre-release `v2.0.0-beta` carries the patch notes and the Windows installers (1.1.1 stays the
"Latest" release). Phase 5 (people, events, HQ: DECISIONS #100-#114), the critic's full review's
fixes (#115-#123), the owner's playtest (#124-#129), the critic's confirmation pass (#130, #132,
#133), the owner's last notes (hand loads count 150 of an input, the pets from "Housewarming": #131,
#132), the bridges and fences pass (#134) and the release (#135) are all in. The patch notes are
the title screen's "What's new" (`src/data/patchnotes.ts`) and PATCHNOTES.md.
**Where it stopped:** released; nothing is pending. Next is Phases 6 and 7 in a new session
("What's next" below). `main` is the release commit `ecf9eb0` (tag `v2.0.0-beta`); `works` is ahead
only by docs and two release helpers (`node scripts/casecheck.mjs`: import paths match file case for
the Linux deploy; `node scripts/release-notes.mjs "<version>"`: a PATCHNOTES.md section as a release
body). Keep working on `works`; merge to `main` (fast-forward, in `../sns-p0check`) only when the
owner says ship. Left on disk, safe to delete: `../sns-review` (the critic's build copy) and the
merged worktrees `../sns-crops`, `../sns-deep`, `../sns-town` (remove their node_modules junction
first).
The owner's rules since Phase 1: hand farming stays, but the factory is the face (ROADMAP.md 3.2,
DECISIONS #68); one path for every player, no "pick a direction" card (#72); the Preserves Jar is
the Preserving Crock (#76). ROADMAP.md is the 2.0 plan; ROADMAP-1.1.md the finished 1.1 overhaul.
- **Phase 5 on `works`** (the build, the critic's fixes and the Fair agent's merge `e7333dc`; the
  owner's playtest `8814e42`..`778fb65`): the done-when checks: `e2e/people.mjs` (real input with
  Pip, Sable and Thorne, Pip's farm question), `e2e/fairs.mjs` (the Fair on the square, the bench
  test, the Haul's auction on a slept-into fall 15), `e2e/house.mjs` (indoor structures, the load
  chooser, a spring arm indoors), `e2e/pet.mjs` and `e2e/hamster.mjs` (the cage, its ball, the
  counter) pass; the critic's full review PASSED WITH FIXES and they're in. The bot still reaches
  the Mill by day 20 on 8 of 8 seeds (day 17). Pacing (28 days, 8 seeds): Story 66.0k, Rush 65.6k.
- **Phases 3-4 on `works`** (`8f24f3d` Phase 2's must-fix list, `876dc2f`..`7d4c159` Phases 3-4 with the three agents' merges, the critic's fixes to `426cb2b`, the re-checks' fixes `16d10cd`..`72ff71b`): the
  done-when checks: the bot reaches the Mill by day 20 on 8 of 8 seeds (days 15-18 after the fixes,
  `npx vite-node scripts/mill20.ts`); `data.test.ts` validates every order and keystone;
  `e2e/minex.mjs` walks all six strata; the year-long bot restores the lift; the Tram runs on a
  reloaded game (`tests/townworks.test.ts`); a chain-walk test takes k11 to k17
  (`tests/eras.test.ts`); the sweep is clean at 1280x720, 1366x620 and 960x600. Pacing (28 days, 8 seeds):
  Story 65.9k, Rush 66.3k; Rush medals 40k / 75k / 110k (DECISIONS #97).
- **Phase 2 on `works`** (`7fc17bf` session 1, `b5c2140` session 2, `7bada4d` the pre-merge
  review fixes, then the critic's fixes): the Keeper's Line (rust and restore, the chain, the Now
  strip, lesson cards, the Notebook, undo), the Orders board with consignment, the river works
  with a real brownout, Shift+F, the Skills cards and crafting labels. A pre-merge review loaded
  ten real 1.1.1 saves into 2.0 with nothing lost (DECISIONS #81); `SAVE_VERSION` is 5 since Phase 3
  (v5 moves the old requests, contracts, projects, pruned research and mine state), so 1.1.x
  refuses a 2.0 save cleanly. The critic's review and the supply fixes: DECISIONS #82.
- **2.0 beta, released October 10** (version `2.0.0-beta`): `git -C ../sns-p0check merge --ff-only
  works` (`main` is checked out there), `git push origin main` (deploys the website through
  .github/workflows/deploy.yml, which runs the tests first), the installers built from that `main`
  in `../sns-p0check/release`, and `gh release create v2.0.0-beta --prerelease` with PATCHNOTES.md's
  2.0 section as its body. For the next one: bump the version in package.json and package-lock.json,
  add a `PATCH_NOTES` entry at the top of `src/data/patchnotes.ts` (the UI font has printable ASCII
  only, no `$` or `_`) and its twin in PATCHNOTES.md, then the same steps.
- **Phase 0 = 1.1.1 on `main`** (commits `1c0d50e`..`ba760a9`, version bumped): the owner's
  playtest bugs, the overhead pickaxe for all 9 looks, flagstone paths, plank decks, the seam
  audit, painted ground transitions (the farming glitch), placed paths that change the ground;
  then the owner's second round (`ba760a9`): the ranch opens (Clem never stepped inside), square
  bridge decks (`squareBridges`, also run on load), mine lifts a shaft drops you past, the map
  with building names, head icons and hovers (`e2e/mapshot.mjs`).
  **Released**: the owner pushed `main` and ran `gh release create v1.1.1` (installers built from
  this exact `main` in `C:\Users\jacks\Documents\sns-p0check\release`). `git push` to `main` is a
  production deploy: the auto-mode permission guard blocks it for Claude, so the owner runs it.
  A worktree of `main` for checks and hotfixes: `C:\Users\jacks\Documents\sns-p0check` (has
  `main` checked out; dev server config "main", port 5175, in .claude/launch.json). A hotfix goes
  there, then `git merge main` on `works`.
- **Phase 1 on branch `works`** (`2d070fa`, fixes to `ff9b51b`, `main` merged in `f2f1e77`): the
  automation core and the Field Works, built to ROADMAP.md 3.1 + 4. The indie-critic's build review
  was PASS WITH FIXES; all its Criticals and Majors and most Minors are fixed in `ff9b51b` (the
  wrong input is named and diagnosed, arms refresh their reason, the gantry parks off season, the
  lamps count root causes), plus "your hands took 3 of the field's 4" (`88f097a`). Not done from
  that review: lamps dimming in a brownout, the pace bot's L3. The owner turned down a
  Builderment-style rework (machines pushing output onto belts, arms optional): don't add it.
- **PixelLab:** about 86 generations spent this session (pick frames 44, terrain 22, Field Works
  20); about 430 left until Nov 9.

**Earlier status: 1.1.0 is released.** The visual overhaul (`ROADMAP-1.1.md`, Phases
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
  - `ROADMAP.md`: **the 1.2 "The Works" plan** (written 2026-10-09 after the owner's playtest):
    the identity rebuild around automation, the owner's decisions D1-D12, the audit, the
    Keeper's Line opening, the Deepworks, Orders, eras, the art brief, the playtest bug table
    and seven phases with their prompts. Start there.
  - `ROADMAP-1.1.md`: the finished 1.0 → 1.1 visual overhaul (history; its Phase 4 open items
    are folded into ROADMAP.md section 10).
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
npm test                                   # 361 Vitest tests (the critic's confirmation pass and Housewarming in confirm.test.ts, bridges and fences in planks/fences.test.ts; sim, data, modes, maps, achievements, UI audit, art lookup, juice/prompts, Roxy, pacing bot, lines L1-L5, the Keeper's Line, orders, eras and the k11-k17 chain, professions, the Deepworks, the town keystones, save v5, the specialists and Trust, the Fair and the Haul, Workshop HQ, the pet, the hamster, the counter, palms)
LONG=1 npx vitest run tests/longrun.test.ts    # bot plays a full in-game year, save round-trip
npx vite-node scripts/pace.ts story rush   # economy: the bot's 28-day earnings on 8 seeds (a few minutes)
npx vite-node scripts/accept.ts            # the critic's Phase 2 acceptance: crocks working on days 5-7, day-6 income, the mill
npx vite-node scripts/mill20.ts            # Phase 3's done-when: the day each main quest finished, per seed (the Mill by day 20)
npm run build                              # production build, about 1.2 MB JS (386 KB gzipped) + ~520 KB of PNG sheets
node e2e/smoke.mjs http://localhost:5173/  # real UI smoke, 0 console errors expected
npm run screens                            # 96-screen sweep + overlap audit -> e2e/out/screens/report.md (0 issues expected); VIEW=1366x620 or VIEW=960x600 (the web embed) for other sizes
node e2e/coverage.mjs                      # every sprite name vs imported art (6415/6415 = 100% expected)
node e2e/sprites.mjs <name> ...            # imported vs procedural sprites side by side
BASE=http://localhost:5173/ node e2e/flow.mjs  # real input: two-step new game, farm, house, bed, reload
BASE=http://localhost:5173/ node e2e/roxy.mjs  # real input: Roxy's door intro -> shop, chat, gift, 2-heart event
BASE=... node e2e/windows.mjs | qa.mjs | bot.mjs 7 | house.mjs | pet.mjs | guild.mjs | ...
BASE=http://localhost:5173/ node e2e/shift.mjs     # 185 real shift/ctrl/double-clicks between bags and structures
BASE=http://localhost:5173/ node e2e/works.mjs     # the automation core on screen: glyphs, inspector (hold I), Lines tab, pole window
BASE=http://localhost:5173/ node e2e/terrainshots.mjs   # bridges, a farm plot, the square: painted ground transitions
node e2e/seams.mjs                         # Wang-set seam audit -> e2e/out/seams.md (165 offenders listed for Phase 6)
BASE=http://localhost:5173/ node e2e/perf.mjs      # 1,300 belts / 260 machines: < 1 ms a tick, the night shift < 3 s
BASE=http://localhost:5173/ node e2e/minex.mjs     # the Deepworks: a level of every stratum, vents, set-down lamps, a chamber card, the lift
BASE=http://localhost:5173/ node e2e/townworks.mjs # the town keystones on screen: the mill, the lamps on your power, the fountain, the tram
BASE=http://localhost:5173/ node e2e/people.mjs    # Phase 5: Pip, Sable, Thorne with real input; Pip's farm question card
BASE=http://localhost:5173/ node e2e/fairs.mjs     # Phase 5: the Fair on the square, the bench test, the Haul's auction
BASE=http://localhost:5173/ node e2e/hamster.mjs   # Housewarming (F at the farmhouse door), the hamster (cage, name, feed, wheel, ball, pick up), the counter's Chat
BASE=http://localhost:5173/ node e2e/bridgefence.mjs # the bridges, the dock, the pier, the paddock and a placed fence layout, zoom 2 and 4
npx vite-node scripts/systems-order.ts     # the systems in tick order (check after adding a system or an import)
```

Last results (October 10, 2026, night, the 2.0 beta as released): typecheck, 361 tests, the
year-long run, `mill20` 8/8 (day 17; seed 7 day 20, as before); `house`, `people`, `fairs`, `pet`,
`hamster`, `works`, `townworks` and `smoke` pass with 0 console errors; the sweep is clean (0 issues,
96 shots) at 1280x720, 1366x620 and 960x600; every relative import matches its file's case (CI is
Linux). (From the Phase 3-4 round, not re-run: `flow`,
`roxy`, `windows`, `minex`.) (From before Phase 3, not re-run:) `e2e/shift.mjs` 185/185; `e2e/perf.mjs` 0.32 ms a tick, the night shift
1.5 s. `e2e/qa.mjs` logs "missing sprite i:hoe_0" warnings: its contact sheet asks tools for an
icon name they don't use (harmless).

Pacing bot, `scripts/pace.ts`, 28 days, 8 seeds (October 10, night, the 2.0 beta; unchanged by the last round):
- Story: average 66.0k coins (63.7k to 68.1k); Clockwork Rush 65.6k (63.2k to 67.9k); day 1 about
  2.7k (Story), 4.5k (Rush). Before the owner's playtest: Story 65.0k, Rush 66.5k; after Phases 3-4:
  Story 65.9k, Rush 66.3k. The Rush
  medals are 40k / 75k / 110k (DECISIONS #97). Phase 2's numbers, for history:
- Story: average 42.2k coins (39.6k to 45.4k). Before Phase 2: 20.9k; 1.1: 10.7k.
- Clockwork Rush: average 39.9k (38.1k to 43.4k). Before Phase 2: 23.1k; 1.1: 13.0k.
- Why it doubled: the jar line runs from minute 3 (the Keeper's Line), the bot builds its own
  crock line on day 2-3, fills Rowan's and Bram's orders, and waters the beds that feed its line.
- Day 1 earns about 4.1k.
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
              save.ts (SAVE_VERSION 4 + MIGRATIONS; saves store mode + farmKind, ground and
              objects, not buildings), world/ (tilemap, worldgen incl. AIRSHIP + skyfield(),
              farms.ts = map variants, A*)
src/sim/systems/  one file per system, registered with registerSystem({tick, dayStart, dayEnd,
              init, save, load, afterLoad, realtime}). Import order lives in src/sim/index.ts.
              New: modes.ts (start kits, the clockwork opening, Rush scoring), achievements.ts,
              keeper.ts (the Keeper's Line: the Professor's visit, safety nets), orders.ts (the
              Orders board, reputation, consignment); rust.ts and lessons.ts sit in src/sim.
              Phase 5: trust.ts (Trust rewards, Pip's watch), tock.ts, pet.ts (stay, treats, the
              crow guard, belt rides), hamster.ts (the cage, the wheel, the ball), festivals.ts (the
              Fair and the Haul), cart.ts (Mags), house.ts (the farmhouse, its furniture and
              DECOR_USE). In src/sim: people.ts (the specialists' talks and Pip's question),
              testbed.ts (the Fair's plate), fair.ts (entries and prizes), auction.ts, drafting.ts
              (the blueprint library), indoors.ts (structures in the farmhouse: g.houseEnts).
              Hand loads: handBatches / handFuel and loadChoices in machines.ts
src/render/   juice.ts (Phase 3 reward layer: sprite effects, confetti, rings, hops, item/coin flights
              into the HUD, streak counter, ribbons, big pop numbers, the post courier; drawFx with
              code fallbacks), renderer (dual-grid terrain bake, y-sorted sprites), lighting, weather, particles, ambient,
              atlas.ts (sprite cache, imported sheet frames, hasImage, drawFit, drawItemIcon),
              planks.ts (plank decks: direction, railings, the ground under), fences.ts (fences,
              walls, gates and the paddock by neighbour mask),
              art/sheets.ts (loads src/art/*.json: character, sprites, terrain kinds), art/match.ts
              (pattern + Wang vertex rules), art/* (procedural generators = the ?art=old fallback)
src/art/      imported sprite sheets (PNG + JSON manifest), written by scripts/*-import.mjs
art/          per-group art sources: raw PixelLab downloads, build scripts, import recipes
src/ui/       immediate-mode canvas UI kit (ui.ts; records draws for the audit when ui.audit is on),
              audit.ts (overlap checks: clash/overflow/covered), font.ts (textWidth, wrapText, ellipsize),
              hud.ts (layout), hudparts.ts (chronometer, odometer,
              gear hotbar, gauges, build bar, Rush tracker), pulse.ts (factory lamps),
              cursor.ts (CSS pixel cursor), tooltips, windows/* (achievements, modes = Rush result,
              palette = Sandbox build palette, plus the older ones; Phase 5: fair, auction, workshop
              = the drafting table and bench test, loadpick = "Load which?", home = the hamster's
              name, town = the shops' counter), askcard.ts (Pip's question beside the play),
              notes.ts (the title screen's "What's new", from src/data/patchnotes.ts)
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
  - Item keys are `index*4 + quality`. Saves store `[id, quality]`, except a blueprint ghost's
    filters (raw keys): a new item goes in `ITEMS_AFTER_1_1` (`src/data/items.ts`) so older items
    keep their index; `tests/data.test.ts` checks it.
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

**Phase 6 status (2026-10-10, round 1 done, DECISIONS #136-#137):** the Deepworks machines, the town
works, the thresher, rapeseed, the 11 missing icons and the state glyphs are imported (coverage
6812/6812); the seam audit reads 0. PixelLab: 314 generations left plus the $2.00 credit (resets Nov
9). Still to do in Phase 6: delete the procedural generators in `src/render/art/` and `?art=old`
(first make `e2e/coverage.mjs` list `deep:`, `town:` and `o:52`; the deep agent's
`art/deep/tools/coverage.mjs` checks them for now), a ground shadow under chamber machines
(`renderer.ts`), the field gantry's turning wheels (`src/render/fieldworks.ts` asks for no frames
yet), the re-roled villagers and portraits, the Tinker's Yard wrecks and Haul stalls, then
qa-screens, the sweep at 1280x720 and 1366x620, and the owner's screenshot test. The opening's arm
steps were reworked from the owner's playtest (#137).

Phases 6 and 7 of ROADMAP.md (2.0 "The Works"), in a new session. The owner asked for both. Phase 6
spends PixelLab generations (about 480 planned; the balance was about 388 on October 10, and the
budget resets on November 9), so check `get_balance` first and plan the groups to fit what's there.
The bridges, fences and the hamster's cage were hand-pixeled by script for 0 generations, which is
the fallback for small pieces. A prompt to paste:

> Read HANDOFF.md, DECISIONS.md #100-#135 (Phase 5, the owner's playtest, the 2.0 beta), then
> ROADMAP.md section 9, Phases 6 and 7, and STYLE.md. 2.0 beta is live; work on `works`.
> Phase 6, the art direction pass: check the PixelLab balance, then one art-director agent per
> group in parallel, each in its own worktree outside the repo (the Phase 2 pattern from 1.1,
> `art/README.md`; remove a worktree's node_modules junction before `git worktree remove`);
> STYLE.md's "Machines" section (every machine has a readable moving part, idle and working frames,
> and a marked output side); the seam audit (`node e2e/seams.mjs`) at 0; `node e2e/coverage.mjs` at
> 100%, then delete the procedural generators in `src/render/art/` and `?art=old`. Run qa-screens
> after each group. Done when the screenshot test (ROADMAP.md 3) passes by the owner's eye, the
> sweep has 0 issues at 1280x720 and 1366x620, and qa-screens finds no regressions.
> Phase 7, review and release 2.0: `/code-review` (high) on `v1.1.1..works`, the indie-critic's
> full review, fix the Criticals; README, HANDOFF, PROGRESS, DECISIONS and the patch notes
> (`src/data/patchnotes.ts` + PATCHNOTES.md: a "2.0" entry over "2.0 beta") updated; version
> 2.0.0; merge to `main` and push only when the owner says ship; installers; `gh release create
> v2.0.0`.

Left over for Phase 6 or 7:
- The pace bot still stops at the Town Mill (k11 on is covered by `tests/eras.test.ts`).
- Fishing's and combat's professions keep Stardew-like effects.
- The drafting library opens only at the table (the critic, Phase 5).
- The blueprint and placement ghosts draw a fence's east-west sprite on a north-south line (#134).
- `art/icons/items.tsv` is stale by 15 post-1.1 items, and 11 of them have no icon pick (canvas,
  lubricant, grain, straw, starch_paste, pigment, spirit, rapeseed and its seed, thresher, tram_bin):
  their bag icons are procedural, so `coverage.mjs`'s icon family reads 541/552.

Owner rules to keep in mind (all in DECISIONS.md): cut old systems freely, but hand farming
(till, plant, water, harvest) stays (#61); the factory must be apparent and un-Stardew-like at a
glance (#68); no Builderment-style arm-free lines (#69); one path, no "pick a direction" card
(#72); merge to `main`, push and `gh release` only when the owner says so (2.0 beta: they did).

Handy for headless probes: write a scratch `e2e/out/<name>.ts` (gitignored) that imports
`../../src/sim` and run it with `npx tsx e2e/out/<name>.ts` (tsx is in the npx cache). 42 ticks
are one game minute.
The "deferred critic list" below is now covered by ROADMAP.md (crop numbers 7.1, re-roles 7.6,
the Exhibition 7.7, Tock Phase 5, the Post Tube is dropped in favour of consignment 7.4,
crafting labels Phase 2, the cut list D3-D5).

Patterns from 1.2 Phase 5 (people, the Fair, Workshop HQ, the owner's playtest):
- A second entity store, `g.houseEnts` (ids from `HOUSE_IDS`, 1,000,000): `storeOf(g, e)` and
  `entById` find any structure's store, `hereEnts(g)` is the one where the player is, and the port
  graph is cached per store. The farmhouse's machines and spring arms tick by day and on the night
  shift (`updateArms(g, dt, g.houseEnts)`). Indoor rules: `src/sim/indoors.ts`.
- The specialists' talks add no system: `TALK_HOOKS` / `EVENT_HOOKS` in npcs.ts, filled by
  `src/sim/people.ts`. Pip's farm question is `g.sys.pipAsk`, drawn by `src/ui/askcard.ts`.
- The Fair's plate is a throwaway `new Game({ blank })` (`src/sim/testbed.ts`): pure, scored by
  `bedScore`, tested on sample lines in `tests/fairs.test.ts`; change a price or a recipe and
  re-check the sample numbers there.
- Something with its own whims draws its own dice (`petRng`, `hamRng`, the vents' and Mags' rngs);
  only a stray pet still draws the world's (the bot never adopts it). A new system registers in
  `src/sim/index.ts` at its place; `scripts/systems-order.ts` prints the real order (a module that
  imports a system registers it first).
- Furniture with a use of its own fills `DECOR_USE` (house.ts) with `use`, `hover`, `prompt`,
  `placed` and `lifted`; F and right-click use it, Shift+right-click picks it up.
- A villager at work indoors is `insideAt(g, loc)`; `talkTo(g, n, shopAfter, chat)` comes back to
  the shop; `counterAsks` and `handIn` (quests.ts) answer their asks from the bag.
- Machines by hand: `handBatches(r)` (about 600 s of batches); with nothing they take in hand,
  `loadChoices` / `loadChosen` (actions.ts) drive "Load which?".

Patterns from 1.2 Phases 3-4 (Orders, eras, the Town Mill, the Deepworks):
- One Orders board: `src/sim/systems/orders.ts` owns every ask (Today, Standing, the Guild, Works).
  An `Order` has lines (`spec`, `n`, `have`), a customer (`cust`: a business id = its keeper's
  villager id, `guild` or `council`), a kind, a due day, pay and reputation. Standing orders and the
  keystones are data in `src/data/orders.ts`: a keystone (`KEYSTONE_WORKS`) is posted when its main
  quest starts (`quest`) and finished once its `after` holds (`keystoneWait` says what it waits
  for); projects (`PROJECTS` in `src/data/goals.ts`) wait for their era (`after`). The crate's
  `st.tag` routes the post's goods (`consign`); the day summary shows them as "<villager>'s order".
- Research eras and keystones: `src/data/research.ts` (`era`, `row`, `keystone: { observe,
  experiment, validate }`, `ERA_REWARDS`). When a keystone's stages count is `src/sim/keystones.ts`
  (`keystoneOpen`, `lookCounts`, `stageCount`, `canResearch`): pure helpers with no system, so any
  module can import them without moving research's place in the tick order. On a Keeper's Line save
  a keystone walked by a main quest (`QuestDef.keystone`) opens with its quest: `stages_open:<id>`
  and `research.base` hold the counters' starting points. The quest objective kind `stage` mirrors a
  keystone's stage (its line shows the count or the validate clock).
- The main path is data: `src/data/goals.ts` k1-k17 (`main: true`, `needFlag: 'keepers_line'`).
  `tests/eras.test.ts` walks k11-k17 step by step; add a step there when you add one to the chain.
- Import order is tick order (`src/sim/index.ts`): importing a module that calls `registerSystem`
  from an earlier system registers it earlier and changes the tick order for everything (the bot's
  numbers move). Put shared pure helpers in a module of their own (as `keystones.ts`).
- A town keystone's payoff is a `{ t: 'scene' }` event: the play screen holds the camera on the
  building (`PlayScreen.scene`), then shows its card; `queueWindow` keeps cards in order (the era's
  card comes after the keystone's).
- Caches belong to their world (DECISIONS #91): the villagers' walk cache is keyed on the map, so
  the bot running seeds in one process is deterministic per seed.
- The Deepworks: `src/sim/systems/mine.ts` (strata from `src/data/deepworks.ts`, hazards with their
  own clocks and rng so level layouts don't change, `lamps` on the mine state, chamber cards with
  `card:<kind>` flags separate from `observed:<kind>`).
- After the re-checks (DECISIONS #99): the era you're in is `townEra` (`src/sim/keystones.ts`: the
  first era whose town keystone isn't done); the Now strip draws its quest's title and step
  (`NowLine.steps`); toasts are a queue (three on screen, only those age; one within 0.3 s of a key
  or click goes first; narrow screens stack them above the hotbar); a keystone finished indoors or
  asleep shows its card then and `PlayScreen.sceneReplay` pans to it once you're outdoors; order
  lines can ask for a tag (`#oil`: cogbean and sunflower oil), with `TAG_LABEL` and `specIcon`; a
  crate tagged for the Council or the Guild never follows a business's new order.
- Professions: `src/data/perks.ts` (ids kept from 1.x, effects new). Machine boosts by station in
  `STATION_PERKS` (`src/sim/systems/machines.ts`); Governor in `updatePower` (`e.sat` is the net's
  satisfaction / 0.75); Field Hand and Long Reach in `fieldHand` / `fieldReach`
  (`src/sim/systems/fieldworks.ts`, also `fieldTiles`); Drill Rigger in `drillTick`. Tinkering gets
  5 XP a machine batch; perk cards take their picture from `PERK_ICON` (`src/ui/windows/perks.ts`).
- The bots and scripts: `tests/bot.ts` plays to the Town Mill (k10) and stops there;
  `scripts/mill20.ts` (the day each main quest finished), `scripts/pace.ts` (28-day earnings, the
  Rush medals' reference), `scripts/accept.ts` (Phase 2's days 5-12 check).
- Parallel agents: one per disjoint subsystem, each in a git worktree outside the repo
  (`../sns-crops`, `../sns-deep`, `../sns-town`) with node_modules as a junction to the main
  repo's; remove the junction (`cmd /c rmdir`) before `git worktree remove`, or it deletes the real
  node_modules. Those three worktrees are still on disk, clean, and their branches (`works-crops`,
  `works-deep`, `works-deep2`, `works-town`) have nothing `works` lacks: safe to remove that way.

Patterns from 1.2 Phase 2 (the Keeper's Line):
- The opening's layout is data in `src/sim/opening.ts`: `OPENING` (the yard, marked tiles) and
  `RIVER` (the river works); `buildYard` and `buildRiverWorks` build them for a new game, and
  `openingTile` keeps weeds and storm debris off both. The keeper's pieces carry `st.yard = 1`
  (the bot and the "wreck the yard" test leave them alone).
- Rust and Restore: `rustStruct(e, need?, n)` in `src/sim/rust.ts` sets `st.rust`, `st.need` and
  `st.needN`; a rusted structure's ports refuse, a rusted pole carries nothing and a rusted
  generator makes nothing (`src/sim/systems/power.ts`); `restore()` takes the parts and bumps
  `powerDirty` and `ents.version`. A worn generator's output is `st.cap` (the old wheel: 40).
- The chain is data in `src/data/goals.ts` (k1-k9). Objective kinds beyond the old ones: crate,
  restore (one tile or a `rect`), flag, made, feeds, armload, order, grid; each has `label`,
  `why` and `goto`. The Now strip (`src/ui/nowstrip.ts`) reads `nowLines` in
  `src/sim/systems/quests.ts`; guide marks per step live in `src/app/play.ts` (`quest:index`).
  Sim code raises a lesson card with `lesson(g, id)` (`src/sim/lessons.ts`, data in
  `src/data/lessons.ts`); cards and the post timer wait while a banner shows.
- Orders: `g.sys.orders` (open, filled, rep) in `src/sim/systems/orders.ts`, standing orders in
  `src/data/orders.ts`. The crate's `st.tag` names a customer; `consign` runs inside `shipAll`
  before market sales and never saturates the market. Hand delivery goes through the quest
  system's `tryDeliver` -> `g.sys.orders.hand`.
- A recipe picked while a machine is crafting goes to `MachC.pending` and takes at the end of the
  batch; Shift+F opens any structure's window. A key bubble can carry a second line
  (`Prompt.hint`).
- `tests/bot.ts` plays the chain (`keeperLine`), waters the keeper's patch and the gleaner's bed
  (unwatered, the line starves for days), and builds its own crock line before it grows its plot
  (3.2 rule 5, checked in `tests/keeper.test.ts`).

Patterns from 1.2 Phases 0-1:
- Every structure has `e.state` (`MState`), `e.why` and `e.since`; set them with `setState`
  (`src/sim/mstate.ts`), never a free string. A full queue in front of a busy taker is
  `setQueued` (Working); a stage whose supply traces to a field with nothing ripe is
  `setHarvestWait` (Idle). Glyphs show only at the root cause (`src/render/glyphs.ts`).
- `src/sim/lines.ts` owns the port graph (cached per `ents.version`), `lineOf`, `fieldSource`,
  `diagnose` and `worksTally`; advice sentences are data in `src/data/advice.ts` (gap + fix).
- `g.stats.states` keeps per-structure state samples (60 s) and day totals; it rolls over at 6am
  in `Game.endDay`. Rates the player sees are per works day (`DAY_SECS`, 1,008 sim s).
- The night shift is `Game.runWorks(seconds, step)`; systems that are part of the works say
  `works: true` in `registerSystem`. Poles have `st.sw` (0 on, 1 off, 2 night only).
- Field machines pick with `pickable(g, crop, dawn)` (noon rule) in `src/sim/systems/fieldworks.ts`.
- Ground: a vertex with no art set for its classes is painted by `src/render/blend.ts`
  (`BLEND_OVER_ART` also overrides the tilled-soil sets). Plank decks: `src/render/planks.ts`.
- PowerShell trap: inside a double-quoted string or `@"..."@`, `${x}` is a PowerShell variable and
  vanishes. Template literals went missing twice this session; use the Edit tool for TS with `${`.
- `main` must stay Phase-0-only while `works` diverges: to commit a hotfix to `main` from a mixed
  working tree, stage a hand-built blob (`git hash-object -w` + `git update-index --cacheinfo`)
  and typecheck it in the clean worktree `../sns-p0check` (node_modules is a junction).

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
- The pacing bot plays the Keeper's Line to the Town Mill (k10, days 15-18) and stops there: it
  doesn't play k11 on, so its research and works stop growing after the Mill and its cash piles up.
  It is a floor for balance, not a target; the chain past the Mill is tested in `tests/eras.test.ts`.
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
  icons, the farmhouse doorway, research window colours, the jar costing 402 at the Workshop vs
  400 at the Mercantile). The 960x600 embed size is done: the sweep is clean there since the
  Phase 3+4 re-checks (`VIEW=960x600 npm run screens`).
- Untracked and left alone: `art/factory/arms/ref/batch1/` and `batch1-contact.png` (arm reference
  images from October 10, 3 am, before Phases 3-4). Keep or delete them as the owner likes.
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
