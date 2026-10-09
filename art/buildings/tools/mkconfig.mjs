// Writes art/buildings/buildings.json (the composer config) from the per-building choices below.
// Coordinates: src/rect/erase/cutX/paint/glass/roof* are trimmed-art px of the candidate;
// props/decor are frame px of the footprint frame (0,0 = the building's top-left tile corner
// minus the ROOF_H/top margin, as the procedural sprite had it).
import fs from 'node:fs';

const BLUES = ['#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff'];
const WARM = { '#f79617': 1, '#f9c22b': 2, '#4d9be6': 0 };
const bld = (w, h, o) => ({ kind: 'bld', W: w * 16, H: h * 16 + 18, ox: 0, oy: 18, doorTile: Math.floor(w / 2) * 16 + 8, roof: 'auto', roofCover: 0.97, glassColors: BLUES, ...o });
const st = (id, w, h, top, o) => ({ kind: 'st', id, W: w * 16, H: h * 16 + top, ox: 0, oy: top, roof: 'auto', roofCover: 0.97, ...o });

// seasonal touches for homes: spring tulips, fall pumpkins, winter wreath on the door; side is
// the prop that fills the footprint beside the house (a snowy shrub in winter if it's a bush)
const homeDecor = (door, doorY, side, sideX = 89, left = door - 17) => {
  const winterSide = side === 'bush' || side === 'rosebush' || side === 'fern' ? 'snowshrub' : side;
  const s = side ? [[side, sideX, 97]] : [];
  return {
    '0': [...s, ['tulips_red', left, 97]],
    '1': [...s],
    '2': [...s, ['pumpkins', left, 97]],
    '3': [...(side ? [[winterSide, sideX, 97]] : []), ['wreath', door, doorY]],
  };
};

