export async function loadWorldAtlases(baseUrl = new URL('../../assets/world/', import.meta.url)) {
  const manifestUrl = new URL('manifests/tiles.json', baseUrl);
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Tile manifest failed: ${response.status}`);
  const manifest = await response.json();
  const images = new Map();
  await Promise.all(Object.entries(manifest.atlases).map(async ([name, relativePath]) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL(relativePath, manifestUrl).href;
    await image.decode();
    images.set(name, image);
  }));
  return new TileAtlas(manifest, images);
}

export class TileAtlas {
  constructor(manifest, images) {
    this.manifest = manifest;
    this.images = images;
    this.size = manifest.tileSize;
  }

  draw(ctx, atlas, frameIndex, x, y, width = this.size, height = this.size, alpha = 1) {
    const image = this.images.get(atlas);
    if (!image) return false;
    const layout = this.manifest.atlasLayouts?.[atlas] || {
      columns: this.manifest.atlasColumns,
      rows: this.manifest.atlasRows,
      frameCount: this.manifest.atlasColumns * this.manifest.atlasRows
    };
    const index = ((frameIndex % layout.frameCount) + layout.frameCount) % layout.frameCount;
    const sourceX = index % layout.columns * this.size;
    const sourceY = Math.floor(index / layout.columns) * this.size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, sourceX, sourceY, this.size, this.size, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    ctx.restore();
    return true;
  }
}
