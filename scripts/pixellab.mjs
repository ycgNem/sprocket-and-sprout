// Call PixelLab's MCP tools from a script (Streamable HTTP MCP, no SDK). Use it when the PixelLab
// MCP server isn't loaded in the session, or to batch jobs. The token comes from the environment
// only; never commit it (the repo is public).
//
// Usage: PIXELLAB_API_TOKEN=… node scripts/pixellab.mjs <tool> '<json args>'
//        PIXELLAB_API_TOKEN=… node scripts/pixellab.mjs --list | --schema <tool>
//        PIXELLAB_API_TOKEN=… node scripts/pixellab.mjs --fetch-character <id> <dir>  (rotations + animation frames)
//        node scripts/pixellab.mjs --download <url> <file>              (job outputs; no auth needed)
// Prints the tool's text result (PL_OUT=prefix also saves its images). Docs: https://api.pixellab.ai/mcp/docs
import fs from 'node:fs';
import path from 'node:path';

const URL_MCP = 'https://api.pixellab.ai/mcp';
const [cmd, a1, a2] = process.argv.slice(2);

if (cmd === '--download') {
  const res = await fetch(a1, { redirect: 'follow' });
  if (!res.ok) { console.error(`download failed: ${res.status} ${res.statusText}`); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(a2)), { recursive: true });
  fs.writeFileSync(a2, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${a2} (${fs.statSync(a2).size} bytes)`);
  process.exit(0);
}

const token = process.env.PIXELLAB_API_TOKEN;
if (!token || !cmd) { console.error('usage: PIXELLAB_API_TOKEN=… node scripts/pixellab.mjs <tool> [json-args] | --list | --download <url> <file>'); process.exit(2); }

let session = null, nextId = 1;
async function rpc(method, params, notify = false) {
  const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notify ? {} : { id: nextId++ }) };
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + token,
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify(body),
  });
  session = res.headers.get('mcp-session-id') ?? session;
  if (notify) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${text.slice(0, 500)}`);
  // either a JSON body or an SSE stream whose data lines carry the JSON-RPC response
  const msgs = (res.headers.get('content-type') ?? '').includes('text/event-stream')
    ? text.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))
    : [JSON.parse(text)];
  const m = msgs.find((x) => x.id === body.id) ?? msgs.at(-1);
  if (m?.error) throw new Error(`${method}: ${JSON.stringify(m.error)}`);
  return m?.result;
}

await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'sprocket-art-script', version: '1.0' } });
await rpc('notifications/initialized', null, true);
if (cmd === '--fetch-character') {
  // save rotations/<dir>.png and <animation name>/<dir>/<frame>.png under a2
  const r = await rpc('tools/call', { name: 'get_character', arguments: { character_id: a1, include_preview: false } });
  const text = (r?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  let section = '', anim = '';
  const jobs = [];
  for (const line of text.split('\n')) {
    if (/^rotations:/.test(line)) section = 'rotations';
    else if (/^animations/.test(line)) section = 'animations';
    else if (/^\S/.test(line)) section = '';
    const am = section === 'animations' && line.match(/^  (\S.*?) — /);
    if (am) anim = am[1].replace(/[^\w.-]+/g, '_');
    const dm = line.match(/^ {2,4}([a-z-]+): (https:\/\/\S+.*)$/);
    if (!dm || !section) continue;
    const list = dm[2].split(', ').map((u) => u.trim());
    if (section === 'rotations') jobs.push([list[0], path.join(a2, 'rotations', dm[1] + '.png')]);
    else list.forEach((u, i) => jobs.push([u, path.join(a2, anim, dm[1], i + '.png')]));
  }
  for (const [u, f] of jobs) {
    const res = await fetch(u);
    if (!res.ok) { console.error(`failed ${res.status}: ${u}`); continue; }
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`saved ${jobs.length} files under ${a2}`);
  process.exit(0);
}
if (cmd === '--list' || cmd === '--schema') {
  const r = await rpc('tools/list', {});
  for (const t of r.tools) {
    if (cmd === '--list') console.log(t.name);
    else if (t.name === a1) console.log(t.description + '\n' + JSON.stringify(t.inputSchema, null, 1));
  }
} else {
  const r = await rpc('tools/call', { name: cmd, arguments: a1 ? JSON.parse(a1) : {} });
  for (const c of r?.content ?? []) {
    if (c.type === 'text') console.log(c.text);
    else if (c.type === 'image' && process.env.PL_OUT) {
      // PL_OUT=prefix saves image results as prefix-0.png, prefix-1.png …
      const f = `${process.env.PL_OUT}-${r.content.indexOf(c)}.png`;
      fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true });
      fs.writeFileSync(f, Buffer.from(c.data, 'base64'));
      console.log(`[image saved: ${f}]`);
    } else if (c.type === 'image') console.log(`[image ${c.mimeType}, ${c.data.length} base64 chars; set PL_OUT=prefix to save]`);
    else console.log(JSON.stringify(c).slice(0, 400));
  }
  if (r?.isError) process.exit(1);
}
