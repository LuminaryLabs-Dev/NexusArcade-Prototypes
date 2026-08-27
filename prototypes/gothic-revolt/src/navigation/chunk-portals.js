import { WORLD_CONFIG } from '../world/world-config.js';

export function chunkPortals(chunk) {
  const middle = WORLD_CONFIG.chunkTiles / 2;
  return [
    { id: `${chunk.key}:north`, side: 'north', x: chunk.x * WORLD_CONFIG.chunkTiles + middle, y: chunk.y * WORLD_CONFIG.chunkTiles },
    { id: `${chunk.key}:west`, side: 'west', x: chunk.x * WORLD_CONFIG.chunkTiles, y: chunk.y * WORLD_CONFIG.chunkTiles + middle },
    { id: `${chunk.key}:east`, side: 'east', x: (chunk.x + 1) * WORLD_CONFIG.chunkTiles - 1, y: chunk.y * WORLD_CONFIG.chunkTiles + middle },
    { id: `${chunk.key}:south`, side: 'south', x: chunk.x * WORLD_CONFIG.chunkTiles + middle, y: (chunk.y + 1) * WORLD_CONFIG.chunkTiles - 1 }
  ];
}

export function portalRoute(fromChunk, toChunk) {
  const result = [];
  let x = fromChunk.x;
  let y = fromChunk.y;
  while (x !== toChunk.x) {
    result.push({ x, y, side: x < toChunk.x ? 'east' : 'west' });
    x += Math.sign(toChunk.x - x);
  }
  while (y !== toChunk.y) {
    result.push({ x, y, side: y < toChunk.y ? 'south' : 'north' });
    y += Math.sign(toChunk.y - y);
  }
  return result;
}
