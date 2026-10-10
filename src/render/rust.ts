// The rusted look of the keeper's derelict machines (ROADMAP.md 6.0): any sprite name prefixed
// with `rust:` is that sprite recoloured by brightness into a rust ramp of Resurrect 64 colours,
// with a few orange flakes. The outline stays plum, so it reads as the same machine, rusted.
import { PALETTE_RGB } from '../data/palette';
import { defSpriteFamily, sprite } from './atlas';

/** brightness bands -> palette index: plum-black, dark plum-brown, rust red, rust, dusty rose, taupe */
const BANDS: [number, number][] = [[45, 0], [80, 49], [110, 19], [145, 20], [185, 3], [256, 4]];
const FLAKE = 21;

defSpriteFamily('rust:', (name) => {
  const base = sprite(name.slice(5));
  return {
    w: base.w, h: base.h, ox: base.ox, oy: base.oy,
    draw: (ctx) => {
      ctx.drawImage(base.img, base.x, base.y, base.w, base.h, 0, 0, base.w, base.h);
      const id = ctx.getImageData(0, 0, base.w, base.h);
      const d = id.data;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        if (!d[i + 3]) continue;
        const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
        let c = BANDS.find(([max]) => lum < max)![1];
        // orange flakes on the middle tones, the same pixels every time
        if ((c === 20 || c === 3) && ((p * 2654435761) >>> 0) % 9 === 0) c = FLAKE;
        const [r, gg, b] = PALETTE_RGB[c];
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b;
      }
      ctx.putImageData(id, 0, 0);
    },
  };
});

/** the rusted version of a sprite name */
export const rusty = (name: string) => 'rust:' + name;
