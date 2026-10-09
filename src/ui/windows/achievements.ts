// Achievements window: category tabs, medal cards with progress, secret hints;
// and the medal banner that slides in when one unlocks.
import { C } from '../../data/palette';
import { ITEM_INDEX } from '../../data/items';
import { ACHIEVEMENTS, ACH_BY_ID, ACH_CATS, AchCat, Achievement, achPoints, featsDone, SECRET_REWARD } from '../../sim/systems/achievements';
import { key } from '../../sim/inventory';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow } from './index';
import { textWidth, wrapText } from '../font';

const TIER_COLS: Record<string, [number, number, number]> = {
  // rim, face, shine
  '1': [C.brick, C.copper, C.apricot],
  '2': [C.slate, C.pebble, C.frost],
  '3': [C.copper, C.brass, C.butter],
  secret: [C.plum, C.violet, C.lavender],
};
export const TIER_NAME = ['', 'Bronze', 'Silver', 'Gold'];

function disc(ui: UI, cx: number, cy: number, r: number, c: number) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    ui.fill(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

/** a round medal with ribbon and the achievement's item icon */
export function medal(ui: UI, a: Achievement, cx: number, cy: number, got: boolean, t = 0) {
  const [rim, face, shine] = got ? TIER_COLS[a.secret ? 'secret' : String(a.tier)] : [C.slate, C.stone, C.pebble];
  // ribbon
  ui.fill(cx - 6, cy - 14, 4, 7, got ? C.rose : C.slate);
  ui.fill(cx + 2, cy - 14, 4, 7, got ? C.sky : C.slate);
  disc(ui, cx, cy, 11, C.ink);
  disc(ui, cx, cy, 10, rim);
  disc(ui, cx, cy, 8, face);
  ui.fill(cx - 5, cy - 7, 4, 1, shine);
  ui.fill(cx - 7, cy - 5, 1, 3, shine);
  if (!got && a.secret) {
    ui.text('?', cx - 2, cy - 4, C.cream, { shadow: C.ink });
    return;
  }
  if (ITEM_INDEX.has(a.icon)) ui.itemIcon(key(a.icon), cx - 8, cy - 8, 16, 0, got ? 1 : 0.35);
  if (got && t > 0 && Math.sin(t * 3) > 0.6) {
    // glint
    ui.fill(cx + 4, cy - 9, 1, 3, C.cream);
    ui.fill(cx + 3, cy - 8, 3, 1, C.cream);
  }
}

type Tab = AchCat | 'all';

function drawAchievements(ui: UI, play: PlayScreen, st: any): boolean {
  const g = play.g;
  const done = featsDone(g);
  const w = Math.min(470, ui.w - 20), h = Math.min(300, ui.h - 40);
  const { x, y } = centered(ui, w, h);
  ui.fill(0, 0, ui.w, ui.h, C.ink, 0.35);
  if (!frame(ui, x, y, w, h, 'Achievements')) return false;
  const tab: Tab = st.data.tab ?? 'all';
  // header: totals
  let pts = 0, maxPts = 0;
  for (const a of ACHIEVEMENTS) {
    maxPts += achPoints(a);
    if (done.has(a.id)) pts += achPoints(a);
  }
  const nDone = ACHIEVEMENTS.filter((a) => done.has(a.id)).length;
  ui.text(`${nDone} / ${ACHIEVEMENTS.length} unlocked`, x + 12, y + 12, C.walnut);
  ui.text(`${pts} / ${maxPts} pts`, x + w - 26, y + 12, C.oak, { align: 'right' });
  ui.bar(x + 110, y + 13, w - 210, 6, nDone / ACHIEVEMENTS.length, C.brass, C.walnut);
  // category tabs (left)
  const tabs: { id: Tab; name: string }[] = [{ id: 'all', name: 'All' }, ...ACH_CATS];
  const tw = 82;
  tabs.forEach((t, i) => {
    const list = t.id === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === t.id);
    const nd = list.filter((a) => done.has(a.id)).length;
    const ty = y + 28 + i * 17;
    if (ui.button('acht' + t.id, x + 10, ty, tw, 15, '', { active: tab === t.id })) st.data.tab = t.id;
    ui.text(t.name, x + 15, ty + 4, tab === t.id ? C.cream : C.cream);
    ui.text(`${nd}/${list.length}`, x + 10 + tw - 4, ty + 4, nd === list.length ? C.lime : C.butter, { align: 'right' });
  });
  // hint for secrets
  ui.para('Secret medals show only a hint until you stumble onto them.', x + 10, y + 28 + tabs.length * 17 + 6, tw, C.oak, 9);
  // cards (right)
  const list = tab === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === tab);
  // unlocked first within each view, then by tier
  const sorted = [...list].sort((a, b) => Number(done.has(b.id)) - Number(done.has(a.id)) || (tab === 'all' ? 0 : a.tier - b.tier));
  const gx = x + tw + 18, gy = y + 28, gw = w - tw - 28, gh = h - 38;
  ui.panel(gx, gy, gw, gh, 'inset', false);
  const cols = gw >= 330 ? 2 : 1;
  const cw = Math.floor((gw - 8) / cols), chh = 40;
  const rows = Math.ceil(sorted.length / cols);
  const off = ui.scrollOffset('achs', gx, gy, gw, gh, rows * (chh + 4) + 6);
  ui.clip(gx + 1, gy + 1, gw - 2, gh - 2);
  sorted.forEach((a, i) => {
    const cx = gx + 4 + (i % cols) * cw, cy = gy + 4 + Math.floor(i / cols) * (chh + 4) - off;
    if (cy + chh < gy || cy > gy + gh) return;
    const got = done.has(a.id);
    const hidden = a.secret && !got;
    ui.fill(cx, cy, cw - 4, chh, got ? C.butter : C.tan);
    ui.fill(cx, cy, cw - 4, 1, got ? C.cream : C.oak);
    ui.fill(cx, cy + chh - 1, cw - 4, 1, C.oak);
    medal(ui, a, cx + 16, cy + 22, got, ui.time + i);
    const name = hidden ? '???' : a.name;
    ui.text(name, cx + 32, cy + 4, got ? C.ink : C.walnut);
    const tag = a.secret ? 'Secret' : TIER_NAME[a.tier];
    ui.text(tag, cx + cw - 8, cy + 4, a.secret ? C.violet : [0, C.brick, C.slate, C.copper][a.tier], { align: 'right' });
    const text = hidden ? 'Hint: ' + (a.hint ?? 'Keep exploring.') : a.desc;
    const lines = wrapText(text, cw - 44).slice(0, 2);
    lines.forEach((l, li) => ui.text(l, cx + 32, cy + 14 + li * 9, hidden ? C.violet : got ? C.walnut : C.bark));
    if (!got && !hidden && a.prog) {
      const [cur, goal] = a.prog(g);
      const f = Math.max(0, Math.min(1, cur / goal));
      const label = `${Math.min(cur, goal).toLocaleString()}/${goal.toLocaleString()}`;
      ui.bar(cx + 32, cy + chh - 7, cw - 48 - textWidth(label), 4, f, C.leaf, C.walnut);
      ui.text(label, cx + cw - 8, cy + chh - 9, C.walnut, { align: 'right' });
    } else if (got) ui.text(`+${achPoints(a)} pts`, cx + cw - 8, cy + chh - 9, C.moss, { align: 'right' });
  });
  ui.unclip();
  return true;
}

