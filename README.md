# NexusArcade Prototypes

A staging repository for self-contained NexusArcade game prototypes.

## Repository model

```text
prototypes/
  _template/
    index.html
    game.json
  <game-slug>/
    index.html
    game.json
    ...assets

catalog/
  index.html

scripts/
  build-site.mjs

.github/workflows/
  publish-prototypes.yml
```

Every folder under `prototypes/` that does **not** begin with `_` is treated as a launchable game.

## Prototype contract

Each prototype must contain:

- `index.html` — launch entrypoint
- `game.json` — catalog metadata

Example `game.json`:

```json
{
  "title": "Rift Runner",
  "slug": "rift-runner",
  "description": "Fast arcade combat prototype.",
  "genre": "Arcade",
  "status": "prototype",
  "version": "0.1.0",
  "controls": ["Keyboard", "Mouse"]
}
```

The folder name and `slug` must match and use lowercase kebab-case.

## Publish flow

Every push to `main` runs `.github/workflows/publish-prototypes.yml`:

```text
main push
   ↓
validate prototypes
   ↓
generate catalog.json
   ↓
copy each prototype into its own /games/<slug>/ directory
   ↓
publish the complete site with GitHub Pages
```

The Pages root is the prototype catalog. Each game is independently launchable at:

```text
.../NexusArcade-Prototypes/games/<slug>/
```

## Add a prototype

1. Copy `prototypes/_template/` to `prototypes/<game-slug>/`.
2. Replace `index.html` with the complete self-contained game.
3. Update `game.json`.
4. Push to `main`.
5. The workflow validates and republishes the catalog automatically.

The build intentionally fails if a prototype is malformed so a bad upload cannot silently replace the live catalog.

> GitHub Pages must use **GitHub Actions** as its deployment source for `actions/deploy-pages` to publish the site.
