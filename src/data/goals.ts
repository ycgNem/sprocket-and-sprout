// Quests (tutorial week + story), town restoration projects, megaprojects, festivals.
import type { FestivalDef, MegaprojectDef, ProjectDef, QuestDef } from './types';

export const QUESTS: QuestDef[] = [
  // ---------------- The Keeper's Line (ROADMAP.md 6): the first hour, on the keeper's works ----------------
  // One main objective at a time in the Now strip; every beat ends with a machine doing something.
  { id: 'k1_line', title: 'The Broken Line', giver: 'ottoline', tutorial: true, main: true, startDay: 0, needFlag: 'keepers_line',
    why: "The arm's seized. Until it's mended, you're the arm.",
    desc: "A note in brass-ink from Professor Cogwhistle: \"The old keeper's works are yours. Most of it has rusted, but the preserving crock still runs. Keep it fed and get its pickles to the crate: the post pays at noon.\"",
    hint: 'Press F at the ripe beans by the crock, then F at the crock and pick the beans (F again). F at the crock later takes its pickles; F at the crate puts them in.',
    objectives: [
      { t: 'harvest', n: 4, item: 'cogbean', label: "Pick the keeper's cogbeans", why: 'The crock is on its last three beans. Keep it fed.' },
      { t: 'load', struct: 'jar', n: 1, label: 'Feed the crock (F)', why: 'F at the crock takes its pickles and asks what to load: pick the beans.' },
      { t: 'crate', item: '#preserve', n: 2, label: 'Carry pickles to the crate', why: "The arm's seized. Until it's mended, you're the arm." },
    ],
    reward: { money: 50 } },
  { id: 'k2_springs', title: "The Professor's Springs", giver: 'ottoline', tutorial: true, main: true, after: ['k1_line'], needFlag: 'keepers_line',
    why: 'It only does one thing. That is the point.',
    desc: "Prof. Cogwhistle came over the moment she heard the keeper's arm had seized, with two mainsprings from her workshop.",
    hint: 'Press F at the Professor, then F at the rusted arm between the crock and the crate.',
    objectives: [
      { t: 'talk', npc: 'ottoline', label: 'Meet Prof. Cogwhistle by the crock', why: "She heard the keeper's arm had seized." },
      { t: 'restore', at: [54, 22], label: "Restore the keeper's arm (F)", why: 'A new mainspring and it swings again.' },
      { t: 'crate', item: '#preserve', n: 1, auto: true, label: 'Watch the arm carry a pickle', why: 'It takes from the square behind it and drops on the one in front.' },
    ],
    reward: { money: 50 } },
  { id: 'k3_hands', title: 'Hands Free', giver: 'ottoline', tutorial: true, main: true, after: ['k2_springs'], needFlag: 'keepers_line',
    why: "That's a line. It runs while you don't.",
    desc: "The keeper's cellar chest below the crock is full of beans. One more arm and the crock feeds itself.",
    hint: 'Select an arm and click the marked tile between the chest and the crock: it turns itself to face the crock.',
    objectives: [
      { t: 'build', struct: 'arm_basic', n: 2, label: 'Put an arm between the chest and the crock', why: "The keeper's cellar chest is full of beans." },
      { t: 'armload', struct: 'jar', n: 4, label: 'Let the arm feed the crock', why: 'It takes beans from the chest behind it and drops them in the crock in front.' },
      { t: 'crate', item: '#preserve', n: 4, auto: true, label: 'Let the line ship its pickles', why: 'Chest, arm, crock, arm, crate: nobody carrying anything.' },
    ],
    reward: { money: 100 } },
  { id: 'k4_grow', title: 'Room to Grow', giver: 'ottoline', tutorial: true, main: true, after: ['k3_hands'], needFlag: 'keepers_line',
    why: 'A line is only as good as what feeds it.',
    desc: "The cellar holds the keeper's last beans. The keeper's gleaner sits on a half-planted bed east of the crock: plant it, and bring the gleaner back.",
    hint: 'Hoe (1) on the marked tiles, then the cogbean seeds, then the watering can (2). Then F at the gleaner.',
    objectives: [
      { t: 'till', n: 4, label: "Till the gleaner's bed (hoe)", why: "The cellar is the keeper's last beans. This bed is tomorrow's." },
      { t: 'plant', n: 4, label: 'Plant the cogbean seeds', why: 'Cogbeans ripen in 4 watered days, then every 2.' },
      { t: 'water', n: 4, label: 'Water them (can)', why: 'Seeds only grow on days they are watered.' },
      { t: 'restore', struct: 'gleaner', label: "Restore the keeper's gleaner (F)", why: 'It picks what ripens in the 3x3 around it, from noon.' },
    ],
    reward: { money: 100 } },
  { id: 'k5_desk', title: 'The Study Desk', giver: 'ottoline', tutorial: true, main: true, after: ['k4_grow'], needFlag: 'keepers_line',
    why: "You don't research what you haven't touched.",
    desc: "The keeper's study desk still holds their notes. Conveyance, the belts, is the first thing worth learning: look at the old belt run, get it moving, then study it.",
    hint: 'F at the desk restores it. C opens crafting (a sprout bundle is 3 crops). F at the desk loads the bundles, T picks the topic.',
    objectives: [
      { t: 'restore', struct: 'lab', label: "Restore the keeper's study desk (F)", why: "The keeper's notes are still in it." },
      { t: 'craft', item: 'bundle_green', n: 1, fresh: true, label: 'Craft a sprout bundle (C)', why: '3 cogbeans make one: the cellar chest has some.' },
      { t: 'flag', flag: 'study:r_belts', label: 'Feed the desk (F) and pick Conveyance (T)', why: 'A keystone has three stages: look, try, study.' },
      { t: 'flag', flag: 'observed:belt_1', label: "Look over the keeper's belt run (hover it)", why: 'Conveyance, stage 1 of 3: look.' },
      { t: 'restore', struct: 'belt_1', label: 'Restore the four belts (F)', why: 'Stage 2 of 3: try.' },
      { t: 'restore', at: [59, 23], label: "Restore the gleaner's arm (F)", why: 'The second mainspring fits it.' },
      { t: 'flag', flag: 'belt_into:jar', label: 'Watch a bean ride the belt into the crock', why: 'A belt drops its goods into whatever it runs into. The desk does stage 3, study, by itself.' },
    ],
    reward: { money: 150, items: [{ item: 'belt_1', n: 12 }, { item: 'arm_basic', n: 2 }] } },
  { id: 'k6_bottleneck', title: 'The Bottleneck', giver: 'ottoline', tutorial: true, main: true, after: ['k5_desk'], needFlag: 'keepers_line',
    why: 'A stopped machine is a question. The glyph is the answer.',
    desc: "Two crocks make twice the pickles, if they both get beans. Buy a second crock at the Mercantile (over the bridge, east, past the keeper's old water wheel) and set it beside the cellar chest.",
    hint: 'Marigold sells crocks at the Mercantile from 9am. Hover a stopped machine, or hold I over it, to see why it stopped.',
    objectives: [
      { t: 'build', struct: 'jar', n: 2, label: 'Buy a second crock (Mercantile) and place it', why: "The day's posts paid for it. The Mercantile is east, over the bridge.", goto: 'marigold' },
      { t: 'feeds', struct: 'jar', other: true, label: 'Your chest below it, an arm between them', why: 'Face the arm with R: it takes from behind and drops in front.' },
      { t: 'flag', flag: 'read:starved', label: 'Find out why it stopped (hover it, or hold I)', why: 'An amber mark means it waits for its input.' },
      { t: 'made', struct: 'jar', n: 3, other: true, label: 'Get the second crock making pickles', why: "Beans in its chest, a third arm from the cellar chest, the gleaner's belt: any fix works." },
      { t: 'flag', flag: 'belt_into:shipping_crate', label: 'Run its pickles to the crate on belts', why: 'An arm onto a belt, the belt into the crate.' },
    ],
    reward: { money: 300 } },
  { id: 'k7_town', title: 'The Town Wants', giver: 'rowan', tutorial: true, main: true, after: ['k6_bottleneck'], needFlag: 'keepers_line',
    why: 'The town is your real customer. The crate is just the door.',
    desc: "Rowan at the Copper Kettle has posted a standing order on the Orders board: pickled cogbeans every week, and double for silver ones. Hand them over at the inn, or tag your crate for the Copper Kettle and the post takes them there.",
    hint: 'The Orders board stands on the town square (J opens it too). F at the crate: "Ship to" picks who its goods go to.',
    objectives: [
      { t: 'flag', flag: 'board:read', label: 'Read the Orders board (on the square, or J)', why: 'Who in town wants what you make.', goto: 'board' },
      { t: 'order', id: 'rowan_pickles', label: "Fill Rowan's order: pickled cogbeans", why: 'Bring them to the inn, or tag the crate for the Copper Kettle (F at the crate): the post delivers.' },
    ],
    reward: { money: 200, flag: 'recipe_cogbean_oil', friendship: ['rowan', 150] } },
  { id: 'k8_river', title: 'The River Works', giver: 'bram', tutorial: true, main: true, after: ['k7_town'], needFlag: 'keepers_line',
    why: 'The valley runs on what you build next.',
    desc: "The keeper's old water wheel stands rusted on the river by the farm gate, with its poles and a grist mill, and the grain bin still holds last autumn's barley. Bram will forge the bars to mend it, for six bottles of cogbean oil.",
    hint: 'Shift+F at a crock opens it: click the cogbean oil recipe to lock it in. Tag the crate for the Smithy, or hand the oil to Bram.',
    objectives: [
      { t: 'order', id: 'bram_oil', label: "Fill Bram's order: cogbean oil", why: 'A crock makes oil from the same beans: Shift+F at a crock opens it, click oil to lock it in.' },
      { t: 'restore', at: [90, 48], label: "Restore the keeper's water wheel (F)", why: "Bram's bars mend its axle. It's on the river by the farm gate.", goto: 'river_works' },
      { t: 'restore', rect: [83, 47, 8, 6], label: 'Restore its poles, the mill and the grain bin (F)', why: "Poles carry the wheel's sparks to the machines around them." },
      { t: 'feeds', struct: 'mill', label: "Bram's Brass Arms: bin to mill, mill to chest", why: 'Brass Arms are three times faster than spring arms, and draw sparks while they swing.' },
      { t: 'made', struct: 'mill', n: 5, label: 'Grind barley meal on the wheel', why: 'The old wheel makes 35 sparks, rain or shine. Watch what the mill and its arms want.' },
    ],
    reward: { money: 500, items: [{ item: 'bundle_copper', n: 5 }] } },
  { id: 'k9_bed', title: 'A Second Bed', giver: 'ottoline', tutorial: true, main: true, after: ['k8_river'], needFlag: 'keepers_line',
    why: 'Each crock wants about 17 beans a day: two beds of 8, with the keeper\'s, feed one crock.',
    desc: "The keeper's cellar is nearly empty: it sends its last beans in the second week. The Professor's advice: two more gleaners, each in a bed of cogbeans, so the field feeds the works, not your hands. Marigold sells cogbean seeds at the Mercantile.",
    hint: 'Gleaning is studied at the desk (8 sprout bundles). A gleaner is crafted (C): 3 planks, 2 copper gears (the Workshop sells them) and a rope. It picks the 3x3 around it.',
    objectives: [
      { t: 'research', id: 'r_gleaning', label: 'Study Gleaning at the desk (T)', why: '8 sprout bundles. A gleaner picks the ripe crops around it.' },
      { t: 'build', struct: 'gleaner', n: 3, label: 'Build two more gleaners (C)', why: '3 planks, 2 copper gears (the Workshop sells them) and a rope each.' },
      { t: 'gleaned', crop: 'cogbean', n: 16, label: 'Plant 16 cogbeans in reach of the new gleaners', why: 'A gleaner picks the 8 tiles around it. A bean plant gives about 3 every 4 days: two beds of 8 and the keeper\'s feed one crock.' },
    ],
    reward: { money: 400, items: [{ item: 'arm_basic', n: 2 }] } },
  { id: 'k9_power', title: 'More Power', giver: 'bram', tutorial: true, main: true, after: ['k9_bed'], needFlag: 'keepers_line',
    why: 'A grid in a brownout slows everything on it.',
    desc: "The keeper's worn wheel can't keep up with the mill and its arms, and Rowan wants barley meal every week. A second wheel would: that's Water Power, studied at the desk after Metalwork, with copper bundles (a copper gear and 2 planks each: the Workshop sells gears, or smelt the mine's copper ore). Then the town's own mill is next.",
    hint: "Copper bundles are crafted (C). A new water wheel goes on the river with its land side on your farm, near the keeper's poles.",
    objectives: [
      { t: 'research', id: 'r_metallurgy', label: 'Study Metalwork at the desk', why: 'Water Power builds on it: 5 sprout bundles.' },
      { t: 'research', id: 'r_power', label: 'Study Water Power at the desk', why: 'Copper bundles: a copper gear and 2 planks each. The Workshop sells copper gears.' },
      { t: 'build', struct: 'waterwheel', n: 2, label: 'Build a second water wheel on the river', why: "A new wheel makes 60 sparks. Wire it into the keeper's poles." },
      { t: 'plant', n: 10, crop: 'barley', label: 'Sow 10 barley for the mill', why: "The granary sent its last sack on day 7. Ten barley a week covers Rowan's ten sacks of meal." },
      { t: 'made', struct: 'mill', n: 5, full: true, label: 'Grind 5 meal at full power', why: 'A grid in a brownout slows the mill: more supply, or less demand (spring arms draw no sparks).' },
    ],
    reward: { money: 800 } },
  // the Water era's town keystone (ROADMAP.md 7.3, Phase 3): the town's own mill, end to end. Its
  // stages count from when the quest starts (the mill you walked past on day 2 isn't the look)
  { id: 'k10_mill', title: 'The Town Mill', giver: 'juniper', tutorial: true, main: true, after: ['k9_power'], needFlag: 'keepers_line', keystone: 'r_milling',
    why: "A keystone is the town's: look at it, try it small, keep it running, study it, then build it.",
    desc: "The town's old mill stands silent on the river at the west end of Main Street. Juniper, the millwright, has waited thirty years to mend its wheel: the Kettle has had no flour of its own in all that time. Milling is the keystone: your mill is the town's in miniature. The Town Mill's order is already up on the Works tab (40 meal, 40 planks, 8 copper gears), so start a store of meal now.",
    hint: 'Milling is studied with copper bundles. A mill on full power grinds 15 a minute: two dozen barley tipped into its bin at once keep it at 3 a minute for 2 minutes. The Works tab is on the Orders board (the square, or the clocktower door). A seed sower (Seed Sowers) plants a 7x7 field of barley for you, and gleaners or a crane pick it.',
    objectives: [
      { t: 'stage', id: 'r_milling', stage: 'observe', label: "Look at the town's silent mill", why: 'The town has had no flour of its own in thirty years. On the river at the west end of Main Street (stage 1 of 4: look).', goto: 'town_mill' },
      { t: 'stage', id: 'r_milling', stage: 'experiment', label: 'Grind 20 meal or flour on your grid', why: "Your mill is the town's in miniature: prove it on your own grid, and keep the meal, the Town Mill wants 40 (stage 2: try)." },
      { t: 'stage', id: 'r_milling', stage: 'validate', label: 'Keep a mill making 3 a minute for 2 minutes', why: 'A town mill runs all day, not in fits: tip two dozen barley into the bin at once. Under 3 a minute and the clock starts again (stage 3: keep it running).' },
      { t: 'research', id: 'r_milling', label: 'Study Milling at the desk', why: "What you learned goes on paper, and then the town's mill can be mended: 20 sprout and 20 copper bundles (stage 4: study)." },
      { t: 'order', id: 'w_town_mill', label: 'Fill the Town Mill on the Works tab', why: 'New paddles, a mended gear train and its first sacks: 40 meal, 40 planks and 8 copper gears, at the board or by a crate tagged for the Town Council.' },
    ],
    reward: { money: 1500, items: [{ item: 'bundle_copper', n: 10 }] } },
  // ---------------- The Steam era (ROADMAP.md 7.5, 8): the Waterworks, then Lamplighting ----------------
  // Each era ends by handing the player the next town keystone (DECISIONS #72: one path for everyone).
  { id: 'k11_boiler', title: 'Down to the Boiler', giver: 'thorne', tutorial: true, main: true, after: ['k10_mill'], needFlag: 'keepers_line', keystone: 'r_steam',
    why: 'Pumps want steam, and the old works left a boiler down below.',
    desc: "The Mayor's next wish is the Waterworks: the pump house by the square, its pumps seized since the old works closed. Its order is already up on the Works tab, so its brass, coils, oil, plates and paste can go in as you make them. Pumps want steam. Old Thorne, the old works' last engineer, says they left a boiler on level 10 of the Deepworks, the one he fed, past a gallery that caved in on level 6. Steam Power is the keystone, and the boiler is its look.",
    hint: "Sawmilling builds a sawmill: hardwood in, two beams out (the Joinery sells hardwood). 20 beams shore up the gallery on level 6: F at the collapse. Mend the old lift on level 5 and it rides to every works chamber you've reached.",
    objectives: [
      { t: 'visit', loc: 'pump_house', label: 'Look at the shuttered pump house by the square', why: "The town's next keystone, the Waterworks: its order is on the Works tab, and its pumps want steam.", goto: 'pump_house' },
      { t: 'research', id: 'r_sawmill', label: 'Study Sawmilling at the desk', why: 'The way to the boiler is caved in, and only beams will hold it: a sawmill cuts two from each hardwood.' },
      { t: 'made', struct: 'sawmill', n: 10, label: 'Saw 10 loads in a sawmill', why: '20 beams shore up the gallery on level 6. The Joinery sells hardwood, or fell the big trees.' },
      { t: 'flag', flag: 'gallery_shored', label: 'Shore up the caved-in gallery on level 6', why: 'The way down to the boiler: 20 beams, F at the collapse. It stays open for good.', goto: 'mine_entrance' },
      { t: 'stage', id: 'r_steam', stage: 'observe', label: 'Look at the seized boiler on level 10', why: "The old works ran on steam: see how its boiler did it. Walk up to it in the works chamber (seen it already? Sable at the library lends its record).", goto: 'mine_entrance' },
    ],
    reward: { money: 1500, items: [{ item: 'charcoal_kiln', n: 1 }] } },
  { id: 'k12_steam', title: 'Steam Power', giver: 'bram', tutorial: true, main: true, after: ['k11_boiler'], needFlag: 'keepers_line',
    why: "Steam doesn't care whether the river runs. It burns what you feed it.",
    desc: 'The boiler showed how it is done: coal heats water, steam pushes a piston, the piston turns a wheel. Study Steam Power and the Waterworks can be built. Its bundles are Harvest Bundles: a jar of preserves, a length of canvas and a copper coil each, so the crocks, a loom and the smelter all work for it.',
    hint: 'Harvest Bundles are crafted (C). The hand loom makes canvas from 2 flax or 8 fiber; copper coils are wound from copper bars, 2 a bar. Steam Power also needs Brass Working.',
    objectives: [
      { t: 'stage', id: 'r_steam', stage: 'experiment', label: 'Make 5 coal in a charcoal kiln', why: 'An engine burns coal, so make your own: a kiln turns wood into coal.' },
      { t: 'research', id: 'r_weaving', label: 'Study Weaving at the desk', why: 'Steam Power is studied with Harvest Bundles, and each wants a length of canvas from a loom.' },
      { t: 'made', struct: 'hand_loom', n: 10, label: 'Weave 10 loads on a hand loom', why: '25 bundles want 25 canvas: 2 flax or 8 fiber make one. An arm can keep the loom fed from a chest.' },
      { t: 'research', id: 'r_brass', label: 'Study Brass Working at the desk', why: "A boiler wants brass that won't crack, so Steam Power builds on it: copper and tin make brass." },
      { t: 'research', id: 'r_steam', label: 'Study Steam Power at the desk', why: "Steam drives the Waterworks' pumps, and engines that run in any weather: 25 sprout, 25 copper and 25 Harvest Bundles." },
    ],
    reward: { money: 2000, items: [{ item: 'steam_engine', n: 1 }] } },
  { id: 'k13_waterworks', title: 'The Waterworks', giver: 'tobias', tutorial: true, main: true, after: ['k12_steam'], needFlag: 'keepers_line',
    why: "The square's fountain has been dry for thirty years.",
    desc: 'With steam the pump house can run again. The Waterworks order has been on the Works tab since the boiler: brass for the pumps, coils for their motors, oil for the bearings, plates for the tank and starch paste to seal the joints. When it runs, the fountain plays and the flooded galleries under the Clayworks drain.',
    hint: 'Any oil will do: cogbean oil from a crock, or sunflower and rapeseed oil from a mill in summer. Starch paste comes from the crock (Dyes & Pastes): potatoes, yams or corn. A furnace alloys copper and tin bars into brass.',
    objectives: [
      { t: 'research', id: 'r_pastes', label: 'Study Dyes & Pastes at the desk', why: "Starch paste from the crock seals the pipes' joints." },
      { t: 'order', id: 'w_waterworks', label: 'Fill the Waterworks on the Works tab', why: 'The fountain plays and the flooded galleries drain: 20 brass bars, 10 copper coils, 50 oil (cogbean counts), 4 iron plates and 20 starch paste.' },
    ],
    reward: { money: 3000 } },
  { id: 'k14_spark', title: 'Spark Coils', giver: 'ottoline', tutorial: true, main: true, after: ['k13_waterworks'], needFlag: 'keepers_line', keystone: 'r_spark',
    why: 'A light that never needs oil, and the heart of every machine after it.',
    desc: "The square wants lamps that light themselves, and the Professor wants spark coils for everything. The old works made both: their lamp works stands on level 20 of the Deepworks, down in the Ember where the firedamp vents. Spark Coils is the keystone, and the Lamplighting order (12 lamps, 6 coils) is up on the Works tab.",
    hint: 'Glassblowing needs Masonry; Assembly needs Brass Working. A kiln melts 2 sand into a glass (the Joinery sells sand once you know glass). The firedamp vents in turns: cross while it is quiet.',
    objectives: [
      { t: 'research', id: 'r_glass', label: 'Study Glassblowing at the desk', why: 'A spark lives in glass, so the coils need it. Masonry first.' },
      { t: 'research', id: 'r_assembly', label: 'Study Assembly at the desk', why: "Spark coils are too fine for hands: a tinker's bench makes parts by itself. Spark Coils builds on it." },
      { t: 'stage', id: 'r_spark', stage: 'observe', label: 'Study the old lamp works on level 20', why: "The old works made lamps that lit themselves: see how. The lift rides to every works chamber you've reached (seen it already? Sable lends its record).", goto: 'mine_entrance' },
      { t: 'stage', id: 'r_spark', stage: 'experiment', label: 'Wind 6 copper coils (C)', why: 'Every spark coil starts as a copper coil: a copper bar winds 2.' },
      { t: 'stage', id: 'r_spark', stage: 'validate', label: 'Keep a kiln making a glass a minute for 2 minutes', why: 'Coils by the dozen want glass by the hour: an arm feeding sand from a chest keeps a kiln going.' },
      { t: 'research', id: 'r_spark', label: 'Study Spark Coils at the desk', why: 'Lamps for the square, and the heart of every machine after them: 25 sprout, 25 copper and 25 Harvest Bundles.' },
    ],
    reward: { money: 3000, items: [{ item: 'spark_coil', n: 2 }] } },
  { id: 'k15_lamps', title: 'Lamplighting', giver: 'sable', tutorial: true, main: true, after: ['k14_spark'], needFlag: 'keepers_line',
    why: 'The square lit at night, on your power.',
    desc: "Twelve lamps for the square and the coils to wire them: the Lamplighting order has been up on the Works tab since Spark Coils. Once they're hung they light after dark on your own grid, through the keeper's old pole at the farm gate, and they draw 12 sparks all night.",
    hint: 'Lamps are crafted from wood and coal (C), or bought at the Joinery. After 6pm your grid needs 12 sparks to spare for the square.',
    objectives: [
      { t: 'order', id: 'w_lamps', label: 'Fill Lamplighting on the Works tab', why: 'Light for the square after dark: 12 lamps and 6 copper coils.' },
      { t: 'flag', flag: 'lamplighting', label: 'Light the square after dark, on your power', why: "They burn on your power, through the keeper's pole: 12 sparks to spare after 6pm." },
    ],
    reward: { money: 2500 } },
  // ---------------- The Clockwork era: the Tram; then the Clock ----------------
  { id: 'k16_tram', title: 'The Tram', giver: 'thorne', tutorial: true, main: true, after: ['k15_lamps'], needFlag: 'keepers_line', keystone: 'r_assembly2',
    why: 'A cart on rails, quarry to town, every morning.',
    desc: "Old Thorne ran the old works' rail cart, ore up to town every morning at six. It still stands in the Crystal galleries on level 25, beside the engineers' lockers, where he left it. Mend the cart, study Clockwork Assembly from their blueprints, and the Tram can run again.",
    hint: 'The Crystal galleries are dark: carry lamps and set them down. The rail cart takes 20 planks, 10 iron bars and 4 brass gears. An assembler finishes jobs by itself once it is fed.',
    objectives: [
      { t: 'stage', id: 'r_assembly2', stage: 'observe', label: "Open the old works' lockers on level 25", why: "The engineers who built the Tram left their blueprints: read them (been down already? Sable has the copies they filed).", goto: 'mine_entrance' },
      { t: 'flag', flag: 'chamber:cart', label: 'Restore the rail cart on level 25', why: "The Tram's cart is down there: 20 planks, 10 iron bars and 4 brass gears, F at the cart.", goto: 'mine_entrance' },
      { t: 'stage', id: 'r_assembly2', stage: 'experiment', label: 'Have an assembler finish 10 jobs', why: 'Clockwork parts come from assemblers: see one through 10 jobs.' },
      { t: 'stage', id: 'r_assembly2', stage: 'validate', label: 'Keep a line making 2 brass gears a minute for 3 minutes', why: 'The Tram wants 40 brass gears: a line that makes 2 a minute and keeps it up.' },
      { t: 'research', id: 'r_assembly2', label: 'Study Clockwork Assembly at the desk', why: 'The blueprints become know-how: 40 each of sprout, copper, Harvest and brass bundles.' },
      { t: 'order', id: 'w_tram', label: 'Fill the Tram on the Works tab', why: 'Sleepers, bogies and livery for the quarry road: 300 planks, 40 brass gears and 20 pigment.' },
    ],
    reward: { money: 5000 } },
  { id: 'k17_clock', title: 'The Clock', giver: 'tobias', tutorial: true, main: true, after: ['k16_tram'], needFlag: 'keepers_line',
    why: 'Thirty years of silence on the square.',
    desc: "Every works in town runs on yours now. The last is the clocktower itself: brass gears, spark coils and a clockwork core for its heart, and the Council's 10,000 coins toward the bell.",
    hint: 'An assembler makes clockwork cores from brass gears, springs and spark coils.',
    objectives: [
      { t: 'order', id: 'p_clock', label: 'Restart the Clock on the Works tab', why: 'The square has been silent thirty years: 40 brass gears, 10 spark coils, a clockwork core and 10,000 coins.' },
    ],
    reward: { money: 5000 } },
  // ---------------- Story ----------------
  // the pets come early, as a small quest's reward, not with you on the first morning (the owner: "make it
  // so you get it within the first 10 minutes or something, a small quest reward; spawning with it seems
  // weird"): the hamster in its cage and a tank of goldfish, on the farmhouse step once the Professor has
  // been by (the cat or dog still finds you as a stray on day 3)
  { id: 's_housewarming', title: 'Housewarming', giver: 'ottoline', after: ['k2_springs'],
    desc: "Prof. Cogwhistle has had two housewarming gifts carried up to your farmhouse: one of her workshop hamster's litter (\"she keeps winding herself up in my spring drawer\") and a tank of three very calm goldfish from Wren.",
    hint: 'Walk in at your farmhouse door. Hold the cage or the tank and click the floor to set it down.',
    objectives: [{ t: 'visit', loc: 'farmhouse_in', label: 'Go into your farmhouse', why: 'Your housewarming gifts are waiting inside.' }],
    reward: { items: [{ item: 'f_hamster_cage', n: 1 }, { item: 'f_tank', n: 1 }, { item: 'radish_seed', n: 5 }], flag: 'housewarming' },
    done: 'Hold the cage (or the tank) and click the floor to set it down: the hamster wants a name. It eats a seed a day.' },
  { id: 's_clock', title: 'The Silent Clock', giver: 'tobias', after: ['k9_bed'],
    desc: "The town clocktower stopped decades ago. Mayor Thistle hopes the town's works can start it again, one at a time. Visit the clocktower: its door has the Orders board's Works tab.",
    objectives: [{ t: 'visit', loc: 'clocktower' }],
    reward: { money: 100, flag: 'board_seen' } },
  { id: 's_animals', title: 'Feathered Friends', giver: 'clem', after: ['k9_bed'],
    desc: 'Clem shyly suggests that a farm is not a farm without animals. Buy a coop from Juniper and a chicken from Meadowlark Ranch.',
    objectives: [{ t: 'build', struct: 'coop_1', n: 1 }, { t: 'have', item: 'egg', n: 1 }],
    reward: { money: 500, items: [{ item: 'hay', n: 30 }] } },
  { id: 's_fish', title: 'Gone Fishing', giver: 'wren', after: ['k9_bed'],
    desc: 'Wren hands you an old rod: "Catch three fish. Any three. Show me you have patience."',
    objectives: [{ t: 'catch', n: 3 }],
    reward: { money: 300, items: [{ item: 'bait', n: 30 }] } },
  { id: 's_deep', title: 'Deeper Down', giver: 'bram', after: ['k9_bed'],
    desc: 'Bram wants tin from the Clayworks. "Level 10 or so. Mind the cracked ceilings on the way down, and the caved-in gallery on level 6: it wants beams."',
    objectives: [{ t: 'floor', n: 10 }, { t: 'have', item: 'tin_ore', n: 15 }],
    reward: { money: 800, items: [{ item: 'sword_1', n: 1 }] } },
  { id: 's_quarry', title: 'Veins of the Valley', giver: 'ottoline', after: ['k9_bed'],
    desc: '"The quarry east of town is full of ore veins. Research Ore Drilling and set up a drill feeding a furnace."',
    objectives: [{ t: 'research', id: 'r_drills' }, { t: 'build', struct: 'drill_steam', n: 1 }],
    reward: { money: 1500 } },
  { id: 's_bottom', title: 'The Bottom of the Deepworks', giver: 'bram', after: ['s_deep'],
    desc: 'Legends say a fallen star rests at the bottom of the Deepworks, level 30.',
    objectives: [{ t: 'floor', n: 30 }],
    reward: { money: 5000, items: [{ item: 'starstone', n: 1 }] } },
  { id: 's_bees', title: 'Bumblebots!', giver: 'ottoline', after: ['s_quarry'],
    desc: '"My life\'s work: clockwork bees that fly your goods around. Research Bumblebots and build a hive."',
    objectives: [{ t: 'research', id: 'r_bots' }, { t: 'build', struct: 'hive', n: 1 }],
    reward: { money: 5000, items: [{ item: 'bumblebot', n: 4 }] } },
  { id: 's_grand', title: 'Grand Works', giver: 'tobias', after: ['s_clock'],
    desc: 'With the clocktower ticking again, the mayor dreams bigger. Research Grand Works and begin a megaproject.',
    objectives: [{ t: 'research', id: 'r_grandworks' }, { t: 'build', struct: 'construction_site', n: 1 }],
    reward: { money: 10000 } },
  { id: 's_friends', title: 'Part of the Town', giver: 'marigold', after: ['k9_bed'],
    desc: 'Reach Trust 4 with three different villagers.',
    objectives: [{ t: 'friend', npc: '*', hearts: 4 }],
    reward: { money: 1000, items: [{ item: 'cake', n: 2 }] } },
  { id: 's_rich', title: 'A Prosperous Farm', giver: 'tobias', after: ['k9_power'],
    desc: 'Earn 25,000 coins in total.',
    objectives: [{ t: 'money', n: 25000 }],
    reward: { items: [{ item: 'gold_bar', n: 5 }] } },
];

