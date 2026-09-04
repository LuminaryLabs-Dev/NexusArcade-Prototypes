import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const index = JSON.parse(await readFile("registry/index.json", "utf8"));
for (const game of index.games) {
  const manifest = JSON.parse(await readFile(game.manifestPath, "utf8"));
  assert.equal(manifest.id, game.id);
  assert.equal(manifest.slug, game.slug);
  assert.equal(manifest.version, game.version);
  assert.match(manifest.source.ref, /^[a-f0-9]{40}$/);
  assert(manifest.files.some((file) => file.path === manifest.entry), `${game.id} entry is not installed`);
  const paths = new Set();
  for (const file of manifest.files) {
    assert(!paths.has(file.path), `${game.id} repeats ${file.path}`);
    assert(!file.path.split("/").includes(".."), `${game.id} contains path traversal`);
    paths.add(file.path);
    let bytes;
    if (manifest.source.repository === "LuminaryLabs-Dev/NexusArcade-Prototypes") {
      const object = `${manifest.source.ref}:${manifest.source.basePath}/${file.path}`;
      ({ stdout: bytes } = await exec("git", ["show", object], { encoding: "buffer", maxBuffer: 100 * 1024 * 1024 }));
    } else {
      bytes = await readFile(path.join("_site", "games", game.slug, file.path));
    }
    assert.equal(bytes.byteLength, file.bytes, `${game.id}/${file.path} byte length changed`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, `${game.id}/${file.path} hash changed`);
  }
}
console.log(`verified ${index.games.length} manifests against immutable source bytes`);
