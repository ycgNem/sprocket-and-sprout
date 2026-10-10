// Pixel-art mouse cursors applied as CSS cursors (zero input lag, always visible).
// Each shape is baked once per scale into a PNG data URL; 'auto' stays as the fallback
// so the system cursor shows if the browser refuses the image (e.g. size limits).
import { C, PALETTE } from '../data/palette';

export type CursorKind = 'arrow' | 'hand' | 'grab' | 'build' | 'none';

const COLORS: Record<string, string> = {
  o: PALETTE[C.ink], // outline
  c: PALETTE[C.cream],
  a: PALETTE[C.brass],
  y: PALETTE[C.amber],
  w: PALETTE[C.walnut],
  s: PALETTE[C.plum], // shadow
};

// '.' is transparent. All rows of a shape must be the same width.
const SHAPES: Record<Exclude<CursorKind, 'none'>, { rows: string[]; hot: [number, number] }> = {
  arrow: {
    hot: [0, 0],
    rows: [
      'o..........',
      'oo.........',
      'oco........',
      'ocao.......',
      'ocaao......',
      'ocaaao.....',
      'ocaaaao....',
      'ocaaaaao...',
      'ocaaaaaao..',
      'ocaaaaaaao.',
      'ocaaaoooooo',
      'ocaoyao....',
      'ocoocyao...',
      'oo..oyao...',
      'o....oyao..',
      '.....oyao..',
      '......oo...',
    ],
  },
  hand: {
    hot: [5, 0],
    rows: [
      '....oo.......',
      '...occo......',
      '...ocao......',
      '...ocao......',
      '...ocaooo....',
      '...ocaocaoo..',
      '.oo.ocaocaoco',
      'occooccaaaoao',
      'oacocaaaaaaao',
      '.oaaaaaaaaaao',
      '..oaaaaaaaaso',
      '..oyaaaaaaaso',
      '...oyaaaaaso.',
      '....oyaaaso..',
      '....oooooo...',
    ],
  },
  grab: {
    hot: [6, 6],
    rows: [
      '.............',
      '.............',
      '....oo.oo....',
      '...occoccooo.',
      '..ooaaoaaocao',
      '.occaaaaaaaao',
      '.oaaaaaaaaaao',
      '.oaaaaaaaaaso',
      '..oyaaaaaaaso',
      '..oyaaaaaaso.',
      '...oyaaaaso..',
      '....oooooo...',
    ],
  },
  build: {
    hot: [0, 0],
    rows: [
      'o...........',
      'oo..........',
      'oco.........',
      'ocao........',
      'ocaao.......',
      'ocaaao......',
      'ocaaaao.....',
      'ocaaoooo....',
      'ocao..oyo.oo',
      'oco..oyyyoyo',
      'oo...oyoyyyo',
      'o....ooywyyo',
      '.....oyyyoyo',
      '.....oyoyyyo',
      '......oyo.oo',
      '.......o....',
    ],
  },
};

const cache = new Map<string, string>();

function bake(kind: Exclude<CursorKind, 'none'>, scale: number): string {
  const id = kind + ':' + scale;
  const hit = cache.get(id);
  if (hit) return hit;
  const sh = SHAPES[kind];
  const w = sh.rows[0].length, h = sh.rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d')!;
  sh.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = COLORS[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  const css = `url(${c.toDataURL()}) ${sh.hot[0] * scale} ${sh.hot[1] * scale}, auto`;
  cache.set(id, css);
  return css;
}

export class PixelCursor {
  private current = '';
  constructor(private el: HTMLElement) {}

  /** `pixelScale` is CSS pixels per cursor pixel. Pass enabled=false for the system cursor. */
  set(kind: CursorKind, pixelScale: number, enabled = true) {
    let css: string;
    if (!enabled) css = kind === 'hand' ? 'pointer' : kind === 'grab' ? 'grabbing' : 'default';
    else if (kind === 'none') css = 'none';
    else css = bake(kind, Math.max(1, Math.min(2, Math.round(pixelScale))));
    if (css === this.current) return;
    this.current = css;
    this.el.style.cursor = css;
  }
}
