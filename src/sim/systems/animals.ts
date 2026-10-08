// Farm animals: live in coops/barns, wander a pen on fair days, need hay, love pets, make goods.
import { ANIMALS, ANIMAL_BY_ID } from '../../data/creatures';
import { STRUCT_BY_ID } from '../../data/structures';
import { Game, registerSystem } from '../Game';
import type { Ent } from '../ents';
import { invTake, PORT_HANDLERS } from '../ports';
import { key, kDef } from '../inventory';
import { siloPort } from './automation';
import { solidAt } from './player';

export interface AnimalState {
  uid: number;
  kind: string;
  name: string;
  home: number;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3;
  moving: boolean;
  walkT: number;
  visible: boolean;
  age: number;
  happy: number;
  fed: boolean;
  petted: boolean;
  baby: boolean;
  tx: number;
  ty: number;
  wait: number;
  emote: string | null;
  emoteT: number;
  made: number;
}

const NAMES = ['Biscuit', 'Clover', 'Pip', 'Marmalade', 'Bramble', 'Dumpling', 'Nutmeg', 'Thimble', 'Juniper', 'Waffles', 'Pebble', 'Toffee', 'Mabel', 'Sprocket', 'Cogsworth', 'Button', 'Hazelnut', 'Muffin', 'Pudding', 'Barley', 'Sorrel', 'Fennel', 'Plum', 'Ginger'];

export function animalSys(g: Game): { list: AnimalState[]; next: number } & Record<string, any> {
  if (!g.sys.animals) g.sys.animals = { list: [], next: 1 };
  const s = g.sys.animals;
  s.at = (gg: Game, x: number, y: number) => {
    let best: AnimalState | null = null, bd = 0.9;
    for (const a of s.list) {
      if (!a.visible) continue;
      const d = Math.hypot(a.x - x, a.y - 0.3 - y);
      if (d < bd) { bd = d; best = a; }
    }
    void gg;
    return best;
  };
  s.pet = pet;
  s.buy = buyAnimal;
  return s;
}

export function buildingsFor(g: Game, kind: 'coop' | 'barn') {
  return g.ents.others.filter((e) => e.def.kind === 'building' && e.def.houses === kind && !e.ghost);
}

export function residents(g: Game, b: Ent) {
  return animalSys(g).list.filter((a) => a.home === b.id);
}

export function buyAnimal(g: Game, kindId: string): string | null {
  const def = ANIMAL_BY_ID.get(kindId)!;
  const tier = (e: Ent) => +e.def.id.split('_')[1];
  const homes = buildingsFor(g, def.building).filter((b) => tier(b) >= def.tier && residents(g, b).length < (b.def.capacity ?? 4));
  if (!homes.length) {
    const any = buildingsFor(g, def.building).length;
    return any ? `You need a ${def.building === 'coop' ? 'coop' : 'barn'} upgraded to tier ${def.tier} with room.` : `You need a ${def.building} first (Oakroot Joinery).`;
  }
  if (g.player.money < def.price) return "You can't afford that.";
  g.player.money -= def.price;
  const s = animalSys(g);
  const b = homes[0];
  s.list.push({
    uid: s.next++, kind: kindId, name: NAMES[(s.next * 7) % NAMES.length], home: b.id, x: b.x + b.w / 2, y: b.y + b.h + 0.6, dir: 2, moving: false, walkT: 0,
    visible: false, age: 0, happy: 140, fed: false, petted: false, baby: true, tx: 0, ty: 0, wait: 0, emote: null, emoteT: 0, made: 0,
  });
  g.emit({ t: 'sfx', id: 'buy' });
  g.count('animals_bought');
  return null;
}

function pet(g: Game, a: AnimalState) {
  if (!a.petted) {
    a.petted = true;
    a.happy = Math.min(255, a.happy + 30);
    g.addXp('farming', 3);
  }
  a.emote = 'heart';
  a.emoteT = 1.6;
  a.wait = 1.5;
  a.moving = false;
  g.emit({ t: 'sfx', id: 'heart', v: 0.6 });
  g.emit({ t: 'fx', kind: 'hearts', x: a.x, y: a.y });
  const def = ANIMAL_BY_ID.get(a.kind)!;
  g.toast(`${a.name} the ${def.name.toLowerCase()} ${a.happy > 200 ? 'adores you' : a.happy > 120 ? 'is content' : 'seems a little lonely'}.`);
}

function outsideWeather(g: Game) {
  return !g.isRaining() && g.weather !== 'snow' && g.time.season !== 3 && g.time.min >= 540 && g.time.min < 1050;
}

function penCenter(b: Ent): [number, number] {
  return [b.x + b.w / 2, b.y + b.h + 2.5];
}

function wander(g: Game, a: AnimalState, dt: number) {
  const b = g.ents.get(a.home);
  if (!b) return;
  const out = outsideWeather(g);
  if (!out) {
    a.visible = false;
    a.x = b.x + b.w / 2;
    a.y = b.y + b.h + 0.6;
    return;
  }
  if (!a.visible) {
    a.visible = true;
    a.x = b.x + b.w / 2;
    a.y = b.y + b.h + 0.6;
  }
  if (a.emoteT > 0 && (a.emoteT -= dt) <= 0) a.emote = null;
  if (a.wait > 0) {
    a.wait -= dt;
    a.moving = false;
    return;
  }
  if (!a.moving) {
    const [cx, cy] = penCenter(b);
    a.tx = cx + (g.rng.next() - 0.5) * 8;
    a.ty = cy + (g.rng.next() - 0.5) * 5;
    a.moving = true;
  }
  const dx = a.tx - a.x, dy = a.ty - a.y;
  const d = Math.hypot(dx, dy);
  const sp = (a.baby ? 0.9 : 1.2) * dt;
  if (d < 0.1) {
    a.moving = false;
    a.wait = 1 + g.rng.next() * 4;
    return;
  }
  const nx = a.x + (dx / d) * sp, ny = a.y + (dy / d) * sp;
  if (solidAt(g, Math.floor(nx), Math.floor(ny))) {
    a.moving = false;
    a.wait = 0.5;
    return;
  }
  a.x = nx;
  a.y = ny;
  a.dir = dx > 0 ? 1 : 3;
  a.walkT += sp;
}

