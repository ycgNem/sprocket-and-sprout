# Sprocket & Sprout — Roadmap 1.2 "The Works" (the identity rebuild)

Written 2026-10-09, the night after 1.1.0 shipped. `ROADMAP-1.1.md` is the finished visual
overhaul; `PLAN.md` the original architecture; `PROGRESS.md` what's built; `HANDOFF.md` how to
run and verify everything. This file is the plan for the next version, and it is a different
kind of plan: not "add features", but "make the game its own thing".

Work one phase per session (some phases take two or three). Start every session with
"Read ROADMAP.md and HANDOFF.md", end it with tests, `npm run screens`, the `indie-critic`
agent where the phase says so, a commit, and a push only when the owner says so (pushing
`main` deploys the website; see "Branches" below).

---

## 0. The brief, in one paragraph

After playtesting 1.1 the owner's verdict is: the game is complete, and it is still "Stardew
Valley with conveyor belts". The factory, the one thing that should make Sprocket & Sprout
distinctive, does not carry its own weight: the first arms have little visible purpose, the
machines are boxes, and the surrounding systems (mine, hearts, festivals, bundles, house,
romance) are genre conventions. New players quit because they get lost. So 1.2 is a scope
change: **automation becomes the identity**, agriculture and the valley feed it, the tutorial
teaches a mental model instead of a checklist, and the rest of the game is re-fitted to that
spine. The owner also sent a bug list from the playtest (section 10) and a long design brief
(section 1 folds it in). The owner's standing priorities still hold: features and visible change
over polish; PixelLab budget is fine to spend; anything that moves gets real frames; Resurrect 64.

The test for every decision in this file: **if you removed the factory from Sprocket & Sprout,
would what's left feel like a familiar farming sim?** Today the answer is yes. At the end of 1.2
it must be no: what's left should feel like an unfinished machine.

---

## 1. Decisions for the owner (defaults apply if not answered)

