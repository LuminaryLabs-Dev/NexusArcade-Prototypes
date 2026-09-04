import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildGameManifest } from "./build-game-manifest.mjs";
import { assertPublishablePath, fileRecord, hashDirectory } from "./hash-game-files.mjs";

const exec = promisify(execFile);
const ROOT = process.cwd();
const REGISTRY_VERSION = "0.1.0";
const LOCAL_REPOSITORY = "LuminaryLabs-Dev/NexusArcade-Prototypes";
const EXCLUDED_LOCAL = new Set(["game.json", "game.ref.json", "index.parts.json"]);

async function json(relative) {
  return JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
}

async function gitBytes(ref, file) {
  const { stdout } = await exec("git", ["show", `${ref}:${file}`], { cwd: ROOT, encoding: "buffer", maxBuffer: 100 * 1024 * 1024 });
  return stdout;
}

async function localFiles(sourceRef, slug) {
  const prefix = `prototypes/${slug}/`;
  const { stdout } = await exec("git", ["ls-tree", "-r", "--name-only", sourceRef, "--", prefix], { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 });
  const paths = stdout.trim().split("\n").filter(Boolean).map((file) => file.slice(prefix.length)).filter((relative) => {
    if (EXCLUDED_LOCAL.has(relative)) return false;
    if (relative.startsWith(".parts/")) return false;
    return true;
  }).sort((a, b) => a.localeCompare(b));
  return Promise.all(paths.map(async (relative) => {
    assertPublishablePath(relative);
    return fileRecord(relative, await gitBytes(sourceRef, `${prefix}${relative}`));
  }));
}

function thumbnailUrl(source, thumbnail) {
  if (!thumbnail) return undefined;
  return `https://cdn.jsdelivr.net/gh/${source.repository}@${source.ref}/${source.basePath}/${thumbnail}`;
}

async function build() {
  const lock = await json("registry/source-lock.json");
  const registryLock = await json("registry/ref-lock.json");
  if (!/^[a-f0-9]{40}$/.test(lock.localSourceRef || "")) throw new Error("registry/source-lock.json requires localSourceRef as a full commit SHA");
  if (!/^(?:registry-v\d+\.\d+\.\d+|[a-f0-9]{40})$/.test(registryLock.ref || "")) throw new Error("registry/ref-lock.json requires an immutable tag or full commit SHA");
  const entries = (await readdir(path.join(ROOT, "prototypes"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));
  const games = [];
  const manifests = new Map();
  for (const entry of entries) {
    const slug = entry.name;
    const localPath = `prototypes/${slug}/game.json`;
    let metadata;
    let source;
    let files;
    try {
      metadata = await json(localPath);
      source = { repository: LOCAL_REPOSITORY, ref: lock.localSourceRef, basePath: `prototypes/${slug}` };
      files = await localFiles(lock.localSourceRef, slug);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      metadata = await json(`prototypes/${slug}/game.ref.json`);
      source = { repository: metadata.source.repository, ref: metadata.source.ref, basePath: metadata.source.deployPath };
      files = await hashDirectory(path.join(ROOT, "_site", "games", slug));
    }
    const manifest = buildGameManifest({ metadata, source, files });
    manifests.set(metadata.id, manifest);
    const game = {
      id: metadata.id,
      slug,
      title: metadata.title,
      description: metadata.description || "",
      genre: metadata.genre || "Prototype",
      version: metadata.version,
      status: metadata.status || "prototype",
      featured: metadata.featured === true,
      sortOrder: Number.isFinite(metadata.sortOrder) ? metadata.sortOrder : 9999,
      controls: Array.isArray(metadata.controls) ? metadata.controls : [],
      manifestPath: `registry/games/${metadata.id}.json`,
    };
    const thumbnail = thumbnailUrl(source, metadata.thumbnail);
    if (thumbnail) game.thumbnail = thumbnail;
    games.push(game);
  }
  games.sort((a, b) => a.id.localeCompare(b.id));
  const index = { schemaVersion: 1, registryVersion: REGISTRY_VERSION, games };
  const latest = { schemaVersion: 1, registryVersion: REGISTRY_VERSION, ref: registryLock.ref, indexPath: "registry/index.json" };
  return { latest, index, manifests };
}

async function serialize(output) {
  const records = new Map([
    ["registry/latest.json", output.latest],
    ["registry/index.json", output.index],
    ...[...output.manifests].map(([id, manifest]) => [`registry/games/${id}.json`, manifest]),
  ]);
  return new Map([...records].map(([file, value]) => [file, `${JSON.stringify(value, null, 2)}\n`]));
}

const output = await serialize(await build());
if (process.argv.includes("--check")) {
  for (const [file, expected] of output) {
    const actual = await readFile(path.join(ROOT, file), "utf8");
    if (actual !== expected) throw new Error(`${file} is stale; run npm run build:registry`);
  }
  console.log(`registry is deterministic and current (${output.size - 2} games)`);
} else {
  await mkdir(path.join(ROOT, "registry", "games"), { recursive: true });
  for (const [file, contents] of output) await writeFile(path.join(ROOT, file), contents);
  const digest = createHash("sha256").update([...output.values()].join("\n")).digest("hex");
  console.log(`built ${output.size - 2} game manifests (registry digest ${digest})`);
}
