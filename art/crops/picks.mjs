// Which generated candidate becomes which sprite. "b1/12" = slot 12 of batch b1: raw/b1/12.png as
// downloaded, src/b1/12.png after prep.mjs (palette, foliage ramp, ripe glint).
// Per crop: stages 1..N-1 and ripe, each a list of takes (variant 0, 1, 2 = map deco % 3 cycle
// through the list). A take may also be { ref, recolor } for a runtime palette swap.
// `dead` (optional) picks the stage withered plants are recolored from (default: stage N-1, take 0).
//
// Pipeline: node art/crops/prep.mjs b1 t1 w2 b3 b5 g1 r1 && node art/crops/build.mjs
//           && node scripts/sprites-import.mjs art/crops/sprites.json
// Batches: PixelLab create_1_direction_object, 64 candidates per call at size 24 (16 at size 48),
// item_descriptions per slot; fetch with node scripts/pl-fetch.mjs frames <frame_0 url> 64 raw/<b>.
//   b1 4090ed09-e615-473d-8d26-ea6892d7a9c3  spring set, seeds, fert test
//   t1 18cf6a37-8855-432a-8e02-5103cdc4c687  tall crops (trellis, stalks, grains, flowers)
//   w2 33233655-0b05-491b-a560-4c146dbe89ea  fall/winter bushes and roots, fertilizer specks
//   b3 c7409279-fd0b-4e46-bac7-251ccdca1b54  summer bushes, cabbage/sunflower fixes, seeds, second takes
//   b5 3338b574-fa82-4b12-b55e-14044b02a6f5  corn/barley/hops fixes, second and third takes
//                                            (style_images: raw w2/18, b1/30, t1/12)
//   g1 a9e69f45-ac60-4969-94bd-3109fbb3a8e5  giant crops, size 48
//   r1 9e4c1ebe-ba09-4ce2-8da7-b5b673d26109  rapeseed (2.0 Phase 6), size 24 with style_images (raw b1/42, t1/20,
//                                            b1/41, b1/40, t1/24); slots 0-11 sprouts, 12-27 rosettes, 28-43 budding,
//                                            44-63 in bloom; graded by prep.mjs mapRape (plum outline, brass-yellow
//                                            flowers, teal leaves)
// Rejected, not kept: w1 531b3133-… (size 20: noisy, outlines missing) and b4 c86d3d49-… (same
// prompt as b5 without style images: art filled the canvas edge to edge, no outline).
export const SEEDS = ['b3/36', 'b3/35', 'b1/1'];

