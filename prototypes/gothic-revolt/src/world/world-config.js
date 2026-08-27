export const WORLD_CONFIG = Object.freeze({
  seed: 76100,
  generatorVersion: 1,
  tileSize: 32,
  chunkTiles: 32,
  chunkPixels: 1024,
  renderRadius: 2,
  collisionRadius: 1,
  tickRate: 60,
  expeditionTicks: 18_000,
  macroChunks: 4,
  navCellSize: 32,
  spire: Object.freeze({ x: 0, y: 0 })
});

export const REGION_DEFINITIONS = Object.freeze([
  { id: 'spirelands', name: 'Spirelands', ground: 0, danger: 1, detail: '#626046' },
  { id: 'rotwood', name: 'Rotwood', ground: 1, danger: 2, detail: '#65763f' },
  { id: 'bone-barrens', name: 'Bone Barrens', ground: 2, danger: 3, detail: '#8a805e' },
  { id: 'bloodfen', name: 'Bloodfen', ground: 3, danger: 4, detail: '#7a3142' },
  { id: 'iron-march', name: 'Iron March', ground: 4, danger: 5, detail: '#657279' },
  { id: 'black-verge', name: 'Black Verge', ground: 5, danger: 6, detail: '#66527d' }
]);

export function tileToChunk(tile) {
  return Math.floor(tile / WORLD_CONFIG.chunkTiles);
}

export function worldToChunk(pixel) {
  return Math.floor(pixel / WORLD_CONFIG.chunkPixels);
}

export function chunkKey(x, y) {
  return `${x},${y}`;
}
