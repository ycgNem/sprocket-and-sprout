// Trading Guild contracts: three bulk orders each week, delivered to the Freight Depot by hand
// or by arm. Contracts pay above market without saturating it, and build guild reputation.
import { CONTRACT_POOL, ContractDef, GUILD_BONUS_PER_RANK, GUILD_RANKS } from '../../data/contracts';
import { ITEMS, ITEM_BY_ID, matchesSpec } from '../../data/items';
import { C } from '../../data/palette';
import { Game, registerSystem } from '../Game';
import { ItemKey, kDef } from '../inventory';
import { PORT_HANDLERS } from '../ports';
import { send } from './goals';

export interface Contract {
  id: string;
  spec: string;
  label: string;
  need: number;
  have: number;
  reward: number;
  rep: number;
  done: boolean;
}

export interface GuildState {
  unlocked: boolean;
  rep: number;
  list: Contract[];
  week: number;
  completed: number;
}

export function guild(g: Game): GuildState {
  if (!g.sys.guild) g.sys.guild = { unlocked: false, rep: 0, list: [], week: -1, completed: 0 } as GuildState;
  return g.sys.guild;
}

export function guildRank(g: Game): number {
  const rep = guild(g).rep;
  let r = 0;
  GUILD_RANKS.forEach((k, i) => { if (rep >= k.rep) r = i; });
  return r;
}

/** shipping price bonus from guild rank */
export function guildBonus(g: Game): number {
  return g.sys.guild ? guildRank(g) * GUILD_BONUS_PER_RANK : 0;
}

function specValid(spec: string): boolean {
  if (spec[0] !== '#') return ITEM_BY_ID.has(spec);
  return ITEMS.some((d) => matchesSpec(d, spec));
}

function unitValue(c: ContractDef): number {
  return c.unit ?? ITEM_BY_ID.get(c.spec)?.price ?? 50;
}

export function specLabel(spec: string): string {
  return spec[0] === '#' ? 'Any ' + spec.slice(1) : ITEM_BY_ID.get(spec)?.name ?? spec;
}

export function postContracts(g: Game) {
  const gs = guild(g);
  const rank = guildRank(g);
  const maxTier = rank >= 4 ? 2 : rank >= 2 ? 1 : 0;
  const pool = CONTRACT_POOL.filter((c) => c.tier <= maxTier && specValid(c.spec));
  const top = pool.filter((c) => c.tier === maxTier);
  const picks: ContractDef[] = [];
  // one from the newest tier, the rest from anything unlocked
  if (top.length) picks.push(g.rng.pick(top));
  for (let tries = 0; picks.length < 3 && tries < 50; tries++) {
    const c = g.rng.pick(pool);
    if (!picks.includes(c)) picks.push(c);
  }
  gs.list = picks.map((c) => {
    const need = Math.max(5, Math.round((c.n * (1 + 0.2 * rank)) / 5) * 5);
    return { id: c.id, spec: c.spec, label: c.label, need, have: 0, reward: Math.round((unitValue(c) * need * 1.5) / 10) * 10, rep: 1 + c.tier, done: false };
  });
  gs.week = Math.floor(g.dayIndex / 7);
}

function matches(k: ItemKey, spec: string) {
  return matchesSpec(kDef(k), spec);
}

export function contractAccept(g: Game, k: ItemKey): number {
  const gs = g.sys.guild as GuildState | undefined;
  if (!gs?.unlocked) return 0;
  let n = 0;
  for (const c of gs.list) if (!c.done && matches(k, c.spec)) n += c.need - c.have;
  return n;
}

function complete(g: Game, c: Contract) {
  const gs = guild(g);
  const before = guildRank(g);
  c.done = true;
  g.player.money += c.reward;
  g.earned += c.reward;
  gs.rep += c.rep;
  gs.completed++;
  g.count('contracts');
  g.emit({ t: 'sfx', id: 'coin' });
  g.emit({ t: 'sfx', id: 'quest' });
  g.toast(`Guild contract filled: ${c.label}! +${c.reward} coins`, 'freight_depot', C.amber);
  const after = guildRank(g);
  if (after > before) {
    const r = GUILD_RANKS[after];
    g.toast(`Guild rank up: ${r.name}! Shipping prices +${Math.round(after * GUILD_BONUS_PER_RANK * 100)}%`, undefined, C.lime);
    send(g, 'guild_rank_' + after, {
      from: 'The Trading Guild', title: `Guild rank: ${r.name}`,
      items: after === 3 ? [{ item: 'f_banner', n: 1 }] : undefined,
      text: `The Thistlewick Trading Guild is pleased to name you ${r.name}.${after === 3 ? ' Please accept the enclosed banner for your home.' : ''} Merchants up and down the river now pay a premium for goods from your farm (+${Math.round(after * GUILD_BONUS_PER_RANK * 100)}% on everything you ship).${after === 2 || after === 4 ? ' Larger, finer contracts will follow.' : ''}\n- Factor Hollis, Trading Guild`,
    });
  }
}

/** deliver items to the open contracts; returns how many were used */
export function contractInsert(g: Game, k: ItemKey, n: number): number {
  const gs = g.sys.guild as GuildState | undefined;
  if (!gs?.unlocked) return 0;
  let used = 0;
  for (const c of gs.list) {
    if (c.done || n <= 0 || !matches(k, c.spec)) continue;
    const t = Math.min(n, c.need - c.have);
    c.have += t;
    n -= t;
    used += t;
    if (c.have >= c.need) complete(g, c);
  }
  if (used) g.stats.use(k, used);
  return used;
}

PORT_HANDLERS.depot = {
  accept: (g, _e, k) => contractAccept(g, k),
  insert: (g, _e, k, n) => contractInsert(g, k, n),
  take: () => null,
};

export function daysLeftInWeek(g: Game) {
  return 7 - (g.dayIndex % 7);
}

registerSystem({
  name: 'contracts',
  dayStart(g) {
    const gs = guild(g);
    if (!gs.unlocked) {
      if (!g.research.done.has('r_arms')) return;
      gs.unlocked = true;
      send(g, 'guild_intro', {
        from: 'The Trading Guild', title: 'A proposal from the Trading Guild',
        text: `Word of your clockwork arms has reached us downriver. The Trading Guild posts three bulk contracts every Monday. Fill them at the enclosed Freight Depot (by hand or by arm) for well above market prices, and without flooding the local market. Contracts expire on Sunday night. Loyal suppliers rise in rank, and every rank earns a premium on everything you ship.\n- Factor Hollis, Trading Guild`,
        items: [{ item: 'freight_depot', n: 1 }],
      });
      g.toast('A letter from the Trading Guild is in your mailbox!', undefined, C.amber);
      postContracts(g);
      return;
    }
    if (g.weekday === 0 || !gs.list.length || gs.week < Math.floor(g.dayIndex / 7) - 1) postContracts(g);
  },
  save(g) {
    return g.sys.guild ?? null;
  },
  load(g, d) {
    if (!d) return;
    const gs = guild(g);
    Object.assign(gs, d);
    gs.list = (gs.list ?? []).filter((c) => specValid(c.spec));
  },
});
