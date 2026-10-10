// Journal (notebook, quests, orders, friends, collections, mail), world map, restoration board, museum.
import { C, PALETTE } from '../../data/palette';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import { FISH } from '../../data/fish';
import { QUEST_BY_ID } from '../../data/goals';
import { SEASON_NAMES } from '../../data/types';
import { key } from '../../sim/inventory';
import { hearts, npcSys, giftTaste } from '../../sim/systems/npcs';
import { objText, questSys } from '../../sim/systems/quests';
import { donateMuseum, goals, museumAccepts, MUSEUM_TOTAL, readMail } from '../../sim/systems/goals';
import { tileColor } from '../hud';
import type { PlayScreen } from '../../app/play';
import type { UI } from '../ui';
import { centered, frame } from './common';
import { registerWindow, WinState } from './index';
import { sprite, drawFit } from '../../render/atlas';
import { ICON, textWidth, ellipsize } from '../font';
import { itemTooltip } from '../tooltips';
import { portrait, heartsRow } from './town';
import { shopFor, shopStatus } from '../../sim/systems/town';
import type { NPCState } from '../../sim/systems/npcs';
import { charArtHeight } from '../../render/art/sheets';
import { drawNotebook } from './notebook';
import { drawOrders } from './orders';

// ---------------- journal ----------------
function drawJournal(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const w = Math.min(ui.w - 20, 440), h = Math.min(ui.h - 30, 300);
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Journal')) return false;
  st.data.tab = st.data.tab ?? st.arg ?? 'quests';
  // (achievements have their own window, U: their tab overflowed its button and pushed Mail under the
  // close button, the sweep found)
  const tabs = [['notebook', 'Notebook'], ['quests', 'Quests'], ['orders', 'Orders'], ['friends', 'Friends'], ['collect', 'Collections'], ['mail', 'Mail']];
  let jump = false;
  const tw = Math.min(70, Math.floor((w - 44) / tabs.length));
  tabs.forEach(([id, label], i) => {
    if (ui.button('jt' + id, x + 10 + i * tw, y + 10, tw - 4, 14, label, { active: st.data.tab === id })) {
      if (id === 'feats') jump = true;
      else st.data.tab = id;
    }
  });
  if (jump || st.data.tab === 'feats') {
    // achievements live in their own window now
    play.openWindow('achievements');
    return true;
  }
  const bx = x + 10, by = y + 30, bw = w - 20, bh = h - 40;
  ui.panel(bx, by, bw, bh, 'inset', false);
  if (st.data.tab === 'notebook') drawNotebook(ui, play, st, bx, by, bw, bh);
  else if (st.data.tab === 'orders') drawOrders(ui, play, bx + 2, by + 2, bw - 4, bh - 4, st);
  else if (st.data.tab === 'quests') {
    const q = questSys(g);
    let yy = by + 6 - ui.scrollOffset('jq', bx, by, bw, bh, 40 + q.active.length * 60 + q.done.length * 10);
    ui.clip(bx, by, bw, bh);
    for (const a of q.active) {
      const d = QUEST_BY_ID.get(a.id);
      if (!d) continue;
      ui.text(d.title, bx + 8, yy, C.ink);
      ui.text(`from ${NPC_BY_ID.get(d.giver)?.name ?? 'the town'}`, bx + bw - 8, yy, C.oak, { align: 'right' });
      yy += 11;
      yy += ui.para(d.desc, bx + 8, yy, bw - 16, C.walnut, 9) + 2;
      d.objectives.forEach((o, i) => {
        ui.text('- ' + objText(g, o, a.prog[i]), bx + 14, yy, C.moss);
        yy += 10;
      });
      if (d.hint) {
        yy += ui.para('Tip: ' + d.hint, bx + 14, yy, bw - 28, C.oak, 9);
      }
      yy += 8;
    }
    if (q.done.length) {
      ui.text(`Completed (${q.done.length})`, bx + 8, yy, C.oak);
      yy += 11;
      for (const id of q.done.slice().reverse()) {
        ui.text('+ ' + (QUEST_BY_ID.get(id)?.title ?? id), bx + 14, yy, C.moss);
        yy += 10;
      }
    }
    ui.unclip();
  } else if (st.data.tab === 'friends') {
    const list = npcSys(g).list;
    const rowH = 30;
    const pet = g.sys.pet?.stage === 'adopted' ? g.sys.pet : null;
    const first = pet ? 1 : 0;
    const off = ui.scrollOffset('jf', bx, by, bw, bh, (list.length + first) * rowH + 4);
    ui.clip(bx, by, bw, bh);
    if (pet) {
      const ry = by + 2 - off;
      ui.fill(bx + 4, ry, 22, 22, C.tan, 0.5);
      const ps = sprite(`pet:${pet.kind}:${pet.coat}:2`);
      drawFit(ui.ctx, ps, bx + 4, ry + 1, 22, 22);
      ui.text(pet.name, bx + 34, ry + 3, C.ink);
      ui.text(`Your ${pet.kind}`, bx + 34, ry + 13, C.oak);
      const ph = Math.min(5, Math.floor(pet.points / 200));
      ui.text(ICON.heart.repeat(ph) + '.'.repeat(5 - ph), bx + 230, ry + 3, C.rose);
      ui.text(pet.bowlFull ? 'Water bowl full' : 'Water bowl empty', bx + 230, ry + 13, pet.bowlFull ? C.moss : C.walnut);
      if (pet.petted) ui.text('petted', bx + bw - 8, ry + 3, C.moss, { align: 'right' });
    }
    list.forEach((n, i0) => {
      const i = i0 + first;
      const d = NPC_BY_ID.get(n.id)!;
      const ry = by + 2 + i * rowH - off;
      if (ry < by - rowH || ry > by + bh) return;
      portrait(ui, n.id, bx + 4, ry, 18);
      ui.text(n.met ? d.name : '???', bx + 34, ry + 3, C.ink);
      if (g.flags.has('partner:' + n.id)) ui.text(ICON.heart + ' partner', bx + 34 + textWidth(d.name) + 6, ry + 3, C.rose);
      // the job shares a row with the birthday column at +230
      ui.text(ellipsize(n.met ? d.job : 'You haven\'t met yet', 230 - 34 - 6), bx + 34, ry + 13, C.oak);
      heartsRow(ui, hearts(n), bx + 230, ry + 3);
      ui.text(`Birthday: ${SEASON_NAMES[d.birthday.season]} ${d.birthday.day}`, bx + 230, ry + 13, C.walnut);
      if (n.talked) ui.text('talked', bx + bw - 8, ry + 3, C.moss, { align: 'right' });
      if (n.giftedToday) ui.text('gift', bx + bw - 8, ry + 13, C.rose, { align: 'right' });
      if (ui.hover(bx, ry, bw, rowH - 2) && n.met) {
        // known gift tastes: love items you have gifted
        const lines = [{ text: d.name, color: C.amber }, { text: d.personality }, { text: `Friendship ${n.points}/${2500}`, color: C.pebble }];
        const held = g.player.inv.slots[g.player.sel];
        if (held) lines.push({ text: `Would think of your ${ITEMS[held.k >> 2].name}: ${giftTaste(d, ITEMS[held.k >> 2].id)}`, color: C.lime });
        ui.tip(lines, 220);
      }
    });
    ui.unclip();
  } else if (st.data.tab === 'collect') {
    const gs = goals(g);
    st.data.sub = st.data.sub ?? 'shipped';
    [['shipped', 'Shipped'], ['fish', 'Fish'], ['museum', 'Museum']].forEach(([id, label], i) => { if (ui.button('cs' + id, bx + 6 + i * 60, by + 4, 56, 12, label, { active: st.data.sub === id, style: 'flat' })) st.data.sub = id; });
    const gy = by + 20;
    let list: { id: string; got: boolean; extra?: string }[] = [];
    if (st.data.sub === 'shipped') list = ITEMS.filter((d) => ['crop', 'fruit', 'flower', 'forage', 'animal', 'artisan', 'food'].includes(d.cat) && d.price > 0).map((d) => ({ id: d.id, got: (gs.shipped[d.id] ?? 0) > 0, extra: `shipped ${gs.shipped[d.id] ?? 0}` }));
    else if (st.data.sub === 'fish') list = FISH.map((f) => ({ id: f.id, got: !!gs.fish[f.id], extra: gs.fish[f.id] ? `caught ${gs.fish[f.id].n}, best ${gs.fish[f.id].max} cm` : `${f.where.join('/')}, ${f.seasons.map((s) => SEASON_NAMES[s]).join(' ')}` }));
    else list = ITEMS.filter((d) => museumAccepts(d.id)).map((d) => ({ id: d.id, got: gs.museum.includes(d.id), extra: gs.museum.includes(d.id) ? 'donated' : 'not donated yet' }));
    const got = list.filter((l) => l.got).length;
    ui.text(`${got} / ${list.length}`, bx + bw - 8, by + 6, C.walnut, { align: 'right' });
    const cols = Math.floor((bw - 12) / 20);
    const off = ui.scrollOffset('jc' + st.data.sub, bx, gy, bw, bh - 22, Math.ceil(list.length / cols) * 20);
    ui.clip(bx, gy, bw, bh - 22);
    list.forEach((l, i) => {
      const sx = bx + 6 + (i % cols) * 20, sy = gy + Math.floor(i / cols) * 20 - off;
      if (sy < gy - 20 || sy > by + bh) return;
      ui.panel(sx, sy, 18, 18, 'slot', false);
      if (l.got) ui.itemIcon(key(l.id), sx + 1, sy + 1, 16);
      else {
        ui.ctx.globalAlpha = 0.15;
        ui.itemIcon(key(l.id), sx + 1, sy + 1, 16);
        ui.ctx.globalAlpha = 1;
      }
      if (ui.hover(sx, sy, 18, 18)) ui.tip([{ text: l.got ? ITEM_BY_ID.get(l.id)!.name : '???', color: C.amber }, { text: l.extra ?? '', color: C.pebble }]);
    });
    ui.unclip();
  } else if (st.data.tab === 'mail') {
    const mail = goals(g).mail;
    const sel = mail[st.data.mi ?? 0];
    const lw = 130;
    mail.forEach((m, i) => {
      const ry = by + 4 + i * 14;
      if (ry > by + bh - 14) return;
      if (ui.button('ml' + i, bx + 4, ry, lw, 13, (m.read ? '' : '* ') + m.title.slice(0, 22), { style: 'flat', active: (st.data.mi ?? 0) === i })) st.data.mi = i;
    });
    if (sel) {
      readMail(g, sel);
      const tx = bx + lw + 12;
      ui.panel(tx - 4, by + 4, bw - lw - 14, bh - 8, 'paper', false);
      ui.text(sel.title, tx, by + 10, C.ink);
      ui.text(`from ${NPC_BY_ID.get(sel.from)?.name ?? sel.from}`, tx, by + 20, C.oak);
      ui.para(sel.text.replace(/\{player\}/g, g.player.name), tx, by + 34, bw - lw - 30, C.walnut);
      if (sel.items?.length) ui.text('Attached: ' + sel.items.map((i) => `${i.n} ${ITEM_BY_ID.get(i.item)?.name}`).join(', ') + ' (received)', tx, by + bh - 20, C.moss);
    } else ui.text('No letters yet.', bx + 10, by + 10, C.oak);
  }
  return true;
}

