import { hash32, streamSeed } from '../simulation/seeded-random.js';
import { sampleWorldFields } from './biome-generator.js';
import { composeBiomeTile } from './biome-composer.js';
import { buildingsForBounds } from './building-generator.js';
import { buildEntrancePathSet, connectivityMask } from './path-factory.js';
import { placeProps } from './place-factory.js';
import { roadAt, nearestTown } from './road-generator.js';
import { WORLD_CONFIG, chunkKey } from './world-config.js';

export function generateChunk(chunkX, chunkY, worldSeed = WORLD_CONFIG.seed) {
  const size = WORLD_CONFIG.chunkTiles;
  const startX = chunkX * size;
  const startY = chunkY * size;
  const tiles = new Uint8Array(size * size);
  const roads = new Uint8Array(size * size);
  const roadMasks = new Uint8Array(size * size);
  const placeStyles = new Uint8Array(size * size);
  const props = [];
  const regionCounts = new Map();
  const pathBuildings = buildingsForBounds(startX - 48, startY - 48, startX + size + 47, startY + size + 47, worldSeed);
  const buildings = pathBuildings.filter((building) => (
    building.x + building.width >= startX && building.x <= startX + size - 1
    && building.y + building.height >= startY && building.y <= startY + size - 1
  ));
  const nearbyTowns = [...new Map(pathBuildings.map((building) => [building.town.id, building.town])).values()];
  const entrancePaths = buildEntrancePathSet(pathBuildings, startX - 1, startY - 1, startX + size, startY + size);
  const pathCache = new Map();
  const pathAt = (globalX, globalY) => {
    const key = `${globalX},${globalY}`;
    if (pathCache.has(key)) return pathCache.get(key);
    const value = roadAt(globalX, globalY, worldSeed) || entrancePaths.has(`${globalX},${globalY}`);
    pathCache.set(key, value);
    return value;
  };

  for (let localY = 0; localY < size; localY += 1) {
    for (let localX = 0; localX < size; localX += 1) {
      const globalX = startX + localX;
      const globalY = startY + localY;
      const index = localY * size + localX;
      const fields = sampleWorldFields(globalX, globalY, worldSeed);
      const composition = composeBiomeTile(globalX, globalY, fields, nearbyTowns);
      const road = pathAt(globalX, globalY);
      tiles[index] = composition.groundIndex;
      roads[index] = road ? 1 : 0;
      placeStyles[index] = composition.placeStyle;
      regionCounts.set(composition.regionId, (regionCounts.get(composition.regionId) || 0) + 1);
      const propRoll = streamSeed(worldSeed, 'prop', globalX, globalY) % 101;
      const shortcut = road && ((globalX === 52 && globalY === 18) || streamSeed(worldSeed, 'shortcut', globalX, globalY) % 997 === 0);
      if (shortcut) {
        props.push({
          id: `shortcut:${globalX}:${globalY}`,
          x: globalX * WORLD_CONFIG.tileSize + 16,
          y: globalY * WORLD_CONFIG.tileSize + 16,
          kind: 'gate',
          solid: true,
          theme: composition.placeStyle === 1 ? 'rotwood' : null,
          variant: streamSeed(worldSeed, 'shortcut-variant', globalX, globalY) % 4
        });
      }
      if (!road && propRoll < 4 && Math.hypot(globalX, globalY) > 7) {
        props.push({
          id: `prop:${globalX}:${globalY}`,
          x: globalX * WORLD_CONFIG.tileSize + 16,
          y: globalY * WORLD_CONFIG.tileSize + 18,
          kind: propRoll === 0 ? 'shrine' : propRoll === 1 ? 'rock' : 'tree',
          solid: propRoll !== 0,
          theme: composition.placeStyle === 1 ? 'rotwood' : null,
          variant: streamSeed(worldSeed, 'prop-variant', globalX, globalY) % 8
        });
      }
    }
  }

  for (let localY = 0; localY < size; localY += 1) {
    for (let localX = 0; localX < size; localX += 1) {
      const globalX = startX + localX;
      const globalY = startY + localY;
      roadMasks[localY * size + localX] = roads[localY * size + localX] ? connectivityMask(globalX, globalY, pathAt) : 0;
    }
  }

  for (const town of nearbyTowns) {
    for (const source of placeProps(town.place, town.macroX, town.macroY, worldSeed)) {
      if (source.tileX < startX || source.tileX >= startX + size || source.tileY < startY || source.tileY >= startY + size) continue;
      if (source.solid && pathAt(source.tileX, source.tileY)) continue;
      props.push({
        ...source,
        x: source.tileX * WORLD_CONFIG.tileSize + 16,
        y: source.tileY * WORLD_CONFIG.tileSize + 18
      });
    }
  }

  const clearedProps = [...new Map(props.map((prop) => [prop.id, prop])).values()].filter((prop) => {
    if (prop.kind === 'gate') return true;
    const tileX = prop.x / WORLD_CONFIG.tileSize;
    const tileY = prop.y / WORLD_CONFIG.tileSize;
    return !buildings.some((building) => (
      tileX >= building.x - 1 && tileX <= building.x + building.width + 1
      && tileY >= building.y - 1 && tileY <= building.y + building.height + 2
    ));
  });
  const town = nearestTown(startX + size / 2, startY + size / 2, worldSeed);
  const regionId = [...regionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const chunk = {
    key: chunkKey(chunkX, chunkY),
    x: chunkX,
    y: chunkY,
    seed: streamSeed(worldSeed, 'chunk', chunkX, chunkY, WORLD_CONFIG.generatorVersion),
    regionId,
    town: town?.distance < 52 ? { id: `town:${town.macroX}:${town.macroY}`, x: town.x, y: town.y } : null,
    tiles,
    roads,
    roadMasks,
    placeStyles,
    props: clearedProps,
    buildings
  };
  chunk.signature = chunkSignature(chunk);
  return chunk;
}

export function chunkSignature(chunk) {
  return hash32(JSON.stringify({
    x: chunk.x,
    y: chunk.y,
    seed: chunk.seed,
    regionId: chunk.regionId,
    tiles: [...chunk.tiles],
    roads: [...chunk.roads],
    roadMasks: [...chunk.roadMasks],
    placeStyles: [...chunk.placeStyles],
    props: chunk.props.map(({ id, kind, role, theme, variant }) => [id, kind, role, theme, variant]),
    buildings: chunk.buildings.map(({ id, x, y, width, height, facing, style, theme, archetype, roofVariant }) => [id, x, y, width, height, facing, style, theme, archetype, roofVariant])
  })).toString(16).padStart(8, '0');
}
