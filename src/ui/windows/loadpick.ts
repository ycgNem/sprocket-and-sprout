// "Load which?" (the owner's playtest: machines took what they liked from the bag, "what if I don't
// want to add them?"). F or right-click at a machine with nothing it takes in hand asks here: a line
// for each item in the bag it takes, the one it last ran on first, fuel for a burner on its own
// lines, the best fuel first. A click, 1-6, or F/Enter for the first loads it; Shift+F opens the
// machine's own window. It's a small card beside the machine, not a window over it (the critic's
// re-check): the farm keeps running, the HUD stays, and turning or walking away puts it away.
import { C } from '../../data/palette';
import type { PlayScreen } from '../../app/play';
import { loadChoices, loadChosen } from '../../sim/actions';
import { entById } from '../../sim/ents';
import { hereEnts } from '../../sim/indoors';
import { itemName } from '../../sim/inventory';
import { facingTile } from '../../sim/systems/player';
import { ellipsize, textWidth } from '../font';
import type { UI } from '../ui';
import { registerWindow, type WinState } from './index';

const ROW = 15, W = 188;

function drawLoadPick(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const e = entById(g, st.arg);
  if (!e?.mach) return false;
  // it belongs to the machine in front of you
  const [fx, fy] = facingTile(g);
  if (hereEnts(g)?.rootAt(fx, fy)?.id !== e.id) return false;
  const list = loadChoices(g, e);
  if (!list.length) return false;
  const H = 17 + list.length * ROW + 16;
  // beside the machine: to its right, or its left where the screen runs out; clear of the hotbar
  const right = play.toUI(e.x + e.w + 0.3, e.y + e.h / 2), left = play.toUI(e.x - 0.3, e.y + e.h / 2);
  const x = Math.max(2, Math.min(ui.w - W - 2, Math.round(right.x + W + 2 <= ui.w ? right.x : left.x - W)));
  const y = Math.max(2, Math.min(ui.h - H - 44, Math.round(right.y - H / 2)));
  ui.panel(x, y, W, H);
  ui.text(ellipsize(`Load the ${e.def.name.toLowerCase()}`, W - 16), x + 8, y + 5, C.walnut);
  // (the F that opened this mustn't also pick)
  const keys = st.t > 0.15;
  let pick = -1;
  list.forEach((c, i) => {
    const ry = y + 16 + i * ROW;
    const hov = ui.hover(x + 5, ry, W - 10, ROW - 1);
    ui.fill(x + 5, ry, W - 10, ROW - 1, hov || i === 0 ? C.butter : C.tan, hov ? 1 : i === 0 ? 0.7 : 0.45);
    ui.text(`${i + 1}`, x + 9, ry + 4, C.oak);
    ui.itemIcon(c.k, x + 16, ry - 1, 16);
    const note = c.fuel ? `${c.takes} as fuel` : c.takes < c.have ? `takes ${c.takes}` : 'all of it';
    const nw = textWidth(note);
    ui.text(ellipsize(`${itemName(c.k)} x${c.have}`, W - 48 - nw), x + 34, ry + 4, C.ink);
    ui.text(note, x + W - 9 - nw, ry + 4, c.fuel ? C.rust : C.walnut);
    if (hov && ui.clicked) {
      ui.eat();
      pick = i;
    }
    // 1-6 pick here, not the hotbar slot
    const dk = 'Digit' + (i + 1);
    if (keys && ui.input.keyPressed(dk)) {
      ui.input.pressed.delete(dk);
      pick = i;
    }
  });
  // F or Enter: the first line (Shift+F is the machine's own window: left to the play screen)
  if (keys && pick < 0 && ((ui.input.wasPressed('interact') && !ui.input.shift) || ui.input.keyPressed('Enter'))) {
    ui.input.consume('interact');
    pick = 0;
  }
  if (pick >= 0) {
    if (loadChosen(g, e, list[pick].k)) ui.sfx('insert');
    return false;
  }
  ui.text('F: the first   Shift+F: open it', x + W / 2, y + H - 13, C.oak, { align: 'center' });
  return true;
}

registerWindow('loadpick', { draw: drawLoadPick, modal: false, pause: false });
