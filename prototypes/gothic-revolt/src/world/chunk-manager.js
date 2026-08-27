import { buildingAtWorld, buildingColliders } from './building-generator.js';
import { generateChunk } from './chunk-generator.js';
import { WORLD_CONFIG, chunkKey, worldToChunk } from './world-config.js';

export class ChunkManager {
  constructor(worldSeed = WORLD_CONFIG.seed, persistence = null) {
    this.worldSeed = worldSeed;
    this.persistence = persistence;
    this.chunks = new Map();
    this.centerX = 0;
    this.centerY = 0;
  }

  get(x, y) {
    const key = chunkKey(x, y);
    if (!this.chunks.has(key)) this.chunks.set(key, generateChunk(x, y, this.worldSeed));
    return this.chunks.get(key);
  }

  update(pixelX, pixelY) {
    this.centerX = worldToChunk(pixelX);
    this.centerY = worldToChunk(pixelY);
    const retained = new Set();
    for (let y = this.centerY - WORLD_CONFIG.renderRadius; y <= this.centerY + WORLD_CONFIG.renderRadius; y += 1) {
      for (let x = this.centerX - WORLD_CONFIG.renderRadius; x <= this.centerX + WORLD_CONFIG.renderRadius; x += 1) {
        const chunk = this.get(x, y);
        retained.add(chunk.key);
        this.persistence?.discoverChunk(chunk);
      }
    }
    for (const key of this.chunks.keys()) if (!retained.has(key)) this.chunks.delete(key);
  }

  visibleChunks() {
    return [...this.chunks.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  activeChunks() {
    return this.visibleChunks().filter((chunk) => (
      Math.abs(chunk.x - this.centerX) <= WORLD_CONFIG.collisionRadius
      && Math.abs(chunk.y - this.centerY) <= WORLD_CONFIG.collisionRadius
    ));
  }

  activeBuildings() {
    const unique = new Map();
    for (const chunk of this.activeChunks()) for (const building of chunk.buildings) unique.set(building.id, building);
    return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  colliders() {
    const result = [];
    for (const chunk of this.activeChunks()) {
      for (const prop of chunk.props) {
        if (prop.solid && !this.persistence?.isShortcutOpen(prop.id)) {
          const gate = prop.kind === 'gate';
          result.push({ id: prop.id, x: prop.x - (gate ? 30 : 10), y: prop.y - 10, width: gate ? 60 : 20, height: 20, kind: prop.kind });
        }
      }
    }
    for (const building of this.activeBuildings()) result.push(...buildingColliders(building));
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  buildingAt(pixelX, pixelY) {
    return buildingAtWorld(pixelX, pixelY, this.worldSeed);
  }
}
