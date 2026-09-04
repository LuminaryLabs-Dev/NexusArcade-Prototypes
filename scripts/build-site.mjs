import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PROTOTYPES_DIR = path.join(ROOT, 'prototypes');
const CATALOG_SOURCE = path.join(ROOT, 'catalog', 'index.html');
const CATALOG_FAVICON = path.join(ROOT, 'catalog', 'favicon.ico');
const OUT_DIR = path.join(ROOT, '_site');
const GAMES_OUT = path.join(OUT_DIR, 'games');
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SECRET_RE = /^(?:\.env(?:\..+)?|\.npmrc|\.pypirc|credentials(?:\..+)?|.*\.(?:pem|key|p12|pfx))$/i;

const fail = (message) => { throw new Error(`[prototype-build] ${message}`); };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const text = (value, field, slug) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${slug}: "${field}" must be a non-empty string`);
  return value.trim();
};
const stringArray = (value, field, slug) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) fail(`${slug}: "${field}" must be an array of non-empty strings`);
  return value.map((v) => v.trim());
};
const optionalString = (value) => typeof value === 'string' && value.trim() ? value.trim() : '';
const safeRelative = (value, field, slug) => {
  const rel = text(value, field, slug);
  if (path.isAbsolute(rel) || rel.split(/[\\/]+/).includes('..')) fail(`${slug}: "${field}" must stay inside the deployable directory`);
  return rel;
};
const sortOrder = (value, slug) => {
  if (value === undefined) return 9999;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${slug}: "sortOrder" must be a finite number`);
  return value;
};

async function json(file, label, slug) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { fail(`${slug}: invalid ${label} (${error.message})`); }
}
function gameFrom(manifest, slug, sourceType) {
  const id = text(manifest.id, 'id', slug);
  if (!/^NXA-[0-9]{6}$/.test(id)) fail(`${slug}: "id" must match NXA-000000`);
  const manifestSlug = text(manifest.slug, 'slug', slug);
  if (manifestSlug !== slug) fail(`${slug}: manifest slug "${manifestSlug}" must match its folder name`);
  return {
    id,
    slug,
    title: text(manifest.title, 'title', slug),
    description: optionalString(manifest.description),
    genre: optionalString(manifest.genre) || 'Prototype',
    status: optionalString(manifest.status) || (sourceType === 'reference' ? 'promoted' : 'prototype'),
    version: optionalString(manifest.version) || '0.0.0',
    controls: stringArray(manifest.controls, 'controls', slug),
    featured: manifest.featured === true,
    accent: optionalString(manifest.accent) || 'cyan',
    sortOrder: sortOrder(manifest.sortOrder, slug),
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
  const value = optionalString(manifest.thumbnail);
  if (!value) return;
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) fail(`${slug}: thumbnail must stay inside the deployable game directory`);
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
    // Multipart files are storage chunks, not line-oriented templates. Editors add a
    // terminal newline to each chunk, which would otherwise split HTML tags and JS tokens.
    html += (await readFile(full, 'utf8')).replace(/\r?\n$/, '');
  }
  await writeFile(path.join(outDir, 'index.html'), html);
}
async function localPrototype(sourceDir, slug) {
  const manifestPath = path.join(sourceDir, 'game.json');
  if (!(await exists(manifestPath))) fail(`${slug}: missing game.json`);
  const hasIndex = await exists(path.join(sourceDir, 'index.html'));
  const hasParts = await exists(path.join(sourceDir, 'index.parts.json'));
  if (!hasIndex && !hasParts) fail(`${slug}: provide index.html or index.parts.json`);

  const manifest = await json(manifestPath, 'game.json', slug);
  const game = gameFrom(manifest, slug, 'local');
  await thumbnail(game, manifest, sourceDir, slug);
  await noSecrets(sourceDir, slug);
  const outDir = path.join(GAMES_OUT, slug);
  await cp(sourceDir, outDir, { recursive: true });
  if (hasParts && !hasIndex) await assembleParts(sourceDir, outDir, slug);
  return game;
}
async function referencedSource(reference, slug) {
  const source = reference.source;
  if (!source || typeof source !== 'object') fail(`${slug}: game.ref.json requires a source object`);
  const repository = text(source.repository, 'source.repository', slug);
  if (!REPO_RE.test(repository)) fail(`${slug}: source.repository must be "owner/repo"`);
  const ref = text(source.ref, 'source.ref', slug);
  if (!/^[a-f0-9]{40}$/i.test(ref)) fail(`${slug}: source.ref must be an immutable 40-character commit SHA`);
  const deployPath = safeRelative(source.deployPath, 'source.deployPath', slug);
  const publishPaths = stringArray(source.publishPaths, 'source.publishPaths', slug).map((entry) => safeRelative(entry, 'source.publishPaths[]', slug));
  if (publishPaths.length && !publishPaths.includes('index.html')) fail(`${slug}: source.publishPaths must include index.html`);

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
  return { tempDir, deployDir, repository, ref, publishPaths };
}
async function copyPublished(sourceDir, outDir, publishPaths, slug) {
  if (!publishPaths.length) {
    await cp(sourceDir, outDir, { recursive: true });
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const rel of publishPaths) {
    const source = path.join(sourceDir, rel);
    if (!(await exists(source))) fail(`${slug}: source.publishPaths entry "${rel}" does not exist`);
    const destination = path.join(outDir, rel);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }
}
async function referencePrototype(sourceDir, slug) {
  const reference = await json(path.join(sourceDir, 'game.ref.json'), 'game.ref.json', slug);
  const game = gameFrom(reference, slug, 'reference');
  const fetched = await referencedSource(reference, slug);
  try {
    await thumbnail(game, reference, fetched.deployDir, slug);
    await noSecrets(fetched.deployDir, slug);
    await copyPublished(fetched.deployDir, path.join(GAMES_OUT, slug), fetched.publishPaths, slug);
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
if (!(await exists(CATALOG_FAVICON))) fail('catalog/favicon.ico is missing');
const entries = (await readdir(PROTOTYPES_DIR, { withFileTypes: true }))
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .sort((a, b) => a.name.localeCompare(b.name));
const games = [];
for (const entry of entries) games.push(await loadPrototype(entry));
games.sort((a, b) =>
  Number(b.featured) - Number(a.featured) ||
  a.sortOrder - b.sortOrder ||
  a.title.localeCompare(b.title) ||
  a.slug.localeCompare(b.slug)
);
await cp(CATALOG_SOURCE, path.join(OUT_DIR, 'index.html'));
await cp(CATALOG_FAVICON, path.join(OUT_DIR, 'favicon.ico'));
await writeFile(path.join(OUT_DIR, 'catalog.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), count: games.length, games }, null, 2)}\n`);
await writeFile(path.join(OUT_DIR, '.nojekyll'), '');
console.log(`[prototype-build] ${games.length} launchable prototype(s) built`);
for (const game of games) console.log(` - ${game.slug} [${game.sourceType}] -> ${game.launchUrl}`);
