import { hash32 } from '../simulation/seeded-random.js';
import { rotwoodFrame } from '../art/rotwood-kit.js';
import { WORLD_CONFIG } from '../world/world-config.js';
import { drawBuildingDetails, drawBuildingFloor } from './building-renderer.js';
import { drawRoofs } from './roof-renderer.js';

export class WorldRenderer {
  constructor(atlas) {
    this.atlas = atlas;
  }

  drawGround(ctx, chunks, playerX, playerY, viewportWidth, viewportHeight) {
    const tile = WORLD_CONFIG.tileSize;
    const cameraX = playerX - viewportWidth / 2;
    const cameraY = playerY - viewportHeight / 2;
    ctx.fillStyle = '#0c0d0c';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    for (const chunk of chunks) {
      const startTileX = chunk.x * WORLD_CONFIG.chunkTiles;
      const startTileY = chunk.y * WORLD_CONFIG.chunkTiles;
      for (let localY = 0; localY < WORLD_CONFIG.chunkTiles; localY += 1) {
        for (let localX = 0; localX < WORLD_CONFIG.chunkTiles; localX += 1) {
          const worldX = (startTileX + localX) * tile;
          const worldY = (startTileY + localY) * tile;
          const x = worldX - cameraX;
          const y = worldY - cameraY;
          if (x < -tile || y < -tile || x > viewportWidth || y > viewportHeight) continue;
          const index = localY * WORLD_CONFIG.chunkTiles + localX;
          const variant = hash32(`${chunk.seed}/tile/${localX}/${localY}`) & 3;
          if (chunk.placeStyles?.[index] === 1) {
            const richVariant = hash32(`${chunk.seed}/rotwood/${localX}/${localY}`) & 15;
            this.atlas.draw(ctx, 'rotwood', rotwoodFrame('ground', richVariant), x, y);
            const surfaceDetail = hash32(`${chunk.seed}/rotwood-detail/${localX}/${localY}`);
            if (surfaceDetail % 5 === 0) this.atlas.draw(ctx, 'rotwood', rotwoodFrame('details', 24 + (surfaceDetail & 7)), x, y, tile, tile, 0.42);
            const transition = placeTransitionMask(chunk, localX, localY);
            if (transition) this.atlas.draw(ctx, 'rotwood', rotwoodFrame('moss', transition), x, y);
            if (chunk.roads[index]) {
              const roadMask = chunk.roadMasks?.[index] || 0;
              if (roadMask === 15) {
                const flipX = surfaceDetail & 1 ? -1 : 1;
                const flipY = surfaceDetail & 2 ? -1 : 1;
                ctx.save();
                ctx.translate(Math.round(x + tile / 2), Math.round(y + tile / 2));
                ctx.scale(flipX, flipY);
                this.atlas.draw(ctx, 'rotwood', rotwoodFrame('roads', roadMask), -tile / 2, -tile / 2);
                ctx.restore();
              } else this.atlas.draw(ctx, 'rotwood', rotwoodFrame('roads', roadMask), x, y);
              this.atlas.draw(ctx, 'rotwood', rotwoodFrame('details', 24 + ((surfaceDetail >>> 4) & 7)), x, y, tile, tile, 0.58);
            }
          } else {
            this.atlas.draw(ctx, 'ground', chunk.tiles[index] * 4 + variant, x, y);
            if (chunk.roads[index]) this.atlas.draw(ctx, 'roads', roadFrame(chunk, localX, localY), x, y);
          }
        }
      }
    }
    return { cameraX, cameraY };
  }

  drawStructures(ctx, chunks, cameraX, cameraY) {
    const unique = uniqueBuildings(chunks);
    for (const building of unique) {
      drawBuildingFloor(ctx, this.atlas, building, cameraX, cameraY);
      drawBuildingDetails(ctx, this.atlas, building, cameraX, cameraY);
    }
    return unique;
  }

