// Creature prep config (read by prep.mjs). Every output is palette-exact and frame-sized.
// Rebuild: node art/creatures/prep.mjs && node art/creatures/build-recipe.mjs && node scripts/sprites-import.mjs art/creatures/sprites.json
// Poses come from PixelLab batches in raw/ (create_1_direction_object); walk, hop, flap and flicker frames are
// derived here from the chosen pose (legs shuffle, body bob, squash/stretch) so cycles never jitter. The two
// moths use PixelLab v3 animate_object frames (raw/anim/).
const ramps = {
  ink: ['#2e222f'],
  plum: ['#2e222f', '#3e3546', '#45293f'],
  // cream fur and feathers: white lit, peach mid, warm taupe shade (Resurrect 64 has no cream)
  cream: ['#ffffff', '#fdcbb0', '#ab947a', '#966c6c'],
  taupe: ['#3e3546', '#625565', '#966c6c', '#ab947a', '#c7dcd0'],
  wood: ['#45293f', '#7a3045', '#9e4539', '#cd683d', '#e6904e'],
  brass: ['#9e4539', '#cd683d', '#f79617', '#f9c22b', '#fbff86'],
  copper: ['#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790'],
  pink: ['#7a3045', '#cf657f', '#ed8099', '#f68181', '#fca790', '#fdcbb0'],
  leaf: ['#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'],
  teal: ['#0b5e65', '#0b8a8f', '#0eaf9b', '#30e1b9', '#8ff8e2'],
  blue: ['#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff'],
  purple: ['#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'],
  fire: ['#6e2727', '#b33831', '#ea4f36', '#fb6b1d', '#f79617', '#f9c22b', '#fbff86', '#fbb954'],
  lime: ['#91db69', '#cddf6c', '#d5e04b'],
  gold: ['#cd683d', '#e6904e', '#f79617', '#fbb954', '#f9c22b', '#fbff86'],
};
const items = [];

/**
 * A 4-frame walk from a standing pose `base` (an output name):
 *   0 = the pose (idle), 1 = stride A + bob, 2 = stride B, 3 = legs together + bob.
 * The game shows 0 standing and alternates 0/1 while walking today; 0-3 is the full cycle.
 */
function walk(name, base, at, legs, opts = {}) {
  const n = legs.length, s = opts.step ?? 1;
  const A = legs.map((_, i) => (n === 2 ? (i ? s : -s) : i % 2 ? -s : s));
  const B = A.map((d) => -d);
  items.push({ out: `${name}_0`, from: base, post: [] });
  items.push({ out: `${name}_1`, from: base, post: [{ walk: { at, legs, dx: A, bob: opts.bob ?? 1 } }] });
  items.push({ out: `${name}_2`, from: base, post: [{ walk: { at, legs, dx: B, bob: 0 } }] });
  items.push({ out: `${name}_3`, from: base, post: [{ walk: { at, legs, bob: opts.bob ?? 1 } }] });
}

// ---- barn adults: 28x26 frame, feet on row 25 (origin [14, 25]) ----
const BARN = { canvas: [28, 26], anchor: [14, 25], outline: true };
items.push({ out: 'base_cow', src: 'raw/barn2/2.png', ...BARN, pal: ['plum', 'cream', 'wood', '#f68181', '#fca790', '#cf657f', '#f9c22b', '#f79617'] });
items.push({ out: 'base_goat', src: 'raw/barn2/9.png', ...BARN, pal: ['plum', 'taupe', '#fdcbb0', '#7a3045', '#9e4539', '#f68181'] });
items.push({ out: 'base_sheep', src: 'raw/barn2/17.png', ...BARN, pal: ['plum', '#694f62', '#ffffff', '#fdcbb0', '#ab947a'] });
items.push({ out: 'base_pig', src: 'raw/barn2/25.png', ...BARN, pal: ['plum', 'pink', '#9e4539'] });
items.push({ out: 'base_alpaca', src: 'raw/barn2/33.png', ...BARN, pal: ['plum', 'wood', '#fdcbb0', '#ab947a', '#966c6c'] });
walk('an_cow_0', 'base_cow', 23, [[5, 7], [9, 11], [13, 16], [18, 20]]);
walk('an_goat_0', 'base_goat', 21, [[4, 6], [8, 10], [12, 15], [16, 18]]);
walk('an_sheep_0', 'base_sheep', 23, [[7, 9], [10, 13], [15, 17], [19, 20]]);
walk('an_pig_0', 'base_pig', 23, [[6, 8], [10, 12], [14, 17], [18, 20]]);
walk('an_alpaca_0', 'base_alpaca', 22, [[6, 12], [13, 19]]);

