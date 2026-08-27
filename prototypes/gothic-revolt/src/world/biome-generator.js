import { coordinateValue } from '../simulation/seeded-random.js';
import { REGION_DEFINITIONS, WORLD_CONFIG } from './world-config.js';

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(worldSeed, stream, x, y, scale) {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = smooth(sx - x0);
  const ty = smooth(sy - y0);
  const a = coordinateValue(worldSeed, stream, x0, y0);
  const b = coordinateValue(worldSeed, stream, x0 + 1, y0);
  const c = coordinateValue(worldSeed, stream, x0, y0 + 1);
  const d = coordinateValue(worldSeed, stream, x0 + 1, y0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export function sampleWorldFields(globalTileX, globalTileY, worldSeed = WORLD_CONFIG.seed) {
  const distance = Math.hypot(globalTileX, globalTileY);
  const elevation = valueNoise(worldSeed, 'elevation', globalTileX, globalTileY, 90);
  const moisture = valueNoise(worldSeed, 'moisture', globalTileX, globalTileY, 110);
  const corruption = Math.min(1, distance / 920 + valueNoise(worldSeed, 'corruption', globalTileX, globalTileY, 150) * 0.42);
  let regionIndex = 0;
  if (distance > 72) regionIndex = Math.min(5, Math.floor((corruption * 4.4 + moisture * 1.3 + elevation * 0.7) % 6));
  return { elevation, moisture, corruption, region: REGION_DEFINITIONS[regionIndex] };
}