export const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

/** Daily town requests are generated from these templates. */
// `after`: an ask for goods only a later know-how makes waits for it, and until then the villager asks
// for `before` instead (a swap, not a filter: the day's draw from the pool stays the same)
export const REQUEST_POOL: { npc: string; item: string; n: number; seasons?: number[]; text: string; after?: string; before?: { item: string; n: number; text: string } }[] = [
  { npc: 'rowan', item: 'egg', n: 6, text: 'The breakfast rush is brutal. Six eggs, please!' },
  { npc: 'rowan', item: 'tomato', n: 5, seasons: [1], text: 'Tomato soup special today. I need tomatoes!' },
  { npc: 'rowan', item: 'flour', n: 10, text: 'Bread day! Ten sacks of flour would save me.' },
  { npc: 'rowan', item: 'pumpkin', n: 2, seasons: [2], text: 'Pie. Must. Make. Pie.' },
  { npc: 'marigold', item: 'wool', n: 2, text: 'Knitting emergency. Two bundles of wool?' },
  { npc: 'marigold', item: 'radish', n: 8, seasons: [0], text: 'Radishes are flying off my shelves.' },
  { npc: 'marigold', item: 'cloth', n: 3, text: 'A big quilt order came in. Cloth, please!' },
  { npc: 'bram', item: 'coal', n: 20, text: 'The forge is hungry. Twenty coal.' },
  { npc: 'bram', item: 'copper_bar', n: 10, text: 'Ten copper bars for a big commission.' },
  { npc: 'bram', item: 'iron_bar', n: 5, text: 'Five iron bars. No questions.' },
  { npc: 'juniper', item: 'hardwood', n: 10, text: 'Hardwood for a cabinet. Ten pieces?' },
  { npc: 'juniper', item: 'plank', n: 40, text: 'Forty planks for the new bridge railing.' },
  { npc: 'ottoline', item: 'copper_gear', n: 20, text: 'Gears! I can never have enough gears.' },
  { npc: 'ottoline', item: 'glass', n: 10, text: 'I broke all my beakers. Again. Glass?' },
  { npc: 'ottoline', item: 'spark_coil', n: 3, text: 'Three spark coils for an experiment I will not describe.' },
  { npc: 'ines', item: 'tea', n: 3, text: 'Calming tea for the waiting room.' },
  { npc: 'ines', item: 'honey', n: 2, text: 'Honey soothes a sore throat. Two jars?' },
  { npc: 'wren', item: 'bait', n: 50, text: 'Out of bait. Fifty, if you can spare.' },
  { npc: 'wren', item: 'sardine', n: 5, text: 'Five sardines. Don\'t ask.' },
  { npc: 'clem', item: 'hay', n: 30, text: 'Running low on hay at the ranch.' },
  { npc: 'clem', item: 'wheat', n: 15, seasons: [1, 2], text: 'Wheat for the horses. Fifteen?' },
  { npc: 'pip', item: 'amethyst', n: 1, text: 'I need a purple rock for my collection! A REAL one!' },
  { npc: 'pip', item: 'strawberry', n: 3, seasons: [0], text: 'Strawberries! For science! (eating)' },
  // the draughtswoman's inks and mounts (ROADMAP.md 7.6): paste and pigment from a crock (Dyes & Pastes).
  // As many asks a season as her old two, in their places, so the day's dice pick the same villagers
  { npc: 'hazel', item: 'starch_paste', n: 2, seasons: [1, 2], text: 'Two pots of starch paste. My drawings keep curling off the board.',
    after: 'r_pastes', before: { item: 'sunflower', n: 3, text: "I'm drawing sunflowers for the Mercantile's sign. I need models: three, please." } },
  { npc: 'hazel', item: 'pigment', n: 3, text: "I'm out of blue halfway through a blueprint. Three pots of pigment?",
    after: 'r_pastes', before: { item: 'clay', n: 5, text: 'Five lumps of clay? I model a machine before I draw it.' } },
  { npc: 'sable', item: 'quartz', n: 3, text: 'Quartz for the school science lesson.' },
  { npc: 'sable', item: 'pale_ale', n: 1, text: 'Book club tonight. One hop ale, quietly.' },
  { npc: 'tobias', item: 'wine_grape', n: 1, text: 'A bottle of grape wine for a visiting dignitary.' },
  { npc: 'tobias', item: 'cake', n: 1, text: 'The council meeting needs cake. Morale!' },
  { npc: 'thorne', item: 'chanterelle', n: 2, seasons: [2], text: 'The forest owes me chanterelles. Bring two.' },
  { npc: 'thorne', item: 'maple_syrup', n: 2, text: 'Syrup, from a tree you tapped yourself.' },
  { npc: 'rowan', item: 'cheese', n: 3, text: 'Cheese plates are trending. Three wheels?' },
  { npc: 'marigold', item: 'jam_strawberry', n: 2, text: 'Customers keep asking for strawberry jam.' },
  { npc: 'bram', item: 'gold_bar', n: 2, text: 'Gold. Two bars. For a wedding ring commission.' },
  { npc: 'roxy', item: 'coffee_drink', n: 2, text: 'Night run to the city. Two coffees, strong as you make them.' },
  { npc: 'roxy', item: 'copper_coil', n: 4, text: "The starboard engine's sulking. Four copper coils, sugar?" },
  { npc: 'roxy', item: 'jam_emberpepper', n: 2, text: 'City folk pay double for anything that burns. Two jars of ember jam.' },
  { npc: 'roxy', item: 'wine_cherry', n: 1, seasons: [1, 2], text: 'A client with expensive taste wants something red. Cherry wine?' },
];