// ---- coop adults and all babies, pets, bowl (bases) ----
const COOP = { canvas: [16, 16], anchor: [8, 15], outline: true };
const BABY = { canvas: [20, 18], anchor: [10, 17], outline: true };
const PCREAM = ['plum', 'cream'];
items.push({ out: 'base_chicken', src: 'raw/coop3/0.png', ...COOP, pal: [...PCREAM, '#e83b3b', '#b33831', '#f79617', '#fb6b1d', '#cd683d'], srcMap: { '#903820': '#cd683d', '#ffa796': '#f79617' } });
items.push({ out: 'base_duck', src: 'raw/coop3/11.png', ...COOP, pal: [...PCREAM, '#f79617', '#fb6b1d', '#cd683d', '#f9c22b'] });
items.push({ out: 'base_rabbit', src: 'raw/coop3/19.png', ...COOP, pal: ['plum', 'wood', '#ab947a', '#fdcbb0', '#ffffff', '#ed8099', '#f68181'] });
items.push({ out: 'base_chick', src: 'raw/coop2/18.png', ...COOP, pal: ['plum', '#f79617', '#f9c22b', '#fbff86', '#fb6b1d', '#cd683d'] });
items.push({ out: 'base_duckling', src: 'raw/coop2/21.png', ...COOP, pal: ['plum', '#f9c22b', '#fbff86', '#ffffff', '#f79617', '#fb6b1d', '#cd683d'] });
items.push({ out: 'base_calf', src: 'raw/coop3/32.png', ...BABY, pal: ['plum', 'cream', 'wood', '#f68181', '#fca790', '#cf657f'] });
items.push({ out: 'base_kid', src: 'raw/coop3/34.png', ...BABY, pal: ['plum', 'taupe', '#7a3045', '#9e4539', '#f68181'] });
items.push({ out: 'base_lamb', src: 'raw/coop3/40.png', ...BABY, pal: ['plum', '#694f62', '#ffffff', '#fdcbb0', '#ab947a'] });
items.push({ out: 'base_piglet', src: 'raw/coop3/46.png', ...BABY, pal: ['plum', 'pink', '#9e4539'] });
items.push({ out: 'base_cria', src: 'raw/coop3/53.png', ...BABY, pal: ['plum', 'wood', '#fdcbb0', '#ab947a', '#966c6c'] });
const BOWL = { canvas: [16, 16], anchor: [8, 14], outline: true, pal: ['plum', 'copper', 'brass', '#45293f', 'blue', '#ffffff'] };
items.push({ out: 'bowl_0', src: 'raw/coop3/59.png', ...BOWL });
items.push({ out: 'bowl_1', src: 'raw/coop3/62.png', ...BOWL });

