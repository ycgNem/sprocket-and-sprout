// One version's section of PATCHNOTES.md, as a GitHub release body (its heading dropped: the
// release's title says it). Put a few lines on top (where to play, what to know) and pass the file
// to `gh release create ... --notes-file`.
//   node scripts/release-notes.mjs "2.0 beta" > e2e/out/release-notes.md
import fs from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: node scripts/release-notes.mjs "<version as in PATCHNOTES.md>"');
  process.exit(1);
}
const md = fs.readFileSync(new URL('../PATCHNOTES.md', import.meta.url), 'utf8');
const lines = md.split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${version} (`) || l === `## ${version}`);
if (start < 0) {
  console.error(`no "## ${version}" section in PATCHNOTES.md`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
process.stdout.write(lines.slice(start + 1, end).join('\n').trim() + '\n');
