// Player-facing patch notes: the title screen's "What's new" window (src/app/app.ts) and the GitHub release.
import thenPic from '../../art/promo/then-0.9.webp';
import nowPic from '../../art/promo/now-2.0.webp';
export interface NoteSection { title: string; items: string[] }
/** a picture under an entry's intro (a screenshot, as WebP), shown beside the entry's others */
export interface NotePic { src: string; caption: string }
export interface PatchNote { version: string; date: string; title: string; intro: string; pics?: NotePic[]; sections: NoteSection[] }
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '2.0',
    date: 'October 2026',
    title: 'The Works',
    intro: `2.0 rebuilds Sprocket & Sprout around its machines. You take over an old keeper's clockwork farm that has rusted to a stop, bring it back piece by piece, then help the town restart its mill, water pumps, street lamps, tram and clock with production lines you build yourself. Hand farming is still here, and your farms from earlier versions come with you.`,
    // the first playable build next to 2.0 at the same moment, a new game's first morning (art/promo/)
    pics: [{ src: thenPic, caption: `Then: the first build (v0.9)` }, { src: nowPic, caption: `Now: 2.0` }],
    sections: [
      {
        title: `The big picture`,
        items: [
          `Your farm runs on machines from the first minute. Arms, belts and crocks do the carrying, and your job is to build lines and make them better.`,
          `You can still till, plant, water and harvest by hand whenever you like.`,
          `One story path for everyone: start in the keeper's yard, then bring back the town's mill, waterworks, street lamps, tram and clock.`,
          `Every machine tells you what it is doing and why it stopped, so a stuck line is a puzzle you can solve instead of a mystery.`,
        ],
      },
      {
        title: `A new start: the Keeper's Line`,
        items: [
          `Every new game opens in the old keeper's yard. One preserving crock still works, and everything around it has rusted.`,
          `Press F on rusted arms, belts and machines to restore them. Within minutes a small line turns beans into pickles and carries them to the shipping crate without you.`,
          `The quest bar at the top left shows one step at a time, with a short reason why.`,
          `Lesson cards appear the first time something new happens, like a machine running out of input or a power shortage. The Keeper's Notebook (J) keeps them all.`,
          `Within the first few days you fix the keeper's water wheel and grind your first sacks of meal at the mill.`,
        ],
      },
      {
        title: `Machines and lines`,
        items: [
          `Every machine shows what it is doing (Working, Idle, Starved, Blocked, Unpowered or Needs fuel) with one line saying why.`,
          `Hold I over a line to see how fast it runs and what holds it back. The Lines tab in the Production window (P) lists every line and its bottleneck.`,
          `Four lamps under the clock count your working and stuck machines. Click one to find them.`,
          `Shift+F opens a machine to pick its recipe. Right-click a spring arm or gleaner to wind it for a short burst of speed.`,
          `Power can run short. When it does, everything on that grid slows down and the lights dim. Power poles switch their machines on, off, or to night shift only.`,
          `Your machines keep working through the night, and the morning summary names yesterday's biggest bottleneck.`,
        ],
      },
      {
        title: `Fields that farm themselves`,
        items: [
          `The gleaner picks the ripe crops around it. Later, the field gantry rides on rails to water, harvest and replant whole strips.`,
          `Machines leave each morning's harvest to you until noon, so farming by hand always pays.`,
          `New goods to make: canvas, grain and straw, starch paste, pigments, rapeseed oil and grain spirit.`,
          `Cogbeans grow twice as fast, and the Mercantile sells their seeds.`,
        ],
      },
      {
        title: `The town is your customer`,
        items: [
          `The Orders board on the town square lists what the town wants: small asks for today, weekly standing orders, and the town's big projects.`,
          `Fill an order by hand, or tag your shipping crate for a customer and the post delivers it for you.`,
          `Each business you supply ranks you up, which opens new orders and new stock in its shop.`,
          `Mags the freight broker visits on Fridays and Sundays with rare parts and seeds, and runs an auction on Sundays.`,
        ],
      },
      {
        title: `Research and the town's works`,
        items: [
          `Research comes in five eras, from Spring to Starlight. After the keeper's yard, each era brings back part of the town: the mill, the waterworks and street lamps, the tram, and last the town clock.`,
          `Big research topics come in stages: look at the real thing, try it yourself, then study it at the desk.`,
          `When a town work comes back, the town changes with it: bread returns to the shops, the fountain runs, and the square lights up at night.`,
        ],
      },
      {
        title: `The Deepworks`,
        items: [
          `The old mine is now the Deepworks: 30 levels in six layers, each with its own look, ores and dangers.`,
          `Monsters are gone. Pests get in your way instead and never hurt you, and every hazard has a fix.`,
          `Every fifth level holds an old machine room to restore, starting with a lift that takes you back down.`,
        ],
      },
      {
        title: `People`,
        items: [
          `Six villagers take up jobs at the works: Juniper the millwright, Bram the foundry master, Sable the archivist, Old Thorne the engineer, Hazel the draughtswoman and Pip the apprentice.`,
          `Friendship is now Trust, and helping with work builds it faster than gifts.`,
          `Pip quizzes you on what you have learned, and some afternoons asks what one of your machines is doing.`,
          `Villagers at work indoors can be talked to at their counter.`,
        ],
      },
      {
        title: `Festivals, home and pets`,
        items: [
          `The Sprocket Fair: enter a small line on the Professor's test plate in the square and see if it beats the other entries.`,
          `The Harvest Haul: every standing order pays double for the day, and the Mayor holds an auction.`,
          `Chests and unpowered machines can go inside your farmhouse. Add a Workshop Wing, and a drafting table to save your lines as blueprints.`,
          `A hamster moves in, and its wheel speeds up the spring arms near its cage. Later, Tock, the Professor's clockwork helper, follows you around winding your arms.`,
        ],
      },
      {
        title: `Art and sound`,
        items: [
          `New pixel art across the valley: the keeper's works, conveyor belts, the town's works, every layer of the Deepworks, the festivals, and the villagers in their work clothes.`,
          `New sounds for winding springs, stopped machines and switching the power.`,
        ],
      },
      {
        title: `Your saves`,
        items: [
          `Farms from 1.x and the 2.0 beta load with nothing lost. Older farms skip the new opening and carry on with their story.`,
          `A farm saved in 2.0 can't be opened in 1.1.1 or earlier.`,
        ],
      },
      {
        title: `Since the 2.0 beta`,
        items: [
          `A smoother opening: clearer steps, no waiting around, and the camera starts closer to your machines.`,
          `F always acts on the tile in front of you, even with a villager standing beside it.`,
          `Tooltips, labels and messages no longer cover each other.`,
          `Crafting and item tooltips tell you where to get materials and parts.`,
          `Farms from 1.x get the cogbean oil recipe and, after Water Power, a mill, so they can keep going.`,
          `The game remembers how far you zoomed in.`,
          `New art for the villagers, the festivals, the belts, the crock and the farmhouse.`,
        ],
      },
      {
        title: `Updates`,
        items: [
          `The Milling step that asks you to keep a mill grinding is clearer: it shows how fast your mill is going and how to pass it, and cornmeal now counts as meal.`,
          `The beach washes up two or three new finds every morning, however much is lying around in the woods.`,
          `Kelp turns up a bit more often, on the beach and in fish traps set in the sea, and its tooltip says where to look.`,
          `Beach palms grow one or two coconuts at a time.`,
          `You can pull up a crop by swinging your axe or pickaxe at it twice. A ripe one drops its harvest.`,
        ],
      },
    ],
  },
  {
    version: '2.0 beta',
    date: 'October 2026',
    title: 'The Works, first test',
    intro: `The first public test of 2.0. Everything it added is in the 2.0 notes above.`,
    sections: [],
  },
  {
    version: '1.1.1',
    date: 'October 9, 2026',
    title: 'Playtest hotfix',
    intro: 'A hotfix from the first playtests of 1.1: the ranch opens, bridges are square, mine lifts remember shafts, and the map names every building and shows every villager. Paths, plank decks and the ground where two terrains meet look better too.',
    sections: [
      {
        title: 'Fixes',
        items: [
          'Meadowlark Ranch opens: a villager waiting on a doorstep now steps straight in, so Clem finally gets inside.',
          'Bridges are rectangles: no more L-shaped decks or strips of plank along the bank, on every farm map. Old saves are squared on load.',
          'A shaft that drops you past floor 5, 10 and so on unlocks those lifts, and the lift lists every floor down to your deepest. Old saves get every lift above their deepest floor.',
          'Shift-click moves stacks between your bag and a chest, ctrl-click moves one, and double-click moves every stack of a kind.',
          'Structure windows have a Pick up button, tools take three hits to lift a structure, and a chest or crate with anything in it never breaks by tool.',
          'Weeds and twigs no longer block your way, and screen shake is gentler (and off with the Screen shake setting).',
          "Weeds and storm debris stay off the opening's marked tiles, which on some new games blocked the first arm step.",
          'One name for the Professor everywhere, Prof. Cogwhistle, and a name tag over the villager the guide arrow points at.',
          'Less mail: quests send no letters, the almanac keeps season notes, festivals and birthdays, and the mailbox brings at most one letter a day.',
          'The research tree pans with the mouse wheel (Shift+wheel sideways), with scrollbars and a Fit overview.',
          "Jars cost the same in every shop, the crate's pop shows what the market really pays, and the 960x600 web embed keeps the larger UI.",
        ],
      },
      {
        title: 'Look and feel',
        items: [
          'The map (M) labels every shop and home without overlap. Hover for the name, opening hours and who is inside; heads show you and every villager.',
          "Flagstone paths with gravel edges, for your own paths and the town's roads. Cobble Path is now Flagstone Path.",
          'Plank decks with rails over water, and a path you place now really changes the ground.',
          'Where two kinds of ground meet, the edges blend instead of leaving square notches, tilled soil included.',
          'The pickaxe swings overhead like the hoe, for every look.',
        ],
      },
    ],
  },
  {
    version: '1.1',
    date: 'October 9, 2026',
    title: 'The visual overhaul',
    intro: "Every sprite is redrawn as pixel art on one warm palette, the keeper's clockwork farm runs from your first minutes, and a new villager moors her airship at the end of Main Street. Saves from 1.0 load as they are.",
    sections: [
      {
        title: 'New look',
        items: [
          'Every sprite is redrawn as pixel art on the warm Resurrect 64 palette: terrain, crops, characters, machines, buildings, icons and the UI.',
          'Crops arc into your hotbar, harvest streaks build (every tenth pick in a streak gives a bonus crop), coins shower into the odometer, and machines hop and pop their goods.',
          'A brass mail-bird collects the noon and 6pm post, and the night tally counts up row by row.',
          'Machines show a status lamp (working, waiting for input or blocked), and up close a ring that fills with each batch.',
          "Shadows under trees and structures, smoke from each machine's chimney, wind gusts that sway the trees, and a title wordmark with the sprocket as its O.",
        ],
      },
      {
        title: 'A better first day',
        items: [
          "The keeper's clockwork farm runs from your first minutes: chest, arm, jar, arm, crate.",
          'Key bubbles show what F does on whatever you face, and a guide arrow and compass point the way.',
          'Belts drop goods into whatever they run into (a crate, chest or machine), so no arm is needed at the end of a line.',
          "Prof. Cogwhistle welcomes you in three short lines, and there's no dead afternoon on day one.",
        ],
      },
      {
        title: 'New villager: Roxy Vane',
        items: [
          'A sky-courier who moors her airship, the Brass Vixen, on Skyhook Field at the east end of Main Street. She sends you a card on day 4.',
          'Her hold sells off-season seeds and clockwork parts, and she has her own story over four heart events. She can become your partner.',
        ],
      },
      {
        title: 'Also',
        items: [
          'The UI stays readable on 1366x768 laptops, and the new-game form works with Tab and Enter.',
          'Artisan goods flood the market more slowly, and the night tally warns you when one is flooding.',
          'A finished study shows a Discovery! ribbon naming what it unlocked.',
          'The derelict greenhouse is an ordinary seasonal plot until you restore it for year-round growth.',
          'Installing over 1.0 keeps your farms.',
        ],
      },
    ],
  },
  {
    version: '1.0',
    date: 'October 8, 2026',
    title: 'First release',
    intro: 'The first release of Sprocket & Sprout, a cozy pixel-art farm-factory in the valley town of Thistlewick: farm by hand, build belts, arms and machines around your fields, and help the town back on its feet.',
    sections: [
      {
        title: 'Farming and home',
        items: [
          '36 crops across four seasons, with watering, sprinklers, fertilizers, silver, gold and star quality, giant crops, fruit trees and a ruined greenhouse to restore.',
          'Coops and barns with eight kinds of animals, fishing with an original tension-reel minigame, and a 60-floor mine with ores, gems, monsters and treasure.',
          'A walk-in farmhouse with renovations, home cooking with timed food buffs, furniture, and a stray cat or dog that adopts you on day 3.',
        ],
      },
      {
        title: 'The factory',
        items: [
          'Two-lane belts in three speeds, with curves, side-loading, underground belts and splitters, and spring-wound clockwork arms that need no power.',
          'More than 20 machines with real recipes, and power from water wheels, windmills, steam engines and sun lenses, carried by poles and stored in spring batteries.',
          "Harvest cranes, seed sowers, ore drills on the quarry's veins, and bumblebots that carry goods and build for you.",
          "Blueprints you can copy, rotate and paste, ghosts that build themselves from your bag when you're near, and production stats with graphs.",
          'A 60-node research tree, studied at desks with bundles made from farm and factory goods.',
        ],
      },
      {
        title: 'Town and goals',
        items: [
          '13 villagers with schedules, dialogue, gifts, birthdays and heart events, who teach you recipes as friendships grow.',
          "Shops with opening hours, Mags' traveling cart on Fridays and Sundays, and a market that pays less for whatever you flood it with.",
          "Four festivals with minigames, Trading Guild contracts, a restoration board, three megaprojects, a museum, and Founder's Day each spring.",
          'Romance: give the Brass Locket to a villager you love.',
        ],
      },
      {
        title: 'Ways to play',
        items: [
          "A clockwork opening: you start beside the keeper's working jar with arms, belts, a chest and a study desk.",
          'Four game modes (Story, Cozy, Clockwork Rush and Sandbox) and five farm maps.',
          'About 120 achievements, around 35 of them secret.',
          'The post collects at noon and 6pm as well as overnight, passing out costs your morning instead of your coins, and the world slows down while you build.',
          'Procedural music and sound. Play in your browser, where it installs as an app, or download it for Windows.',
        ],
      },
    ],
  },
];
