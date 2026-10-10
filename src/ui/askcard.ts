// Pip's machine question (src/sim/people.ts), on a card under the Now strip and the lesson card. Never
// modal: the farm keeps running, and you can walk up, hover the machine or hold I before you answer
// (the critic's Phase 5 review: in the event window the question was a guess). Pip's reply stays a
// moment once you've picked, then the card goes; "Later" puts it away, and Pip asks again.
import { C } from '../data/palette';
import type { PlayScreen } from '../app/play';
import { answerPip, dropPipAsk, pipAsk, pipAskLive, type PipAsk } from '../sim/people';
import { wrapText } from './font';
import type { UI } from './ui';
import { portrait } from './windows/town';

const W = 236;
/** seconds Pip's reply stays up */
const REPLY_T = 7;
const replied = new WeakMap<PipAsk, number>();

/** Draw the card at `y` in the left column; returns the y below it. */
export function drawAskCard(ui: UI, play: PlayScreen, dt: number, y: number): number {
  const g = play.g;
  if (!pipAskLive(g) || play.modalOpen) return y;
  const a = pipAsk(g)!;
  const x = 4;
  const lead = wrapText(a.lead, W - 44);
  const q = wrapText(a.q, W - 44);
  const top = Math.max(32, 16 + (lead.length + q.length) * 9);
  if (a.reply !== undefined) {
    const t = (replied.get(a) ?? 0) + dt;
    replied.set(a, t);
    const lines = wrapText(a.reply, W - 44);
    const h = Math.max(36, 18 + lines.length * 9);
    const clicked = ui.hover(x, y, W, h) && ui.clicked;
    if (t > REPLY_T || clicked) {
      if (clicked) ui.eat();
      dropPipAsk(g);
      return y;
    }
    ui.ctx.globalAlpha = Math.min(1, (REPLY_T - t) * 2);
    ui.panel(x, y, W, h, 'dark', false);
    ui.fill(x, y, W, 1, a.ok ? C.lime : C.rose);
    portrait(ui, 'pip', x + 4, y + 5, 16, a.ok ? 1 : 2);
    ui.text("Pip's Question", x + 36, y + 4, C.amber);
    lines.forEach((l, i) => ui.text(l, x + 36, y + 14 + i * 9, a.ok ? C.lime : C.cream));
    ui.ctx.globalAlpha = 1;
    if (ui.hover(x, y, W, h)) ui.block(x, y, W, h);
    play.hud.occupied?.push({ x, y, w: W, h });
    return y + h + 4;
  }
  // the answers: a row each, wrapped to two lines when they're long
  const rows = a.answers.map((s) => wrapText(s, W - 26));
  const rowH = rows.map((r) => r.length * 9 + 5);
  const h = top + rowH.reduce((s, n) => s + n + 2, 0) + 4;
  ui.panel(x, y, W, h, 'dark', false);
  ui.block(x, y, W, h);
  ui.fill(x, y, W, 1, C.amber);
  portrait(ui, 'pip', x + 4, y + 5, 16);
  ui.text("Pip's Question", x + 36, y + 4, C.amber);
  // "Later": put it away (Pip asks again)
  const lx = x + W - 38, ly = y + 3;
  if (ui.button('pip_later', lx, ly, 34, 11, 'Later', { style: 'flat', tip: 'Put the question away. Talk to Pip again to answer it.' })) {
    dropPipAsk(g);
    return y;
  }
  lead.forEach((l, i) => ui.text(l, x + 36, y + 14 + i * 9, C.cream));
  q.forEach((l, i) => ui.text(l, x + 36, y + 14 + (lead.length + i) * 9, C.butter));
  let ry = y + top;
  rows.forEach((r, i) => {
    const rx = x + 6, rw = W - 12;
    const hov = ui.hover(rx, ry, rw, rowH[i]);
    ui.fill(rx, ry, rw, rowH[i], hov ? C.walnut : C.bark);
    ui.fill(rx, ry, 2, rowH[i], hov ? C.butter : C.oak);
    ui.text(`${i + 1}`, rx + 5, ry + 3, C.pebble);
    r.forEach((l, li) => ui.text(l, rx + 14, ry + 3 + li * 9, hov ? C.butter : C.cream));
    if (hov && ui.clicked) {
      ui.eat();
      ui.sfx('click');
      answerPip(g, i);
    }
    if (hov) ui.tip([{ text: 'Not sure? Walk over and hover the machine, or hold I: it says what it is doing.', color: C.pebble }]);
    ry += rowH[i] + 2;
  });
  play.hud.occupied?.push({ x, y, w: W, h });
  return y + h + 4;
}
