// "Load which?" (the owner's playtest: machines took what they liked from the bag, "what if I don't
// want to add them?"). F or right-click at a machine with nothing it takes in hand asks here: a line
// for each item in the bag it takes, the one it last ran on first, fuel for a burner on its own
// line. A click, 1-6, or F/Enter for the first loads it; Open shows the machine's own window.
import { C } from '../../data/palette';
import type { PlayScreen } from '../../app/play';
import { loadChoices, loadChosen } from '../../sim/actions';
import { entById } from '../../sim/ents';
import { itemName } from '../../sim/inventory';
import { textWidth } from '../font';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, type WinState } from './index';

const ROW = 20;

function drawLoadPick(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const e = entById(g, st.arg);
  if (!e?.mach) return false;
  const list = loadChoices(g, e);
  if (!list.length) return false;
  const W = 236, H = 30 + list.length * ROW + 26;
  const { x, y } = centered(ui, W, H);
  if (!frame(ui, x, y, W, H, `Load the ${e.def.name.toLowerCase()}`)) return false;
  ui.text('Pick what goes in from your bag.', x + 12, y + 14, C.walnut);
  // (the F that opened this mustn't also pick)
  const keys = st.t > 0.15;
  let pick = -1;
  list.forEach((c, i) => {
    const ry = y + 26 + i * ROW;
    const hov = ui.hover(x + 10, ry, W - 20, ROW - 2);
    ui.fill(x + 10, ry, W - 20, ROW - 2, hov ? C.butter : C.tan, hov ? 1 : 0.55);
    ui.text(`${i + 1}`, x + 15, ry + 6, C.oak);
    ui.itemIcon(c.k, x + 24, ry + 1, 16);
    ui.text(`${itemName(c.k)}  x${c.have}`, x + 44, ry + 6, C.ink);
    const note = c.fuel ? 'as fuel' : c.takes < c.have ? `takes ${c.takes}` : 'all of it';
    ui.text(note, x + W - 16 - textWidth(note), ry + 6, c.fuel ? C.rust : C.walnut);
    if (hov && ui.clicked) {
      ui.eat();
      pick = i;
    }
    if (keys && ui.input.keyPressed('Digit' + (i + 1))) pick = i;
  });
  if (keys && pick < 0 && (ui.input.wasPressed('interact') || ui.input.keyPressed('Enter'))) {
    ui.input.consume('interact');
    pick = 0;
  }
  if (pick >= 0) {
    const c = list[pick];
    if (loadChosen(g, e, c.k)) ui.sfx('insert');
    return false;
  }
  if (ui.button('lp_open', x + 10, y + H - 22, 70, 14, 'Open it', { style: 'flat', tip: "The machine's own window: its recipes, what's inside, your bag" })) {
    play.closeWindow();
    play.openWindow('struct', e.id);
    return true;
  }
  ui.text('F or Enter: the first', x + W - 12, y + H - 19, C.oak, { align: 'right' });
  return true;
}

registerWindow('loadpick', { draw: drawLoadPick });
