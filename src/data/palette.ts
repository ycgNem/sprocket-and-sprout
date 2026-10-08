// The game's fixed 32-color palette. Every pixel of art comes from this list.
// Warm, slightly desaturated tones: wood, brass, moss, dusk.

export const PALETTE = [
  '#1a1220', //  0 ink        near-black plum (outlines)
  '#3b2a3a', //  1 plum       deep shadow
  '#5e3b46', //  2 wine
  '#8a4b4b', //  3 brick
  '#c0624f', //  4 terracotta
  '#e98b5a', //  5 apricot
  '#f4b860', //  6 amber
  '#fbe5a0', //  7 butter
  '#fff7e4', //  8 cream      highlights / text
  '#4a2e22', //  9 bark       dark wood
  '#6e4630', // 10 walnut
  '#9a6a45', // 11 oak
  '#c99a68', // 12 tan
  '#2c3a2a', // 13 pine       dark green
  '#3e5a34', // 14 moss
  '#5d8a3c', // 15 grass
  '#8cbf4e', // 16 leaf
  '#c4e07a', // 17 lime
  '#1f3349', // 18 deep sea
  '#2f5d7c', // 19 river
  '#4a90a8', // 20 sky
  '#86c6c9', // 21 aqua
  '#d0ecea', // 22 frost
  '#5a4e6e', // 23 slate
  '#8a7f8e', // 24 stone
  '#b8afb0', // 25 pebble
  '#a8582e', // 26 copper
  '#d9a440', // 27 brass
  '#d14b6a', // 28 rose
  '#f08fa8', // 29 blush
  '#7a4a8c', // 30 plum violet
  '#b37ac4', // 31 lavender
] as const;

export enum C {
  ink, plum, wine, brick, terracotta, apricot, amber, butter, cream,
  bark, walnut, oak, tan, pine, moss, grass, leaf, lime,
  deepsea, river, sky, aqua, frost, slate, stone, pebble, copper, brass,
  rose, blush, violet, lavender,
}

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
export const DARK: number[] = [0, 0, 1, 2, 3, 4, 27, 6, 25, 1, 9, 10, 11, 1, 13, 14, 15, 16, 0, 18, 19, 20, 21, 1, 23, 24, 3, 26, 2, 28, 1, 30];
/** For each palette index, a lighter palette neighbor (for highlights). */
export const LIGHT: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 8, 10, 11, 12, 7, 14, 15, 16, 17, 8, 19, 20, 21, 22, 8, 24, 25, 8, 5, 6, 29, 8, 31, 8];
