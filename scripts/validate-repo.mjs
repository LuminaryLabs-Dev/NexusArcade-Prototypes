import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const read = (relative) => readFile(path.join(ROOT, relative), 'utf8');
const check = (source, label, module = false) => {
  const result = spawnSync(process.execPath, ['--check', `--input-type=${module ? 'module' : 'commonjs'}`], { input: source, encoding: 'utf8' });
  assert.equal(result.status, 0, `${label} has invalid JavaScript:\n${result.stderr}`);
};
const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !/\bsrc\s*=/.test(attrs) && !/type\s*=\s*["']importmap["']/.test(attrs));

const prototypeDirs = (await readdir(path.join(ROOT, 'prototypes'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'));
for (const entry of prototypeDirs) {
  const base = `prototypes/${entry.name}`;
  let html;
  try { html = await read(`${base}/index.html`); }
  catch {
    try {
      const parts = JSON.parse(await read(`${base}/index.parts.json`)).parts;
      html = (await Promise.all(parts.map(async (part) => (await read(`${base}/${part}`)).replace(/\r?\n$/, '')))).join('');
    } catch {
      const reference = JSON.parse(await read(`${base}/game.ref.json`));
      assert.match(reference.source.ref, /^[a-f0-9]{40}$/i, `${entry.name} must use an immutable source ref`);
      continue;
    }
  }
  assert.match(html, /<!doctype html>/i, `${entry.name} must assemble to HTML`);
  for (const [index, [, attrs, source]] of inlineScripts(html).entries()) check(source, `${entry.name} inline script ${index + 1}`, /type\s*=\s*["']module["']/.test(attrs));
}

const javascriptFiles = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.(?:m?js)$/.test(entry.name)) javascriptFiles.push(full);
  }
}
await collect(path.join(ROOT, 'prototypes'));
for (const file of javascriptFiles) check(await readFile(file, 'utf8'), path.relative(ROOT, file), true);

const knockout = await read('prototypes/knockout-circuit/app.mjs');
const knockoutHtml = await read('prototypes/knockout-circuit/index.html');
assert.match(knockout, /session\.tick\(delta\)/, 'Knockout must pump multiplayer while the lobby is visible');
assert.match(knockout, /visibilitychange/);
assert.match(knockoutHtml, /NexusEngine-Kits@2ef76f0/);
assert.match(knockoutHtml, /multiplayer-host-kit\/controller\.js/);

const blood = await read('prototypes/blood-maiden/index.html');
assert.match(blood, /blood-maiden-pilgrimage\/1/);
assert.match(blood, /data-touch="potion"/);
assert.match(blood, /id="ending"/);

const bubble = await read('prototypes/bubble-raft-assault/index.html');
assert.match(bubble, /bubble-raft-campaign\/1/);
assert.match(bubble, /startOrContinueCampaign/);
assert.match(bubble, /New campaign/i);

const gothic = await read('prototypes/gothic-revolt/src/main.js');
for (const skill of ['break','guillotine','chain','decoy','prison','tempest','totem','forest']) assert.match(gothic, new RegExp(`skillRank\\('${skill}'\\)`), `${skill} must affect gameplay`);
const gothicHtml = await read('prototypes/gothic-revolt/index.html');
assert.match(gothicHtml, /data-touch="skill1"/);
assert.match(gothicHtml, /data-touch="skill4"/);

const riftParts = JSON.parse(await read('prototypes/rift-runner/index.parts.json')).parts;
const rift = (await Promise.all(riftParts.map(async (part) => (await read(`prototypes/rift-runner/${part}`)).replace(/\r?\n$/, '')))).join('');
assert.match(rift, /"three":"\.\/vendor\/three\/three\.module\.js"/);
assert.doesNotMatch(rift, /cdn\.jsdelivr\.net\/npm\/three/);
assert.match(await read('prototypes/rift-runner/vendor/three/three.module.js'), /const REVISION = '165'/);

const catalog = await read('catalog/index.html');
assert.match(catalog, /renderFeatured\(games\.filter\(game=>game\.featured\)\)/);
const longHaul = JSON.parse(await read('prototypes/the-long-haul/game.ref.json'));
assert.match(longHaul.source.ref, /^[a-f0-9]{40}$/i);
assert.deepEqual(longHaul.source.publishPaths, ['index.html', 'styles.css', 'src']);

console.log(`repository validation ok: ${prototypeDirs.length} games, ${javascriptFiles.length} JavaScript modules`);
