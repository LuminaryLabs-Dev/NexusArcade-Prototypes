# NexusArcade Prototypes

A launchable prototype library for NexusArcade games.

## Installation registry

The public installer contract lives under `registry/`. `registry/latest.json` is the only moving pointer; it selects an immutable release commit (or `registry-v*` tag) containing the sorted master index and one integrity manifest per permanent game ID.

Game files are installed through jsDelivr from full 40-character commit SHAs. The registry records every file's exact byte length and SHA-256 digest. Run `npm test` to rebuild the Pages output, validate IDs and verify each manifest against its immutable source bytes.

To prepare a registry release after changing game files:

1. Commit the game/source changes.
2. Put that commit SHA in `registry/source-lock.json`.
3. Run `npm run build:registry` and commit the generated registry.
4. Put that immutable registry commit SHA (or release tag) in `registry/ref-lock.json`, regenerate, and commit the moving pointer.

Permanent IDs are never reassigned. Catalog display order remains independent through `featured` and `sortOrder`.

## Deployment states

A game can exist in one of two states.

### 1. Local prototype

The complete prototype lives in this repository:

```text
prototypes/<game-slug>/
  index.html
  game.json
  ...public assets
```

Every local prototype must contain `game.json` and either `index.html` or `index.parts.json`. Multipart HTML is reassembled into a normal public `index.html` during the build; it is only a repository-storage option for large single-file games.

### 2. Promoted / referenced game

After a game is promoted into its own repository, its source becomes independent. NexusArcade-Prototypes keeps only a deployment reference:

```text
prototypes/<game-slug>/
  game.ref.json
```

Example:

```json
{
  "title": "Rift Runner",
  "slug": "rift-runner",
  "description": "High-speed arcade shooter.",
  "genre": "Arcade Shooter",
  "status": "promoted",
  "version": "1.0.0",
  "controls": ["WASD", "Mouse"],
  "source": {
    "repository": "LuminaryLabs-Dev/NexusArcade-RiftRunner",
    "ref": "0123456789abcdef0123456789abcdef01234567",
    "deployPath": "dist",
    "publishPaths": ["index.html", "assets"]
  }
}
```

`ref` must be a full commit SHA so an unrelated upstream push cannot change an Arcade deployment. `deployPath` is the public directory in the standalone repository and must contain `index.html`. Optional `publishPaths` is an allowlist relative to that directory; when present it must include `index.html` and prevents tests, package metadata, and other repository files from being published.

## Private repositories

The Pages build can read referenced private repositories through the optional repository secret:

```text
NEXUS_ARCADE_REPO_TOKEN
```

Use a read-only credential scoped only to the game repositories the library must deploy. The token is used only inside the GitHub Actions build and is never written into `_site`.

The build rejects secret-like files inside a deployment directory, including `.env*` files (except `.env.example`), private keys, certificates, credential files, and `.npmrc`/`.pypirc`.

Runtime secrets must never be included in a browser game. If a public game needs a secret while running, it must call a backend that owns that secret.

## Publish flow

```text
push to main
   ↓
resolve local prototypes + referenced repositories
   ↓
validate public deployment contents
   ↓
build catalog.json + copy games to _site
   ↓
open every built game in headless Chrome
   ↓
GitHub Pages
```

The public library is the Pages root. Each game launches at:

```text
.../NexusArcade-Prototypes/games/<slug>/
```

The build fails rather than publishing a malformed prototype or a deployment directory containing secret-like files. CI also parses every script, runs deterministic multiplayer and save checks, verifies reference allowlists, and opens every built game in Chrome before upload.
