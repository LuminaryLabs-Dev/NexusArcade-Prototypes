import { WORLD_CONFIG } from './world-config.js';

export class PersistentWorldState {
  constructor(save, commit) {
    this.save = save;
    this.commit = commit;
  }

  discoverChunk(chunk) {
    const world = this.save.world;
    if (!world.discoveredChunks.includes(chunk.key)) {
      world.discoveredChunks.push(chunk.key);
      if (world.discoveredChunks.length > 2048) world.discoveredChunks.shift();
      if (chunk.town && !world.discoveredTowns.includes(chunk.town.id)) world.discoveredTowns.push(chunk.town.id);
      this.commit?.();
    }
  }

  discoverLandmark(id) {
    if (!this.save.world.knownLandmarks.includes(id)) {
      this.save.world.knownLandmarks.push(id);
      this.commit?.();
    }
  }

  openShortcut(id) {
    if (!this.save.world.openedShortcuts.includes(id)) {
      this.save.world.openedShortcuts.push(id);
      this.commit?.();
    }
  }

  isShortcutOpen(id) {
    return this.save.world.openedShortcuts.includes(id);
  }

  snapshot() {
    return {
      worldSeed: WORLD_CONFIG.seed,
      generatorVersion: WORLD_CONFIG.generatorVersion,
      discoveredChunks: this.save.world.discoveredChunks.length,
      discoveredTowns: this.save.world.discoveredTowns.length,
      knownLandmarks: this.save.world.knownLandmarks.length,
      openedShortcuts: this.save.world.openedShortcuts.length
    };
  }
}
