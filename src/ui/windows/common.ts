// Shared window helpers: inventory grids with drag/drop, window frames.
import { C } from '../../data/palette';
import { Inventory, kStack, Stack } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { itemTooltip } from '../tooltips';

export const SLOT = 20;

export interface GridOpts {
  /** shift-click moves the stack here, ctrl-click one item, double-click every stack of that kind */
  target?: Inventory | ((k: number, n: number) => number);
  /** only allow placing items matching */
  accept?: (k: number) => boolean;
  start?: number;
  count?: number;
  selected?: number;
  readonly?: boolean;
  extraTip?: (k: number) => { text: string; color?: number }[];
}

/** Draw an inventory grid; handles click-to-pick, right-click split, shift-move. */
export function invGrid(ui: UI, play: PlayScreen, inv: Inventory, x: number, y: number, cols: number, opts: GridOpts = {}) {
  const start = opts.start ?? 0;
  const count = opts.count ?? inv.slots.length - start;
  for (let n = 0; n < count; n++) {
    const i = start + n;
    const sx = x + (n % cols) * (SLOT + 2), sy = y + Math.floor(n / cols) * (SLOT + 2);
    const st = inv.slots[i];
    const r = ui.slot(sx, sy, st, { selected: opts.selected === i });
    if (r.hover && st && !ui.hand) ui.tip(itemTooltip(play.g, st.k, st.n, opts.extraTip?.(st.k) ?? []));
    if (opts.readonly) {
      if ((r.click || r.rclick) && st) {
        // take out of read-only containers into the player inventory
        const left = play.g.player.inv.add(st.k, r.rclick ? 1 : st.n);
        const taken = (r.rclick ? 1 : st.n) - left;
        st.n -= taken;
        if (st.n <= 0) inv.slots[i] = null;
        if (taken) ui.sfx('pickup');
      }
      continue;
    }
    if (r.click) {
      // modifiers are the ones held when the button went down (input.press), so a quick
      // shift-click never turns into a plain pick-up
      const press = ui.input.press;
      const again = press.count >= 2 && !!ui.hand && ui.hand.k === lastPick.k && lastPick.inv === inv && lastPick.i === i && (!st || st.k === ui.hand.k);
      if (opts.target && press.count >= 2 && (again || (!ui.hand && st))) {
        // double-click: send every stack of that kind across. Usually the first click picked the
        // stack up, so put it back first; a fast pair can also land in a single frame
        let k = st?.k ?? -1;
        if (again) {
          if (!st) inv.slots[i] = ui.hand;
          else st.n += ui.hand!.n;
          k = ui.hand!.k;
          ui.hand = null;
        }
        let movedAny = 0;
        for (let j = start; j < start + count; j++) {
          const s = inv.slots[j];
          if (!s || s.k !== k) continue;
          const moved = moveTo(opts.target, s.k, s.n);
          s.n -= moved;
          movedAny += moved;
          if (s.n <= 0) inv.slots[j] = null;
          if (!moved) break;
        }
        if (movedAny) ui.sfx('pickup');
      } else if ((press.shift || press.ctrl) && st && opts.target && !ui.hand) {
        // shift moves the stack, ctrl moves one
        const moved = moveTo(opts.target, st.k, press.ctrl && !press.shift ? 1 : st.n);
        st.n -= moved;
        if (st.n <= 0) inv.slots[i] = null;
        ui.sfx(moved ? 'pickup' : 'error');
      } else {
        const had = !!ui.hand;
        clickSlot(ui, inv, i, opts.accept);
        if (!had && ui.hand) lastPick = { inv, i, k: ui.hand.k };
      }
    } else if (r.rclick) rclickSlot(ui, inv, i, opts.accept);
  }
}

/** the slot the last plain click picked a stack up from (double-click = send all of that kind) */
let lastPick: { inv: Inventory | null; i: number; k: number } = { inv: null, i: -1, k: -1 };

function moveTo(target: Inventory | ((k: number, n: number) => number), k: number, n: number): number {
  if (typeof target === 'function') return target(k, n);
  return n - target.add(k, n);
}

export function clickSlot(ui: UI, inv: Inventory, i: number, accept?: (k: number) => boolean) {
  const st = inv.slots[i];
  const hand = ui.hand;
  if (!hand) {
    if (st) {
      ui.hand = { ...st };
      inv.slots[i] = null;
      ui.sfx('click');
    }
    return;
  }
  if (accept && !accept(hand.k)) {
    ui.sfx('error');
    return;
  }
  if (!st) {
    inv.slots[i] = hand;
    ui.hand = null;
  } else if (st.k === hand.k) {
    const room = kStack(st.k) - st.n;
    const t = Math.min(room, hand.n);
    st.n += t;
    hand.n -= t;
    if (hand.n <= 0) ui.hand = null;
  } else {
    inv.slots[i] = hand;
    ui.hand = st;
  }
  ui.sfx('click');
}

export function rclickSlot(ui: UI, inv: Inventory, i: number, accept?: (k: number) => boolean) {
  const st = inv.slots[i];
  const hand = ui.hand;
  if (!hand) {
    if (st && st.n > 0) {
      const half = Math.ceil(st.n / 2);
      ui.hand = { k: st.k, n: half };
      st.n -= half;
      if (st.n <= 0) inv.slots[i] = null;
    }
    return;
  }
  if (accept && !accept(hand.k)) return;
  if (!st) {
    inv.slots[i] = { k: hand.k, n: 1 };
    hand.n--;
  } else if (st.k === hand.k && st.n < kStack(st.k)) {
    st.n++;
    hand.n--;
  }
  if (hand.n <= 0) ui.hand = null;
}

/** window frame with title + close button; returns false if closed */
export function frame(ui: UI, x: number, y: number, w: number, h: number, title: string): boolean {
  ui.panel(x, y, w, h);
  ui.panel(x + w / 2 - Math.max(50, title.length * 3 + 12), y - 8, Math.max(100, title.length * 6 + 24), 16, 'brass', false);
  ui.text(title, x + w / 2, y - 3, C.ink, { align: 'center' });
  if (ui.button('close_' + title, x + w - 18, y + 5, 12, 12, 'x', { style: 'red' })) return false;
  return true;
}

export function centered(ui: UI, w: number, h: number) {
  // (frame's title plate stands 8 px above the panel: keep it on screen on short ones, 1366x620)
  return { x: Math.floor((ui.w - w) / 2), y: Math.max(Math.min(9, Math.floor((ui.h - h) / 2)), Math.floor((ui.h - h) / 2) - 10) };
}

export function stackLine(ui: UI, s: Stack | null, x: number, y: number) {
  ui.slot(x, y, s);
}