Each one has a recommendation. If the owner says nothing, the recommendation is the decision
and gets written into `DECISIONS.md` (#49 onward) in Phase 0.

| # | Question | Recommendation (default) | Why |
|---|---|---|---|
| D1 | **Version label.** 1.2 or 2.0? | **Ship as 2.0** when the new opening lands (end of Phase 2); the hotfix is 1.1.1. Codename "The Works". | The opening, the pitch, the research model and the save format all change. "1.2" undersells it on the store page and in the changelog. |
| D2 | **Old saves.** Migrate 1.x saves or require a fresh start? | **Migrate** (SAVE_VERSION 4) for everything that is cheap (new state defaults, re-roled NPC ids kept), **new opening only for new games**. Old saves keep their quest chain through the existing `needFlag` rule. | The migration machinery exists (`src/sim/save.ts` MIGRATIONS) and the test suite checks old-save loads. |
| D3 | **Romance and partners.** Keep, freeze, or cut? | **Keep as built, freeze** (no new content). Roxy's events stay. | It is cheap to keep and the owner asked for Roxy. It stops being a pillar: no quest points at it. |
| D4 | **Mine monsters and sword combat.** | **Keep combat but take it off the critical path.** The mine becomes the Deepworks (section 7): hazards and a few pests; the sword stays a tool, `s_deep` no longer gates anything important. | Combat is the most Stardew-shaped system; removing it outright would strand 8 creatures, 4 swords, 2 perks and 6 achievements. |
| D5 | **Festivals.** Four seasonal minigames today. | **Keep two, replace two.** Keep Lantern Night (summer) and Frostlight Skate (winter) as the cozy ones. Replace Kite Day with the **Sprocket Fair** (spring: the Clockmakers' Exhibition, a throughput contest) and Pumpkin Roll with the **Harvest Haul** (fall: a trade fair with an auction). | The brief asks for engineering exhibitions and trade fairs; two is enough to say it. The minigame code (`src/ui/windows/activities.ts`) is reused for the two kept ones. |
| D6 | **Cobble path.** Replace only the placeable Cobble Path, or the town's cobbled roads too (`T.PATH`)? | **Both, one new set** (flagstone with a gravel edge; the town road a wider, worn version). | The owner dislikes the design, not the placement. One set keeps the town and farm consistent. |
| D7 | **Ottoline / the Professor.** One name everywhere. | Quests, arrows, the tracker and the map say **"Prof. Cogwhistle"**; only dialogue lines from friends say "Ottoline". Add a name tag over any villager a guide arrow points at. | The playtest got lost between the two names. |
| D8 | **Art budget timing.** 520 generations left this cycle; 2,000 from Nov 9. | Phase 0 spends up to 60 (pickaxe frames, the cobble set, arm "?" fix). **Phase 6 (the art direction pass, ~450 generations) starts after Nov 9.** | Keeps 400+ in reserve for fixes during Phases 1-5. |
| D9 | **Mail.** | Quests stop sending letters; birthdays and season notes move to the almanac; at most one letter a day; the mailbox flag only for letters with items or story. | "Too much mail" is a real tutorial problem: the mailbox competes with the quest tracker for the player's attention. |
| D10 | **Things placeable in the house.** Owner asked for "items placeable in house". | Chests, jars, kegs, the loom, the desk, lamps and decor go indoors in Phase 5 (**Workshop HQ**). Belts and arms indoors are a later upgrade (the Basement). | Needs a second entity store for the house map; medium risk, so it goes with the HQ work, not the hotfix. |
| D11 | **Fluids.** The brief mentions a pumping station teaching fluid handling. | **No fluid network in 1.2.** The Waterworks keystone is a restored pump house (a project) that drains the flooded Deepworks stratum and unlocks mist towers. Pipes are a 2.1 candidate. | A fluid sim is a new system on the scale of belts. Not this version. |
| D12 | **Branch.** | Work on branch `works`; merge to `main` (= deploy) at the end of Phase 0 (1.1.1), Phase 2 (2.0 beta on the website, installers stay 1.1.1) and Phase 7 (2.0). | Pushing `main` deploys. A half-rebuilt opening must not go live by accident. |

---

## 2. Audit: what is actually there

Numbers from the code on 2026-10-09 (not the README): about 30,000 lines of TypeScript;
14 villagers with 2,206 lines of data (`src/data/npcs.ts`); 37 crops; 64 research nodes
(12 of them flat stat buffs); 20 processing machines plus 5 arm kinds, 3 belt tiers, 3 burrow
belts, 3 splitters, 4 generators; 60 mine floors; 4 festivals; ~120 achievements; 16 restoration
projects, 3 megaprojects, 27 Guild contracts, 22 dishes, 15 furniture pieces; 105 Vitest tests
(104 by default plus the `LONG=1` year run) and 26 Playwright scripts. All green.

### 2.1 Where the resemblance comes from

Not from any one feature. From the **shape**: seasons × crops × shops × hearts × gifts ×
birthdays × four festivals × a 60-floor monster mine × house upgrades × romance × a travelling
merchant × "bundles" as research cost × a cosy farmhouse with a bed and an almanac. Each is
implemented well; together they are the genre's silhouette. The factory sits on top of that
silhouette instead of replacing it.

### 2.2 What is genuinely ours (keep and build on)

- **Belts that deliver into whatever they run into** (`Game.beltSink`, 1.1): fewer arms, more
  readable lines. No other cosy-factory game does this; it is our best logistics idea.
- **The Study Desk** (`lab`): research as a machine on the farm that arms can feed. The owner
  loves it. It becomes the heart of the new research model (section 8).
- **Unique ores and the ore veins / drills loop** (`ORE_TYPES`, `drillTick` in
  `src/sim/systems/automation.ts`): rocks are not the same rock. The owner called this out.
- **Spring-wound arms that need no power** (DECISIONS #7): the clockwork identity in one rule.
- **Bumblebots with request/outbox/storage crates** (`src/sim/systems/bots.ts`): a real
  logistics tier.
- **The post at noon and 6pm** (DECISIONS #36): automation pays off while you watch.
- **Roxy and the airship**, the chronometer HUD, the pulse lamps, the juice layer, the pixel
  cursor: presentation that is already not Stardew's.
- The sim architecture: pure sim, systems with hooks, ports (`src/sim/ports.ts`) that let any
  structure be fed by arms. This is what makes the rebuild possible without a rewrite.

### 2.3 What is mechanically weak (the evidence)

| System | Evidence | Consequence |
|---|---|---|
| **Arms** | `src/sim/systems/arms.ts` is 111 lines: pick behind, drop in front, four states. The only visible state is `e.working`. The next arm kinds are speed/reach/filter/bulk tiers that arrive after Steam. The arm panel shows a rate and a filter. | The basic arm is "a mover with no reason". Nothing in the first week needs a second kind; nothing tells you what an arm is waiting for. |
| **Machines** | `src/sim/systems/machines.ts`: status is a free string (`'Waiting for input'`, `'Output full'`, `'No power'`…), shown only inside the window. Auto mode only picks single-input recipes (DECISIONS #16), so every machine except the assembler is "one thing in, one thing out". | Machines are boxes. There is no bottleneck to understand because there is no chain to understand. |
| **Power** | `src/sim/systems/power.ts`: satisfaction is a scalar that slows machines. The only feedback is a status string and the P window. | Brownouts are invisible until you open a window. |
| **Stats** | `src/ui/windows/factory.ts` `drawStats`: rates and graphs per item. No "why". | The window answers "how much", never "what's wrong". |
| **Research** | 64 nodes; the cost is bundles (collect N of X). 12 nodes are flat stat buffs (machine speed ×2, arm hand ×2, desk speed ×2, market bonus ×2, energy, bot speed, bot count, reach). Tree positions go to column 9 / row 10; the wheel pans only vertically and X needs a right-drag, with no scrollbars to say there is more (`src/ui/windows/factory.ts:31-49`). | Bundles are Stardew's Community Center by another name. The owner reports they cannot scroll to every topic. |
| **Quests** | `src/data/goals.ts`: 30 quests, 19 of them tutorial, across two chains (the 1.1 clockwork opening and the older farming chain that it mostly skips). Every quest start also sends a letter (`src/sim/systems/quests.ts:61`). | Players get a tracker, a letter and a toast for the same thing. "Too much mail." |
| **Orders** | Three systems ask for goods: daily requests (`REQUEST_POOL`), Guild contracts (`src/sim/systems/contracts.ts`), restoration projects (`PROJECTS`). Three windows, three rewards. | The economy has no single face. |
| **The house** | A separate small map (`player.where === 'house'`, DECISIONS #28) that only accepts furniture (`src/sim/systems/house.ts:164`). | The owner wants to place things there. It cannot hold a chest. |

### 2.4 Coupling and risk (what to be careful with)

- `O` (object enum) is saved by value: append only.
- Saves store ground and objects, not buildings; anything new on the overworld needs an
  `afterLoad` clean-up (see `skyfield()` in `src/sim/world/worldgen.ts`).
- `src/sim/index.ts` import order = tick order. New systems go at the right place, not the end.
- The opening hard-codes tiles (`src/sim/opening.ts` `OPENING`) inside the farmhouse yard, which
  every map shares. The new opening keeps that rule (section 6).
- `src/render/renderer.ts` is 1,440 lines; `src/app/play.ts` 1,315. New rendering (state glyphs,
  the Now strip) goes in new files, not into these.
- NPC data keys dialogue on season/weather/hearts. Re-roling a villager means rewriting their
  ~40 lines and 4 heart events, not just their `job`.
- The HUD `occ` rectangles (`src/ui/hud.ts`) are how overlays avoid each other; the key bubble
  (`src/app/play.ts:387-432`) is world-anchored and ignores them (section 10, bug 6).

### 2.5 Keep / Reshape / Replace / Cut

| System | Verdict | What changes | Phase |
|---|---|---|---|
| Belts, arms, splitters, burrows, chests, crate | **Keep + deepen** | Machine contract, visible states, line inspector, bottleneck advice, the winding verb | 1 |
| Processing machines (20) | **Keep + deepen** | Same contract; 6 new intermediate recipes from crops (section 7.1); state animations | 1, 6 |
| Power | **Keep + feedback** | Brownout visuals, the Power tab explains the gap | 1 |
| Bumblebots, blueprints | **Keep** | Unchanged (Era 4) | — |
| Study Desk / research | **Reshape** | 4-stage keystones, era columns, prune buffs into era rewards | 3 |
| The opening and tutorial chain | **Replace** | The Keeper's Line (section 6), the Notebook, lesson cards, the Now strip | 2 |
| Daily requests, Guild contracts, restoration projects | **Reshape → Orders** | One Orders board, standing customers, consignment by post, reputation per business | 3 |
| Town | **Reshape** | Five infrastructure keystones that visibly change the town (mill, waterworks, lamps, tram, clock) | 3, 5 |
| The Old Mine (60 floors, monsters) | **Reshape → The Deepworks** | 30 levels in 6 strata, each a works problem with a machine reward; ores stay unique; pests + hazards; combat optional | 4 |
| Villagers (14) | **Reshape** | 6 re-roled into works roles; "Trust" built by orders, favours, discoveries; gifts matter less; heart events rewritten for the 6 | 5 |
| Festivals (4) | **Reshape** | 2 kept, 2 replaced (D5) | 5 |
| Farmhouse, renovations, furniture | **Reshape → Workshop HQ** | Structures indoors, the drafting table (blueprint library), the ledger | 5 |
| Pet | **Keep** | Unchanged; Tock is a stretch goal | 5+ |
| Romance / partners | **Keep, freeze** | D3 | — |
| Mags' cart | **Reshape → freight broker** | Rare components, a Sunday auction, shortage events | 5 |
| Founder's Day | **Replace** | The Sprocket Fair scores a line's throughput (the deferred "Clockmakers' Exhibition") | 5 |
| Crops (37), trees, animals, fishing, ponds | **Keep + industrial uses** | Re-derived numbers; fiber/oil/starch/pigment/spirit intermediates; animals and fishing unchanged | 3 |
| Modes, maps, achievements, profile | **Keep** | New "works" achievements; Rush unchanged | — |
| Mail | **Reshape** | D9 | 0 |
| Procedural art fallback (`?art=old`) | **Cut** at the end of Phase 6 | The generators in `src/render/art/` are deleted once nothing needs them | 6 |

---

## 3. Identity

**Pitch:** You inherit the valley's last clockwork farm. Fields feed machines, machines feed the
town, and the town's needs pull you deeper into the valley: into the flooded Deepworks, up to the
sky-courier's routes, back to the silent clocktower. Build the works that bring Thistlewick back
to life.

**Pillars, in order.** When two pillars conflict, the higher one wins.
1. **Building, understanding, troubleshooting and improving production lines.**
2. **Engineering choices with more than one answer** (another machine, a buffer, a splitter, more
   power, a better recipe, moving the line nearer the source).
3. **Exploration that reveals capabilities**, not only resources: the Deepworks' strata each hand
   you a machine problem and a machine.
4. **Agriculture as the biological half of industry**: crops are inputs with industrial uses.
5. **A valley that depends on what you make**: businesses with needs; infrastructure that
   visibly changes when you meet them; people who are specialists first and friends second.
6. **Cosy atmosphere and environmental storytelling** support all of the above. Warm brass,
   never grey. "Dopaminergic but cosy" (`references/notes.md`) stays the feel.

**What we are not.** Not Factorio: no pollution, no enemies attacking the base, no rocket. Not
Stardew: hearts are not content, the mine is not a dungeon, festivals are not the calendar's
reason to exist. Not Satisfactory: no first person, no verticality. The references are for
analysis, never templates.

**The screenshot test** (for Phase 6): a screenshot with no logo should be recognisable by its
machines: moving parts, pipes and gantries in brass and copper, plants growing *on* the works.

---

## 4. The automation redesign (Phase 1)

This is the most important work in the version and it comes first, in isolation, so the opening
can be built on something that is already satisfying.

### 4.1 The machine contract

Every structure that handles items declares what it does, and the game shows it everywhere.

- **Data.** `StructureDef` gains `io: { in: ItemSpec[] | 'any'; out: ItemSpec[] | 'any'; time?: number; buffer: { in: number; out: number }; power?: number; fuel?: boolean }`, derived
  automatically for machines from their station's recipes (`src/data/recipes.ts`) and declared
  by hand for arms, belts, chests, the crate, the desk, drills, cranes, sowers. A data test
  asserts every port-capable kind has one.
- **State.** `e.working: boolean` becomes `e.state: MState` with exactly six values:
  `Idle`, `Working`, `Starved` (wants input, none available), `Blocked` (output has nowhere to
  go), `Unpowered` (no grid or satisfaction < 0.25), `NeedsFuel`. The free-text `m.status` in
  `src/sim/systems/machines.ts:150-210` becomes a lookup from the state plus one detail string.
  Arms get the same states: an arm with nothing behind it is Starved; one whose front is full is
  Blocked. Belts: a lane that hasn't moved for 3 s is Blocked.
- **Time in state.** `src/sim/systems/stats.ts` keeps, per entity, the share of the last 60 s
  spent in each state (a ring of 60 one-second samples; cheap). This is what the diagnosis uses.
- **Shown.** A 7 px state glyph above every non-idle, non-working machine and arm (new sprites
  `fx:state:<state>`; amber for Starved, red for Blocked, blue for Unpowered, grey for fuel;
  `Working` shows nothing, `Idle` a faint zz). The pulse lamps on the HUD (`src/ui/hudparts.ts`)
  map to the same states. The tooltip on hover (`src/sim/prompts.ts`) adds one line: *"Waiting
  for cogbeans"*, *"Crate is full"*, *"Needs 40 more power"*. The machine window
  (`src/ui/windows/struct.ts`) leads with the contract: inputs → outputs, time, buffers, power.

### 4.2 Arms

The basic Clockwork Arm stays what it is (one item per swing, one tile, no power); the fix is
purpose, visibility and feedback, not a new stat line.

- **Pick/drop tiles always visible on hover**, not only in build mode (the green/gold squares).
- **The held item is drawn mid-swing** at the right lane height (already in `renderer.ts`,
  check it against the new arm art).
- **Arm states** as in 4.1. An arm that is Starved for more than 10 s shows the glyph; the
  first time this happens the lesson card "Starved" appears (section 6.4).
- **The winding verb.** F on a spring arm (basic, reaching) gives it a 30-second overwind: 2x
  speed, a spring-ratchet sound, the key turning in the art. It is a juice verb, not a chore:
  arms never stop for lack of winding.
- **The ladder stays** (Brass = fast, Reaching = 2 tiles, Sorting = filter, Bulk = handful) but
  is re-sequenced by era (section 8): Reaching and Sorting arrive with Water power, not Steam.
- **Numbers**: one basic arm (0.75 swings/s) keeps one jar busy; a second jar on the same bean
  chest starves within a minute. These are the opening's "bottleneck" beat, and
  `tests/lines.test.ts` pins them.

### 4.3 Belts, buffers, splitters: clear roles

- **Belt = distance and merging.** Keep `beltSink`. Add the blocked visual: a lane that stops
  compresses and the chevrons stop scrolling.
- **Chest = the only buffer.** The stock-limit setting on arms stays. A chest fed by an arm shows
  a small fill bar when hovered.
- **Splitter = division**, with the existing modes (alternate / prefer / filter).
- **Burrow belt = crossing.**
- **The line inspector.** Hover a belt with the Inspect key (Q while not holding anything, or a
  new I): the line lights up from its sources to its sinks, with items/min at the sink and the
  first Starved/Blocked entity ringed. Implementation: a walk over `b.next` pointers and
  `armTiles`, cached per topology version (`g.ents.version`).

### 4.4 Power that you can see

- Under-supplied grids: machines animate slower, lamps dim, the pulse lamp turns amber, the
  pole tooltip says *"Demand 180 / supply 120: add a generator or switch off two machines"*.
- The Power tab (`factory.ts` `powerTab`) keeps the graph and adds the sentence.
- A **grid switch** on poles (a toggle in the pole window) so "switch off two machines" is a
  real option. Small: the pole's consumers get `e.off`.

### 4.5 Bottleneck diagnosis

The Stats window gets a **Line** tab. Pick an item (or the crate): it lists the chain that makes
it (sources → machines → sink, found by walking ports and belts), per-stage items/min, the
share of time each stage spent Starved/Blocked, and one sentence of advice chosen from a small
table: *"The jar waits for beans 60% of the time: add a second bean source, or a chest in
between."* / *"The crate is full 40% of the time: the post can't keep up; ship more kinds or add
a second crate."* / *"Two machines share one basic arm: a Brass Arm or a second arm."* The
advice table is data (`src/data/advice.ts`), one entry per (state, kind) pair, so it grows
without code.

### 4.6 Crops as industrial inputs

Six intermediates with one capability each (data only, `src/data/recipes.ts` + `items.ts`):

| Crop(s) | Intermediate | Made in | Used for |
|---|---|---|---|
| flax, cotton, fiber | **Canvas** | loom | belts (belt_1 recipe: wood + canvas), Roxy's envelope repairs (an order) |
| sunflower, rapeseed (new) | **Oil** | mill | **Lubricant** (oil + sap): a machine buff item, +20% speed for a day when loaded (arms can feed it) |
| potato, yam, corn | **Starch paste** | jar | blueprint ghosts build from paste + the parts (bumblebots), sign labels |
| beet, mooncap, starpetal | **Pigment** | jar | paint: decor colours, the tram's livery, Hazel's orders |
| sweetcane, barley | **Spirit** | keg | the steam engine's clean fuel (2x a coal), Rowan's orders |
| cogbean | **Cogbean oil** | jar | the opening's second product (teaches "one input, two recipes") |

Crops keep their food and sale uses; the point is that farming is now *required* by the works
and the works is required by the town.

### 4.7 "Machines feel alive" (lands in Phase 6, planned here)

Every machine gets an idle frame and a working loop; arms show the spring key turning while
idle (the "?" at rest problem becomes the design: at rest the arm is a wound spring, not a
question mark); the jar bubbles; the furnace glows and puffs; belts rattle (a subtle 2-frame
roller animation); state changes make one sound each (Starved: a hollow click, once).

### 4.8 Tests and numbers

- `tests/lines.test.ts` builds four canonical lines headless and asserts rates (±10%) and that
  the diagnosis names the right stage: **L1** chest → arm → jar → arm → crate; **L2** two jars
  on one chest (the second starves); **L3** a splitter feeding two jars (both run); **L4** a
  water wheel + poles + mill with 2x the demand (brownout: both machines at half speed, the
  advice says "add a generator").
- `scripts/pace.ts` bots build L1 then L2 then L3 so the 28-day economy numbers include the new
  behaviour; the 8-seed averages (Story 10.7k, Rush 13.0k today) must not fall more than 15%.
- `e2e/perf.mjs` still runs 1,300 belts / 260 machines under 1 ms tick with the state tracking on.

---

## 5. What a new player should know after the first hour

The tutorial is measured by what the player can *do and explain*, not by markers completed.
After the Keeper's Line a player should be able to answer:

1. What does an arm do, and which side does it take from?
2. Why did the second jar stop? (It was starved.) Name two fixes.
3. What does the crate do, when, and what happens to the price if you ship 30 of one thing?
4. What is a belt for, and what happens at the end of one?
5. Where do you see what a machine is waiting for? (The glyph, the tooltip, the Line tab.)
6. How do you learn a new machine? (The desk: feed it bundles; keystones want an experiment.)
7. Who in town wants what you make, and how do you find out? (The Orders board.)
8. What are you going to build next, and why?

The playtest script for a new player is those eight questions after 60 minutes; the
`indie-critic` agent is asked them too. `tests/bot.ts` plays the whole Keeper's Line unaided.

---

## 6. The first hour: "The Keeper's Line" (Phase 2)

Replaces both tutorial chains in `src/data/goals.ts`. One chain, eight beats, in the farmhouse
yard on every map (the `OPENING` tile rule stays, `src/sim/opening.ts`). Time targets are real
minutes at Story speed.

| Beat | Minute | What happens | What it teaches | The "why" line |
|---|---|---|---|---|
| **B1 The broken line** | 0-4 | The keeper's note. The jar and crate are there; the arm between them is gone ("sent to the Professor for mending"). Pick the ripe cogbeans, F the jar, carry pickles to the crate by hand. The noon post pays. | Move, F, inventory, the crate, the post, the coin shower. | "Every jar you carry is a jar you didn't plant." |
| **B2 The Professor's arm** | 4-7 | Prof. Cogwhistle walks onto the farm (a scripted visit, like the day-4 Roxy card) with the mended arm. Place it on the marked tile; the pick/drop squares show; watch it carry the next pickle. | Arms: behind → front, orientation, "it turns itself". | "It only does one thing. That is the point." |
| **B3 Hands free** | 7-10 | The cellar chest of beans + a second arm: chest → arm → jar → arm → crate. The quest completes when 4 pickles ship with zero manual jar loads since the quest began (`g.counters.manualLoad`). | A complete process. The word "line". | "That's a line. It runs while you don't." |
| **B4 Room to grow** | 10-14 | Till, plant, water the marked plot (cogbean seeds from the note). The chest is "the keeper's last beans"; the plot is tomorrow's. | Farming as the line's supply. Water = growth. | "A line is only as good as what feeds it." |
| **B5 The desk** | 14-20 | Wood and stone from the yard; craft bundles (fiber + crop); place the desk; research **Conveyance** as the first keystone in miniature: *Observe* (hold the keeper's spare belt piece), *Experiment* (lay 4 belts from the jar's arm into the crate), *Apply* (the desk finishes it overnight-fast: 2 real minutes). | Research has stages; belts deliver into what they hit; crafting. | "You don't research what you haven't touched." |
| **B6 The bottleneck** | day 2, 20-30 | The post's day-1 pay buys a second jar at the Mercantile (the quest hands the coins and sends the player to town: the town beat). Two jars on one chest: the second shows the **Starved** glyph; the "Starved" lesson card; three fixes are each possible: plant more, buy beans from Roxy's hold (add cogbeans to `airfreight`), or move the second jar onto the plot's own arm. | Diagnosis. Multiple solutions. The glyph, the tooltip, the Line tab. | "A stopped machine is a question. The glyph is the answer." |
| **B7 The town wants** | day 2-3 | The first **order**: Rowan wants 6 pickles by Friday. Deliver by hand, or tag the crate (consignment): the post delivers tagged goods to the inn. The crate's price tag drops after 10 of one thing: saturation, in one sentence. Reputation with the inn +1: Rowan teaches the Cogbean oil recipe. | Orders, consignment, saturation, reputation, a second recipe for one input. | "The town is your real customer. The crate is just the door." |
| **B8 Deeper** | day 3-5 | Bram wants copper: the quarry road, the Deepworks entrance, copper rocks, the furnace. Then the first full keystone, **Water Power**, with a real experiment: a wheel on the river, two poles, the mill; the brownout when the mill and a Brass Arm share the wheel. Ends with **Plan the works**: a card with three directions (more lines / the Deepworks / the Orders board) that each start a story thread. | Exploration gives materials and a problem; power; the first real choice. | "From here, you decide." |

### 6.1 Rules of the chain

- **One main objective at a time** in the tracker, never three. Side objectives (up to two)
  only after B8.
- Every quest has a `why` field shown under the title in the tracker and the Notebook. A quest
  with no `why` fails `tests/data.test.ts`.
- Objectives check state, not only events (DECISIONS #46), so doing a step early never blocks.
- The opening's tiles are never weeded or storm-littered (`openingTile`).
- No letters from quests (D9). The Professor's visit and Rowan's order are in-world: a visit and
  a board notice.
- No step requires a window the player hasn't been shown. Windows are introduced one at a time
  (bag at B1, crafting at B5, research at B5, Orders at B7, Stats at B6 via the Line tab).

### 6.2 The Now strip (replaces the 3-quest tracker)

One line at the top left: *"Now: feed the jar (2/8 beans)"* with the `why` beneath in small
type and a **?** button. The strip never covers the key bubble: the bubble avoids HUD `occ`
rectangles (flips below the tile, or the strip fades to 40% while they overlap). Old 3-quest
tracking lives in the Notebook.

### 6.3 The Keeper's Notebook (the persistent reference)

A new tab in the existing Journal window (`src/ui/windows/journal.ts`, beside quests, friends,
collections, mail, map, board, museum) with four pages, filled as things happen:
**Lessons** (every lesson card seen, re-readable), **Machines** (every machine kind the player
has placed, with its contract), **Lines** (the diagnosis tab's last view per named line),
**Controls** (the real key names, from `keyLabel`). The ? button opens it on the relevant page.

### 6.4 Lesson cards (contextual, once each)

Shown the first time the situation happens, 2 lines + a 24x24 picture, dismissed with any
key, never modal, logged in the Notebook. The set: **Starved**, **Blocked**, **Output full**,
**Unpowered**, **Needs fuel**, **Belt ends deliver**, **Arms take from behind**, **A chest is a
buffer**, **Saturation**, **Consignment**, **Research stages**, **The night post**, **Quality**
(first silver crop), **Brownout**, **The spring key** (first overwind). Implementation: a
`lesson(id)` sim event, `src/data/lessons.ts`, a tiny `LessonCard` overlay in `src/ui/`.

### 6.5 Recovery

- **Undo last placement** (Ctrl+Z, 10 s window, refund): `src/sim/build.ts` keeps a 5-deep
  stack of placements.
- **Rotate in place** already exists (R); the arm's squares make the mistake visible before it
  costs anything.
- A line that is wrong for 30 s shows the glyph; the Line tab names the stage. No step in the
  chain can be made unwinnable: `tests/modes.test.ts` grows a "wreck the yard" case (remove
  everything mid-chain, check every objective can still complete).

### 6.6 Measurement

- Time to first automated sale ≤ 4 min (1.1 already); time to a full line (B3) ≤ 10 min;
  B6's second jar starves within 60 s on every map and seed (test over 150 seeds).
- `tests/bot.ts` completes B1-B8 by day 5 on 8 seeds; the pacing numbers hold.
- The `indie-critic` answers the eight questions from section 5 from a fresh build. Any answer
  it gets wrong is a Phase 2 bug.

---

## 7. The world, system by system (Phases 3-5)

### 7.1 Farming
Keep everything. Re-derive the ~15 crops still on Stardew's numbers (the 1.1 deferred list):
`price = round((seedPrice + growDays * 6) * tagMult)` with `tagMult` 1.0 vegetable / 1.15
fruit / 0.8 grain-fiber / 1.6 rare, then hand-adjust the five crops the pacing bot leans on.
Add **rapeseed** (summer, oil). The six intermediates of 4.6. Giant crops, quality, cranes,
sowers unchanged.

### 7.2 The Deepworks (was the Old Mine)
Purpose now: ore, gems, monsters, 60 floors, ladders. Resemblance: the Stardew mine almost
exactly. Redesign:
- **30 levels in 6 strata** of 5: Earth (copper, clay), Clayworks (tin, the first *works
  problem*: a collapsed gallery that needs 20 beams, which teaches the sawmill), Frost (iron;
  **flooded**: levels 11-15 are under water until the Waterworks keystone restores the pump
  house), Ember (gold, coal; gas pockets that need the lamp post's lantern research), Crystal
  (gems; the old works' lockers hold blueprints), Starfall (starmetal; the fallen star).
- Each stratum ends in a **works chamber**: an abandoned machine the player studies (an
  Observation for a keystone) and can restore in place (a project inside the mine: the lift,
  the pump, the rail cart). Restoring the rail cart is the **Tram** keystone: a cart runs
  quarry → town every morning and sells 20 ore at a premium (a visible town change).
- **Pests and hazards instead of monsters**: three pests reuse creature code (the rust-mite
  eats unattended ore drops, the clatter-crab blocks a gallery until hit, the wisp hides a
  ladder); hazards are floods, gas, loose rock (`shake`, dampened). Swords stay; `s_deep`
  stops gating anything.
- **Ores stay unique** and so do the drill veins at the quarry. Mine floors still regenerate
  daily; `deepest` and restored chambers are saved.
- Code: `src/sim/systems/mine.ts` (666 lines) keeps its generator; strata replace `themeOf`;
  chambers are placed structures with `st.fixed`.

### 7.3 Research (section 8 has the tree)
- **Minor nodes** keep bundles (collect-and-feed is fine for small things; the desk is ours).
- **Keystones** (8) get stages: `stages: { observe?: ItemSpec; experiment?: ObjectiveDef[]; validate?: { item: ItemSpec; perMin: number; minutes: number } }` on `ResearchDef`, then the
  bundle cost as *Apply*. The node shows four pips. The first keystone (Conveyance) is the
  opening's miniature version.
- **Flat buffs become era rewards**: finishing an era's keystone grants the era's buffs
  (`machineSpeed`, `armHand`, `labSpeed`, `marketBonus`, `reach`) in one card. 12 nodes go.
- **The window**: five era columns, both axes scroll with the wheel (shift = horizontal), a
  Fit button, the info panel never hides a node. Fixes the owner's scroll bug by layout.

### 7.4 Orders (was requests + contracts + projects)
One board (`J` → Orders, and the physical noticeboard on the square) with three kinds:
**Today** (small daily asks, from `REQUEST_POOL`), **Standing** (each business has recurring
needs that grow with reputation: inn → food; smithy → metal; joinery → wood; workshop → parts;
clinic → tea/herbs; harbour → fish/rope; airship → anything, bulk, premium), **Works** (the
restoration projects and the five keystones, with their visible payoff). Consignment: a tag on
a crate routes the post's pickup to a customer; arms can therefore fulfil orders (the Guild
depot already does this; generalise `src/sim/systems/contracts.ts`). Reputation per business
(six ranks, as the Guild has) unlocks that business's special stock and its keystone's parts.
Market saturation stays and is shown on the crate's price tag.

### 7.5 The town depends on you (the five keystones)
| Era | Keystone | What the player builds | What the town shows |
|---|---|---|---|
| 1 Spring | The Keeper's Line | the opening | the farm's crate flag, the post's cart |
| 2 Water | **The Mill** | a wheel + poles + the grist mill; 200 flour to the mill project | the town mill's wheel turns; Rowan's inn sells bread; the bakery window project opens |
| 3 Steam | **The Waterworks** | the pump house project (brass, coils, 50 oil) | the square's fountain runs; the Frost stratum drains; mist towers unlock |
| 3 Steam | **Lamplighting** | 12 lamps on the square powered from the player's grid (a pole at the farm gate links town) | the square lit at night; Lantern Night happens on the player's power |
| 4 Clockwork | **The Tram** | the rail cart chamber in the Deepworks + 300 planks + 40 brass gears | a cart runs quarry → town each morning; Juniper becomes the millwright; ore sells at a premium |
| 5 Starlight | **The Clock** (exists) + the Orrery (exists) | as today | as today |

Each keystone is a project in the Orders board, a flag, a building state in
`src/render/art/structs.ts` / `buildings` sheet, and a short scene (the Roxy card pattern).

### 7.6 Villagers as specialists
Six re-roles (the deferred list's "about 6"): Juniper → **millwright** (builds the mill,
sells machine frames); Bram → **foundry master** (smelting orders, the blast furnace); Sable →
**archivist** (keeps the old works' records: Observation samples are "lent" by her); Thorne →
**the last engineer of the old works** (blueprints in the forest; the Tram's know-how); Hazel
→ **draughtswoman** (blueprint art, pigments); Pip → **apprentice** (follows the player's
lines, asks the lesson questions back: a tutorial echo). Marigold, Rowan, Ines, Wren, Clem,
Tobias and Roxy keep their roles; they become customers (7.4). Hearts stay under the hood but
the UI says **Trust**, built mostly by orders and discoveries (gift points ÷ 3). Birthdays
stay. Heart events: the six re-roled villagers get two rewritten events each first (12), the
rest later; all other events unchanged.

### 7.7 Festivals (D5)
Spring **Sprocket Fair**: bring a line (a 6x6 blueprint, placed on the square's test bed), it
runs for 60 s, throughput is scored against three NPC entries; replaces Founder's Day's
scoring too (the deferred "Clockmakers' Exhibition"). Fall **Harvest Haul**: the trade fair; an
auction of one rare lot against two NPC bidders, and every business's standing order pays
double that day. Lantern Night and Frostlight Skate stay.

### 7.8 Workshop HQ (was the farmhouse)
Structures indoors (D10): a second entity store (`g.houseEnts`) ticked by the same systems
through a `map` field on `Ents`; chests, jars, kegs, loom, desk, lamps, decor. The almanac
becomes the **ledger** (yesterday's sales by customer, saturation, tomorrow's weather). The
**drafting table** (a renovation) is the blueprint library: save, name, re-place. Renovations
become workshop upgrades (Kitchen, Cellar, Featherbed, Hearth stay; add the Basement: belts
and arms indoors, 2.1 if not reached).

### 7.9 Mags → freight broker
The cart keeps its days; stock becomes rare components and off-season seeds; a Sunday
auction (one lot); shortage events (a business's need doubles for a week; the broker sells the
missing input at a premium). Small: `src/sim/systems/cart.ts`.

### 7.10 Mail (D9)
`src/sim/systems/quests.ts:61` stops sending; `src/sim/systems/goals.ts:246-260` moves
season notes and birthday nudges to the almanac; `send()` (`src/sim/systems/goals.ts:220`)
today only de-duplicates by id and caps the list at 60, so it gains a one-a-day queue.

### 7.11 Achievements, modes, maps, pet, partners
Unchanged, plus ~15 works achievements (first Starved fix, first consignment, each keystone,
a 60-item/min line, every stratum chamber). Tinker's Yard's ruins get wrecked-machine dressing
in Phase 6.

---

## 8. Progression: five eras

| Era | Capabilities (research columns) | Keystone | Target day (Story, bot) |
|---|---|---|---|
| **1 Spring** | Conveyance, Clockwork Arms, Preserving, Soil, Woodcraft, Metalwork, Brewing, Apiary, Tapping, Trapcraft | Keeper's Line | 1-5 |
| **2 Water** | Water Power, Logistics (splitter, burrow), Reaching Arms, Sorting Arms, Milling, Sawmilling, Dairy, Weaving, Masonry, Glass, Brass, Storage, Irrigation | The Mill | 6-20 |
| **3 Steam** | Steam Power, Wind, Brass Arms, Assembly, Drills, Crushing, Bottling, Hearth Cooking, Steam Loom, Spark Coils, Towers, Batteries | Waterworks, Lamplighting | 20-45 |
| **4 Clockwork** | Clockwork Assembly, Bulk Arms, Harvest Cranes, Seed Sowers, Blast Furnace, Steam Kitchen, Gilded Sprinklers, Sun Lenses, Brass Drills, Brass Belts | The Tram | 45-80 |
| **5 Starlight** | Bumblebots, Gilded Belts, Mist Towers, Starmetal, Grand Works | The Clock, the Orrery | 80+ |

Each era's keystone is the "why" of its research; each era ends with a **Plan the works** card
(three directions). Era rewards replace the 12 flat-buff nodes. The research tree's `pos`
becomes `era` + `row`. The 28-day pacing bot should reach the Mill by day 20 on 6 of 8 seeds.

---

## 9. Art direction brief (Phase 6, after Nov 9)

**Industrial botany in Resurrect 64.** Brass, copper, iron, ceramic and dark timber; machines
with identifiable moving parts; plants that grow on and around the works (vines on the wheel,
moss on the pump house, cogbeans up a gantry); silhouettes the farm never had: gantries, pipes,
hoists, kilns, rails, a water tower. Keep the warmth, the plum outline, the upper-left light.
`STYLE.md` gets a new section, "Machines", with three rules: every machine has a *readable
moving part*, every machine has idle and working frames, every machine's output side is marked.

| Group | Keep / transform / replace | Count (generations, est.) |
|---|---|---|
| Arms (5 kinds, 4 dirs, idle key-turn + 4 swing frames) | **Replace** (fixes "?" at rest) | 60 |
| State glyphs, lesson pictures, the Now strip, Notebook UI, Orders board, Skills cards, research era columns | **New** | 45 |
| Machine idle/working loops (20 machines × 2-4 frames) | **Transform** (existing sprites get frames) | 80 |
| Terrain: flagstone path set (D6), plank bridge Wang set with ends and rails, seam fixes from the audit | **Replace** | 45 |
| Deepworks strata (6 × ~8 tiles + 3 chambers + 3 pests) | **New** | 70 |
| Town works props (mill wheel, pump house, fountain, lamps lit, tram + rails, water tower, gantry, pipes) | **New** | 50 |
| Re-roled villagers (6 outfits + 6 portrait sets) | **Transform** | 50 |
| Tinker's Yard wrecked machines, the Harvest Haul stalls, the Sprocket Fair test bed | **New** | 30 |
| Tock (stretch) | **New** | 20 |
| **Total** | | **~450** (one month's budget, 150 in reserve) |

The procedural generators (`src/render/art/`, ~4,000 lines in 12 files) are deleted at the end of Phase 6;
`?art=old` goes with them; `node e2e/coverage.mjs` must still read 100%.

---

## 10. Bugs and UX from the playtest (the owner's list, 2026-10-09)

Fixed in Phase 0 unless the phase column says otherwise.

| # | Report | Where / cause | Fix | Check | Phase |
|---|---|---|---|---|---|
| 1 | Shift-click works one way but not the other; on the wooden chest half the time | `src/ui/windows/common.ts:44` moves only when `opts.target` is set; `struct.ts:63-66` sets the bag's target only for writable containers. "Half the time" points at input: the click fires on mouse-up, and shift may already be up, or `ui.hand` holds an item and swallows the click. | Latch shift at mouse-down; ignore shift-moves while `ui.hand` is set; add Ctrl-click = move one, double-click = move all of a kind. | New `e2e/shift.mjs`: 20 shift-clicks each way on chest, crate, jar, desk, depot; 0 failures. | 0 |
| 2 | Make items placeable in the house | `src/sim/systems/house.ts:164` `canPlaceDecor` accepts furniture only; `src/sim/build.ts:29` has no house map | Workshop HQ (7.8) | `e2e/house.mjs` places a chest and a jar indoors, reload, still there | 5 |
| 3 | Ground tiles don't connect (bridges, and recurring) | `src/render/renderer.ts:217` draws planks as a per-tile class over water with no transition set, and the fringe pass skips `PLANKS` (`:389-397`); several Wang corner masks were generated in different batches and don't meet at the edges | A **seam audit** (`e2e/seams.mjs`: render every set's 16 masks in a ring and pixel-diff shared edges; list offenders); regenerate the offenders; a plank set with ends and rails | `seams.mjs` reports 0; the sweep's bridge shots | 0 (audit + worst), 6 (rest) |
| 4 | Dampen the vigorous shaking | Tree shake is ±8 px at 50 rad/s (`renderer.ts:512`, amount 4 from `src/sim/actions.ts:166`); camera shake `cam.shake*6` (`renderer.ts:441`) | Tree: ±2 px, 30 rad/s, eased decay; camera: half the amounts, cap 3 px; the Screen shake setting gates both | Eye check; `juice.test.ts` asserts the caps | 0 |
| 5 | Skills UI: text over the border, bland, confusing | `src/ui/windows/menu.ts:92-104`: perk descriptions drawn at `sx + 210` with no width; no explanation of what a skill does | One card per skill: icon, level ring, XP to next, the next perk, "what this unlocks"; part of the tutorial surface | `npm run screens` 0 issues; the audit test | 2 |
| 6 | The quest screen covers prompts | The tracker (`src/ui/hud.ts:95-110`) pushes `occ` rects; the key bubble (`src/app/play.ts:387-432`) is world-anchored and ignores them | The Now strip (6.2) + the bubble avoids `occ` | Sweep scenario: player at the top-left facing a jar | 2 (interim in 0: the bubble avoids `occ`) |
| 7 | You can one-shot a chest | `src/sim/actions.ts:329` (axe) and `:363` (pick): any hit on a structure calls `deconstruct` | Structures take 3 hits with a wobble; a non-empty chest/crate never breaks by tool, only by remove mode (X) or the window's Pick up; contents are always refunded (already: `build.ts:165`) | `systems.test.ts` case | 0 |
| 8 | Quest says Ottoline, leads to the Professor | `src/data/goals.ts:85-88` mixes "Professor Cogwhistle" and "Talk to Ottoline"; `shortName` (`src/data/cookbook.ts:27`) skips the title and gives "Ottoline" | D7: one display form in quests/arrows/map; a name tag over the target villager | Text audit test: no quest text contains "Ottoline" | 0 |
| 9 | Too much mail | `src/sim/systems/quests.ts:61` mails every quest; `src/sim/systems/goals.ts:246-260` seasons, festivals, birthdays, gifts | D9 | Day-7 bot: ≤ 7 letters | 0 |
| 10 | Can't scroll the research tree to every topic | `src/ui/windows/factory.ts:31-49`: the wheel pans Y only; X needs a right-drag (or shift-drag); no scrollbars, so nothing says there is more to the right or below | Phase 0: wheel + shift pans X, visible scrollbars on both axes, a Fit button. Phase 3: the era-column layout | Sweep: a shot scrolled to `r_traps` and to `r_bot_count` | 0, 3 |
| 11 | The cobble path design | `path_stone` + `T.PATH` art in `art/terrain` | D6: a flagstone set | Eye check, sweep | 0 |
| 12 | Every piece of grass blocks you | `src/sim/world/tilemap.ts:23` `SOLID_OBJ` includes `WEED` and `TWIG` | Weeds and twigs are walkable (bushes, logs, rocks stay solid); walking through weeds rustles | `sim.test.ts` walkability case; the bot's path lengths drop | 0 |
| 13 | The pickaxe swings sideways | The C32 player sheet's `pick0/pick1` frames (`src/art/player.json`, `art/player/c32/pick/`) were generated as a side swing | Regenerate as an overhead strike like the hoe (4 dirs × 2 phases + 1 custom animation ≈ 9 generations) | `node e2e/sprites.mjs ch:player:0:pick0 ch:player:0:pick1 ch:player:2:pick0 ch:player:2:pick1` (exact names; the script takes no wildcards) | 0 |
| 14 | 1.1 leftovers: arms "?" at rest; day-2 toast behind the tracker; look-alike tool icons; crafting labels; the farmhouse doorway; research colours; 960x600 embed; jar 402 vs 400; crate pop pre-saturation price; raw palette indices | see `ROADMAP-1.1.md` Phase 4 | Arms: 6. Toast/tracker: 2 (the Now strip). Tool icons: 6. Crafting labels: 2. Doorway: 6. Research colours: 3. Embed: 0. Jar price, crate pop, palette names: 0 | sweep | 0, 2, 3, 6 |

Also from the playtest, as positives to protect: the study desk, the unique ores. Neither
changes shape.

---

## 11. Phases

Estimates are sessions of the usual length. Every phase ends with: typecheck, `npm test`,
`npm run screens` (0 issues), `node e2e/smoke.mjs` (0 console errors), the build, PROGRESS.md,
a commit on `works`. Phases 2, 5 and 7 end with the `indie-critic`.

### Phase 0 — Hotfix 1.1.1 and the ground rules (1 session)
- Bugs 1, 3 (audit + planks), 4, 7, 8, 9, 10 (quick fix), 11, 12, 13 from section 10, plus the
  1.1 leftovers marked 0 (embed size, jar price, crate pop, palette names), and bug 6's interim
  (the bubble avoids `occ`).
- Write the D1-D12 answers into `DECISIONS.md` (#49-#60).
- Create branch `works`; `main` gets only this phase: bump to 1.1.1, `Build desktop app.bat`,
  `gh release create v1.1.1`.
- Art: ≤ 60 generations (pick frames, flagstone set, plank set).
- Done when: the bug table's checks pass; the release is up; the seam audit exists and its
  offender list is in `e2e/out/seams.md`.

### Phase 1 — The automation core (2 sessions)
- 4.1 contract + states + time-in-state; 4.2 arms (hover squares, the winding verb); 4.3 the
  blocked visual and the line inspector; 4.4 power feedback and the grid switch; 4.5 the Line
  tab and `src/data/advice.ts`; 4.6 the six intermediates.
- `tests/lines.test.ts` (L1-L4); `scripts/pace.ts` builds L1-L3; `e2e/perf.mjs` within budget.
- State glyphs use placeholder code-drawn marks until Phase 6 (the renderer hooks are the
  deliverable, the art is not).
- Done when: the four lines diagnose correctly in tests and on screen; an 8-seed pace run is
  within 15% of 1.1's numbers; `indie-critic` (short, automation-only review) finds no
  "I can't tell why it stopped".

### Phase 2 — The Keeper's Line (2-3 sessions)
- Section 6 in full: the eight beats, the Now strip, the Notebook, lesson cards, undo, the
  Professor's visit scene, Rowan's first order (a minimal Orders board: Today + one Standing
  entry; the rest is Phase 3), the Skills cards (bug 5), the crafting labels.
- Old tutorial chains removed; `needFlag`'d quests migrated: saves from 1.x mark the whole old
  chain done if `tutorial_done` is set.
- `tests/bot.ts` plays B1-B8; the 150-seed opening test; the "wreck the yard" test.
- Done when: the bot finishes B8 by day 5 on 8 seeds; the critic answers 7 of 8 questions from
  section 5 correctly from a fresh build; sweep 0 issues; **merge to `main` as 2.0 beta**
  (the website; installers stay 1.1.1).

### Phase 3 — Orders, research stages, the Mill (2 sessions)
- 7.4 the Orders board (unifying requests, contracts, projects; consignment; per-business
  reputation); 7.3 research stages, era columns, era rewards, the 12 nodes pruned; 7.1 crop
  numbers and rapeseed; the Mill keystone end to end (project → flag → town change → Rowan's
  bread); research window colours (1.1 leftover).
- Save migration v4: contracts/requests/projects state → orders; research `done` unchanged;
  pruned node ids map to era rewards.
- Done when: a bot run reaches the Mill by day 20 on 6 of 8 seeds; `data.test.ts` validates
  every order's items and every keystone's stages; sweep.

### Phase 4 — The Deepworks (2 sessions)
- 7.2: strata, the three chambers (lift, pump, rail cart), pests, hazards, the flooded Frost
  stratum tied to the Waterworks keystone, the Tram keystone's cart (sim + a moving sprite on
  the quarry road), Lamplighting (the farm-gate pole links the square's lamps).
- Floors 31-60 content folds into the six strata; `deepest` migrates (×0.5).
- Done when: `e2e/minex.mjs` walks every stratum; the longrun bot restores the lift; the Tram
  runs on a saved and reloaded game.

### Phase 5 — People, events, HQ (2-3 sessions)
- 7.6 the six re-roles with 12 rewritten heart events and ~40 lines each; Trust in the UI;
  Pip's echo questions; 7.7 the Sprocket Fair and the Harvest Haul (Kite Day and Pumpkin Roll
  retired; their achievements remapped); 7.8 Workshop HQ with indoor structures and the
  drafting table; 7.9 the broker; Tock if there is time.
- Done when: `e2e/roxy.mjs`-style real-input passes for two re-roled villagers and both new
  events; `e2e/house.mjs` with indoor structures; the critic's full review.

### Phase 6 — The art direction pass (3-4 sessions, after Nov 9)
- Section 9, one `art-director` agent per group in parallel (the Phase 2 pattern from 1.1,
  `art/README.md`); `STYLE.md` "Machines" section; the seam audit at 0; `coverage.mjs` 100%;
  delete `src/render/art/` generators and `?art=old`.
- Done when: the screenshot test (section 3) passes by the owner's eye; sweep 0 issues at
  1280x720 and 1366x620; `qa-screens` finds no regressions.

### Phase 7 — Review and release 2.0 (1 session)
- `/code-review` (high) on `main..works`; the critic's full review; fix the Criticals.
- README, HANDOFF, PROGRESS, DECISIONS updated; version 2.0.0; merge to `main`;
  `Build desktop app.bat`; `gh release create v2.0.0`.

**Total: about 15-18 sessions.** Phases 1-2 are the ones that cannot slip; if time runs short,
Phase 5's re-roles shrink to three villagers and Tock waits for 2.1.

---

## 12. Save compatibility

- `SAVE_VERSION` 3 → 4 in Phase 3 (the first phase that changes stored shapes). One migration:
  requests/contracts/projects → orders; research pruned ids → era rewards; `deepest` ÷ 2 in
  Phase 4 (same version, additive); new counters default to 0.
- Old saves never enter the new opening (they have `tutorial_done`); they see the Now strip
  with their current quest.
- `tests/roxy.test.ts`'s old-save load pattern becomes `tests/migrate.test.ts` with a 1.1.0 save
  fixture checked in (`tests/fixtures/save-1.1.0.json`).

---

## 13. Verification, every phase

```
npm run typecheck && npm test                         # + tests/lines.test.ts, migrate.test.ts
LONG=1 npx vitest run tests/longrun.test.ts           # a year, with the Deepworks and orders
npx vite-node scripts/pace.ts story rush              # 8 seeds; within 15% of 1.1 until Phase 3 re-tunes
npm run build && node e2e/smoke.mjs http://localhost:5173/
npm run screens                                       # + the new scenarios (Now strip, Line tab, Orders, Notebook, strata)
node e2e/coverage.mjs                                 # 100%
node e2e/seams.mjs                                    # 0 offenders (Phase 0 lists them, Phase 6 clears them)
BASE=http://localhost:5173/ node e2e/flow.mjs | shift.mjs | roxy.mjs | house.mjs | minex.mjs
```

The `indie-critic` runs at the end of Phases 1 (short), 2, 5 and 7 with the eight questions
from section 5 added to its brief. The `qa-screens` agent runs after every rendering change.

---

## 14. Prompts to start each phase

Phase 0:
> Read ROADMAP.md (1.2) and HANDOFF.md. Phase 0: fix the playtest bugs in section 10 marked
> Phase 0, write the owner's D1-D12 answers into DECISIONS.md, build e2e/seams.mjs and list the
> offenders, regenerate the pickaxe frames and the flagstone/plank sets with the art-director
> agent (≤ 60 generations). Run the checks. Bump to 1.1.1, build the desktop app, make the
> GitHub release, then create the `works` branch for everything after.

Phase 1:
> Read ROADMAP.md section 4. On branch `works`: the machine contract and the six states,
> time-in-state in stats, state glyphs (placeholder marks), arm hover squares and the winding
> verb, the blocked-belt visual and the line inspector, power feedback and the grid switch,
> the Line tab with src/data/advice.ts, the six crop intermediates. Write tests/lines.test.ts
> (L1-L4) first and make it pass. Update scripts/pace.ts. Run the checks and a short
> indie-critic review of the automation only.

Phase 2:
> Read ROADMAP.md sections 5 and 6. On `works`: replace both tutorial chains with the Keeper's
> Line (eight beats), the Now strip, the Keeper's Notebook, the lesson cards, undo, the
> Professor's visit, Rowan's first order on a minimal Orders board, the Skills cards. Make
> tests/bot.ts play B1-B8. Run the checks, then the indie-critic with the eight questions. Merge
> to main as the 2.0 beta when the owner says so.

Phase 3:
> Read ROADMAP.md sections 7.1, 7.3, 7.4, 7.5 and 8. On `works`: the Orders board, research
> stages and era columns, the pruned nodes as era rewards, crop numbers and rapeseed, the Mill
> keystone end to end, save version 4 with tests/migrate.test.ts. Run the checks and the pace bot.

Phase 4:
> Read ROADMAP.md section 7.2. On `works`: the Deepworks: six strata, the three chambers, pests
> and hazards, the flooded Frost stratum and the Waterworks keystone, the Tram and Lamplighting.
> Run the checks, e2e/minex.mjs and the longrun bot.

Phase 5:
> Read ROADMAP.md sections 7.6-7.9. On `works`: the six re-roles with twelve rewritten events,
> Trust, Pip's echoes, the Sprocket Fair and the Harvest Haul, Workshop HQ with indoor
> structures and the drafting table, the broker. Tock if there is time. Run the checks and the
> full indie-critic review.

Phase 6 (after Nov 9, one art-director per group in parallel):
> Read ROADMAP.md section 9 and STYLE.md. On `works`: the art direction pass, group N. Seam
> audit to 0. Delete the procedural generators when coverage stays 100%. qa-screens after each
> group.

Phase 7:
> Read ROADMAP.md section 11, Phase 7. /code-review high on main..works, the critic's full
> review, fix the Criticals, update the docs, version 2.0.0, merge, build, release.

---

## Appendix A — The removal test, applied

Remove the factory from 1.1 and you have: 37 crops in four seasons, animals, fishing, a monster
mine, 14 villagers with hearts and gifts, four festivals, a farmhouse with renovations and
romance, a travelling cart, bundles. A farming sim.

Remove the factory from 1.2 as planned and you have: crops with nowhere to go (their prices
say "feed me to something"), a Deepworks full of dead machines you cannot restore, an Orders
board you cannot fill, a dark square, a mill that doesn't turn, a research desk with nothing
to study, villagers who are specialists in things you cannot do. Not a game. That is the goal.

## Appendix B — Glossary

- **Line**: a chain from sources to a sink that runs without the player.
- **Keystone**: the research or project that defines an era and visibly changes the town.
- **Era**: Spring, Water, Steam, Clockwork, Starlight.
- **Starved / Blocked / Unpowered / Needs fuel / Idle / Working**: the only six machine states.
- **Consignment**: a crate tag that routes the post to a customer.
- **Trust**: the UI name for the hearts counter.
- **The Deepworks**: the mine. **The Works**: everything the player builds, and this version.
