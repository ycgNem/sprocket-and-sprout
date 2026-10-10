// Before a release: every relative import in src/, tests/ and scripts/ must name its file with the
// exact case. Windows doesn't mind a mismatch; the deploy builds on Linux (.github/workflows/deploy.yml),
// where it fails.
//   node scripts/casecheck.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const exts = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts'];
const bad = [];

/** does the path exist with exactly this case, segment by segment? */
function exactExists(p) {
  const parts = path.resolve(p).split(path.sep);
  let cur = parts[0] + path.sep;
  for (let i = 1; i < parts.length; i++) {
    let names;
    try {
      names = fs.readdirSync(cur);
    } catch {
      return false;
    }
    if (!names.includes(parts[i])) return false;
    cur = path.join(cur, parts[i]);
  }
  return true;
}

function check(file) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    const spec = (m[1] ?? m[2]).split('?')[0];
    const base = path.join(path.dirname(file), spec);
    if (!exts.some((e) => exactExists(base + e))) bad.push(`${path.relative(root, file)}: ${spec}`);
  }
}

function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n);
    if (fs.statSync(f).isDirectory()) walk(f);
    else if (/\.(ts|mjs|js)$/.test(n)) check(f);
  }
}

for (const d of ['src', 'tests', 'scripts']) walk(path.join(root, d));
console.log(bad.length ? bad.join('\n') : 'all relative imports match their files exactly');
process.exit(bad.length ? 1 : 0);
