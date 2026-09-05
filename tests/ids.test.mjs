import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const expected = new Map([
  ["blood-maiden", "NXA-000001"],
  ["bubble-raft-assault", "NXA-000002"],
  ["bumble-beez", "NXA-000003"],
  ["chroma-break", "NXA-000004"],
  ["gothic-revolt", "NXA-000005"],
  ["knockout-circuit", "NXA-000006"],
  ["rift-runner", "NXA-000007"],
  ["the-long-haul", "NXA-000008"],
  ["stormbound-shelter-run", "NXA-000009"],
  ["wrong-floor", "NXA-000010"],
]);
const seen = new Set();
for (const [slug, id] of expected) {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join("prototypes", slug, "game.json"), "utf8")); }
  catch { manifest = JSON.parse(await readFile(path.join("prototypes", slug, "game.ref.json"), "utf8")); }
  assert.equal(manifest.slug, slug);
  assert.equal(manifest.id, id, `${slug} must keep its permanent ID`);
  assert(!seen.has(id), `${id} is duplicated`);
  seen.add(id);
}
console.log("permanent game IDs are complete and unique");
