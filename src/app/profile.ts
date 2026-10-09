// Cross-save player profile kept in localStorage: every achievement ever unlocked
// (with the farm and date), farm maps tried, and best Clockwork Rush scores.
const KEY = 'sns_profile_v1';

export interface Profile {
  ach: Record<string, { at: number; farm: string }>;
  maps: string[];
  modes: string[];
  rush: { score: number; medal: number; farm: string; at: number }[];
}

function blank(): Profile {
  return { ach: {}, maps: [], modes: [], rush: [] };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch {
    return blank();
  }
}

function save(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the profile just won't persist */
  }
}

export function recordAch(id: string, farm: string) {
  const p = loadProfile();
  if (p.ach[id]) return;
  p.ach[id] = { at: Date.now(), farm };
  save(p);
}

export function recordStart(map: string, mode: string) {
  const p = loadProfile();
  if (!p.maps.includes(map)) p.maps.push(map);
  if (!p.modes.includes(mode)) p.modes.push(mode);
  save(p);
}

export function recordRush(score: number, medal: number, farm: string) {
  const p = loadProfile();
  p.rush.push({ score, medal, farm, at: Date.now() });
  p.rush.sort((a, b) => b.score - a.score);
  p.rush = p.rush.slice(0, 10);
  save(p);
}