// The town works besides the keystones (the Orders board's Works tab, ROADMAP.md 7.4). The 1.x
// restoration board's crop, fish, forage and gem baskets were Stardew's Community Center and went
// in 2.0 (DECISIONS #93); what's left asks for what lines make, and each waits for its era. Each is
// listed under the place it serves (not a Community Center room), and finishing every work at one
// place is not a "room" of its own. The Kettle's Cellar, Dairy Day and the Bakery Window were the
// last baskets (the critic's Phases 3+4 re-check): they're steady supply now, a day's share on each
// of three days, which a line feeding a crate tagged for the Council does on its own.
export const PROJECTS: ProjectDef[] = [
  { id: 'p_greenhouse', name: 'Repair the Greenhouse', area: 'Your farm', desc: 'Glass, beams and brass to fix the old greenhouse on your farm.', items: [{ item: 'glass', n: 40 }, { item: 'beam', n: 20 }, { item: 'brass_bar', n: 10 }], money: 5000, after: ['flag:waterworks'],
    reward: { flag: 'greenhouse_fixed', text: 'Your greenhouse is restored: crops grow in any season!' } },
  { id: 'p_gears', name: 'Clockwork Restock', area: 'The clocktower', desc: 'Parts for the clocktower mechanism.', items: [{ item: 'copper_gear', n: 30 }, { item: 'spring', n: 10 }, { item: 'iron_plate', n: 10 }], after: ['flag:town_mill'],
    reward: { items: [{ item: 'arm_fast', n: 4 }], text: 'Four brass arms' } },
  { id: 'p_metals', name: 'The Smelter\'s Pride', area: 'The smithy', desc: 'Bars of every metal in the valley.', items: [{ item: 'copper_bar', n: 20 }, { item: 'tin_bar', n: 10 }, { item: 'iron_bar', n: 20 }, { item: 'gold_bar', n: 5 }], after: ['flag:waterworks'],
    reward: { items: [{ item: 'blast_furnace', n: 1 }], text: 'A blast furnace' } },
  // the Clock is the Starlight era's town keystone: it waits for the Tram
  { id: 'p_clock', name: 'Restart the Clock', area: 'The clocktower', desc: 'The great mechanism needs brass, coils and a heart.', items: [{ item: 'brass_gear', n: 40 }, { item: 'spark_coil', n: 10 }, { item: 'clockwork_core', n: 1 }], money: 10000, after: ['flag:tram'],
    reward: { flag: 'clock_fixed', text: 'The clocktower ticks again! The whole town celebrates.' } },
  { id: 'p_preserves', name: "The Kettle's Cellar", area: 'The Copper Kettle', desc: "Rowan stocks the cellar for winter: a day's worth from your crocks and kegs, three days running.", items: [{ item: '#preserve', n: 8 }, { item: '#wine', n: 2 }], after: ['flag:town_mill'], steady: 3,
    reward: { items: [{ item: 'keg', n: 4 }], text: 'Four kegs' } },
  { id: 'p_dairy', name: 'Dairy Day', area: 'The Copper Kettle', desc: "The inn's dairy, supplied a day at a time: cheese, butter and eggs on three days.", items: [{ item: 'cheese', n: 3 }, { item: 'butter', n: 3 }, { item: '#egg', n: 4 }], after: ['r_dairy'], steady: 3,
    reward: { items: [{ item: 'kitchen', n: 1 }], text: 'A steam kitchen' } },
  // the Bakery Window opens once the town has flour of its own (the Town Mill) and you have an oven
  { id: 'p_bakery', name: 'Bakery Window', area: 'The Mercantile', desc: "The Mercantile's window, kept full: a day's baking from the Town Mill's flour, three days.", items: [{ item: 'bread', n: 4 }, { item: 'cookies', n: 4 }], after: ['flag:bread_town', 'r_cooking'], steady: 3,
    reward: { items: [{ item: 'assembler', n: 1 }], text: "A tinker's bench (assembler)" } },
  { id: 'p_quarry', name: 'Quarry Road', area: 'The quarry', desc: 'Stone and gravel to pave the quarry road.', items: [{ item: 'stone', n: 200 }, { item: 'gravel', n: 50 }, { item: 'concrete', n: 20 }], after: ['r_crusher'],
    reward: { items: [{ item: 'drill_brass', n: 2 }], text: 'Two brass drills' } },
];

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