export const PICKS = {
  // spring
  radish: { 1: ['b1/3'], 2: ['b1/4'], 3: ['b1/5', 'b5/9'], ripe: ['b1/6', 'b1/47', 'b3/46'] },
  spinach: { 1: ['b1/7'], 2: ['b1/8'], 3: ['b1/9', 'b5/10'], ripe: ['b1/10', 'b1/48', 'b3/58'] },
  pea: { 1: ['t1/0'], 2: ['t1/1'], 3: ['t1/2', 'b5/11'], ripe: ['t1/3', 'b1/14', 'b5/32'] },
  strawberry: { 1: ['b1/15'], 2: ['b1/16'], 3: ['b1/17', 'b5/57'], 4: ['b1/18', 'b1/57'], ripe: ['b1/19', 'b1/50', 'b3/49'] },
  tulip: { 1: ['b1/20'], 2: ['b1/21'], 3: ['b1/22', 'b5/12'], ripe: ['b1/23', 'b1/51', 'b5/33'] },
  potato: { 1: ['b1/24'], 2: ['b1/25'], 3: ['b1/26', 'b5/56'], 4: ['b1/27', 'b1/58'], ripe: ['b1/28', 'b1/52', 'b3/47'] },
  cabbage: { 1: ['b1/29'], 2: ['b3/27'], 3: ['b3/28', 'b5/61'], 4: ['b3/29', 'b3/30'], ripe: ['b1/33', 'b1/53', 'b3/48'] },
  rhubarb: { 1: ['b1/34'], 2: ['b1/35'], 3: ['b1/36'], 4: ['b1/37', 'b1/60'], ripe: ['b1/38', 'b1/54', 'b5/34'] },
  flax: { 1: ['b1/39'], 2: ['b1/40'], 3: ['b1/41', 'b5/13'], ripe: ['b1/42', 'b1/55'] },
  cogbean: { 1: ['t1/4'], 2: ['t1/5'], 3: ['t1/6', 'b5/14'], ripe: ['t1/7', 'b1/46', 'b5/36'] },
  // summer
  tomato: { 1: ['t1/8'], 2: ['t1/9'], 3: ['t1/10', 'b5/58'], 4: ['t1/11', 'b3/38'], ripe: ['t1/12', 't1/59', 'b3/50'] },
  corn: { 1: ['t1/13'], 2: ['t1/14', 'b5/59'], 3: ['b5/0', 'b5/1'], 4: ['t1/16', 'b3/39', 'b5/63'], ripe: ['t1/17', 't1/58', 'b3/51'] },
  melon: { 1: ['b3/0'], 2: ['b3/1'], 3: ['b3/2'], 4: ['b3/3', 'b5/15'], ripe: ['b3/4', 'b3/5', 'b3/63'] },
  blueberry: { 1: ['b3/6'], 2: ['b3/7'], 3: ['b3/8'], 4: ['b3/9', 'b3/45'], ripe: ['b3/10', 'b3/11'] },
  emberpepper: { 1: ['b3/12'], 2: ['b3/13'], 3: ['b3/14'], 4: ['b3/15', 'b5/16'], ripe: ['b3/16', 'b3/17', 'b5/46'] },
  sunflower: { 1: ['t1/18'], 2: ['b3/31'], 3: ['b3/32', 'b3/33'], ripe: ['t1/20', 't1/60', 'b5/55'] },
  rapeseed: { 1: ['r1/3', 'r1/8', 'r1/9'], 2: ['r1/17', 'r1/18', 'r1/16'], 3: ['r1/36', 'r1/38', 'r1/42'], ripe: ['r1/54', 'r1/52', 'r1/48'] },
  wheat: { 1: ['t1/21'], 2: ['t1/22', 'b5/62'], 3: ['t1/24', 'b3/43'], ripe: ['t1/25', 'b3/53', 'b5/43'] },
  hops: { 1: ['t1/26'], 2: ['t1/27'], 3: ['t1/28', 'b5/4', 'b5/5'], 4: ['b5/6', 't1/29'], ripe: ['t1/31', 't1/62', 'b5/37'] },
  sweetcane: { 1: ['t1/32'], 2: ['t1/33'], 3: ['t1/34'], 4: ['t1/35', 'b5/17'], ripe: ['t1/36', 'b3/55', 'b5/38'] },
  cotton: { 1: ['b3/18'], 2: ['b3/19'], 3: ['b3/20', 'b5/18'], ripe: ['b3/21', 'b3/61', 'w2/59'] },
  coffee: { 1: ['b3/22'], 2: ['b3/23'], 3: ['b3/24'], 4: ['b3/25', 'b5/19'], ripe: ['b3/26', 'b3/62', 'w2/60'] },
  sunbell: { 1: ['b3/34'], 2: ['t1/37'], 3: ['t1/38', 'b5/20'], ripe: ['t1/39', 'b3/57', 'b5/39'] },
  // fall
  pumpkin: { 1: ['w2/0'], 2: ['w2/1'], 3: ['w2/2', 'b5/60'], 4: ['w2/3', 'b3/40'], ripe: ['w2/4', 'w2/48', 'b3/52'] },
  cranberry: { 1: ['w2/5'], 2: ['w2/6'], 3: ['w2/7'], 4: ['w2/8', 'b5/21'], ripe: ['w2/9', 'w2/49', 'b5/47'] },
  eggplant: { 1: ['w2/10'], 2: ['w2/11'], 3: ['w2/12'], 4: ['w2/13', 'b3/41'], ripe: ['w2/14', 'w2/50', 'b3/60'] },
  grape: { 1: ['t1/40'], 2: ['t1/41'], 3: ['t1/42'], 4: ['t1/43', 'b3/42'], ripe: ['t1/44', 't1/61', 'b5/40'] },
  beet: { 1: ['w2/15'], 2: ['w2/16'], 3: ['w2/17'], ripe: ['w2/18', 'w2/51', 'b3/59'] },
  yam: { 1: ['w2/19'], 2: ['w2/20'], 3: ['w2/21'], ripe: ['w2/22', 'w2/52', 'b5/48'] },
  artichoke: { 1: ['t1/45'], 2: ['t1/46'], 3: ['t1/47'], 4: ['t1/48', 'b5/24'], ripe: ['t1/49', 'b3/56', 'b5/41'] },
  barley: { 1: ['t1/50'], 2: ['b5/2', 'b5/3'], 3: ['t1/52', 'b3/44'], ripe: ['t1/53', 'b3/54', 'b5/42'] },
  glowmelon: { 1: ['w2/23'], 2: ['w2/24'], 3: ['w2/25'], 4: ['w2/26', 'b5/25'], ripe: ['w2/27', 'w2/53', 'b5/49'] },
  mooncap: { 1: ['w2/28'], 2: ['w2/29'], 3: ['w2/30'], ripe: ['w2/31', 'w2/54', 'b5/50'] },
  // winter (tea leaf grows three seasons)
  frostmint: { 1: ['w2/32'], 2: ['w2/33'], 3: ['w2/34'], ripe: ['w2/35', 'w2/55', 'b5/51'] },
  kale: { 1: ['w2/36'], 2: ['w2/37'], 3: ['w2/38', 'b5/28'], ripe: ['w2/39', 'w2/56', 'b5/52'] },
  snowroot: { 1: ['w2/40'], 2: ['w2/41'], 3: ['w2/42', 'b5/29'], ripe: ['w2/43', 'w2/57', 'b5/53'] },
  starpetal: { 1: ['t1/54'], 2: ['b5/8'], 3: ['t1/56', 'b5/30'], ripe: ['t1/57', 't1/63', 'b5/44'] },
  tealeaf: { 1: ['w2/44'], 2: ['w2/45'], 3: ['w2/46', 'b5/31'], ripe: ['w2/47', 'w2/58', 'b5/54'] },
};

// giant:<id>, 48x48 over a 3x3 block (renderer draws it at the block's top-left tile)
export const GIANTS = { cabbage: 'g1/1', melon: 'g1/4', pumpkin: 'g1/9', glowmelon: 'g1/14' };
// fert:<palette index>: C.lime (tonic), C.sky (mulch), C.amber (the rest); see renderer drawSoil
export const FERT = { 33: 'w2/61', 47: 'w2/62', 23: 'w2/63' };
