import { WORLD_CONFIG } from '../world/world-config.js';
import { rotwoodFrame } from '../art/rotwood-kit.js';

export function updateRoofOpacity(buildings, activeBuildingId, opacityById, dt) {
  const alive = new Set();
  for (const building of buildings) {
    alive.add(building.id);
    const target = building.id === activeBuildingId ? 0.08 : 1;
    const current = opacityById.get(building.id) ?? 1;
    const next = current + (target - current) * Math.min(1, dt * 9);
    opacityById.set(building.id, next);
  }
  for (const id of opacityById.keys()) if (!alive.has(id)) opacityById.delete(id);
}

export function drawRoofs(ctx, atlas, buildings, opacityById, cameraX, cameraY) {
  const tile = WORLD_CONFIG.tileSize;
  for (const building of buildings.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (building.theme === 'rotwood') {
      drawRotwoodRoof(ctx, atlas, building, opacityById, cameraX, cameraY);
      continue;
    }
    const opacity = opacityById.get(building.id) ?? 1;
    const startX = building.x * tile - cameraX;
    const startY = building.y * tile - cameraY - 5;
    const width = building.width * tile;
    const height = building.height * tile + 6;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.fillRect(Math.round(startX + 8), Math.round(startY + 12), Math.round(width), Math.round(height));
    ctx.beginPath();
    ctx.moveTo(startX + 10, startY);
    ctx.lineTo(startX + width - 10, startY);
    ctx.lineTo(startX + width, startY + 10);
    ctx.lineTo(startX + width, startY + height - 10);
    ctx.lineTo(startX + width - 10, startY + height);
    ctx.lineTo(startX + 10, startY + height);
    ctx.lineTo(startX, startY + height - 10);
    ctx.lineTo(startX, startY + 10);
    ctx.closePath();
    ctx.clip();
    for (let y = 0; y < building.height; y += 1) {
      for (let x = 0; x < building.width; x += 1) {
        const frame = building.style * 4 + ((x + y) & 3);
        atlas.draw(ctx, 'roofs', frame, startX + x * tile, startY + y * tile, tile, tile + 6, opacity);
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = '#120f12';
    ctx.lineWidth = 5;
    ctx.strokeRect(Math.round(startX + 3), Math.round(startY + 3), Math.round(width - 6), Math.round(height - 6));
    ctx.strokeStyle = '#81605a';
    ctx.lineWidth = 2;
    if (building.facing === 'north' || building.facing === 'south') {
      ctx.beginPath();ctx.moveTo(startX + width / 2, startY + 5);ctx.lineTo(startX + width / 2, startY + height - 5);ctx.stroke();
    } else {
      ctx.beginPath();ctx.moveTo(startX + 5, startY + height / 2);ctx.lineTo(startX + width - 5, startY + height / 2);ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRotwoodRoof(ctx, atlas, building, opacityById, cameraX, cameraY) {
  const tile = WORLD_CONFIG.tileSize;
  const opacity = opacityById.get(building.id) ?? 1;
  const startX = building.x * tile - cameraX - 9;
  const startY = building.y * tile - cameraY - 17;
  const width = building.width * tile + 18;
  const height = building.height * tile + 25;
  const chapel = building.archetype === 'thorn-chapel';
  const workshop = building.archetype === 'fungal-workshop';
  ctx.save();
  ctx.globalAlpha = opacity * 0.72;
  ctx.fillStyle = '#050706';
  ctx.beginPath();
  ctx.moveTo(startX + 24, startY + 22);
  ctx.lineTo(startX + width + 22, startY + 32);
  ctx.lineTo(startX + width + 28, startY + height + 25);
  ctx.lineTo(startX + 28, startY + height + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  if (chapel) {
    ctx.moveTo(startX + width / 2, startY - 12);
    ctx.lineTo(startX + width, startY + 20);
    ctx.lineTo(startX + width - 3, startY + height - 10);
    ctx.lineTo(startX + width - 18, startY + height);
    ctx.lineTo(startX + 18, startY + height);
    ctx.lineTo(startX + 3, startY + height - 10);
    ctx.lineTo(startX, startY + 20);
  } else if (workshop) {
    ctx.moveTo(startX + 14, startY);
    ctx.lineTo(startX + width - 54, startY);
    ctx.lineTo(startX + width - 54, startY + 30);
    ctx.lineTo(startX + width, startY + 30);
    ctx.lineTo(startX + width - 8, startY + height - 12);
    ctx.lineTo(startX + width - 18, startY + height);
    ctx.lineTo(startX + 18, startY + height);
    ctx.lineTo(startX, startY + height - 16);
    ctx.lineTo(startX, startY + 14);
  } else {
    ctx.moveTo(startX + 14, startY);
    ctx.lineTo(startX + width - 14, startY);
    ctx.lineTo(startX + width, startY + 14);
    ctx.lineTo(startX + width - (workshop ? 8 : 0), startY + height - 12);
    ctx.lineTo(startX + width - 18, startY + height);
    ctx.lineTo(startX + 18, startY + height);
    ctx.lineTo(startX, startY + height - 16);
    ctx.lineTo(startX, startY + 14);
  }
  ctx.closePath();
  ctx.clip();
  const columns = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const familyStart = building.archetype === 'fungal-workshop' ? 8 : building.archetype === 'thorn-chapel' ? 16 : 0;
      const local = familyStart + ((building.roofVariant + x + y * 3) & 7);
      atlas.draw(ctx, 'rotwood', rotwoodFrame('roofs', local), startX + x * tile, startY + y * tile, tile, tile, opacity);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = '#151015';
  ctx.lineWidth = 6;
  ctx.strokeRect(Math.round(startX + 5), Math.round(startY + 8), Math.round(width - 10), Math.round(height - 14));
  ctx.strokeStyle = '#8f6a77';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (building.facing === 'north' || building.facing === 'south') {
    ctx.moveTo(startX + width / 2, startY + 3);
    ctx.lineTo(startX + width / 2, startY + height - 6);
  } else {
    ctx.moveTo(startX + 5, startY + height / 2);
    ctx.lineTo(startX + width - 5, startY + height / 2);
  }
  ctx.stroke();
  if (building.corruption > 0) {
    for (let index = 0; index < building.corruption + 1; index += 1) {
      atlas.draw(ctx, 'rotwood', rotwoodFrame('details', 12 + index), startX + 20 + index * 37, startY + 18 + (index & 1) * 28, tile, tile, opacity);
    }
  }
  if (!building.damaged) atlas.draw(ctx, 'rotwood', rotwoodFrame('details', 2), startX + width * 0.68, startY - 4, 40, 48, opacity);
  ctx.restore();
}