export const MEGAPROJECTS: MegaprojectDef[] = [
  { id: 'm_orrery', name: 'The Great Orrery', desc: 'A brass model of the heavens, taller than the clocktower. Its gears turn with the seasons.',
    stages: [
      { name: 'Foundation', items: [{ item: 'concrete', n: 300 }, { item: 'beam', n: 150 }] },
      { name: 'Gear Train', items: [{ item: 'brass_gear', n: 1000 }, { item: 'iron_plate', n: 500 }] },
      { name: 'Planets', items: [{ item: 'gold_bar', n: 120 }, { item: 'lens', n: 200 }, { item: 'clockwork_core', n: 40 }] },
      { name: 'Starlight', items: [{ item: 'starmetal_bar', n: 60 }, { item: 'starstone', n: 5 }] },
    ],
    reward: 'All machines work 25% faster, forever. The valley becomes famous across the land.' },
  { id: 'm_skyship', name: 'Skyship Dock', desc: 'A mooring tower for trade airships. Sells your goods across the world at a premium.',
    stages: [
      { name: 'Tower', items: [{ item: 'beam', n: 400 }, { item: 'iron_plate', n: 600 }] },
      { name: 'Balloons', items: [{ item: 'cloth', n: 500 }, { item: 'linen', n: 300 }, { item: 'rope', n: 600 }] },
      { name: 'Cargo Lift', items: [{ item: 'clockwork_core', n: 60 }, { item: 'spring_battery', n: 20 }] },
      { name: 'Maiden Voyage', items: [{ item: '#wine', n: 300 }, { item: '#preserve', n: 300 }, { item: 'cheese', n: 200 }] },
    ],
    reward: 'Every sale earns 25% more, and market saturation recovers twice as fast.' },
  { id: 'm_beacon', name: 'Starlight Beacon', desc: 'A lighthouse that gathers starlight to grow crops through any night and season.',
    stages: [
      { name: 'Lighthouse', items: [{ item: 'brick', n: 800 }, { item: 'glass', n: 600 }] },
      { name: 'Lens Crown', items: [{ item: 'lens', n: 400 }, { item: 'gold_bar', n: 150 }] },
      { name: 'Starheart', items: [{ item: 'starstone', n: 8 }, { item: 'prism_shard', n: 1 }, { item: 'glow_sorbet', n: 20 }] },
    ],
    reward: 'All outdoor crops grow in every season, and sprinklers reach one tile further.' },
];

