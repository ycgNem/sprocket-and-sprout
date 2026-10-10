// Lesson cards (ROADMAP.md 6.4): two lines and a 24x24 picture, the first time a situation happens.
// Never modal: the card hangs under the Now strip, waits while a window is open, and goes after a
// key (not a movement key) once it has been up a moment, after a click, or by itself. The
// Keeper's Notebook keeps every card seen.
import { C } from '../data/palette';
import { LESSON_BY_ID } from '../data/lessons';
import { drawFit, sprite } from '../render/atlas';
import { drawGlyph } from '../render/glyphs';
import type { PlayScreen } from '../app/play';
import { textWidth, wrapText } from './font';
import type { UI } from './ui';

const W = 236;
/** seconds before a key may dismiss it, and before it leaves by itself */
const MIN_T = 2.5, MAX_T = 16;

export interface LessonQueue {
  q: { id: string; t: number }[];
}

export function queueLesson(play: PlayScreen, id: string) {
  if (!LESSON_BY_ID.has(id) || play.lessons.q.some((l) => l.id === id)) return;
  play.lessons.q.push({ id, t: 0 });
}

/** Draw the front card (if any) at the left column; `dt` ages it unless a window is open. */
export function drawLessonCard(ui: UI, play: PlayScreen, dt: number) {
  const L = play.lessons.q[0];
  if (!L || play.modalOpen || play.g.sleeping) return;
  const def = LESSON_BY_ID.get(L.id)!;
  L.t += dt;
  const input = play.app.input;
  // any key but walking (once it has been read a moment), a click on it, or time
  const move = new Set([...(input.binds.left ?? []), ...(input.binds.right ?? []), ...(input.binds.up ?? []), ...(input.binds.down ?? []), ...(input.binds.run ?? [])]);
  const keyed = L.t > MIN_T && [...input.pressed].some((k) => !move.has(k));
  const x = 4, y = Math.max(4, play.hud.leftY ?? 4);
  const lines = def.text.flatMap((t) => wrapText(t, W - 44));
  const h = Math.max(36, 16 + lines.length * 9);
  const clicked = ui.hover(x, y, W, h) && ui.clicked;
  if (keyed || clicked || L.t > MAX_T) {
    play.lessons.q.shift();
    if (clicked) ui.eat();
    return;
  }
  const a = Math.min(1, L.t * 6, (MAX_T - L.t) * 2);
  ui.ctx.globalAlpha = a;
  ui.panel(x, y, W, h, 'dark', false);
  ui.fill(x, y, W, 1, C.amber);
  // the picture: a sprite in a 24x24 frame, a state glyph on its corner
  ui.fill(x + 5, y + 6, 26, 26, C.ink);
  ui.fill(x + 6, y + 7, 24, 24, C.plum);
  drawFit(ui.ctx, sprite(def.pic), x + 6, y + 7, 24, 24);
  if (def.glyph) drawGlyph(ui.ctx, def.glyph, x + 27, y + 9, ui.time);
  ui.text(def.title, x + 36, y + 4, C.amber);
  const tag = 'Lesson';
  ui.text(tag, x + W - 6 - textWidth(tag), y + 4, C.slate);
  lines.forEach((l, i) => ui.text(l, x + 36, y + 14 + i * 9, C.cream));
  ui.ctx.globalAlpha = 1;
  if (ui.hover(x, y, W, h)) {
    ui.block(x, y, W, h);
    ui.tip([{ text: 'Click or press a key to put it away.', color: C.pebble }, { text: "Every lesson stays in the Keeper's Notebook (J).", color: C.pebble }]);
  }
  play.hud.occupied?.push({ x, y, w: W, h });
}