/** frames from a list of post-op lists (frame 0 = the pose itself) */
function frames(name, base, posts) {
  items.push({ out: name + '_0', from: base, post: [] });
  posts.forEach((post, i) => items.push({ out: name + '_' + (i + 1), from: base, post }));
}
const up = (n) => ({ shiftAll: [0, -n] });
// birds bob and nod their heads; rabbits and chicks hop (the renderer's shadow stays on the ground)
frames('an_chicken_0', 'base_chicken', [
  [{ walk: { at: 14, legs: [[6, 10]], bob: 1 } }, { move: [8, 0, 7, 7], by: [1, 0] }],
  [{ move: [8, 0, 7, 7], by: [1, 1] }],
  [{ walk: { at: 14, legs: [[6, 10]], bob: 1 } }],
]);
frames('an_duck_0', 'base_duck', [
  [{ walk: { at: 14, legs: [[5, 10]], bob: 1 } }, { move: [7, 2, 8, 7], by: [1, 0] }],
  [{ move: [7, 2, 8, 7], by: [1, 1] }],
  [{ walk: { at: 14, legs: [[5, 10]], bob: 1 } }],
]);
frames('an_rabbit_0', 'base_rabbit', [[up(2)], [up(1)], [{ move: [5, 0, 10, 7], by: [0, 1] }]]);
frames('an_chicken_1', 'base_chick', [[up(2)], [up(1)], [{ walk: { at: 14, legs: [[5, 10]], bob: 1 } }]]);
frames('an_duck_1', 'base_duckling', [[up(2)], [up(1)], [{ walk: { at: 14, legs: [[5, 10]], bob: 1 } }]]);
// baby bunny: the adult rabbit shrunk (rows and columns dropped in flat areas), then touched up by hand
items.push({ out: 'bunny_shrunk', from: 'base_rabbit', post: [{ delRow: 13 }, { delRow: 11 }, { delRow: 5 }, { delCol: 3 }, { delCol: 5 }, { delCol: 8 }] });
items.push({ out: 'base_bunny2', from: 'bunny_shrunk', post: [{ set: [
  [7, 5, null], [10, 6, '#2e222f'], [11, 6, '#f68181'], [12, 6, '#e6904e'], [10, 7, '#2e222f'], [11, 7, '#f68181'], [12, 7, '#e6904e'],
  [10, 8, '#e6904e'], [11, 8, '#e6904e'], [8, 9, '#2e222f'], [12, 13, '#cd683d'], [5, 13, '#ffffff'], [9, 9, '#fdcbb0'],
] }] });
frames('an_rabbit_1', 'base_bunny2', [[up(2)], [up(1)], [{ move: [6, 0, 9, 8], by: [0, 1] }]]);
walk('an_cow_1', 'base_calf', 15, [[4, 6], [7, 9], [10, 13]]);
walk('an_goat_1', 'base_kid', 15, [[4, 8], [9, 12]]);
walk('an_sheep_1', 'base_lamb', 15, [[4, 6], [7, 9], [10, 13]]);
walk('an_pig_1', 'base_piglet', 16, [[5, 8], [9, 13]]);
walk('an_alpaca_1', 'base_cria', 16, [[4, 7], [8, 12]]);

// ---- monsters: 20x20 frame, feet at [10, 18]; frames 0-3 loop at 6 fps ----
const MON = { canvas: [20, 20], anchor: [10, 18], outline: true };
/** a monster cycle from PixelLab animation frames (raw/anim/<dir>/<i>.png, same canvas as the pose) */
function monAnim(id, dir, order, common) {
  const base = `mon_${id}_0`;
  order.forEach((f, i) => items.push(i === 0
    ? { out: base, src: `raw/anim/${dir}/${f}.png`, ...MON, ...common }
    : { out: `mon_${id}_${i}`, like: base, src: `raw/anim/${dir}/${f}.png`, alignTo: base }));
}
monAnim('cave_moth', 'cave_moth2', [0, 2, 3, 4], { pal: ['ink', '#45293f', '#7a3045', '#9e4539', '#cd683d', '#ab947a', '#fdcbb0', '#ffffff', '#f79617'], srcMap: { '#eaba81': '#ab947a', '#e4ae7b': '#966c6c', '#d7a36b': '#966c6c', '#ffdd9f': '#fdcbb0', '#f1ddb3': '#fdcbb0' } });
monAnim('dusk_moth', 'dusk_moth', [0, 1, 2, 4], { pal: ['ink', 'purple', 'lime'] });

