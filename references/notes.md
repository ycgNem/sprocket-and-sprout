# Taste notes

Written by the owner (with Claude's help). Add to the lists; the agents read this
file first. Say *why* you like something, not just that you do.

## The target in one line

Dopaminergic but cozy: small, frequent rewards with soft presentation. Every
action answers within ~100 ms (sound + particle + motion); rewards escalate
(harvest streaks, a night tally that counts up); the palette stays warm, motion
eases instead of snapping, nothing reads as an alarm.

## Games to borrow a feeling from

- **Stardew Valley**: warmth. Every tile has a tuft or a flower, no two
  neighbours identical. Crops are readable at a glance at every stage.
- **Forager**: reward density. Something pops, bounces or counts up every
  second or two, and it never feels stressful.
- **Sun Haven**: crop and character readability at a slightly higher pixel
  density than Stardew.
- *(add yours: game, and the one thing to look at)*

## What is wrong with the current look (October 2026)

- Plants look sad: too few growth stages, flat color, no ripe-state sparkle.
- Grass is one repeated tile. Nothing moves in the wind.
- Belt items blur because they are drawn at a non-integer scale.
- The title overlaps the demo windmill; text and sprites overlap in several
  windows.
- Everything is uniform because it is drawn by code: no hand-placed highlights,
  no shadows under objects.

## Things to keep

- The clockwork theme: brass, copper, wood, warm light. Never cold industrial gray.
- The procedural music following season and time of day.
- The one-link browser launch and the tiny download.

## Palette (decided 2026-10-08)

**Resurrect 64** (`palettes/resurrect-64.hex`): warm, 64 colors, long ramps for wood,
brass, skin and foliage. Rule: never fewer than 48 colors. TanoPal 48
(`palettes/tanopal-48-1x.png`) was the first pick but is too saturated (neon yellow,
electric greens); keep it only as a source for rare accents. `ROADMAP.md` has the full
hex list.

## What to look at in the reference screenshots

- `games/factoryref.png`: a factory game that stays friendly. Chunky machines with
  clear silhouettes and colored accents (red, blue, yellow), belts with hazard-stripe
  edges and readable items, lots of trees breaking up the industry, small busy workers.
  Target for belts, machines and the "cozy factory" balance.
- `games/House Ref.png`: a cottage at higher detail than ours. Wood-shingle roof with
  visible texture, warm wood against cool blue-gray stone, a red door, tall grass
  overlapping the base. Target for buildings: texture, material contrast, grass
  in front of structures.
- `games/map.png`: dense, lively ground. Flowers, tufts, bushes and rocks everywhere, a
  pink blossom tree as an accent, raised grass ledges with shadowed edges, dirt paths
  with soft borders. Target for terrain variation and "no empty ground".
- `games/pixelref.png`: lush trees. Big layered canopies with 3–4 green shades and
  bright rim highlights, pines in front of broadleaf trees, a dark drop shadow on the
  grass, winding paths with a darker edge. Target for trees and foliage depth.
