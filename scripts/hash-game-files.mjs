import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SECRET_RE = /^(?:\.env(?:\..+)?|\.npmrc|\.pypirc|credentials(?:\..+)?|.*\.(?:pem|key|p12|pfx))$/i;

export function fileRecord(relative, bytes) {
  return {
    path: relative.replaceAll(path.sep, "/"),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function assertPublishablePath(relative) {
  const normalized = relative.replaceAll(path.sep, "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) throw new Error(`Unsafe install path: ${relative}`);
  const name = normalized.split("/").at(-1);
  if (name !== ".env.example" && SECRET_RE.test(name)) throw new Error(`Secret-like file cannot enter an install manifest: ${normalized}`);
  return normalized;
}

export async function listFiles(root) {
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) output.push(assertPublishablePath(path.relative(root, full)));
      else throw new Error(`Unsupported filesystem entry: ${full}`);
    }
  }
  await walk(root);
  return output.sort((a, b) => a.localeCompare(b));
}

export async function hashDirectory(root, include) {
  const paths = (await listFiles(root)).filter((relative) => !include || include(relative));
  return Promise.all(paths.map(async (relative) => fileRecord(relative, await readFile(path.join(root, relative)))));
}
