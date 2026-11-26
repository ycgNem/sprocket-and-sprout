// Seed packets (2.1.2, the critic: "the seed packets all look alike"). Every crop's seed icon is the
// same upright paper packet, told apart by what is on it: a fold across the top in the crop's own
// colour and the crop's item icon printed on the face, shrunk from the 16 px icon by area vote (ink
// counts for less than colour, so a 2 px stem keeps its green). The outline of the picture is kept
// where it separates the crop from the paper and dropped where the crop is dark enough to stand on
// its own, which leaves more of the 10x10 face for colour.
//
// picks.json: "<crop>_seed": { "packet": "<crop item id>" } with options
//     band  ["#light", "#shade"]   the fold's colours (default: the crop's strongest colour and the
//                                  next shade down among the icon's own colours)
//     face  "cream" | "tan" | "sky"  the paper (default: cream; tan when the crop is pale)
//     fit   n                      the picture's box, n x n pixels (default 10)
//     nudge [dx, dy]               move the picture on the face
// art/icons/tools/build.mjs calls packet() after the crop's own icon is resolved.
import { PAL, blank, bbox, lab, rgbOf } from '../../../scripts/lib/pixel.mjs';
import { px, put, INK, lum } from './lib.mjs';

type Img = { w: number; h: number; data: Uint8Array };
export type PacketSpec = { packet: string; band?: [string, string]; face?: keyof typeof FACES; fit?: number; nudge?: [number, number]; bare?: boolean };

/** the paper: face, its shaded right and bottom edge */
const FACES = {
  cream: ['#fdcbb0', '#fbb954'],
  tan: ['#ab947a', '#966c6c'],
  sky: ['#8fd3ff', '#4d9be6'],
} as const;

const chroma = (h: string) => { const [, a, b] = lab(rgbOf(h)); return Math.hypot(a, b); };

/** the crop's strongest colour (area x chroma) and the next shade down that the icon also uses */
export function bandOf(crop: Img): [string, string] {
  const n = new Map<string, number>();
  for (let y = 0; y < crop.h; y++) for (let x = 0; x < crop.w; x++) { const c = px(crop, x, y); if (c && c !== INK) n.set(c, (n.get(c) ?? 0) + 1); }
  const cols = [...n.keys()];
  if (!cols.length) return ['#fbb954', '#e6904e'];
  // leaves are on nearly every crop: a green counts for less, so the fold takes the fruit's colour
  const leafy = (c: string) => { const [, a, b] = lab(rgbOf(c)); return a < -12 && b > -6; };
  const score = (c: string) => n.get(c)! * (8 + chroma(c)) * (lum(c) > 36 ? 1 : 0.15) * (leafy(c) ? 0.3 : 1);
  const main = cols.sort((a, b) => score(b) - score(a))[0];
  // the shade: the icon's colour nearest in hue that is clearly darker; else the palette's
  const [, a0, b0] = lab(rgbOf(main));
  const darker = (list: string[]) => list.filter((c) => lum(main) - lum(c) > 8 && lum(c) > 18)
    .sort((p, q) => { const d = (c: string) => { const [, a, b] = lab(rgbOf(c)); return Math.hypot(a - a0, b - b0) + Math.abs(lum(main) - lum(c) - 18) * 0.5; }; return d(p) - d(q); })[0];
  return [main, darker(cols) ?? darker(PAL) ?? INK];
}

/** shrink by area vote: each target pixel takes the colour covering most of its source box */
function shrink(src: Img, box: number): Img {
  const b = bbox(src);
  if (!b) return blank(1, 1);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const s = Math.min(1, box / w, box / h);
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  const out = blank(tw, th);
  const N = 6; // sub-samples per axis
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const votes = new Map<string, number>();
    let clear = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const sx = b.x0 + Math.floor(((tx + (i + 0.5) / N) * w) / tw), sy = b.y0 + Math.floor(((ty + (j + 0.5) / N) * h) / th);
      const c = px(src, sx, sy);
      if (!c) clear++;
      else votes.set(c, (votes.get(c) ?? 0) + (c === INK ? 0.55 : 1));
    }
    if (clear > N * N * 0.5 || !votes.size) continue;
    const best = [...votes.entries()].sort((p, q) => q[1] - p[1] || chroma(q[0]) - chroma(p[0]))[0][0];
    put(out, tx, ty, best);
  }
  return out;
}

/** the icon without its outer outline: ink pixels on the silhouette's edge are dropped */
function bare(src: Img): Img {
  const out = { w: src.w, h: src.h, data: new Uint8Array(src.data) };
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (px(src, x, y) !== INK) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !px(src, x + dx, y + dy))) put(out, x, y, null);
  }
  return out;
}

/** a round, solid crop (a tomato, a pumpkin) fills its box: it reads without its outline */
export function bulky(src: Img): boolean {
  const b = bbox(src);
  if (!b) return false;
  let n = 0;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (px(src, x, y)) n++;
  return n / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)) > FILL;
}
const FILL = +(process.env.PACKET_FILL ?? 0.72);

export function packet(crop: Img, spec: PacketSpec): Img {
  const out = blank(16, 16);
  const pale = (() => { let n = 0, l = 0; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = px(crop, x, y); if (c && c !== INK) { n++; l += lum(c); } } return n ? l / n > 74 : false; })();
  const [face, shade] = FACES[spec.face ?? (pale ? 'tan' : 'cream')];
  const [band, bandShade] = spec.band ?? bandOf(crop);
  for (const c of [face, shade, band, bandShade]) if (!PAL.includes(c)) throw new Error('packet: off-palette ' + c);
  // the packet: outline x 2..13, y 1..14, corners open
  for (let y = 1; y <= 14; y++) for (let x = 2; x <= 13; x++) {
    const edge = x === 2 || x === 13 || y === 1 || y === 14;
    const corner = (x === 2 || x === 13) && (y === 1 || y === 14);
    if (corner) continue;
    if (edge) put(out, x, y, INK);
    else if (y === 2) put(out, x, y, band);
    else if (y === 3) put(out, x, y, bandShade);
    else put(out, x, y, x === 12 || y === 13 ? shade : face);
  }
  // a notch of light on the fold's left end, the paper's lit corner
  put(out, 3, 4, face);
  // the picture, centred on the face (x 3..12, y 4..13)
  const pic = shrink(spec.bare ?? bulky(crop) ? bare(crop) : crop, spec.fit ?? 10);
  const ox = 3 + Math.floor((10 - pic.w) / 2) + (spec.nudge?.[0] ?? 0), oy = 4 + Math.floor((10 - pic.h) / 2) + (spec.nudge?.[1] ?? 0);
  for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
    const c = px(pic, x, y);
    if (!c) continue;
    const X = ox + x, Y = oy + y;
    if (X < 3 || X > 12 || Y < 4 || Y > 13) continue;
    put(out, X, Y, c);
  }
  return out;
}
