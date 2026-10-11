// Belt-size item icons, made at runtime from each item's imported 16 px icon (src/art/icons.*).
import { C, DARK, LIGHT, PALETTE_RGB } from '../../data/palette';
import { ITEM_BY_ID } from '../../data/items';
import { defSpriteFamily, sprite } from '../atlas';
import { PixBuf } from './pixbuf';

/** Nearest palette index for an RGB color (icons are drawn from the palette, so it's exact). */
function paletteIndex(r: number, g: number, b: number): number {
  let best = 0, bestD = Infinity;
  PALETTE_RGB.forEach(([pr, pg, pb], i) => {
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

export function registerBeltIcons() {
  // belt-size icons: ib:<itemId>, the icon's colored fill halved exactly (2x2 -> 1) and
  // re-outlined, so items on belts stay on the pixel grid. Outline pixels don't vote:
  // icons are mostly 1px ink lines, which would otherwise swallow every block. A block
  // with at least two opaque pixels keeps its most common fill color.
  defSpriteFamily('ib:', (name) => {
    if (!ITEM_BY_ID.has(name.slice(3))) return null;
    return {
      w: 10, h: 10,
      draw: (ctx) => {
        const s = sprite('i:' + name.slice(3));
        const src = s.img.getContext('2d')!.getImageData(s.x, s.y, 16, 16).data;
        const fill: number[] = new Array(64).fill(-1);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const votes = new Map<number, number>();
            let opaque = 0;
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
              const i = ((y * 2 + dy) * 16 + x * 2 + dx) * 4;
              if (src[i + 3] < 128) continue;
              opaque++;
              const c = paletteIndex(src[i], src[i + 1], src[i + 2]);
              if (c !== C.ink) votes.set(c, (votes.get(c) ?? 0) + 1);
            }
            let best = -1, bestN = 0;
            for (const [c, n] of votes) if (n > bestN) [best, bestN] = [c, n];
            if (opaque >= 2 && best >= 0) fill[y * 8 + x] = best;
          }
        // light top-left edge, dark bottom-right edge: volume, so the item reads against the belt
        const pb = new PixBuf(10, 10);
        const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < 8 && y < 8 ? fill[y * 8 + x] : -1);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const c = at(x, y);
            if (c < 0) continue;
            const shade = at(x + 1, y) < 0 || at(x, y + 1) < 0 ? DARK[c] : at(x - 1, y) < 0 || at(x, y - 1) < 0 ? LIGHT[c] : c;
            pb.set(x + 1, y + 1, shade);
          }
        // outline in the material's own dark shade on the lit top/left, plum only on the
        // bottom/right, so neighbors on a full belt don't merge into one dark band
        for (let y = 0; y < 10; y++)
          for (let x = 0; x < 10; x++) {
            if (at(x - 1, y - 1) >= 0) continue;
            const below = at(x - 1, y), right = at(x, y - 1);
            const above = at(x - 1, y - 2), left = at(x - 2, y - 1);
            if (above >= 0 || left >= 0) pb.set(x, y, C.ink);
            else if (below >= 0 || right >= 0) pb.set(x, y, DARK[DARK[below >= 0 ? below : right]]);
          }
        pb.drawTo(ctx);
      },
    };
  });
}
