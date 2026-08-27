import { createRandom, streamSeed } from '../simulation/seeded-random.js';
import { buildingVisualSpec, createPlacePlan } from './place-factory.js';
import { nearestTown, roadAt, townAnchor } from './road-generator.js';
import { WORLD_CONFIG } from './world-config.js';

const LOTS = Object.freeze([
  [-19, -9], [-10, -9], [5, -9], [15, -9],
  [-20, 4], [-10, 4], [5, 4], [15, 4],
  [-30, 8], [26, 8]
]);
const TOWN_CACHE = new Map();
const TOWN_CACHE_LIMIT = 256;

export function createTown(macroX, macroY, worldSeed = WORLD_CONFIG.seed) {
  const cacheKey = `${worldSeed}:${macroX}:${macroY}`;
  const cached = TOWN_CACHE.get(cacheKey);
  if (cached) {
    TOWN_CACHE.delete(cacheKey);
    TOWN_CACHE.set(cacheKey, cached);
    return cached;
  }
  const anchor = townAnchor(macroX, macroY, worldSeed);
  const random = createRandom(streamSeed(worldSeed, 'town', macroX, macroY));
  const states = ['friendly', 'abandoned', 'occupied', 'corrupted', 'besieged'];
  const state = anchor.central ? 'friendly' : states[Math.floor(random() * states.length)];
  const place = createPlacePlan(macroX, macroY, anchor, state, worldSeed);
  const buildings = LOTS.map(([offsetX, offsetY], index) => {
    const width = 6 + Math.floor(random() * 3);
    const height = 5 + Math.floor(random() * 2);
    const facing = offsetY < 0 ? 'south' : offsetY > 5 ? 'north' : offsetX < 0 ? 'east' : 'west';
    let x = anchor.x + offsetX;
    let y = anchor.y + offsetY;
    const shiftX = Math.sign(offsetX) || 1;
    const shiftY = Math.sign(offsetY) || 1;
    const overlapsRoad = () => {
      for (let tileY = y; tileY < y + height; tileY += 1) {
        for (let tileX = x; tileX < x + width; tileX += 1) if (roadAt(tileX, tileY, worldSeed)) return true;
      }
      return false;
    };
    for (let attempt = 0; attempt < 32 && overlapsRoad(); attempt += 1) {
      x += shiftX;
      y += shiftY;
    }
    return {
      id: `building:${macroX}:${macroY}:${index}`,
      x,
      y,
      width,
      height,
      facing,
      style: streamSeed(worldSeed, 'building-style', macroX, macroY, index) % 5,
      damaged: streamSeed(worldSeed, 'building-damage', macroX, macroY, index) % 5 === 0,
      townId: `town:${macroX}:${macroY}`,
      ...buildingVisualSpec(place, macroX, macroY, index, worldSeed)
    };
  });
  const town = {
    id: `town:${macroX}:${macroY}`,
    macroX,
    macroY,
    x: anchor.x,
    y: anchor.y,
    name: anchor.central ? 'Revolt Sanctuary' : townName(macroX, macroY, worldSeed),
    state,
    central: anchor.central,
    theme: place.theme,
    place,
    buildings
  };
  TOWN_CACHE.set(cacheKey, town);
  if (TOWN_CACHE.size > TOWN_CACHE_LIMIT) TOWN_CACHE.delete(TOWN_CACHE.keys().next().value);
  return town;
}

function townName(macroX, macroY, worldSeed) {
  const first = ['Ash', 'Briar', 'Crow', 'Dread', 'Gallow', 'Mire', 'Thorn', 'Witch'];
  const last = ['bridge', 'cross', 'fen', 'gate', 'hollow', 'march', 'rest', 'wick'];
  return `${first[streamSeed(worldSeed, 'town-name-a', macroX, macroY) % first.length]}${last[streamSeed(worldSeed, 'town-name-b', macroX, macroY) % last.length]}`;
}

export function buildingsForBounds(minTileX, minTileY, maxTileX, maxTileY, worldSeed = WORLD_CONFIG.seed) {
  const macroTiles = WORLD_CONFIG.macroChunks * WORLD_CONFIG.chunkTiles;
  const minMacroX = Math.floor((minTileX - 40) / macroTiles);
  const maxMacroX = Math.floor((maxTileX + 40) / macroTiles);
  const minMacroY = Math.floor((minTileY - 40) / macroTiles);
  const maxMacroY = Math.floor((maxTileY + 40) / macroTiles);
  const result = [];
  for (let macroY = minMacroY; macroY <= maxMacroY; macroY += 1) {
    for (let macroX = minMacroX; macroX <= maxMacroX; macroX += 1) {
      const town = createTown(macroX, macroY, worldSeed);
      for (const building of town.buildings) {
        if (building.x + building.width >= minTileX && building.x <= maxTileX && building.y + building.height >= minTileY && building.y <= maxTileY) {
          result.push({ ...building, town });
        }
      }
    }
  }
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildingAtWorld(pixelX, pixelY, worldSeed = WORLD_CONFIG.seed) {
  const tileX = pixelX / WORLD_CONFIG.tileSize;
  const tileY = pixelY / WORLD_CONFIG.tileSize;
  const town = nearestTown(tileX, tileY, worldSeed);
  if (!town || town.distance > 60) return null;
  const generated = createTown(town.macroX, town.macroY, worldSeed);
  return generated.buildings.find((building) => (
    tileX > building.x + 0.22 && tileX < building.x + building.width - 0.22
    && tileY > building.y + 0.22 && tileY < building.y + building.height - 0.22
  )) || null;
}

export function buildingColliders(building) {
  const tile = WORLD_CONFIG.tileSize;
  const x = building.x * tile;
  const y = building.y * tile;
  const width = building.width * tile;
  const height = building.height * tile;
  const wall = 9;
  const door = 34;
  const result = [];
  const push = (suffix, left, top, w, h) => result.push({ id: `${building.id}:${suffix}`, x: left, y: top, width: w, height: h, kind: 'wall' });

  if (building.facing === 'south' || building.facing === 'north') {
    const doorX = x + width / 2;
    push('left', x, y, wall, height);
    push('right', x + width - wall, y, wall, height);
    const wallY = building.facing === 'north' ? y : y + height - wall;
    const oppositeY = building.facing === 'north' ? y + height - wall : y;
    push('door-a', x, wallY, doorX - door / 2 - x, wall);
    push('door-b', doorX + door / 2, wallY, x + width - (doorX + door / 2), wall);
    push('opposite', x, oppositeY, width, wall);
  } else {
    const doorY = y + height / 2;
    push('top', x, y, width, wall);
    push('bottom', x, y + height - wall, width, wall);
    const wallX = building.facing === 'west' ? x : x + width - wall;
    const oppositeX = building.facing === 'west' ? x + width - wall : x;
    push('door-a', wallX, y, wall, doorY - door / 2 - y);
    push('door-b', wallX, doorY + door / 2, wall, y + height - (doorY + door / 2));
    push('opposite', oppositeX, y, wall, height);
  }

  if (!building.damaged) {
    push('furniture', x + width * 0.22, y + height * 0.22, Math.min(42, width * 0.22), 22);
  }
  return result.filter((entry) => entry.width > 0 && entry.height > 0);
}