registerWindow('achievements', { draw: drawAchievements });

// ---------------- unlock banner ----------------
export interface AchBanner { id: string; t: number }

/** Draws the front of the banner queue; returns the queue with finished banners removed. */
export function drawAchBanner(ui: UI, q: AchBanner[], dt: number): AchBanner[] {
  const b = q[0];
  if (!b) return q;
  b.t += dt;
  const a = ACH_BY_ID.get(b.id);
  const LIFE = 4.6;
  if (!a || b.t > LIFE) return q.slice(1);
  const w = 210, h = 38;
  const slide = Math.min(1, b.t * 4) * (b.t > LIFE - 0.35 ? (LIFE - b.t) / 0.35 : 1);
  const x = Math.floor(ui.w / 2 - w / 2), y = Math.floor(-h + slide * (h + 30));
  ui.fill(x + 2, y + h, w - 2, 2, C.ink, 0.4);
  ui.fill(x, y, w, h, C.ink);
  ui.fill(x + 1, y + 1, w - 2, h - 2, a.secret ? C.plum : C.bark);
  ui.fill(x + 1, y + 1, w - 2, 1, a.secret ? C.violet : C.brass);
  ui.fill(x + 1, y + h - 2, w - 2, 1, a.secret ? C.violet : C.copper);
  // sparkles while it lands
  for (let i = 0; i < 6; i++) {
    const s = (b.t * 2 + i / 6) % 1;
    ui.fill(Math.round(x + 20 + Math.cos(i * 2.1 + b.t) * (14 + s * 8)), Math.round(y + 19 + Math.sin(i * 2.1 + b.t) * (12 + s * 6)), 1, 1, C.butter);
  }
  medal(ui, a, x + 20, y + 21, true, b.t);
  ui.text(a.secret ? 'Secret achievement!' : `${TIER_NAME[a.tier]} achievement`, x + 38, y + 6, a.secret ? C.lavender : C.amber);
  ui.text(a.name, x + 38, y + 16, C.cream);
  ui.text(`+${achPoints(a)} pts${a.secret ? `  +${SECRET_REWARD} coins` : ''}   U to view`, x + 38, y + 26, C.pebble);
  return q;
}
