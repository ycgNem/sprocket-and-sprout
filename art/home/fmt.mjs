// Rewrite art/home/fixups.json and sprites.json with one entry per line (readable diffs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(HERE, 'fixups.json'), 'utf8'));
fs.writeFileSync(path.join(HERE, 'fixups.json'), '{\n' + Object.entries(fx).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
const R = JSON.parse(fs.readFileSync(path.join(HERE, 'sprites.json'), 'utf8'));
const head = Object.entries(R).filter(([k]) => k !== 'sprites').map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
fs.writeFileSync(path.join(HERE, 'sprites.json'), '{\n' + head.join(',\n') + ',\n  "sprites": [\n' + R.sprites.map((s) => '    ' + JSON.stringify(s)).join(',\n') + '\n  ]\n}\n');
