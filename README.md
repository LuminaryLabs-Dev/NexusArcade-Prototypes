# NexusArcade Prototypes

A launchable prototype library for NexusArcade games.

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
    "ref": "main",
    "deployPath": "dist"
  }
}
```

`deployPath` is the public, deployable directory in the standalone repository and must contain `index.html`.

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
build catalog.json
   ↓
copy games to _site/games/<slug>/
   ↓
GitHub Pages
```

The public library is the Pages root. Each game launches at:

```text
.../NexusArcade-Prototypes/games/<slug>/
```

The build fails rather than publishing a malformed prototype or a deployment directory containing secret-like files.
