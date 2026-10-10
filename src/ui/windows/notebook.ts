// The Keeper's Notebook (ROADMAP.md 6.3): the Journal's reference tab, filled as things happen.
// Lessons (every card seen, to re-read), Machines (every kind you have placed, with its contract),
// Lines (each line's diagnosis now) and Controls (the real key names). The Now strip's ? opens it.
import { C } from '../../data/palette';
import { LESSON_BY_ID } from '../../data/lessons';
import { ITEM_BY_ID } from '../../data/items';
import { STRUCT_BY_ID } from '../../data/structures';
import { ioOf, PORT_KINDS } from '../../data/contract';
import { drawFit, sprite } from '../../render/atlas';
import { drawGlyph } from '../../render/glyphs';
import { ACTION_LABELS, keyLabel, SHOWN_ACTIONS } from '../../engine/input';
import { lessonsSeen } from '../../sim/lessons';
import { diagnose, feedersOf, takersOf } from '../../sim/lines';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import type { WinState } from './index';
import { ellipsize, wrapText } from '../font';

const PAGES = [['lessons', 'Lessons'], ['machines', 'Machines'], ['lines', 'Lines'], ['controls', 'Controls']] as const;

/** what a contract's in/out list reads as */
function io(v: string[] | 'any' | 'field'): string {
  if (v === 'any') return 'anything';
  if (v === 'field') return 'ripe crops around it';
  const names = v.slice(0, 3).map((id) => (id[0] === '#' ? id.slice(1) + ' goods' : ITEM_BY_ID.get(id)?.name.toLowerCase() ?? id));
  return names.join(', ') + (v.length > 3 ? ` and ${v.length - 3} more` : '');
}

export function drawNotebook(ui: UI, play: PlayScreen, st: WinState, bx: number, by: number, bw: number, bh: number) {
  const g = play.g;
  st.data.page = st.data.page ?? 'lessons';
  PAGES.forEach(([id, label], i) => {
    if (ui.button('nb' + id, bx + 6 + i * 64, by + 5, 60, 13, label, { active: st.data.page === id, style: 'flat' })) st.data.page = id;
  });
  const cx = bx + 6, cy = by + 24, cw = bw - 12, ch = bh - 28;
  if (st.data.page === 'lessons') {
    const seen = lessonsSeen(g);
    if (!seen.length) {
      ui.text('Lessons appear here the first time something new happens on the farm.', cx, cy + 4, C.walnut, { maxW: cw });
      return;
    }
    const rowH = 34;
    let y = cy - ui.scrollOffset('nbl', cx, cy, cw, ch, seen.length * rowH);
    ui.clip(cx, cy, cw, ch);
    for (const id of seen) {
      const l = LESSON_BY_ID.get(id)!;
      ui.fill(cx, y + 2, 26, 26, C.ink);
      ui.fill(cx + 1, y + 3, 24, 24, C.plum);
      drawFit(ui.ctx, sprite(l.pic), cx + 1, y + 3, 24, 24);
      if (l.glyph) drawGlyph(ui.ctx, l.glyph, cx + 22, y + 5, ui.time);
      ui.text(l.title, cx + 32, y + 2, C.ink);
      l.text.forEach((t, i) => ui.text(ellipsize(t, cw - 36), cx + 32, y + 12 + i * 9, C.walnut));
      y += rowH;
    }
    ui.unclip();
  } else if (st.data.page === 'machines') {
    // every kind of works piece you own, with what it takes and gives
    const ids = [...new Set(g.ents.all().filter((e) => !e.ghost && !e.st.rust && PORT_KINDS.includes(e.def.kind)).map((e) => e.def.id))];
    if (!ids.length) {
      ui.text('Every machine you place is written up here, with what it takes and what it gives.', cx, cy + 4, C.walnut, { maxW: cw });
      return;
    }
    const rowH = 30;
    let y = cy - ui.scrollOffset('nbm', cx, cy, cw, ch, ids.length * rowH);
    ui.clip(cx, cy, cw, ch);
    for (const id of ids) {
      const d = STRUCT_BY_ID.get(id)!;
      const c = ioOf(d);
      ui.spriteIcon('i:' + d.item, cx, y + 2, 16);
      ui.text(d.name, cx + 22, y + 2, C.ink);
      if (c) {
        const gives = io(c.out);
        ui.text(ellipsize(`Takes ${io(c.in)}${gives ? `; gives ${gives}` : ''}${c.power ? `; ${c.power} sparks` : ''}`, cw - 26), cx + 22, y + 11, C.walnut);
        ui.text(ellipsize(c.note, cw - 26), cx + 22, y + 20, C.oak);
      }
      y += rowH;
    }
    ui.unclip();
  } else if (st.data.page === 'lines') {
    // a line ends where goods stop: the crate, or a chest something feeds and nothing empties
    const sinks = g.ents.all().filter((e) => !e.ghost && !e.st.rust && (e.def.kind === 'shipbin' || (e.def.kind === 'chest' && feedersOf(g, e).length > 0 && takersOf(g, e).length === 0)));
    const lines = sinks.map((s) => ({ s, d: diagnose(g, s) })).filter((x) => x.d.stages.length > 1).slice(0, 6);
    if (!lines.length) {
      ui.text('Each line you build ends somewhere: the crate, or a chest. Its diagnosis shows here, and in full in the Lines tab (P).', cx, cy + 4, C.walnut, { maxW: cw });
      return;
    }
    let y = cy;
    for (const { s, d } of lines) {
      const head = `${s.def.name} (${s.x}, ${s.y}): ${d.stages.length} stages`;
      ui.text(head, cx, y, C.ink);
      const body = wrapText(d.gap, cw - 6).slice(0, 2);
      body.forEach((t, i) => ui.text(t, cx + 6, y + 10 + i * 9, C.walnut));
      y += 14 + body.length * 9;
      if (y > cy + ch - 20) break;
    }
    ui.text('The Production window (P) has the whole of each line, and the fixes behind its ?', cx, cy + ch - 9, C.oak);
  } else {
    // the real key names (rebindable in Settings)
    const acts = SHOWN_ACTIONS.filter((a) => ACTION_LABELS[a]);
    const col = Math.ceil(acts.length / 2), colW = Math.floor(cw / 2);
    acts.forEach((a, i) => {
      const x = cx + Math.floor(i / col) * colW, y = cy + (i % col) * 10;
      const k = play.app.input.binds[a]?.[0];
      ui.text(ellipsize(ACTION_LABELS[a], colW - 50), x, y, C.walnut);
      ui.text(k ? keyLabel(k) : '-', x + colW - 8, y, C.ink, { align: 'right' });
    });
    ui.text('Ctrl+Z takes back your last five placements, with a full refund.', cx, cy + col * 10 + 4, C.oak);
    ui.text(`Shift+${keyLabel(play.app.input.binds.interact?.[0] ?? 'KeyF')} opens a machine's window (to lock a recipe) instead of loading it.`, cx, cy + col * 10 + 14, C.oak);
  }
}