const C = {
  farmhouse: {
    kind: 'bld', W: 112, H: 98, ox: 0, oy: 18, doorTile: 56,
    src: 'raw/farmhouse/g.png',
    remap: { '#c32454': '#b33831', '#e83b3b': '#ea4f36', '#f68181': '#f57d4a', '#ae2334': '#6e2727', '#753c54': '#7a3045' },
    remapIn: [[[48, 92, 22, 15], { '#f57d4a': '#e6904e', '#ea4f36': '#cd683d', '#b33831': '#9e4539', '#6e2727': '#7a3045' }]],
    doorX: 58,
    glass: [[16, 66, 18, 18], [82, 66, 18, 18], [50, 46, 16, 14]],
    glassMap: { '#313638': 1, '#9babb2': 2 },
    glassKey: ['#323353', '#484a77', '#8fd3ff'],
    roof: [[0, 0, 116, 62]],
    roofExclude: [[78, 0, 14, 22]],
    decor: {
      '0': [['tulips_red', 36, 97], ['tulips_yellow', 77, 97]],
      '2': [['pumpkins', 36, 97], ['pumpkins2', 78, 97]],
      '3': [['wreath', 56, 79]],
    },
  },
  greenhouse: {
    kind: 'bld', W: 176, H: 50, ox: 0, oy: 18, seasons: [1],
    src: 'raw/greenhouse/a.png',
    erase: [[0, 54, 252, 4], [0, 53, 12, 1], [245, 53, 7, 1]],
    remapPre: [[[12, 53, 233, 1], { '#676633': '#9e4539', '#a2a947': '#9e4539', '#91db69': '#9e4539', '#4c3e24': '#9e4539', '#cd683d': '#9e4539' }]],
    fill: [[12, 54, 233, 1, '#2e222f']],
    cutX: [[141, 202]],
    states: { '1': {}, '0': { src: 'raw/greenhouse/broken1.png', erase: [], remapPre: [], fill: [], cutX: null } },
  },
  store: bld(8, 6, { src: 'raw/store/e1.png', doorX: 65, roofCover: 0.99, remapIn: [[[0, 0, 122, 31], { '#f57d4a': '#ed8099', '#ea4f36': '#cf657f', '#b33831': '#a24b6f', '#9e4539': '#a24b6f', '#6e2727': '#753c54', '#7a3045': '#753c54', '#ae2334': '#a24b6f', '#cd683d': '#cf657f' }]], glass: [[26, 35, 11, 11], [86, 35, 10, 11], [15, 68, 35, 19], [60, 68, 14, 18]] }),
  inn: bld(9, 6, { src: 'raw/inn/e1.png', doorX: 71, roofCover: 0.99, roofExclude: [[114, 0, 18, 26]], glass: [[27, 48, 12, 12], [104, 48, 11, 12], [24, 83, 13, 12], [105, 83, 13, 13]], glassColors: undefined, glassMap: WARM }),
  smithy: bld(7, 6, { src: 'raw/smithy/e1.png', doorX: 56, roofExclude: [[78, 0, 18, 30]], glass: [[53, 49, 6, 7], [18, 72, 10, 11]] }),
  carpenter: bld(8, 6, { src: 'raw/carpenter/e2.png', doorX: 64, dx: -4, glass: [[61, 47, 6, 8], [21, 74, 11, 11], [96, 74, 11, 12]] }),
  workshop: bld(8, 6, { src: 'raw/workshop/e1.png', doorX: 66, dx: -2, paint: [[13, 67, 42, 4, '#6e2727']], glass: [[26, 40, 11, 11], [89, 40, 11, 11], [16, 76, 36, 21]] }),
  clinic: bld(7, 5, { src: 'raw/clinic/e1.png', doorX: 56, glass: [[17, 56, 12, 12], [83, 56, 13, 12]] }),
  library: bld(8, 6, { src: 'raw/library/e2.png', doorX: 64, dx: -3, glass: [[23, 40, 9, 16], [59, 40, 9, 16], [95, 40, 9, 16], [23, 75, 9, 17], [95, 75, 9, 17], [60, 78, 11, 16]] }),
  mayor_house: bld(8, 6, { src: 'raw/mayor/e1.png', doorX: 63, dx: -5, roofY: 27, glass: [[22, 35, 11, 16], [59, 35, 10, 13], [95, 35, 11, 16], [22, 67, 10, 18], [95, 67, 11, 18], [59, 70, 9, 13]] }),
  ranch: bld(9, 6, { src: 'raw/ranch/e2.png', doorX: 69, roofCover: 0.995, remapIn: [[[0, 0, 114, 44], { '#f57d4a': '#ea4f36', '#ea4f36': '#b33831', '#b33831': '#6e2727', '#6e2727': '#45293f' }], [[132, 0, 10, 44], { '#f57d4a': '#ea4f36', '#ea4f36': '#b33831', '#b33831': '#6e2727', '#6e2727': '#45293f' }]], roofY: 46, roofExclude: [[114, 0, 18, 26]], paint: [[46, 53, 50, 5, '#6e2727']], glass: [[27, 48, 12, 12], [104, 48, 11, 12], [24, 82, 13, 13], [105, 82, 13, 10]], glassColors: undefined, glassMap: WARM }),
  home_ines: bld(6, 5, { src: 'raw/cottage/c.png', doorX: 65, dx: 4, roofExclude: [[0, 0, 18, 24]], glass: [[17, 72, 15, 6]], decor: homeDecor(60, 77, 'bush') }),
  home_sable: bld(6, 5, { src: 'raw/sable/e1.png', doorX: 67, dx: 4, roofExclude: [[0, 0, 18, 24]], glass: [[19, 71, 15, 6]], decor: homeDecor(60, 77, 'barrel', 90) }),
  home_hazel: bld(6, 5, { src: 'raw/hazel/e1.png', doorX: 68, dx: 4, snowSplit: [0.15, 0.45], erase: [[74, 0, 22, 12]], roofExclude: [[0, 0, 18, 24]], glass: [[18, 73, 15, 6]], decor: homeDecor(60, 77, 'rosebush') }),
  house_a: bld(6, 5, { src: 'raw/house_a/e1.png', doorX: 67, dx: 4, roofExclude: [[0, 0, 18, 24]], glass: [[18, 64, 15, 6]], decor: homeDecor(60, 79, 'woodpile', 88, 41) }),
  house_b: bld(6, 5, { src: 'raw/house_b/e1.png', doorX: 68, dx: 4, roofExclude: [[0, 0, 18, 24]], glass: [[18, 72, 15, 6]], glassKey: ['#0b5e65', '#0b8a8f', '#8ff8e2'], decor: homeDecor(60, 77, 'bush') }),
  fisher_hut: bld(6, 5, { src: 'raw/fisher/e1.png', doorX: 63, dx: 4, roof: null, snowCap: 3, glass: [[20, 65, 16, 15]], props: [['oars', 89, 97]] }),
  hermit_hut: bld(6, 5, { src: 'raw/hermit/e1.png', doorX: 66, dx: 4, remapIn: [[[12, 0, 14, 32], { '#4d65b4': '#966c6c', '#484a77': '#625565', '#323353': '#3e3546' }]], glass: [[16, 56, 12, 14]], roof: null, snowCap: 4, decor: homeDecor(60, 80, 'fern', 86) }),
  clocktower: bld(5, 6, { src: 'raw/clocktower/e3.png', doorX: 39, roofExclude: [[30, 0, 18, 14]], states: { '1': {}, '0': { src: 'raw/clocktower/broken1.png' } } }),
  mine: bld(5, 4, { src: 'raw/mine/e1.png', doorX: 40, glassColors: undefined, roof: null, snowCap: 2 }),
  coop_1: st('coop_1', 4, 3, 18, { src: 'raw/coop/e1.png', glass: [[9, 28, 9, 9], [42, 28, 9, 9]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  coop_2: st('coop_2', 4, 3, 20, { src: 'raw/coop/e2.png', glass: [[8, 28, 8, 9], [21, 28, 10, 8], [35, 28, 9, 8], [8, 43, 8, 7], [35, 43, 9, 9]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  coop_3: st('coop_3', 4, 3, 22, { src: 'raw/coop/e3.png', roof: null, snowCap: 3, glass: [[8, 46, 8, 9], [31, 46, 7, 9]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  barn_1: st('barn_1', 5, 3, 22, { src: 'raw/barn/e1.png', roof: null, snowCap: 3, glass: [[35, 17, 8, 7], [11, 50, 5, 6], [62, 50, 5, 6]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  barn_2: st('barn_2', 5, 3, 24, { src: 'raw/barn/e2.png', roof: null, snowCap: 3, glass: [[33, 23, 8, 7], [10, 56, 5, 5]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  barn_3: st('barn_3', 5, 3, 26, { src: 'raw/barn/e3.png', roof: null, snowCap: 3, glass: [[11, 56, 6, 6], [61, 56, 6, 6]], glassMap: { '#2e222f': 1 }, glassKey: ['#323353', '#484a77', '#8fd3ff'], glint: true }),
  silo: st('silo', 2, 2, 28, { src: 'raw/silo/a.png', erase: [[22, 58, 8, 8]], roof: null, snowCap: 3 }),
  well: st('well', 2, 2, 8, { src: 'raw/well/e1.png', roof: null, snowCap: 2 }),
  freight_depot: st('freight_depot', 3, 2, 20, { src: 'raw/depot/e1.png' }),
  shipping_crate: st('shipping_crate', 1, 1, 3, { src: 'raw/crate/hand.png', roof: null, seasons: [1] }),
  // greenhouse glass roof panes, tiled by the renderer over the greenhouse interior
  _extra: [
    { match: 'gh:glass:1', file: 'raw/ghglass/intact.png', place: 'none', frame: [16, 16], origin: [0, 0], keepStrays: true },
    { match: 'gh:glass:0', file: 'raw/ghglass/broken.png', place: 'none', frame: [16, 16], origin: [0, 0], keepStrays: true },
  ],
  cart: { kind: 'cart', W: 48, H: 40, ox: 0, oy: 24, src: 'raw/cart/e1.png', seasons: [1], roof: null },
};
for (const v of Object.values(C)) for (const f of Object.keys(v)) if (v[f] === undefined) delete v[f];
// keep pending ones out until their art exists
for (const [k, v] of Object.entries(C)) {
  const srcs = [v.src, ...Object.values(v.states ?? {}).map((s) => s.src)].filter(Boolean);
  const missing = srcs.filter((s) => !fs.existsSync('art/buildings/' + s));
  if (missing.length) { console.log('skip (no art yet):', k, missing.join(' ')); delete C[k]; }
}
fs.writeFileSync('art/buildings/buildings.json', JSON.stringify(C, null, 1));
console.log('wrote', Object.keys(C).length, 'entries');
