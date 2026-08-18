import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PROTOTYPES_DIR = path.join(ROOT, 'prototypes');
const CATALOG_SOURCE = path.join(ROOT, 'catalog', 'index.html');
const OUT_DIR = path.join(ROOT, '_site');
const GAMES_OUT = path.join(OUT_DIR, 'games');
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
  throw new Error(`[prototype-build] ${message}`);
}

function asString(value, field, slug) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${slug}: "${field}" must be a non-empty string`);
  }
  return value.trim();
}

function asStringArray(value, field, slug) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${slug}: "${field}" must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadPrototype(dirent) {
  const slug = dirent.name;

  if (!SLUG_RE.test(slug)) {
    fail(`${slug}: folder names must be lowercase kebab-case`);
  }

  const sourceDir = path.join(PROTOTYPES_DIR, slug);
  const manifestPath = path.join(sourceDir, 'game.json');
  const indexPath = path.join(sourceDir, 'index.html');

  if (!(await fileExists(manifestPath))) fail(`${slug}: missing game.json`);
  if (!(await fileExists(indexPath))) fail(`${slug}: missing index.html`);

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail(`${slug}: invalid game.json (${error.message})`);
  }

  const manifestSlug = asString(manifest.slug, 'slug', slug);
  if (manifestSlug !== slug) {
    fail(`${slug}: game.json slug "${manifestSlug}" must match its folder name`);
  }

  const game = {
    slug,
    title: asString(manifest.title, 'title', slug),
    description: typeof manifest.description === 'string' ? manifest.description.trim() : '',
    genre: typeof manifest.genre === 'string' && manifest.genre.trim() ? manifest.genre.trim() : 'Prototype',
    status: typeof manifest.status === 'string' && manifest.status.trim() ? manifest.status.trim() : 'prototype',
    version: typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '0.0.0',
    controls: asStringArray(manifest.controls, 'controls', slug),
    launchUrl: `./games/${slug}/`,
  };

  const thumbnail = typeof manifest.thumbnail === 'string' ? manifest.thumbnail.trim() : '';
  if (thumbnail) {
    const thumbnailPath = path.join(sourceDir, thumbnail);
    if (!(await fileExists(thumbnailPath))) {
      fail(`${slug}: thumbnail "${thumbnail}" does not exist`);
    }
    game.thumbnail = `./games/${slug}/${thumbnail.replaceAll('\\', '/')}`;
  }

  await cp(sourceDir, path.join(GAMES_OUT, slug), { recursive: true });

  return game;
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(GAMES_OUT, { recursive: true });

if (!(await fileExists(CATALOG_SOURCE))) fail('catalog/index.html is missing');

const entries = await readdir(PROTOTYPES_DIR, { withFileTypes: true });
const prototypeDirs = entries
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
  .sort((a, b) => a.name.localeCompare(b.name));

const games = [];
for (const dirent of prototypeDirs) {
  games.push(await loadPrototype(dirent));
}

games.sort((a, b) => a.title.localeCompare(b.title));

await cp(CATALOG_SOURCE, path.join(OUT_DIR, 'index.html'));
await writeFile(
  path.join(OUT_DIR, 'catalog.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), count: games.length, games }, null, 2)}\n`,
);
await writeFile(path.join(OUT_DIR, '.nojekyll'), '');

console.log(`[prototype-build] ${games.length} launchable prototype(s) built`);
for (const game of games) console.log(` - ${game.slug} -> ${game.launchUrl}`);