/** clean blob body: flat base, bottom shade band, a simple face (eyes, smile, cheeks) */
function blobFace(B, M, S, D, cheek) {
  const set = [];
  const row = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) set.push([x, y, c]); };
  row(11, 4, 15, B); set.push([15, 11, M]);
  row(12, 4, 15, B); set.push([15, 12, M]);
  row(13, 3, 16, B); set.push([16, 13, M]);
  row(14, 3, 16, B); row(14, 15, 16, M);
  row(15, 3, 16, B); row(15, 14, 16, M); set.push([3, 15, M]);
  row(16, 4, 15, M); row(16, 13, 15, S);
  row(17, 6, 13, S);
  for (const [x, y] of [[7, 11], [7, 12], [12, 11], [12, 12]]) set.push([x, y, '#2e222f']);
  set.push([9, 13, D], [10, 13, D], [5, 13, cheek], [14, 13, cheek]);
  return { set };
}
/** blob cycle: 0 pose, 1 squash, 2 stretch, 3 tall (bottom fixed, centered) */
function blobCycle(id, base) {
  items.push({ out: `mon_${id}_0`, from: base, post: [] });
  items.push({ out: `mon_${id}_1`, from: base, post: [{ delRow: 9 }, { dupCol: 6 }, { dupCol: 13 }, { shiftAll: [1, 0] }] });
  items.push({ out: `mon_${id}_2`, from: base, post: [{ dupRow: 9 }, { delCol: 6 }, { delCol: 13 }, { shiftAll: [-1, 0] }] });
  items.push({ out: `mon_${id}_3`, from: base, post: [{ dupRow: 9 }] });
}
items.push({ out: 'base_dew_blob', src: 'raw/mon1/40.png', ...MON, pal: ['ink', 'leaf', '#ffffff'], post: [blobFace('#91db69', '#1ebc73', '#239063', '#165a4c', '#f68181')] });
items.push({ out: 'base_frost_blob', src: 'raw/mon1/43.png', ...MON, pal: ['ink', 'teal', '#ffffff', '#c7dcd0'], post: [blobFace('#8ff8e2', '#30e1b9', '#0eaf9b', '#0b5e65', '#ed8099')] });
blobCycle('dew_blob', 'base_dew_blob');
blobCycle('frost_blob', 'base_frost_blob');

// ---- pets: 22x20 frame, feet at [11, 19] ----
const PET = { canvas: [22, 20], anchor: [11, 19], outline: true };
const CAT = ['plum', '#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954', '#fdcbb0', '#ffffff', '#f68181'];
const DOG = ['plum', '#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954', '#fdcbb0', '#ffffff', '#f68181', '#b33831'];
const CALICO = ['plum', '#3e3546', '#625565', '#9e4539', '#cd683d', '#e6904e', '#fbb954', '#ab947a', '#fdcbb0', '#ffffff', '#f68181'];
items.push({ out: 'base_cat_stand', src: 'raw/pets3/0.png', ...PET, pal: CAT });
items.push({ out: 'base_cat_sit', src: 'raw/pets3/10.png', ...PET, pal: CAT });
items.push({ out: 'base_cat_sleep', src: 'raw/pets3/19.png', ...PET, pal: CAT });
items.push({ out: 'base_dog_stand', src: 'raw/pets3/22.png', ...PET, pal: DOG });
items.push({ out: 'base_dog_sit', src: 'raw/pets3/31.png', ...PET, pal: DOG });
items.push({ out: 'base_dog_sleep', src: 'raw/pets3/36.png', ...PET, pal: DOG });
items.push({ out: 'base_calico_stand', src: 'raw/pets3/44.png', ...PET, pal: CALICO });
items.push({ out: 'base_calico_sit', src: 'raw/pets3/45.png', ...PET, pal: CALICO });
items.push({ out: 'base_calico_sleep', src: 'raw/pets3/46.png', ...PET, pal: CALICO });

/**
 * pet:<kind>:<coat>:<pose> frames: 0 stand, 1 walk (stride A + bob), 2 sit, 3 sleep,
 * 4 stride B, 5 legs together + bob (4 and 5 finish a 4-frame walk if the renderer wants one).
 * `coat` = { stand, sit, sleep } post ops applied to the base poses (recolors, markings).
 */