export const MEGA_BY_ID = new Map(MEGAPROJECTS.map((m) => [m.id, m]));

export const FESTIVALS: FestivalDef[] = [
  // the Sprocket Fair (2.0, was Kite Day): bring a line to the Professor's 6x6 plate on the square
  // (src/sim/testbed.ts, src/sim/fair.ts); its prizes score in entries beaten, and the candle rewards
  // come once per save. The first F at the Professor opens it (the Mayor opens it too, as he opened Kite
  // Day); the plate and the three entries stand on the square while it's on (src/render/fairground.ts)
  { id: 'f_fair', name: 'Sprocket Fair', the: true, season: 0, day: 13, start: 540, end: 1080, host: 'ottoline', cohost: 'tobias', activity: 'fair',
    desc: "Bring a line to the Professor's 6x6 plate on the square. The value it adds in five minutes is judged against the town's best.",
    intro: "Welcome to the Sprocket Fair! Pick a blueprint that fits my 6x6 plate and I'll build it right here: its chests filled from your farm's goods, the burners stoked, the plate's grid humming. Five minutes on the clock, and the value it adds is judged against this year's entries.",
    prizes: [{ score: 1, items: [{ item: 'ticket', n: 5 }], money: 300 }, { score: 2, items: [{ item: 'ticket', n: 10 }], money: 800 }, { score: 3, items: [{ item: 'ticket', n: 20 }], money: 1500 }] },
  { id: 'f_firefly', name: 'Lantern Night', season: 1, day: 20, start: 1080, end: 1440, host: 'sable', activity: 'firefly',
    desc: 'Fireflies and paper lanterns over the summer square. Catch as many fireflies as you can!',
    intro: 'Lantern Night! Click the fireflies before they drift away. Golden ones are worth extra.',
    prizes: [{ score: 15, items: [{ item: 'ticket', n: 5 }], money: 300 }, { score: 30, items: [{ item: 'ticket', n: 10 }, { item: 'sunbell_seed', n: 10 }], money: 900 }, { score: 45, items: [{ item: 'ticket', n: 20 }, { item: 'lamp', n: 4 }], money: 1800 }] },
  // the Harvest Haul (2.0, was the Pumpkin Roll): every standing order pays double today (orders.ts),
  // and the Mayor auctions a rare lot (src/sim/auction.ts). Its prizes: 1 for bidding, 2 for winning.
  // Fall 15 is a Monday, the day the week's standing orders go up, so a line that fills them by the
  // post is paid double too (the Orders board says so from fall 12)
  { id: 'f_haul', name: 'Harvest Haul', the: true, season: 2, day: 15, start: 540, end: 1080, host: 'tobias', activity: 'haul',
    desc: "The town's trade fair: every standing order pays double today, and the Mayor auctions a rare lot on the square.",
    intro: "Welcome, welcome to the Harvest Haul! Every business in town pays double for its standing order today, by hand or by the post. And on the block I have this year's lot. Roxy and Bram have been eyeing it since breakfast.",
    prizes: [{ score: 1, items: [{ item: 'ticket', n: 10 }], money: 0 }, { score: 2, items: [{ item: 'ticket', n: 20 }], money: 0 }] },
  { id: 'f_skate', name: 'Frostlight Skate', season: 3, day: 24, start: 1020, end: 1380, host: 'marigold', activity: 'skate',
    desc: 'Skate the frozen square collecting floating lights, and dodge the thin ice!',
    intro: 'Frostlight Skate! Use WASD to glide around the rink. Collect the lights, avoid the cracks. You have one minute!',
    prizes: [{ score: 10, items: [{ item: 'ticket', n: 5 }], money: 300 }, { score: 20, items: [{ item: 'ticket', n: 10 }, { item: 'starpetal_seed', n: 5 }], money: 900 }, { score: 30, items: [{ item: 'ticket', n: 20 }, { item: 'snowberry_sapling', n: 1 }], money: 2000 }] },
];

/** festival token shop */
export const TOKEN_SHOP: { item: string; tickets: number }[] = [
  { item: 'flower_pot', tickets: 4 }, { item: 'lamp', tickets: 6 }, { item: 'super_tonic', tickets: 3 }, { item: 'deluxe_bait', tickets: 2 },
  { item: 'starpetal_seed', tickets: 8 }, { item: 'glowmelon_seed', tickets: 10 }, { item: 'heart_charm', tickets: 40 }, { item: 'sprinkler_2', tickets: 15 },
];
