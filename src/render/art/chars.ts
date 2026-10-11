// The looks characters wear (the imported character sheets recolor their frames by them, the
// player's from the new-game choices: src/render/art/sheets.ts), and the soft round shadow under
// everything that stands, drawn at any width (STYLE.md).
import type { NPCLook } from '../../data/types';
import { defSpriteFamily } from '../atlas';

const looks = new Map<string, NPCLook>();
export function registerLook(id: string, look: NPCLook) {
  looks.set(id, look);
}
export function getLook(id: string) {
  return looks.get(id);
}

export function registerShadowSprites() {
  // soft round shadow
  defSpriteFamily('shadow:', (name) => {
    const w = +name.split(':')[1];
    return {
      w, h: Math.max(3, Math.round(w / 3)), ox: w / 2, oy: Math.max(3, Math.round(w / 3)) / 2,
      draw: (ctx) => {
        const h = Math.max(3, Math.round(w / 3));
        ctx.fillStyle = 'rgba(46,34,47,0.28)'; // #2e222f at 28 % (STYLE.md)
        for (let y = 0; y < h; y++) {
          const t = 1 - Math.pow((y + 0.5 - h / 2) / (h / 2), 2);
          const ww = Math.round((w / 2) * Math.sqrt(Math.max(0, t)));
          ctx.fillRect(w / 2 - ww, y, ww * 2, 1);
        }
      },
    };
  });
}
