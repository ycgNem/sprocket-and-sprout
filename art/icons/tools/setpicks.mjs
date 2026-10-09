// Edit art/icons/picks.json from the command line and keep it compact (one pick per line).
//   node art/icons/tools/setpicks.mjs id=B/3 id2=C/7 ...      set raw picks
//   node art/icons/tools/setpicks.mjs --fmt                   just reformat
//   del:id                                                    remove a raw pick
//   fam:name='{json}'                                         set a family (src/mask/members)
//   ramp:name='["#a",…]'                                     set a ramp
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const file = path.join(HERE, 'picks.json');
const P = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) continue;
  if (a.startsWith('del:')) { delete P.icons[a.slice(4)]; continue; }
  if (a.startsWith('fam:') || a.startsWith('ramp:')) { const i = a.indexOf('='); const [k, n] = [a.slice(0, a.indexOf(':')), a.slice(a.indexOf(':') + 1, i)]; (k === 'fam' ? P.families : P.ramps)[n] = JSON.parse(a.slice(i + 1)); continue; }
  const i = a.indexOf('='); const [id, v] = [a.slice(0, i), a.slice(i + 1)];
  P.icons[id] = v.startsWith('{') ? JSON.parse(v) : v;
}
export function fmt(P) {
  const one = (v) => JSON.stringify(v).replace(/","/g, '", "').replace(/":"/g, '": "').replace(/,"/g, ', "');
  const block = (o, ind) => Object.entries(o).map(([k, v]) => `${ind}${JSON.stringify(k)}: ${one(v)}`).join(',\n');
  let s = '{\n';
  s += ` "about": ${JSON.stringify(P.about)},\n`;
  s += ' "icons": {\n' + block(P.icons, '  ') + '\n },\n';
  s += ' "ramps": {\n' + block(P.ramps, '  ') + '\n },\n';
  s += ' "families": {\n' + Object.entries(P.families).map(([k, f]) => {
    const { members, ...rest } = f;
    return `  ${JSON.stringify(k)}: { ${Object.entries(rest).map(([a, b]) => `${JSON.stringify(a)}: ${one(b)}`).join(', ')},\n   "members": ${one(members)} }`;
  }).join(',\n') + '\n }\n}\n';
  return s;
}
fs.writeFileSync(file, fmt(P));
console.log(`${Object.keys(P.icons).length} picks, ${Object.keys(P.families).length} families`);