const PET_LEGS = { at: 17, legs: [[4, 6], [7, 9], [11, 13], [14, 16]] };
function pet(kind, c, bases, coat = {}) {
  const n = `pet_${kind}_${c}`;
  const all = coat.all ?? [];
  items.push({ out: `${n}_0`, from: bases.stand, post: [...all, ...(coat.stand ?? [])] });
  items.push({ out: `${n}_2`, from: bases.sit, post: [...all, ...(coat.sit ?? [])] });
  items.push({ out: `${n}_3`, from: bases.sleep, post: [...all, ...(coat.sleep ?? [])] });
  const { at, legs } = bases.legs ?? PET_LEGS;
  items.push({ out: `${n}_1`, from: `${n}_0`, post: [{ walk: { at, legs, dx: [1, -1, 1, -1], bob: 1 } }] });
  items.push({ out: `${n}_4`, from: `${n}_0`, post: [{ walk: { at, legs, dx: [-1, 1, -1, 1] } }] });
  items.push({ out: `${n}_5`, from: `${n}_0`, post: [{ walk: { at, legs, bob: 1 } }] });
}
const CATB = { stand: 'base_cat_stand', sit: 'base_cat_sit', sleep: 'base_cat_sleep' };
const DOGB = { stand: 'base_dog_stand', sit: 'base_dog_sit', sleep: 'base_dog_sleep' };
const lime = (pts) => ({ set: pts.map(([x, y]) => [x, y, '#91db69']) });
// cats: 0 Ginger, 1 Silver, 2 Midnight (lime eyes), 3 Calico (its own generated set)
pet('cat', 0, CATB);
pet('cat', 1, CATB, { all: [{ recolor: { '#fbb954': '#c7dcd0', '#e6904e': '#9babb2', '#cd683d': '#7f708a', '#9e4539': '#625565', '#7a3045': '#3e3546', '#fdcbb0': '#ffffff' } }] });
pet('cat', 2, CATB, {
  all: [{ recolor: { '#fbb954': '#694f62', '#e6904e': '#3e3546', '#cd683d': '#45293f', '#9e4539': '#2e222f', '#7a3045': '#2e222f', '#fdcbb0': '#625565', '#ffffff': '#7f708a' } }],
  stand: [lime([[13, 10], [17, 10]])], sit: [lime([[12, 9], [16, 9]])],
});
pet('cat', 3, { stand: 'base_calico_stand', sit: 'base_calico_sit', sleep: 'base_calico_sleep' });
// dogs: 0 Golden, 1 Chestnut, 2 Patches (white, brown ears and a back patch), 3 Sable (tan, dark saddle and ears)
const BODY = ['#fbb954', '#e6904e', '#cd683d', '#ffffff', '#fdcbb0'];
pet('dog', 0, DOGB);
pet('dog', 1, DOGB, { all: [{ recolor: { '#fbb954': '#cd683d', '#e6904e': '#9e4539', '#cd683d': '#9e4539', '#9e4539': '#7a3045', '#7a3045': '#45293f' } }] });
pet('dog', 2, DOGB, {
  all: [{ recolor: { '#fbb954': '#ffffff', '#e6904e': '#fdcbb0', '#cd683d': '#ab947a' } }],
  stand: [{ patch: [8, 12, 2.3], on: BODY, to: '#cd683d' }, { patch: [8, 13, 1], on: ['#cd683d'], to: '#9e4539' }],
  sit: [{ patch: [9, 14, 2], on: BODY, to: '#cd683d' }],
  sleep: [{ patch: [6, 12, 2.4], on: BODY, to: '#cd683d' }],
});
pet('dog', 3, DOGB, {
  all: [{ recolor: { '#9e4539': '#45293f', '#7a3045': '#2e222f' } }],
  stand: [{ patch: [8, 11, 2.2], on: BODY, to: '#45293f' }, { patch: [11, 11, 1.6], on: BODY, to: '#45293f' }, { patch: [8, 13, 1.2], on: BODY, to: '#7a3045' }],
  sit: [{ patch: [8, 13, 2.2], on: BODY, to: '#45293f' }],
  sleep: [{ patch: [6, 11, 2.3], on: BODY, to: '#45293f' }, { patch: [9, 10, 1.6], on: BODY, to: '#45293f' }],
});