// ---------------- map ----------------
let mapCanvas: HTMLCanvasElement | null = null;
let mapKey = '';
function drawMap(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const m = g.map;
  const scale = Math.max(1, Math.min(Math.floor((ui.w - 40) / m.w), Math.floor((ui.h - 60) / m.h))) || 1;
  const mw = m.w * scale, mh = m.h * scale;
  // a whole-number scale keeps every map pixel the same size
  const fitRaw = Math.min((ui.w - 40) / m.w, (ui.h - 60) / m.h);
  const fit = fitRaw >= 1 ? Math.floor(fitRaw) : fitRaw;
  const s2 = scale >= 1 && m.w * scale < ui.w - 40 ? scale : fit;
  const w = Math.round(m.w * s2) + 16, h = Math.round(m.h * s2) + 30;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Valley of Thistlewick')) return false;
  const k = `${g.time.season}:${m.version >> 6}:${g.ents.version >> 4}`;
  if (!mapCanvas || mapKey !== k) {
    mapKey = k;
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = m.w;
    mapCanvas.height = m.h;
    const ctx = mapCanvas.getContext('2d')!;
    const img = ctx.createImageData(m.w, m.h);
    for (let yy = 0; yy < m.h; yy++)
      for (let xx = 0; xx < m.w; xx++) {
        const hex = PALETTE[tileColor(g, m, xx, yy)];
        const i = (yy * m.w + xx) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }
  const ox = x + 8, oy = y + 18;
  ui.ctx.imageSmoothingEnabled = false;
  ui.ctx.drawImage(mapCanvas, ox, oy, m.w * s2, m.h * s2);
  const mx = ui.mx, my = ui.my;
  const blds = m.buildings.filter((b) => MAP_NAME[b.id] !== '');
  // hovered: the full name, the door's answer and who is inside
  let hoverB: (typeof blds)[number] | null = null;
  for (const b of blds) {
    const bx = ox + b.x * s2, by = oy + b.y * s2;
    if (mx >= bx && mx < bx + b.w * s2 && my >= by && my < by + b.h * s2) hoverB = b;
  }
  if (hoverB) ui.fill(ox + hoverB.x * s2 - 1, oy + hoverB.y * s2 - 1, hoverB.w * s2 + 2, hoverB.h * s2 + 2, C.butter, 0.6);
  // villagers: a head each (indoors, on their building), the name on hover
  const inside = (n: { target: string; visible: boolean }) => !n.visible && n.target.endsWith('_in');
  const dots: { n: NPCState; x: number; y: number }[] = [];
  const perB = new Map<string, number>();
  for (const n of npcSys(g).list) {
    let nx = ox + n.x * s2, ny = oy + n.y * s2;
    if (inside(n)) {
      const b = m.buildings.find((bb) => { const l = m.locs.get(n.target); return !!l && l[0] >= bb.x && l[0] < bb.x + bb.w && l[1] >= bb.y && l[1] < bb.y + bb.h; });
      if (!b) continue;
      const k = perB.get(b.id) ?? 0;
      perB.set(b.id, k + 1);
      nx = ox + (b.x + b.w / 2) * s2 + (k % 3) * 7 - 7;
      ny = oy + (b.y + b.h / 2) * s2 + Math.floor(k / 3) * 7;
    } else if (!n.visible) continue;
    dots.push({ n, x: Math.round(nx), y: Math.round(ny) });
  }
  let hoverN: (typeof dots)[number] | null = null;
  for (const d of dots) {
    headIcon(ui, d.n.id, d.x, d.y, inside(d.n) ? C.slate : C.lavender);
    if (Math.abs(mx - d.x) <= 5 && Math.abs(my - d.y) <= 5) hoverN = d;
  }
  const p = g.player;
  if (p.where === 'world') {
    // you: your own head in a rose badge with a pulsing ring
    const px = Math.round(ox + p.x * s2), py = Math.round(oy + p.y * s2);
    if (Math.floor(ui.time * 3) % 2) ui.fill(px - 7, py - 7, 15, 15, C.rose, 0.5);
    headIcon(ui, 'player', px, py, C.rose);
    if (Math.abs(mx - px) <= 6 && Math.abs(my - py) <= 6) ui.tip([{ text: `${p.name} (you)`, color: C.amber }]);
  } else ui.text(p.where === 'mine' ? `You are on level ${g.sys.mine?.floor} of the Deepworks` : 'You are at home', x + w / 2, y + h - 10, C.walnut, { align: 'center' });
  // labels over the heads, never over each other (a 2 px gap): each takes the first free spot
  // around its place, or waits for a hover. They don't move as villagers walk about.
  const taken: [number, number, number, number][] = [];
  const free = (r: [number, number, number, number]) => r[0] >= ox && r[0] + r[2] <= ox + m.w * s2 && r[1] >= oy && r[1] + r[3] <= oy + m.h * s2 && !taken.some((t) => r[0] < t[0] + t[2] + 2 && r[0] + r[2] + 2 > t[0] && r[1] < t[1] + t[3] && r[1] + r[3] > t[1]);
  const place = (name: string, cx: number, top: number, bottom: number, col: number, left = cx - 2, right = cx + 2): boolean => {
    const tw = textWidth(name) + 2;
    for (const [lx, ly] of [[cx - tw / 2, top - 10], [cx - tw / 2, bottom + 1], [right + 1, (top + bottom) / 2 - 4], [left - tw - 1, (top + bottom) / 2 - 4]]) {
      const r: [number, number, number, number] = [Math.round(lx), Math.round(ly), tw, 9];
      if (!free(r)) continue;
      taken.push(r);
      ui.text(name, r[0] + 1, r[1] + 1, col, { shadow: C.ink });
      return true;
    }
    return false;
  };
  // no label covers a shop (its own label goes beside it)
  for (const b of blds) if (b.kind === 'shop') taken.push([ox + b.x * s2, oy + b.y * s2, b.w * s2, b.h * s2]);
  // places first (the farm, the square, the lake ...), then every named building
  const areas: [string, string][] = [['farmhouse', g.player.farmName + ' Farm'], ['square', 'Town Square'], ['mine_entrance', 'The Deepworks'], ['quarry', 'Quarry'], ['lake_dock', 'Mirror Lake'], ['pier', 'Pier'], ['forest_pond', 'Forest Pond'], ['forest_glade', 'Glade']];
  for (const [loc, name] of areas) {
    const l = m.locs.get(loc);
    if (!l) continue;
    const lx = ox + l[0] * s2, ly = oy + l[1] * s2;
    ui.fill(lx - 1, ly - 1, 3, 3, C.ink);
    place(name, lx, ly - 1, ly + 2, C.cream);
  }
  for (const b of blds) {
    const bx = ox + b.x * s2, by = oy + b.y * s2;
    place(MAP_NAME[b.id] ?? b.name, bx + (b.w * s2) / 2, by, by + b.h * s2, b.kind === 'shop' ? C.butter : C.frost, bx, bx + b.w * s2);
  }  if (hoverN) {
    const n = hoverN.n;
    const where = inside(n) ? m.buildings.find((bb) => { const l = m.locs.get(n.target); return !!l && l[0] >= bb.x && l[0] < bb.x + bb.w && l[1] >= bb.y && l[1] < bb.y + bb.h; })?.name : null;
    ui.tip([{ text: NPC_BY_ID.get(n.id)?.name ?? n.id, color: C.lavender }, ...(where ? [{ text: `Inside ${where}`, color: C.pebble }] : [])]);
  } else if (hoverB) {
    const lines = [{ text: hoverB.name, color: C.amber }];
    const shop = shopFor(hoverB.id);
    if (shop && hoverB.kind === 'shop') {
      const s = shopStatus(g, shop.id);
      lines.push({ text: s.text, color: s.open ? C.lime : C.pebble });
    }
    const who = dots.filter((d) => inside(d.n) && (() => { const l = m.locs.get(d.n.target); return !!l && l[0] >= hoverB!.x && l[0] < hoverB!.x + hoverB!.w && l[1] >= hoverB!.y && l[1] < hoverB!.y + hoverB!.h; })()).map((d) => NPC_BY_ID.get(d.n.id)?.name ?? d.n.id);
    if (who.length) lines.push({ text: 'Inside: ' + who.join(', '), color: C.pebble });
    ui.tip(lines);
  }
  void mw;
  void mh;
  void st;
  return true;
}

/** A character's head in an 11 px ink-rimmed badge centred on (cx, cy), at 1:1 (the walking sprite's top). */
function headIcon(ui: UI, id: string, cx: number, cy: number, ring: number) {
  const x = cx - 5, y = cy - 5;
  ui.fill(x + 1, y, 9, 11, C.ink);
  ui.fill(x, y + 1, 11, 9, C.ink);
  ui.fill(x + 1, y + 1, 9, 9, ring);
  const ch = sprite(`ch:${id}:2:0`);
  if (!ch?.img) return;
  // the 9x9 at the top of the art, around the anchor column: hair and face
  const sx = ch.x + ch.ox - 4, sy = ch.y + Math.max(0, ch.oy - charArtHeight(id) - 1) + 1;
  ui.ctx.drawImage(ch.img, sx, sy, 9, 9, x + 1, y + 1, 9, 9);
}

/** the map's short building names ('' = no label: the farm's own buildings and plain cottages) */
const MAP_NAME: Record<string, string> = {
  store: 'Mercantile', inn: 'Copper Kettle', smithy: 'Smithy', carpenter: 'Joinery', workshop: 'Workshop', clinic: 'Clinic',
  library: 'Library', mayor_house: 'Manor', ranch: 'Ranch', home_ines: 'Marrow Cottage', home_sable: 'Moss House',
  home_hazel: 'Quill Cottage', fisher_hut: 'Bait & Tackle', hermit_hut: "Thorne's Hollow", clocktower: 'Clocktower', airship: 'Airship',
  mine: '', farmhouse: '', greenhouse: '', house_a: '', house_b: '',
};


// ---------------- museum ----------------
function drawMuseum(ui: UI, play: PlayScreen, st: WinState): boolean {
  const g = play.g;
  const gs = goals(g);
  const w = 360, h = 200;
  const { x, y } = centered(ui, w, h);
  if (!frame(ui, x, y, w, h, 'Library & Museum')) return false;
  ui.para(`Sable keeps the town's collection of minerals, gems and relics. Donated: ${gs.museum.length}/${MUSEUM_TOTAL}. Milestones bring gifts!`, x + 12, y + 12, w - 24, C.walnut);
  const inv = g.player.inv;
  ui.text('Click a gem, mineral or relic to donate it:', x + 12, y + 44, C.ink);
  for (let i = 0; i < 36; i++) {
    const sx = x + 12 + (i % 12) * 22, sy = y + 56 + Math.floor(i / 12) * 22;
    const s = inv.slots[i];
    const ok = s && museumAccepts(ITEMS[s.k >> 2].id) && !gs.museum.includes(ITEMS[s.k >> 2].id);
    const r = ui.slot(sx, sy, s, { dim: !!s && !ok });
    if (r.hover && s) ui.tip(itemTooltip(g, s.k, s.n, [{ text: ok ? 'Click to donate' : gs.museum.includes(ITEMS[s.k >> 2].id) ? 'Already donated' : 'The museum doesn\'t collect this', color: ok ? C.lime : C.pebble }]).slice(0, 4));
    if (r.click && ok && s) donateMuseum(g, ITEMS[s.k >> 2].id);
  }
  ui.text('Next gift at ' + ([5, 10, 15, 20, 25].find((n) => n > gs.museum.length) ?? 'complete!') + ' donations', x + 12, y + h - 18, C.oak);
  void st;
  void NPCS;
  return true;
}

registerWindow('journal', { draw: drawJournal });
registerWindow('map', { draw: drawMap });
registerWindow('museum', { draw: drawMuseum });
registerWindow('mail', { draw: (ui, play, st) => { st.data.tab = 'mail'; return drawJournal(ui, play, st); } });
