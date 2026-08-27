import { WORLD_CONFIG } from '../world/world-config.js';
import { rotwoodFrame } from '../art/rotwood-kit.js';

export function drawBuildingFloor(ctx, atlas, building, cameraX, cameraY) {
  if (building.theme === 'rotwood') return drawRotwoodBuildingFloor(ctx, atlas, building, cameraX, cameraY);
  const tile = WORLD_CONFIG.tileSize;
  const startX = building.x * tile - cameraX;
  const startY = building.y * tile - cameraY;
  for (let y = 0; y < building.height; y += 1) {
    for (let x = 0; x < building.width; x += 1) {
      const edge = x === 0 || y === 0 || x === building.width - 1 || y === building.height - 1;
      const atlasName = edge ? 'buildings' : 'interiors';
      const frame = building.style * 4 + ((x + y) & 3);
      atlas.draw(ctx, atlasName, frame, startX + x * tile, startY + y * tile);
    }
  }
}

export function drawBuildingDetails(ctx, atlas, building, cameraX, cameraY) {
  if (building.theme === 'rotwood') return drawRotwoodBuildingDetails(ctx, atlas, building, cameraX, cameraY);
  const tile = WORLD_CONFIG.tileSize;
  const x = building.x * tile - cameraX;
  const y = building.y * tile - cameraY;
  const width = building.width * tile;
  const height = building.height * tile;
  const doorX = x + width / 2;
  const doorY = y + height / 2;
  ctx.fillStyle = '#100d0d';
  if (building.facing === 'south') ctx.fillRect(doorX - 17, y + height - 9, 34, 9);
  if (building.facing === 'north') ctx.fillRect(doorX - 17, y, 34, 9);
  if (building.facing === 'west') ctx.fillRect(x, doorY - 17, 9, 34);
  if (building.facing === 'east') ctx.fillRect(x + width - 9, doorY - 17, 9, 34);
  if (!building.damaged) atlas.draw(ctx, 'props', 18, x + width * 0.22, y + height * 0.22, 32, 32);
}

function drawRotwoodBuildingFloor(ctx, atlas, building, cameraX, cameraY) {
  const tile = WORLD_CONFIG.tileSize;
  const startX = building.x * tile - cameraX;
  const startY = building.y * tile - cameraY;
  const width = building.width * tile;
  const height = building.height * tile;
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,4,.62)';
  ctx.beginPath();
  ctx.moveTo(startX + 14, startY + 14);
  ctx.lineTo(startX + width + 18, startY + 22);
  ctx.lineTo(startX + width + 24, startY + height + 22);
  ctx.lineTo(startX + 18, startY + height + 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (let y = 0; y < building.height; y += 1) {
    for (let x = 0; x < building.width; x += 1) {
      const north = y === 0 ? 1 : 0;
      const east = x === building.width - 1 ? 2 : 0;
      const south = y === building.height - 1 ? 4 : 0;
      const west = x === 0 ? 8 : 0;
      const edgeMask = north | east | south | west;
      const px = startX + x * tile;
      const py = startY + y * tile;
      const variant = (building.materialVariant + x * 3 + y * 5) & 15;
      atlas.draw(ctx, 'rotwood', rotwoodFrame('floors', variant), px, py);
      if (edgeMask) atlas.draw(ctx, 'rotwood', rotwoodFrame('foundations', edgeMask), px, py);
    }
  }
}

function drawRotwoodBuildingDetails(ctx, atlas, building, cameraX, cameraY) {
  const tile = WORLD_CONFIG.tileSize;
  const startX = building.x * tile - cameraX;
  const startY = building.y * tile - cameraY;
  const width = building.width * tile;
  const height = building.height * tile;
  for (let y = 0; y < building.height; y += 1) {
    for (let x = 0; x < building.width; x += 1) {
      const north = y === 0 ? 1 : 0;
      const east = x === building.width - 1 ? 2 : 0;
      const south = y === building.height - 1 ? 4 : 0;
      const west = x === 0 ? 8 : 0;
      const edgeMask = north | east | south | west;
      if (!edgeMask) continue;
      atlas.draw(ctx, 'rotwood', rotwoodFrame('walls', edgeMask), startX + x * tile, startY + y * tile);
    }
  }
  const doorFrame = rotwoodFrame('details', building.damaged ? 5 : 4);
  const windowFrame = rotwoodFrame('details', 6 + building.materialVariant % 2);
  if (building.facing === 'south' || building.facing === 'north') {
    const doorX = startX + width / 2 - 16;
    const doorY = building.facing === 'south' ? startY + height - 32 : startY;
    atlas.draw(ctx, 'rotwood', doorFrame, doorX, doorY);
    atlas.draw(ctx, 'rotwood', windowFrame, startX + 32, doorY);
    atlas.draw(ctx, 'rotwood', windowFrame, startX + width - 64, doorY);
  } else {
    const doorX = building.facing === 'east' ? startX + width - 32 : startX;
    const doorY = startY + height / 2 - 16;
    atlas.draw(ctx, 'rotwood', doorFrame, doorX, doorY);
    atlas.draw(ctx, 'rotwood', windowFrame, doorX, startY + 32);
    atlas.draw(ctx, 'rotwood', windowFrame, doorX, startY + height - 64);
  }
  const furnitureFrame = rotwoodFrame('props', building.archetype === 'fungal-workshop' ? 38 : building.archetype === 'thorn-chapel' ? 39 : 37);
  atlas.draw(ctx, 'rotwood', furnitureFrame, startX + width * 0.24, startY + height * 0.24, 48, 48, building.damaged ? 0.65 : 1);
}