// ---- monster poses (hand-animated below) ----
const CRAB = ['plum', '#625565', '#966c6c', '#ab947a', '#c7dcd0', '#b33831', '#ea4f36', '#f57d4a', '#fca790', '#6e2727', '#ffffff'];
items.push({ out: 'base_crab', src: 'raw/mon2/8.png', ...MON, pal: CRAB });
items.push({ out: 'base_crab_hidden', src: 'raw/mon2/38.png', ...MON, pal: [...CRAB, '#91db69'] });
items.push({ out: 'base_mole', src: 'raw/mon2/23.png', ...MON, pal: ['plum', 'wood', '#4c3e24', '#694f62', '#ed8099', '#f68181', '#fca790', '#f79617', '#f9c22b', '#fbff86', '#ffffff'] });
items.push({ out: 'base_mound', src: 'raw/mon2/33.png', ...MON, pal: ['plum', 'wood', '#4c3e24', '#966c6c', '#ab947a'] });
items.push({ out: 'base_wisp', src: 'raw/mon2/40.png', ...MON, pal: ['ink', 'fire', '#fdcbb0', '#ffffff'] });
items.push({ out: 'base_golem', src: 'raw/mon2/46.png', ...MON, pal: ['plum', 'copper', '#7a3045', '#9e4539', '#cd683d', '#f79617', '#f9c22b', '#30e1b9', '#8ff8e2', '#1ebc73', '#91db69'], map: { '#91db69': '#30e1b9', '#1ebc73': '#0eaf9b' } });
const mon = (id, base, posts) => posts.forEach((post, i) => items.push({ out: `mon_${id}_${i}`, from: base, post }));
// pebble crab scuttles; frame 4 = hiding in its pebble (the "disguised" state)
mon('pebble_crab', 'base_crab', [[],
  [{ walk: { at: 15, legs: [[2, 8], [11, 18]], dx: [-1, 1], bob: 1 } }],
  [{ walk: { at: 15, legs: [[2, 8], [11, 18]], dx: [1, -1] } }],
  [{ walk: { at: 15, legs: [[2, 8], [11, 18]], dx: [-1, 1] } }]]);
items.push({ out: 'mon_pebble_crab_4', from: 'base_crab_hidden', post: [] });
// burrow mole peeks, pops up, stretches, its brass lamp glints; frame 4 = only the molehill (underground)
const glint = { recolor: { '#fbff86': '#ffffff', '#ffffff': '#fbff86' } };
mon('burrow_mole', 'base_mole', [
  [{ sink: { at: 13, by: 3 } }],
  [],
  [{ walk: { at: 13, legs: [[0, 19]], bob: 1 } }],
  [glint]]);
items.push({ out: 'mon_burrow_mole_4', from: 'base_mound', post: [] });
// ember wisp flickers: tip right, tip left, tall
mon('ember_wisp', 'base_wisp', [[],
  [{ move: [6, 3, 8, 6], by: [1, 0] }],
  [{ move: [6, 3, 8, 6], by: [-1, 0] }],
  [{ dupRow: 9 }]]);
// rust golem stomps: left step (right arm up), body up, right step (left arm up)
mon('rust_golem', 'base_golem', [[],
  [{ move: [5, 15, 4, 3], by: [0, -1] }, { move: [15, 12, 4, 6], by: [0, -1] }],
  [{ walk: { at: 15, legs: [[0, 19]], bob: 1 } }],
  [{ move: [11, 15, 4, 3], by: [0, -1] }, { move: [1, 12, 4, 6], by: [0, -1] }]]);
// pose 6: sleeping, breathing in (the top of the body rises a pixel); alternate 3 and 6 slowly
for (const k of ['cat', 'dog']) for (let c = 0; c < 4; c++) {
  const row = k === 'cat' ? (c === 3 ? 13 : 14) : 13;
  items.push({ out: `pet_${k}_${c}_6`, from: `pet_${k}_${c}_3`, post: [{ dupRow: row }] });
}
export default { ramps, items };
