const ID_RE = /^NXA-[0-9]{6}$/;
const SHA_RE = /^[a-f0-9]{40}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function buildGameManifest({ metadata, source, files }) {
  if (!ID_RE.test(metadata.id || "")) throw new Error(`${metadata.slug}: invalid permanent ID`);
  if (!SLUG_RE.test(metadata.slug || "")) throw new Error(`${metadata.id}: invalid slug`);
  if (!VERSION_RE.test(metadata.version || "")) throw new Error(`${metadata.id}: invalid version`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository || "")) throw new Error(`${metadata.id}: invalid source repository`);
  if (!SHA_RE.test(source.ref || "")) throw new Error(`${metadata.id}: source ref must be a full commit SHA`);
  if (!source.basePath || source.basePath.startsWith("/") || source.basePath.split("/").includes("..")) throw new Error(`${metadata.id}: unsafe source base path`);
  if (!files.length || !files.some((file) => file.path === "index.html")) throw new Error(`${metadata.id}: install files must include index.html`);
  const uniquePaths = new Set(files.map((file) => file.path));
  if (uniquePaths.size !== files.length) throw new Error(`${metadata.id}: duplicate install path`);
  return {
    schemaVersion: 1,
    id: metadata.id,
    slug: metadata.slug,
    version: metadata.version,
    entry: "index.html",
    offlineReady: true,
    source,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  };
}