  drawProps(ctx, chunks, cameraX, cameraY, isShortcutOpen = () => false) {
    for (const chunk of chunks) {
      for (const prop of chunk.props) {
        if (prop.theme === 'rotwood') {
          drawRotwoodProp(ctx, this.atlas, prop, cameraX, cameraY, isShortcutOpen(prop.id));
          continue;
        }
        const x = prop.x - cameraX - 16;
        const y = prop.y - cameraY - 26;
        const base = prop.kind === 'tree' ? 0 : prop.kind === 'rock' ? 1 : prop.kind === 'gate' ? 2 : 3;
        const open = prop.kind === 'gate' && isShortcutOpen(prop.id);
        this.atlas.draw(ctx, 'props', base + prop.variant * 4, x - (prop.kind === 'gate' ? 16 : 0), y, prop.kind === 'gate' ? 64 : 32, prop.kind === 'tree' ? 48 : 32, open ? 0.28 : 1);
      }
    }
  }

  drawRoofs(ctx, buildings, opacityById, cameraX, cameraY) {
    drawRoofs(ctx, this.atlas, buildings, opacityById, cameraX, cameraY);
  }
}

function placeTransitionMask(chunk, localX, localY) {
  const size = WORLD_CONFIG.chunkTiles;
  const at = (x, y) => x < 0 || y < 0 || x >= size || y >= size ? 1 : chunk.placeStyles[y * size + x];
  let mask = 0;
  if (!at(localX, localY - 1)) mask |= 1;
  if (!at(localX + 1, localY)) mask |= 2;
  if (!at(localX, localY + 1)) mask |= 4;
  if (!at(localX - 1, localY)) mask |= 8;
  return mask;
}

function drawRotwoodProp(ctx, atlas, prop, cameraX, cameraY, open) {
  const x = Math.round(prop.x - cameraX);
  const y = Math.round(prop.y - cameraY);
  const role = prop.role || (prop.kind === 'tree' ? 'small-tree' : prop.kind === 'rock' ? 'root-rock' : prop.kind === 'gate' ? 'gate' : 'shrine');
  const bases = {
    'elder-tree': 0,
    'root-cluster': 8,
    'fungus-cluster': 12,
    'lantern-post': 16,
    shrine: 20,
    'broken-cart': 28,
    well: 32,
    fence: 36,
    'small-tree': 40,
    'root-rock': 48,
    gate: 52
  };
  const local = bases[role] ?? 44;
  ctx.save();
  ctx.globalAlpha = open ? 0.3 : 0.6;
  ctx.fillStyle = '#050806';
  ctx.beginPath();
  ctx.ellipse(x + 7, y + 8, role === 'elder-tree' ? 30 : 18, role === 'elder-tree' ? 12 : 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (role === 'elder-tree' || role === 'shrine' || role === 'gate') {
    const base = rotwoodFrame('props', local + (prop.variant & 1) * 4);
    atlas.draw(ctx, 'rotwood', base, x - 32, y - 64);
    atlas.draw(ctx, 'rotwood', base + 1, x, y - 64);
    atlas.draw(ctx, 'rotwood', base + 2, x - 32, y - 32);
    atlas.draw(ctx, 'rotwood', base + 3, x, y - 32, 32, 32, open ? 0.28 : 1);
  } else {
    atlas.draw(ctx, 'rotwood', rotwoodFrame('props', local + (prop.variant & 3)), x - 16, y - 28, 32, 32, open ? 0.28 : 1);
  }
  if (role === 'lantern-post') {
    const glow = ctx.createRadialGradient(x, y - 22, 2, x, y - 22, 42);
    glow.addColorStop(0, 'rgba(255,220,135,.25)');
    glow.addColorStop(1, 'rgba(255,195,95,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 42, y - 64, 84, 84);
  }
}

function uniqueBuildings(chunks) {
  const map = new Map();
  for (const chunk of chunks) for (const building of chunk.buildings) map.set(building.id, building);
  return [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function roadFrame(chunk, localX, localY) {
  const size = WORLD_CONFIG.chunkTiles;
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return 1;
    return chunk.roads[y * size + x];
  };
  const north = at(localX, localY - 1);
  const south = at(localX, localY + 1);
  const west = at(localX - 1, localY);
  const east = at(localX + 1, localY);
  if ((north || south) && (west || east)) return 2;
  return north || south ? 0 : 1;
}
