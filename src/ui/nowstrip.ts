// The Now strip (ROADMAP.md 6.2): one line at the top left, "Now: feed the jar", with the step's
// why beneath it and a ? that opens the Keeper's Notebook. It replaces the 3-quest tracker; the
// full quest list lives in the Journal. Side steps (up to two) show only after the Keeper's Line.
import { C } from '../data/palette';
import type { PlayScreen } from '../app/play';
import type { NowLine } from '../sim/systems/quests';
import { textWidth, wrapText } from './font';
import type { UI } from './ui';

const MAX_W = 250;

/** Draw the strip from y; returns the y below it. */
export function drawNowStrip(ui: UI, play: PlayScreen, y: number): number {
  const g = play.g;
  // a ribbon ("Quest complete!") owns the top of the screen for a moment; the next step follows it
  if (play.app.renderer.juice.banners.length) return y;
  // side steps only once the Keeper's Line is done (or on saves that never had it)
  const side = !g.flags.has('keepers_line') || !!g.sys.quests?.done?.includes('k8_deeper');
  const lines: NowLine[] = g.sys.quests?.now?.(g, side ? 3 : 1) ?? [];
  if (!lines.length) return y;
  const [main, ...rest] = lines;
  const head = 'Now: ';
  const textW = Math.min(MAX_W - 30, Math.max(textWidth(head + main.text), 120));
  const body = wrapText(main.text, textW - textWidth(head));
  const why = main.why ? wrapText(main.why, textW) : [];
  const w = textW + 26;
  const h = 6 + body.length * 10 + why.length * 9 + 3;
  ui.panel(4, y, w, h, 'dark', false);
  ui.fill(4, y, w, 1, C.brass);
  ui.text(head, 9, y + 4, C.amber);
  body.forEach((l, i) => ui.text(l, 9 + textWidth(head), y + 4 + i * 10, C.cream));
  why.forEach((l, i) => ui.text(l, 9, y + 4 + body.length * 10 + i * 9, C.pebble));
  // ? opens the Notebook on the lessons page
  if (ui.button('nowq', 4 + w - 15, y + 3, 11, 11, '?', { style: 'flat', tip: [{ text: main.title, color: C.amber }, { text: "The Keeper's Notebook: lessons, machines, controls" }] })) {
    play.openWindow('journal', 'notebook');
  }
  if (ui.hover(4, y, w, h)) ui.block(4, y, w, h);
  let yy = y + h + 2;
  for (const s of rest) {
    const t = wrapText('- ' + s.text, MAX_W - 16)[0];
    const sw = textWidth(t) + 12;
    ui.panel(4, yy, sw, 13, 'dark', false);
    ui.text(t, 9, yy + 3, C.pebble);
    if (ui.hover(4, yy, sw, 13)) ui.tip([{ text: s.title, color: C.amber }, { text: s.why || s.text }]);
    yy += 15;
  }
  return yy + 1;
}
