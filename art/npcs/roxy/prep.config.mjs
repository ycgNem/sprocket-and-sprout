// Roxy Vane prep config (read by prep.mjs). Character: PixelLab v3 2c0ea7f2 (pixellab.json).
// Rebuild: node art/npcs/roxy/prep.mjs && node scripts/art-import.mjs art/npcs/roxy/recipe.json
const pal = [
  // outline and plum shadows
  '#2e222f', '#45293f', '#694f62',
  // wine-red hair and the oxblood corset
  '#7a3045', '#ae2334',
  // lips, blush
  '#b33831', '#e83b3b', '#f68181',
  // brown leather and boots (wood ramp)
  '#6e2727', '#9e4539', '#cd683d',
  // skin (apricot: #cd683d #e6904e #fca790)
  '#e6904e', '#fca790',
  // fleece collar, cream ramp
  '#966c6c', '#ab947a', '#fdcbb0', '#ffffff',
  // brass goggles, buckles, earrings
  '#f79617', '#f9c22b', '#fbb954',
  // goggle lenses
  '#484a77', '#4d9be6', '#8fd3ff',
  // wrench, small iron bits
  '#625565', '#7f708a', '#9babb2', '#c7dcd0',
];

// big source clusters, by material (the v3 character, the skeleton walk and the v3 idle share them)
const srcMap = {
  // outline / near black
  '#000000': '#2e222f', '#010005': '#2e222f', '#0a010b': '#2e222f', '#0c0505': '#2e222f', '#000804': '#2e222f',
  '#18081d': '#2e222f', '#22021a': '#2e222f', '#251011': '#2e222f',
  // hair: shadow, mid, light
  '#2e031f': '#45293f', '#330a16': '#45293f', '#400321': '#45293f', '#510a25': '#7a3045',
  '#73132a': '#7a3045', '#841c2f': '#ae2334', '#8c1b35': '#ae2334', '#9a203a': '#ae2334', '#a52d46': '#ae2334',
  // trousers (plum)
  '#28102b': '#45293f', '#381d37': '#45293f', '#422440': '#694f62', '#4d2f4a': '#694f62',
  // jacket and boots (brown leather)
  '#461c14': '#6e2727', '#612e1a': '#6e2727', '#662114': '#6e2727', '#7e3517': '#9e4539', '#94491e': '#9e4539',
  '#af4e2e': '#cd683d', '#a75d36': '#cd683d',
  // skin
  '#d26948': '#cd683d', '#df7f55': '#cd683d', '#c87e54': '#cd683d', '#ea8f5e': '#e6904e', '#f3a972': '#e6904e',
  '#d08d61': '#e6904e', '#fa9a6e': '#fca790', '#fcc792': '#fca790', '#f9a15f': '#e6904e',
  // fleece collar and cuffs (cream)
  '#a28064': '#966c6c', '#b18f6f': '#966c6c', '#654537': '#694f62', '#c1a07a': '#ab947a', '#d4b086': '#ab947a',
  '#e0c59c': '#ab947a', '#ead3b0': '#fdcbb0', '#f6e3bd': '#fdcbb0', '#fcedcf': '#fdcbb0', '#e9b96b': '#fbb954',
};

const map = {};

const frames = [];
const dirs = { up: 'north', right: 'east', down: 'south' };
for (const [row, d] of Object.entries(dirs)) {
  frames.push({ out: `${row}/stand`, src: `rotations/${d}.png` });
  for (let i = 0; i < 4; i++) frames.push({ out: `${row}/walk${i}`, src: `walk/${d}/${i}.png`, dir: row, lock: true });
  for (let i = 0; i < 8; i++) frames.push({ out: `${row}/idle${i}`, src: `idle/${d}/${i}.png`, dir: row, lock: true });
}
// greeting toward the camera (south only; the recipe repeats the stand pose in the other rows):
// hand up, wave with a wink, fingertips to her lips, arm out sending the kiss. Not head-locked: the
// face is part of the gesture.
[2, 3, 5, 1].forEach((src, i) => frames.push({ out: `down/greet${i}`, src: `greet/south/${src}.png` }));

export default {
  canvas: [48, 48],
  anchor: [24, 46],
  kL: 1,
  pal,
  srcMap,
  map,
  // head rects (goggles to chin) in the placed stand poses; the hanging hair outside them still moves
  heads: {
    down: { from: 'down/stand', band: [15, 9, 32, 23] },
    right: { from: 'right/stand', band: [16, 9, 31, 21] },
    up: { from: 'up/stand', band: [16, 9, 33, 18] },
  },
  frames,
};