function dayEndAnimals(g: Game) {
  const s = animalSys(g);
  for (const b of g.ents.others) {
    if (b.def.kind !== 'building' || !b.def.houses) continue;
    const res = residents(g, b);
    if (!res.length) continue;
    const tier = +b.def.id.split('_')[1];
    for (const a of res) {
      const def = ANIMAL_BY_ID.get(a.kind)!;
      // feed: grazed outside today, or hay from the feeder, or (grand buildings) straight from the silo
      let fed = a.fed;
      if (!fed && (b.st.hay ?? 0) > 0) {
        b.st.hay--;
        fed = true;
      }
      if (!fed && (tier >= 3 || g.flags.has('auto_feed')) && (g.sys.hay ?? 0) > 0) {
        g.sys.hay--;
        fed = true;
      }
      a.happy = Math.max(0, Math.min(255, a.happy + (fed ? 0 : -45) + (a.petted ? 0 : -15) + (a.visible || a.fed ? 8 : 0)));
      a.age++;
      if (a.age >= 3) a.baby = false;
      if (fed && !a.baby && a.age % def.every === 0) {
        const deluxe = def.deluxe && a.happy > 200 && g.rng.next() < 0.35;
        const pid = deluxe ? def.deluxe! : def.product;
        const q = a.happy > 230 ? 2 : a.happy > 170 ? 1 : 0;
        if (pid === 'truffle' && (g.isRaining() || g.time.season === 3)) continue;
        const k = key(pid, kDef(key(pid)).quality ? q : 0);
        const left = b.inv!.add(k, 1);
        if (!left) {
          g.stats.add(k, 1);
          a.made++;
        }
      }
      a.fed = false;
      a.petted = false;
    }
  }
  void s;
}

registerSystem({
  name: 'animals',
  tick(g, dt) {
    const s = g.sys.animals;
    if (!s || !s.list.length) return;
    for (const a of s.list) {
      wander(g, a, dt);
      // grazing on fair days counts as a meal
      if (a.visible && !a.fed && g.rng.next() < dt * 0.02) a.fed = true;
    }
  },
  dayEnd(g) {
    dayEndAnimals(g);
  },
  dayStart(g) {
    const s = animalSys(g);
    // animals of removed buildings move to another home or run off to the ranch
    for (const a of [...s.list]) {
      if (!g.ents.get(a.home)) {
        const def = ANIMAL_BY_ID.get(a.kind)!;
        const nb = buildingsFor(g, def.building).find((b) => residents(g, b).length < (b.def.capacity ?? 4));
        if (nb) a.home = nb.id;
        else s.list.splice(s.list.indexOf(a), 1);
      }
    }
    g.sys.buildings = {
      upgrade: (gg: Game, b: Ent, id: string) => {
        b.def = STRUCT_BY_ID.get(id)!;
        b.inv!.resize(12);
        gg.ents.version++;
      },
    };
  },
  save(g) {
    const s = animalSys(g);
    return { next: s.next, list: s.list.map((a) => { const b = g.ents.get(a.home); return { uid: a.uid, kind: a.kind, name: a.name, hx: b?.x ?? -1, hy: b?.y ?? -1, age: a.age, happy: a.happy, made: a.made }; }) };
  },
  load(g, d) {
    const s = animalSys(g);
    s.next = d.next ?? 1;
    s.list = (d.list ?? []).filter((a: any) => ANIMAL_BY_ID.has(a.kind)).map((a: any) => ({
      ...a, x: 0, y: 0, dir: 2, moving: false, walkT: 0, visible: false, fed: false, petted: false, baby: a.age < 3, tx: 0, ty: 0, wait: 0, emote: null, emoteT: 0,
    }));
  },
  afterLoad(g) {
    // building ids changed during load: remap animal homes by saved position
    const s = animalSys(g);
    for (const a of s.list as any[]) {
      const b = a.hx >= 0 ? g.ents.rootAt(a.hx, a.hy) : null;
      if (b && b.def.kind === 'building') a.home = b.id;
      else {
        const def = ANIMAL_BY_ID.get(a.kind)!;
        const nb = buildingsFor(g, def.building).find((b) => residents(g, b).length < (b.def.capacity ?? 4));
        if (nb) a.home = nb.id;
      }
    }
  },
});

PORT_HANDLERS.building = {
  accept: (g, e, k) => {
    if (e.def.id === 'silo') return siloPort.accept(g, e, k);
    if (e.def.houses && kDef(k).id === 'hay') return Math.max(0, 40 - (e.st.hay ?? 0));
    return 0;
  },
  insert: (g, e, k, n) => {
    if (e.def.id === 'silo') return siloPort.insert(g, e, k, n);
    if (!e.def.houses || kDef(k).id !== 'hay') return 0;
    const can = Math.min(n, 40 - (e.st.hay ?? 0));
    e.st.hay = (e.st.hay ?? 0) + can;
    return can;
  },
  take: (g, e, pred, max) => {
    if (e.def.id === 'silo') return siloPort.take(g, e, pred, max);
    return invTake(e, pred, max);
  },
};

export { ANIMALS };
