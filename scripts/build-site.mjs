import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PROTOTYPES_DIR = path.join(ROOT, 'prototypes');
const CATALOG_SOURCE = path.join(ROOT, 'catalog', 'index.html');
const OUT_DIR = path.join(ROOT, '_site');
const GAMES_OUT = path.join(OUT_DIR, 'games');
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SECRET_RE = /^(?:\.env(?:\..+)?|\.npmrc|\.pypirc|credentials(?:\..+)?|.*\.(?:pem|key|p12|pfx))$/i;

const fail = (message) => { throw new Error(`[prototype-build] ${message}`); };
const exists = async (p) => { try { await readFile(p); return true; } catch { return false; } };
const text = (value, field, slug) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${slug}: "${field}" must be a non-empty string`);
  return value.trim();
};
const stringArray = (value, field, slug) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) fail(`${slug}: "${field}" must be an array of non-empty strings`);
  return value.map((v) => v.trim());
};
async function json(file, label, slug) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { fail(`${slug}: invalid ${label} (${error.message})`); }
}
function gameFrom(manifest, slug, sourceType) {
  const manifestSlug = text(manifest.slug, 'slug', slug);
  if (manifestSlug !== slug) fail(`${slug}: manifest slug "${manifestSlug}" must match its folder name`);
  return {
    slug,
    title: text(manifest.title, 'title', slug),
    description: typeof manifest.description === 'string' ? manifest.description.trim() : '',
    genre: typeof manifest.genre === 'string' && manifest.genre.trim() ? manifest.genre.trim() : 'Prototype',
    status: typeof manifest.status === 'string' && manifest.status.trim() ? manifest.status.trim() : (sourceType === 'reference' ? 'promoted' : 'prototype'),
    version: typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '0.0.0',
    controls: stringArray(manifest.controls, 'controls', slug),
    sourceType,
    launchUrl: `./games/${slug}/`,
  };
}
async function noSecrets(root, slug) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name !== '.env.example' && SECRET_RE.test(entry.name)) fail(`${slug}: refusing to publish secret-like file "${path.relative(root, full)}"`);
    }
  }
}
async function thumbnail(game, manifest, sourceDir, slug) {
  const value = typeof manifest.thumbnail === 'string' ? manifest.thumbnail.trim() : '';
  if (!value) return;
  if (!(await exists(path.join(sourceDir, value)))) fail(`${slug}: thumbnail "${value}" does not exist`);
  game.thumbnail = `./games/${slug}/${value.replaceAll('\\', '/')}`;
}
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}
async function assembleParts(sourceDir, outDir, slug) {
  const spec = await json(path.join(sourceDir, 'index.parts.json'), 'index.parts.json', slug);
  if (!Array.isArray(spec.parts) || !spec.parts.length) fail(`${slug}: index.parts.json requires a non-empty parts array`);
  let html = '';
  for (const rel of spec.parts) {
    const part = text(rel, 'parts[]', slug);
    if (path.isAbsolute(part) || part.split(/[\\/]+/).includes('..')) fail(`${slug}: multipart path must stay inside the prototype folder`);
    const full = path.join(sourceDir, part);
    if (!(await exists(full))) fail(`${slug}: missing multipart file "${part}"`);
    html += await readFile(full, 'utf8');
  }
  await writeFile(path.join(outDir, 'index.html'), html);
}
async function localPrototype(sourceDir, slug) {
  const manifestPath = path.join(sourceDir, 'game.json');
  if (!(await exists(manifestPath))) fail(`${slug}: missing game.json`);
  const hasIndex = await exists(path.join(sourceDir, 'index.html'));
  const hasParts = await exists(path.join(sourceDir, 'index.parts.json'));
  if (hasIndex === hasParts) fail(`${slug}: provide exactly one of index.html or index.parts.json`);

  const manifest = await json(manifestPath, 'game.json', slug);
  const game = gameFrom(manifest, slug, 'local');
  await thumbnail(game, manifest, sourceDir, slug);
  await noSecrets(sourceDir, slug);
  const outDir = path.join(GAMES_OUT, slug);
  await cp(sourceDir, outDir, { recursive: true });
  if (hasParts) await assembleParts(sourceDir, outDir, slug);
  return game;
}
async function referencedSource(reference, slug) {
  const source = reference.source;
  if (!source || typeof source !== 'object') fail(`${slug}: game.ref.json requires a source object`);
  const repository = text(source.repository, 'source.repository', slug);
  if (!REPO_RE.test(repository)) fail(`${slug}: source.repository must be "owner/repo"`);
  const ref = typeof source.ref === 'string' && source.ref.trim() ? source.ref.trim() : 'main';
  const deployPath = text(source.deployPath, 'source.deployPath', slug);
  if (path.isAbsolute(deployPath) || deployPath.split(/[\\/]+/).includes('..')) fail(`${slug}: source.deployPath must stay inside the referenced repository`);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), `nexusarcade-${slug}-`));
  const archive = path.join(tempDir, 'repo.tar.gz');
  const extracted = path.join(tempDir, 'repo');
  await mkdir(extracted, { recursive: true });
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'NexusArcade-Prototypes' };
  const token = process.env.NEXUS_ARCADE_REPO_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/tarball/${encodeURIComponent(ref)}`, { headers, redirect: 'follow' });
  if (!response.ok) fail(`${slug}: could not fetch ${repository}@${ref}: HTTP ${response.status}${token ? '' : ' (set NEXUS_ARCADE_REPO_TOKEN for private repositories)'}`);
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  try { await run('tar', ['-xzf', archive, '-C', extracted, '--strip-components=1']); }
  catch (error) { fail(`${slug}: could not extract referenced repository (${error.message})`); }

  const root = path.resolve(extracted);
  const deployDir = path.resolve(extracted, deployPath);
  if (deployDir !== root && !deployDir.startsWith(`${root}${path.sep}`)) fail(`${slug}: source.deployPath escaped the referenced repository`);
  if (!(await exists(path.join(deployDir, 'index.html')))) fail(`${slug}: ${repository}@${ref}/${deployPath} is missing index.html`);
  return { tempDir, deployDir, repository, ref };
}
async function referencePrototype(sourceDir, slug) {
  const reference = await json(path.join(sourceDir, 'game.ref.json'), 'game.ref.json', slug);
  const game = gameFrom(reference, slug, 'reference');
  const fetched = await referencedSource(reference, slug);
  try {
    await thumbnail(game, reference, fetched.deployDir, slug);
    await noSecrets(fetched.deployDir, slug);
    await cp(fetched.deployDir, path.join(GAMES_OUT, slug), { recursive: true });
  } finally { await rm(fetched.tempDir, { recursive: true, force: true }); }
  game.sourceRepository = fetched.repository;
  game.sourceRef = fetched.ref;
  return game;
}
async function loadPrototype(entry) {
  const slug = entry.name;
  if (!SLUG_RE.test(slug)) fail(`${slug}: folder names must be lowercase kebab-case`);
  const sourceDir = path.join(PROTOTYPES_DIR, slug);
  const hasReference = await exists(path.join(sourceDir, 'game.ref.json'));
  const hasLocal = await exists(path.join(sourceDir, 'game.json')) || await exists(path.join(sourceDir, 'index.html')) || await exists(path.join(sourceDir, 'index.parts.json'));
  if (hasReference && hasLocal) fail(`${slug}: choose local files OR game.ref.json, not both`);
  return hasReference ? referencePrototype(sourceDir, slug) : localPrototype(sourceDir, slug);
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(GAMES_OUT, { recursive: true });
if (!(await exists(CATALOG_SOURCE))) fail('catalog/index.html is missing');
const entries = (await readdir(PROTOTYPES_DIR, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .sort((a, b) => a.name.localeCompare(b.name));
const games = [];
for (const entry of entries) games.push(await loadPrototype(entry));
games.sort((a, b) => a.title.localeCompare(b.title));
await cp(CATALOG_SOURCE, path.join(OUT_DIR, 'index.html'));
await writeFile(path.join(OUT_DIR, 'catalog.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), count: games.length, games }, null, 2)}\n`);
await writeFile(path.join(OUT_DIR, '.nojekyll'), '');
console.log(`[prototype-build] ${games.length} launchable prototype(s) built`);
for (const game of games) console.log(` - ${game.slug} [${game.sourceType}] -> ${game.launchUrl}`);
