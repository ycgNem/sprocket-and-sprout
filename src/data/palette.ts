// The game palette: Resurrect 64 by Kerrie Lake (https://lospec.com/palette-list/resurrect-64).
// Every pixel of art comes from this list. Rules and material ramps: STYLE.md.

export const PALETTE = [
  // 0-4 warm neutrals (plum-black up to taupe)
  '#2e222f', '#3e3546', '#625565', '#966c6c', '#ab947a',
  // 5-9 cool neutrals (mauve up to white)
  '#694f62', '#7f708a', '#9babb2', '#c7dcd0', '#ffffff',
  // 10-13 reds, 14-15 crimson
  '#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#ae2334', '#e83b3b',
  // 16-18 orange to gold
  '#fb6b1d', '#f79617', '#f9c22b',
  // 19-23 rust to amber (wood, skin, brass shadows)
  '#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954',
  // 24-28 olive to pale yellow
  '#4c3e24', '#676633', '#a2a947', '#d5e04b', '#fbff86',
  // 29-33 greens
  '#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c',
  // 34-38 sage (muted green-grays)
  '#313638', '#374e4a', '#547e64', '#92a984', '#b2ba90',
  // 39-43 teals
  '#0b5e65', '#0b8a8f', '#0eaf9b', '#30e1b9', '#8ff8e2',
  // 44-48 blues
  '#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff',
  // 49-53 purples
  '#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded',
  // 54-57 roses
  '#753c54', '#a24b6f', '#cf657f', '#ed8099',
  // 58-63 magenta to peach
  '#831c5d', '#c32454', '#f04f78', '#f68181', '#fca790', '#fdcbb0',
] as const;

/** Resurrect 64's own ramps, dark to light (Lospec order). */
export const RAMPS: readonly number[][] = [
  [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13], [14, 15], [16, 17, 18], [19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28], [29, 30, 31, 32, 33], [34, 35, 36, 37, 38], [39, 40, 41, 42, 43],
  [44, 45, 46, 47, 48], [49, 50, 51, 52, 53], [54, 55, 56, 57], [58, 59, 60, 61, 62, 63],
];

/**
 * The 1.0 palette's 32 color names, now aliases to their nearest Resurrect color (picked by
 * CIELAB distance, then adjusted by hand so no two names share a color and every DARK/LIGHT
 * step still goes darker/lighter). They stay until the procedural art is gone.
 */
export enum C {
  ink = 0, plum = 1, wine = 54, brick = 11, terracotta = 12, apricot = 22, amber = 23, butter = 63, cream = 9,
  bark = 49, walnut = 24, oak = 3, tan = 4, pine = 34, moss = 25, grass = 30, leaf = 32, lime = 33,
  deepsea = 44, river = 46, sky = 47, aqua = 48, frost = 8, slate = 2, stone = 6, pebble = 7, copper = 21, brass = 17,
  rose = 56, blush = 57, violet = 50, lavender = 51,
}

/** Old (1.0, 32-color) palette index -> Resurrect index, in the old order. Used by the save migration. */
export const LEGACY32: readonly number[] = [
  C.ink, C.plum, C.wine, C.brick, C.terracotta, C.apricot, C.amber, C.butter, C.cream,
  C.bark, C.walnut, C.oak, C.tan, C.pine, C.moss, C.grass, C.leaf, C.lime,
  C.deepsea, C.river, C.sky, C.aqua, C.frost, C.slate, C.stone, C.pebble, C.copper, C.brass,
  C.rose, C.blush, C.violet, C.lavender,
];

export const PALETTE_RGB: [number, number, number][] = PALETTE.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

export function col(i: number): string {
  return PALETTE[i];
}

export function rgba(i: number, a: number): string {
  const [r, g, b] = PALETTE_RGB[i];
  return `rgba(${r},${g},${b},${a})`;
}

/** For each palette index, a darker palette neighbor (for shading). */
export const DARK: number[] = PALETTE.map((_, i) => {
  const r = RAMPS.find((r) => r.includes(i))!;
  const k = r.indexOf(i);
  return k > 0 ? r[k - 1] : 0;
});
/** For each palette index, a lighter palette neighbor (for highlights). */
export const LIGHT: number[] = PALETTE.map((_, i) => {
  const r = RAMPS.find((r) => r.includes(i))!;
  const k = r.indexOf(i);
  return k < r.length - 1 ? r[k + 1] : 9;
});
// The procedural art was shaded with the 1.0 neighbor tables; keep those steps for the aliased names.
{
  const OLD_DARK = [0, 0, 1, 2, 3, 4, 27, 6, 25, 0, 9, 10, 11, 0, 13, 14, 15, 16, 0, 18, 19, 20, 21, 1, 23, 24, 3, 26, 2, 28, 1, 30];
  const OLD_LIGHT = [1, 2, 3, 4, 5, 6, 7, 8, 8, 10, 11, 12, 7, 14, 15, 16, 17, 8, 19, 20, 21, 22, 8, 24, 25, 8, 5, 6, 29, 8, 31, 8];
  LEGACY32.forEach((n, i) => {
    DARK[n] = LEGACY32[OLD_DARK[i]];
    LIGHT[n] = LEGACY32[OLD_LIGHT[i]];
  });
}

/**
 * Three-shade ramps [shadow, base, light] for every color the look system offers (hair, shirt,
 * pants). Imported character sheets are drawn with one look's ramps as key colors and recolored
 * to another look's ramps at runtime (see `lookSwap` in src/render/art/sheets.ts).
 */
export const RAMP3: Record<number, [number, number, number]> = {
  [C.ink]: [0, 1, 2],
  [C.bark]: [0, 49, 54],
  [C.walnut]: [49, 24, 20],
  [C.oak]: [54, 3, 4],
  [C.amber]: [22, 23, 28],
  [C.brick]: [10, 11, 12],
  [C.pebble]: [6, 7, 8],
  [C.rose]: [55, 56, 57],
  [C.violet]: [49, 50, 51],
  [C.river]: [45, 46, 47],
  [C.moss]: [35, 25, 26],
  [C.cream]: [7, 8, 9],
  [C.sky]: [46, 47, 48],
  [C.terracotta]: [11, 12, 13],
  [C.slate]: [1, 2, 6],
  [C.leaf]: [30, 32, 33],
  [C.blush]: [56, 57, 62],
  [C.deepsea]: [0, 44, 45],
  [C.wine]: [49, 54, 55],
  [C.tan]: [3, 4, 38],
};

/**
 * Skin tones. The look system stores skin as one of the old names (cream … bark, light to dark);
 * each maps to a Resurrect skin ramp [shadow, base, light].
 */
export const SKIN3: Record<number, [number, number, number]> = {
  [C.cream]: [62, 63, 9],
  [C.blush]: [61, 62, 63],
  [C.apricot]: [21, 22, 62],
  [C.tan]: [20, 21, 22],
  [C.oak]: [19, 20, 21],
  [C.walnut]: [49, 19, 20],
  [C.bark]: [0, 49, 19],
};

export function ramp3(c: number): [number, number, number] {
  return RAMP3[c] ?? [DARK[c], c, LIGHT[c]];
}
export function skin3(c: number): [number, number, number] {
  return SKIN3[c] ?? ramp3(c);
}
